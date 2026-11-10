# -*- coding: utf-8 -*-
"""按关检查可收集性：每个空位答案，在其所在关内必须有 chip（或该关起始词条）。"""
import json, io, sys, os, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
d = json.load(open(os.path.join(ROOT, "final_game.json"), encoding='utf-8'))
entries = d["entries"]
cards = d["cards"]
TAG = re.compile(r"\{\{([^|}]+)\|([^}]*)\}\}")

# 每关内，每个词条被哪些卡 chip
chip_in_lv = {}  # (level, eid) -> set(cardid)
for c in cards:
    for s in c["segments"]:
        for m in TAG.finditer(s.get("text", "")):
            chip_in_lv.setdefault((c["level"], m.group(1)), set()).add(c["id"])

start = d.get("levelStartEntries", {})

print("=== 本关内不可收集的空位答案 ===")
n = 0
for c in cards:
    lv = str(c["level"])
    for b in c.get("blanks", []):
        ans = b["answer"] if isinstance(b["answer"], list) else [b["answer"]]
        for eid in ans:
            if eid in start.get(lv, []):
                continue
            if not chip_in_lv.get((c["level"], eid)):
                # 找本关内可包裹候选（非答案卡）
                cands = []
                for c2 in cards:
                    if c2["level"] != c["level"] or c2["id"] == c["id"]:
                        continue
                    # 该词条不是 c2 的答案
                    c2ans = set()
                    for b2 in c2.get("blanks", []):
                        a2 = b2["answer"] if isinstance(b2["answer"], list) else [b2["answer"]]
                        c2ans.update(a2)
                    if eid in c2ans:
                        continue
                    plain = TAG.sub("", "".join(s.get("text", "") for s in c2["segments"]))
                    if entries[eid]["name"] in plain:
                        cands.append(c2["id"])
                print(f"  L{lv} {c['id']} 答案 {eid}（{entries[eid]['name']}）  本关可包裹候选={cands}")
                n += 1
print(f"\n共 {n} 处")
