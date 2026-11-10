# -*- coding: utf-8 -*-
"""分析：哪些空位答案词条全游戏无 chip；并找出可包裹裸文本的候选卡。"""
import json, io, sys, os, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

d = json.load(open(os.path.join(ROOT, "final_game.json"), encoding='utf-8'))
entries = d["entries"]
cards = d["cards"]

TAG = re.compile(r"\{\{([^|}]+)\|([^}]*)\}\}")

# 每个词条被哪些卡 chip（正文 tag）
chip_in = {eid: set() for eid in entries}
for c in cards:
    for s in c["segments"]:
        for m in TAG.finditer(s.get("text", "")):
            if m.group(1) in chip_in:
                chip_in[m.group(1)].add(c["id"])

# 每个词条作为答案出现在哪些卡
answer_in = {}
for c in cards:
    for b in c.get("blanks", []):
        ans = b["answer"] if isinstance(b["answer"], list) else [b["answer"]]
        for eid in ans:
            answer_in.setdefault(eid, set()).add(c["id"])

# 起始词条
start = set()
for lv, lst in d.get("levelStartEntries", {}).items():
    start.update(lst)

print("=== 空位答案但全游戏无 chip 的词条 ===")
need = []
for eid, cardset in answer_in.items():
    if not chip_in.get(eid) and eid not in start:
        name = entries[eid]["name"]
        need.append((eid, name))
        # 找候选卡：正文裸文本含显示名、且该卡不是它的答案卡
        cands = []
        for c in cards:
            if c["id"] in answer_in.get(eid, set()):
                continue
            plain = TAG.sub("", "".join(s.get("text", "") for s in c["segments"]))
            if name in plain:
                cands.append(c["id"])
        print(f"{eid}（{name}）  答案卡={sorted(answer_in[eid])}  可包裹候选={cands}")

print(f"\n共 {len(need)} 个待处理")

# 顺带：从来不被 chip 也非答案非起始的词条（潜在死词条）
print("\n=== 从不 chip 也非答案非起始的词条（检查是否死词条）===")
for eid, e in entries.items():
    if not chip_in.get(eid) and eid not in answer_in and eid not in start:
        has_arc = bool(e.get("archive"))
        print(f"  {eid}（{e['name']}）type={e['type']} 档案={has_arc}")
