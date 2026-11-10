#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
init_recaps.py — 为【回顾本关故事】生成分页骨架（写作任务书）
用法: python tools/init_recaps.py [xdd|bad|murder|weicheng|all]（默认 all）

产出 workspace/{作品}/DEBUG/recaps.json：每关按 int(行数×0.5+0.5) 切成连续行区间，
每页算好覆盖卡、覆盖卡总字数与 10~20% 的目标字数区间，并附卡片摘要供撰稿参考。
`_meta` 是给写作者看的辅助信息，tools/apply_recaps.py 合并进 final_game.json 时会丢弃。

已存在的 recaps.json 默认不覆盖（保住已写好的文章）；加 --force 重建骨架。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from art_spec import GAMES, game_root, load_game  # noqa: E402

TAG_STRIP_RE = re.compile(r"\{\{e_[a-z0-9_]+\|([^}]*)\}\}")
SHARE = (0.10, 0.20)


def page_count(rows: int) -> int:
    return max(1, min(rows - 1, int(rows * 0.5 + 0.5)))


def row_groups(rows: int) -> list:
    """把行下标切成 page_count(rows) 段连续区间（前面的区间优先多一行）。"""
    n = page_count(rows)
    base, extra = divmod(rows, n)
    out, r = [], 0
    for i in range(n):
        size = base + (1 if i < extra else 0)
        out.append(list(range(r, r + size)))
        r += size
    return out


def recap_len(text: str) -> int:
    """回顾字数口径：去标记、去全部空白后的字符数（与 validate_data.recap_len、前端 textLen 一致）。"""
    return len(re.sub(r"\s", "", TAG_STRIP_RE.sub(lambda m: m.group(1), text)))


def card_len(card: dict) -> int:
    return sum(recap_len(s["text"]) for s in card["segments"])


def build(game: str, force: bool) -> None:
    g = load_game(game)
    out_file = game_root(game) / "DEBUG" / "recaps.json"
    existing = {}
    if out_file.exists() and not force:
        existing = json.loads(out_file.read_text(encoding="utf-8"))

    result = {}
    for key, tl in sorted(g["timelines"].items(), key=lambda kv: int(kv[0])):
        lv = int(key)
        rows = tl["rows"]
        cols = tl["cols"]
        cards = [c for c in g["cards"] if c["level"] == lv]
        pages = []
        for grp in row_groups(len(rows)):
            in_rows = sorted(
                (c for c in cards if c["row"] in grp),
                key=lambda c: (c["row"], cols.index(c["col"]) if c["col"] in cols else 0),
            )
            base = sum(card_len(c) for c in in_rows)
            pages.append({
                "rows": grp,
                "title": "",
                "cards": [c["id"] for c in in_rows],
                "segments": [],
                "_meta": {
                    "rowNames": [rows[r] for r in grp],
                    "baseChars": base,
                    "targetChars": [int(base * SHARE[0]), int(base * SHARE[1])],
                    "cards": [
                        {
                            "id": c["id"],
                            "title": c["title"],
                            "form": c["form"],
                            "col": "情节" if c["col"] == cols[0] else c["col"],
                            "row": rows[c["row"]],
                            "chars": card_len(c),
                        }
                        for c in in_rows
                    ],
                },
            })
        # 已写好的页保留（按页序对齐），只刷新 _meta 与覆盖卡
        old_pages = (existing.get(key) or {}).get("pages") or []
        for i, p in enumerate(pages):
            if i < len(old_pages) and old_pages[i].get("segments"):
                p["title"] = old_pages[i].get("title", "")
                p["segments"] = old_pages[i]["segments"]
        result[key] = {"pages": pages}

    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total = sum(len(v["pages"]) for v in result.values())
    written = sum(1 for v in result.values() for p in v["pages"] if p["segments"])
    print(f"[{game}] {len(result)} 关 / {total} 页（已有正文 {written} 页）→ {out_file.relative_to(ROOT)}")


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    arg = args[0] if args else "all"
    targets = list(GAMES) if arg == "all" else [arg]
    for t in targets:
        if t not in GAMES:
            print(f"未知游戏 \"{t}\"，可选：{' | '.join(GAMES)} | all")
            return 1
    for t in targets:
        build(t, force)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
