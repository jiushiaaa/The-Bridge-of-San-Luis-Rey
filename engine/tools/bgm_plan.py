#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bgm_plan.py — 按关统计 BGM 设计目标与现状（doc/14-bgm-pipeline.md）

用法: python tools/bgm_plan.py [xdd|bad|murder|weicheng] [--json]

输出每关：
  情节卡总字数（口径 = validate_data.card_text_len，词条标签按显示名计）
  应有曲数 = max(round(字数 / BGM_CHARS_PER_TRACK), BGM_MIN_PER_LEVEL)，**含**本关开篇曲
  现有曲数 / 是否有开篇曲 / 卡曲绑在哪些 row（用于看分布是否均匀）
以及封面曲、结局曲有无、缺 prompt 的曲目。
设计前先跑一次看目标，写完 assets.bgm 再跑一次自检；同一公式也在 validate_data.check_bgm 里强制。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

GAMES = {"xdd": "xidaduo", "bad": "badblood", "murder": "murder", "weicheng": "WeiCheng_QianZhongShu"}

BGM_CHARS_PER_TRACK = 1500  # 每 1500 字正文配 1 首
BGM_MIN_PER_LEVEL = 2       # 每关至少 2 首（开篇曲 + 至少 1 首卡曲）

TAG_STRIP_RE = re.compile(r"\{\{e_[a-z0-9_]+\|([^}]*)\}\}")


def card_text_len(card: dict) -> int:
    return sum(len(TAG_STRIP_RE.sub(lambda m: m.group(1), s["text"])) for s in card["segments"])


def required_tracks(chars: int) -> int:
    return max(round(chars / BGM_CHARS_PER_TRACK), BGM_MIN_PER_LEVEL)


def game_levels(g: dict) -> list:
    lv = {int(k) for k in g.get("timelines", {})}
    lv |= {int(c["level"]) for c in g.get("cards", [])}
    lv |= {int(x["after"]) for x in g.get("gates", [])}
    return sorted(lv)


def plan(g: dict) -> dict:
    """返回 {levels: {lv: {...}}, title: bool, ending: bool, missingPrompt: [id]}"""
    bgm = g["assets"].get("bgm") or []
    cards = {c["id"]: c for c in g["cards"]}
    out = {"levels": {}, "title": False, "ending": False, "missingPrompt": []}
    for t in bgm:
        if t.get("stage") == "title":
            out["title"] = True
        elif t.get("stage") == "ending":
            out["ending"] = True
        if not (t.get("prompt") or "").strip():
            out["missingPrompt"].append(t.get("id"))
    for lv in game_levels(g):
        lv_cards = [c for c in g["cards"] if c["level"] == lv]
        chars = sum(card_text_len(c) for c in lv_cards)
        tracks = [t for t in bgm if t.get("stage") == lv]
        intro = [t for t in tracks if not t.get("unlockCard")]
        card_tracks = [t for t in tracks if t.get("unlockCard")]
        rows = []
        for t in card_tracks:
            c = cards.get(t["unlockCard"])
            rows.append((c["row"] if c else -1, t["unlockCard"], t.get("id")))
        rows.sort()
        out["levels"][lv] = {
            "chars": chars,
            "cards": len(lv_cards),
            "required": required_tracks(chars),
            "have": len(tracks),
            "intro": len(intro),
            "rows": rows,
            "rowCount": len(g["timelines"].get(str(lv), {}).get("rows", [])),
        }
    return out


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    game = args[0] if args else "xdd"
    if game not in GAMES:
        sys.exit(f"未知游戏 {game}，可选：{' | '.join(GAMES)}")
    data = ROOT / "workspace" / GAMES[game] / "final_game.json"
    g = json.loads(data.read_text(encoding="utf-8"))
    p = plan(g)
    if "--json" in sys.argv:
        print(json.dumps(p, ensure_ascii=False, indent=2))
        return
    print(f"BGM 规划: {game}（{data.relative_to(ROOT)}）  公式: max(round(字数/{BGM_CHARS_PER_TRACK}), {BGM_MIN_PER_LEVEL})，含开篇曲")
    print(f"封面曲: {'有' if p['title'] else '缺'}   结局曲: {'有' if p['ending'] else '缺'}")
    total_req = total_have = 0
    for lv, x in p["levels"].items():
        total_req += x["required"]
        total_have += x["have"]
        flag = "OK " if x["have"] >= x["required"] and x["intro"] == 1 else "!! "
        print(f"{flag}第{lv}关  {x['cards']} 卡 / {x['chars']} 字 → 应有 {x['required']} 首，现有 {x['have']} 首"
              f"（开篇曲 {x['intro']} 首，卡曲 {len(x['rows'])} 首，时间轴 {x['rowCount']} 行）")
        for row, cid, tid in x["rows"]:
            print(f"      row {row:>2}  {cid:<8} → {tid}")
    print(f"合计 应有 {total_req} + 封面 1 + 结局 1 = {total_req + 2} 首；现有 {total_have + int(p['title']) + int(p['ending'])} 首")
    if p["missingPrompt"]:
        print(f"缺 prompt 的曲目: {', '.join(str(x) for x in p['missingPrompt'])}")


if __name__ == "__main__":
    main()
