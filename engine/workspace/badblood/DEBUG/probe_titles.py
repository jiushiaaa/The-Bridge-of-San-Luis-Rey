#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""临时探针：列出全部卡片标题与所在行列，便于核对过场取材。"""
import json
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "final_game.json"
g = json.loads(DATA.read_text(encoding="utf-8"))
for lv in sorted(g["timelines"], key=int):
    tl = g["timelines"][lv]
    print("=" * 60, "\n第", lv, "关 rows:", tl["rows"])
    for c in sorted((c for c in g["cards"] if c["level"] == int(lv)), key=lambda c: (c["row"], c["col"])):
        print("  %-7s r%d %-6s %-8s %s" % (c["id"], c["row"], c["col"], c["form"], c.get("title")))
print("\nGATES")
for gt in g["gates"]:
    print(gt["after"], gt["title"])
    for b in gt["blanks"]:
        print("   ", b.get("text") or b.get("q") or b, "->", b.get("answerEntry") or b.get("answerTitle"))
