#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""临时探针：按词条 id 列出相关卡片正文。用法: python probe_cards.py e_fuisz [level]"""
import json
import re
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "final_game.json"
g = json.loads(DATA.read_text(encoding="utf-8"))
TAG = re.compile(r"\{\{([^|}]+)\|([^}]*)\}\}")
key = sys.argv[1]
lv = int(sys.argv[2]) if len(sys.argv) > 2 else None

for c in g["cards"]:
    if lv and c["level"] != lv:
        continue
    txt = "\n".join(s["text"] for s in c["segments"])
    ids = set(m.group(1) for m in TAG.finditer(txt))
    if key not in ids and not any(b["answer"] == key for b in c["blanks"]):
        continue
    print("=" * 70)
    print(c["id"], "| lv", c["level"], "| row", c["row"], "|", c["col"], "|", c["form"], c.get("difficulty"), c.get("len"))
    print("TITLE:", c.get("title"))
    print("BLANKS:", [(b["slot"], b["kind"], b["answer"]) for b in c["blanks"]])
    for s in c["segments"]:
        who = s.get("slot") or s.get("speakerEntry") or s.get("speaker") or ""
        print(f"  [{s['kind']}{'/' + who if who else ''}] {s['text']}")
