#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""临时探针：按卡 id 打印正文。用法: python probe_byid.py c1_02 c2_01 ..."""
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "final_game.json"
g = json.loads(DATA.read_text(encoding="utf-8"))
want = set(sys.argv[1:])
for c in g["cards"]:
    if c["id"] not in want:
        continue
    print("=" * 70)
    print(c["id"], "|", c.get("title"), "| lv", c["level"], "r", c["row"], c["col"], c["form"])
    for s in c["segments"]:
        who = s.get("slot") or s.get("speakerEntry") or s.get("speaker") or ""
        print(f"  [{s['kind']}{'/' + who if who else ''}] {s['text']}")
