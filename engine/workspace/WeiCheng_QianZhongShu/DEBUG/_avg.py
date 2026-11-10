# -*- coding: utf-8 -*-
"""列出全部卡字数（校验器口径），按降序，并给出为达标需削减的总量。"""
import json, io, sys, os, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
d = json.load(open(os.path.join(ROOT, "final_game.json"), encoding='utf-8'))
TAG = re.compile(r"\{\{([^|}]+)\|([^}]*)\}\}")

def clen(c):
    return sum(len(TAG.sub(lambda m: m.group(1), s["text"])) for s in c["segments"])

rows = [(clen(c), c["id"], c["len"], c["title"]) for c in d["cards"]]
rows.sort(reverse=True)
total = sum(r[0] for r in rows)
n = len(rows)
print(f"总字数 {total}，卡数 {n}，平均 {total//n}（目标 ≤756，即总量 ≤ {756*n}）")
print(f"需削减 {total - 756*n} 字")
print("\n降序（前 25 张）:")
for ln, cid, ln2, t in rows[:25]:
    print(f"  {ln}  {cid} [{ln2}] {t}")
