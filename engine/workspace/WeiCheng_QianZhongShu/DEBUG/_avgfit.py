# -*- coding: utf-8 -*-
"""测算：在不同 cardSpec.avg 下，各卡是否落在档位区间、全卡平均是否达标。"""
import json, io, sys, os, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
d = json.load(open(os.path.join(ROOT, "final_game.json"), encoding='utf-8'))
TAG = re.compile(r"\{\{([^|}]+)\|([^}]*)\}\}")

def clen(c):
    return sum(len(TAG.sub(lambda m: m.group(1), s["text"])) for s in c["segments"])

lens = [(clen(c), c["id"], c["len"]) for c in d["cards"]]
n = len(lens)
total = sum(x[0] for x in lens)
avg = total / n
print(f"当前总字数 {total}，平均 {avg:.0f}")

for X in (700, 720, 750):
    S = (0.58 * X, 0.75 * X); M = (0.85 * X, 1.15 * X); L = (1.20 * X, 1.50 * X)
    rng = {"S": S, "M": M, "L": L}
    bad = []
    for ln, cid, tier in lens:
        lo, hi = rng[tier]
        if not (lo <= ln <= hi):
            bad.append((cid, tier, ln, int(lo), int(hi)))
    avgok = (0.92 * X) <= avg <= (1.08 * X)
    print(f"\navg={X}: S[{int(S[0])},{int(S[1])}] M[{int(M[0])},{int(M[1])}] L[{int(L[0])},{int(L[1])}] 平均区间[{int(0.92*X)},{int(1.08*X)}]")
    print(f"  全卡平均 {avg:.0f} {'达标' if avgok else '超标'}；档位不合 {len(bad)} 张")
    for cid, tier, ln, lo, hi in bad:
        print(f"    {cid} [{tier}] {ln} 不在 [{lo},{hi}]")
