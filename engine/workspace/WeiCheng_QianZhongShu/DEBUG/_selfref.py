# -*- coding: utf-8 -*-
"""定位"自指卡"：一张卡的所有 chip 词条若都只在本卡首次出现（别处拿不到），则它永远无法被搜寻解锁。"""
import json, io, sys, os, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
d = json.load(open(os.path.join(ROOT, "final_game.json"), encoding='utf-8'))
entries = d["entries"]
cards = d["cards"]
TAG = re.compile(r"\{\{([^|}]+)\|([^}]*)\}\}")

# 每个词条在哪些卡被 chip
chip_in = {}
for c in cards:
    for s in c["segments"]:
        for m in TAG.finditer(s.get("text", "")):
            chip_in.setdefault(m.group(1), set()).add(c["id"])

start = set()
for lv, lst in d.get("levelStartEntries", {}).items():
    start.update(lst)

print("=== 自指卡（所有 chip 都只能在本地拿到）===")
for c in cards:
    chips = set()
    for s in c["segments"]:
        for m in TAG.finditer(s.get("text", "")):
            chips.add(m.group(1))
    # 该卡可"外部获得"的 chip：词条在别的卡也出现，或是起始词条
    external = [e for e in chips if (chip_in.get(e, set()) - {c["id"]}) or e in start]
    if not external:
        print(f"  {c['id']} [{c['col']}/r{c['row']}] {c['title']}  chips={sorted(chips)}")

print("\n=== 每关起始词条 ===")
for lv, lst in d.get("levelStartEntries", {}).items():
    print(f"  L{lv}: {[entries[e]['name'] for e in lst]}")
