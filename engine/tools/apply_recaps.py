#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_recaps.py — 把 DEBUG/recaps.json 的回顾文章合并进 final_game.json
用法: python tools/apply_recaps.py [xdd|bad|murder|weicheng|all]（默认 all）

丢弃写作用的 `_meta`，只写 rows / title / cards / images / segments。
合并前逐页检查（字数占比、引语词条存在、行区间铺满全关），有问题只提示不阻断——
最终以 tools/validate_data.py 的 check_recap 为准。
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from art_spec import GAMES, game_root, load_game  # noqa: E402
from init_recaps import SHARE, card_len, page_count, recap_len  # noqa: E402


def apply(game: str) -> int:
    root = game_root(game)
    src = root / "DEBUG" / "recaps.json"
    if not src.exists():
        print(f"[{game}] 没有 DEBUG/recaps.json，跳过（先跑 tools/init_recaps.py）")
        return 0
    recaps = json.loads(src.read_text(encoding="utf-8"))
    g = load_game(game)
    cards = {c["id"]: c for c in g["cards"]}
    warns = []
    out = {}

    for key, rec in recaps.items():
        tl = g["timelines"].get(key)
        if not tl:
            warns.append(f"第{key}关不存在，已忽略")
            continue
        pages = []
        for i, p in enumerate(rec.get("pages", []), 1):
            segs = [s for s in p.get("segments", []) if (s.get("text") or "").strip()]
            if not segs:
                warns.append(f"第{key}关第{i}页还没有正文")
                continue
            for s in segs:
                if s.get("kind") == "quote" and s.get("entry") not in g["entries"]:
                    warns.append(f"第{key}关第{i}页引语指向不存在的词条 {s.get('entry')}")
            ids = [cid for cid in p.get("cards", []) if cid in cards]
            base = sum(card_len(cards[cid]) for cid in ids)
            words = sum(recap_len(s.get("text") or "") for s in segs)
            lo, hi = int(base * SHARE[0]), int(base * SHARE[1])
            if base > 0 and not (lo <= words <= hi):
                warns.append(f"第{key}关第{i}页 {words} 字，目标 [{lo},{hi}]")
            page = {
                "rows": p["rows"],
                "title": (p.get("title") or "").strip(),
                "cards": ids,
                "segments": [
                    {"kind": "quote", "entry": s["entry"], "text": s["text"].strip()}
                    if s.get("kind") == "quote"
                    else {"kind": "narration", "text": s["text"].strip()}
                    for s in segs
                ],
            }
            if p.get("images"):
                page["images"] = p["images"]
            pages.append(page)
        if not pages:
            continue
        want = page_count(len(tl["rows"]))
        if len(pages) != want:
            warns.append(f"第{key}关合并了 {len(pages)} 页，建议 {want} 页")
        seen = sorted(r for p in pages for r in p["rows"])
        if seen != list(range(len(tl["rows"]))):
            warns.append(f"第{key}关各页行区间没有铺满全关：{seen}")
        out[key] = {"pages": pages}

    if not out:
        print(f"[{game}] recaps.json 里还没有可合并的正文")
        for w in warns:
            print("  -", w)
        return 0

    data_file = root / "final_game.json"
    old = data_file.read_text(encoding="utf-8")
    indent = 1
    for line in old.split("\n"):
        st = line.lstrip(" ")
        if st.startswith('"') and line != st:
            indent = len(line) - len(st)
            break
    g["recaps"] = out
    data_file.write_text(
        json.dumps(g, ensure_ascii=False, indent=indent) + ("\n" if old.endswith("\n") else ""),
        encoding="utf-8",
    )
    n = sum(len(v["pages"]) for v in out.values())
    print(f"[{game}] 已合并 {len(out)} 关 / {n} 页 → {data_file.relative_to(ROOT)}")
    for w in warns:
        print("  提示:", w)
    return 0


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    arg = args[0] if args else "all"
    targets = list(GAMES) if arg == "all" else [arg]
    for t in targets:
        if t not in GAMES:
            print(f"未知游戏 \"{t}\"，可选：{' | '.join(GAMES)} | all")
            return 1
    for t in targets:
        apply(t)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
