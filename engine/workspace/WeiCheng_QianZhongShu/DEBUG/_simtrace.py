# -*- coding: utf-8 -*-
"""复刻 validate_data.py 的 simulate()，逐关打印诊断：解锁/完成/归位/档案/闸门状态。"""
import json, io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "tools"))
import validate_data as V

g = json.load(open(os.path.join(ROOT := os.path.dirname(HERE), "final_game.json"), encoding='utf-8'))

st = g["meta"]["stamina"]
max_level = V.max_level_of(g)
level = 1
stamina = st["start"]
collected = set()
fam = {eid: 0 for eid in g["entries"]}
clicked = {eid: set() for eid in g["entries"]}
ans_fam_done = set()
unlocked = set()
unlock_order = []
done = set()
placed = set()
arch_unlocked = {eid: set() for eid in g["entries"]}
arch_done = {eid: set() for eid in g["entries"]}
gates_passed = 0

for eid in g["levelStartEntries"].get("1", []):
    collected.add(eid)

cards_by_level = {}
for c in g["cards"]:
    cards_by_level.setdefault(c["level"], []).append(c)

def gate_pool_ok(gate):
    for b in gate["blanks"]:
        if "answerEntry" in b:
            eid = b["answerEntry"]
            pages = [i for i, p in enumerate(g["entries"][eid].get("archive", [])) if p["level"] <= gate["after"]]
            if not all(i in arch_done[eid] for i in pages):
                return False, f"闸门答案 {g['entries'][eid]['name']} 的档案未完成"
        else:
            if b["answerTitle"] not in placed:
                return False, f"闸门答案卡 {b['answerTitle']} 未归位"
    return True, ""

steps = 0
while steps < 5000:
    steps += 1
    progressed = False
    for c in g["cards"]:
        if c["id"] in unlocked:
            for t in V.card_tag_ids(c):
                collected.add(t)
                if c["id"] not in clicked[t]:
                    clicked[t].add(c["id"])
                    fam[t] = min(fam[t] + 1, V.fam_max_of(g, t, level))
                    progressed = True
    for c in g["cards"]:
        if c["id"] in unlocked and c["id"] not in done:
            if all(any(a in collected for a in V.blank_answers(b)) for b in c["blanks"]):
                done.add(c["id"]); stamina += st["completeReward"]; progressed = True
                if c["id"] not in ans_fam_done:
                    ans_fam_done.add(c["id"])
                    for b in c["blanks"]:
                        t = next((a for a in V.blank_answers(b) if a in collected), V.blank_answers(b)[0])
                        fam[t] = min(fam[t] + 1, V.fam_max_of(g, t, level))
    for cid in done:
        if cid not in placed:
            placed.add(cid); progressed = True
    for eid, e in g["entries"].items():
        if fam[eid] >= V.fam_max_of(g, eid, level):
            for i, p in enumerate(e.get("archive", [])):
                if p["level"] == level and i not in arch_unlocked[eid]:
                    arch_unlocked[eid].add(i); progressed = True
    for eid, e in g["entries"].items():
        for i in arch_unlocked[eid]:
            if i in arch_done[eid]: continue
            page = e["archive"][i]
            if all(f["blank"]["answer"] in collected for f in page["fields"] if "blank" in f):
                arch_done[eid].add(i); progressed = True
    if stamina >= st["searchCost"]:
        potential, locked_tag_cards = V.build_search_ctx(g, level, collected, unlocked)
        recent_keys = [(c["col"], c["form"]) for c in reversed(unlock_order) if c["level"] == level]
        best_card = None; best_p = None
        for c in cards_by_level.get(level, []):
            if c["id"] in unlocked or not (V.card_tag_ids(c) & collected):
                continue
            p = V.search_priority(g, c, level, collected, potential, locked_tag_cards, recent_keys)
            if best_p is None or p > best_p:
                best_p, best_card = p, c
        if best_card is not None:
            unlocked.add(best_card["id"]); unlock_order.append(best_card); stamina -= st["searchCost"]; progressed = True
    gate = next((x for x in g["gates"] if x["after"] == level), None)
    if gate is not None and not progressed:
        lv_cards = [c["id"] for c in cards_by_level.get(level, [])]
        placed_n = sum(1 for cid in lv_cards if cid in placed)
        lv_pages = [(eid, i) for eid, e in g["entries"].items() for i, p in enumerate(e.get("archive", [])) if p["level"] == level]
        arch_n = sum(1 for eid, i in lv_pages if i in arch_done[eid])
        total = len(lv_cards) * 25 + len(lv_pages) * 10
        pct = (placed_n * 25 + arch_n * 10) * 100 // total if total else 0
        ok, why = gate_pool_ok(gate)
        print(f"\n--- 关 {level} 闸门尝试：归位 {placed_n}/{len(lv_cards)} 档案 {arch_n}/{len(lv_pages)} 进度 {pct}% 候选池 {'OK' if ok else why}")
        if (placed_n * 25 + arch_n * 10) * 10 >= total * 7:
            if ok:
                gates_passed += 1
                if level == max_level: break
                level += 1; stamina += st["perLevel"]
                for eid in fam: fam[eid] = 0
                for eid in g["levelStartEntries"].get(str(level), []): collected.add(eid)
                progressed = True
            else:
                print(f"    进度够但候选池不齐：{why}")
            # 诊断：哪些卡未完成、哪些档案未完成
            notdone = [c["id"] for c in cards_by_level.get(level, []) if c["id"] not in done]
            print(f"    未完成卡: {notdone}")
            for cid in notdone:
                c = next(x for x in g["cards"] if x["id"] == cid)
                miss = []
                for b in c["blanks"]:
                    for a in V.blank_answers(b):
                        if a not in collected:
                            miss.append(g["entries"][a]["name"])
                print(f"      {cid} 缺收集: {miss}")
            for eid, i in lv_pages:
                if i not in arch_done[eid]:
                    e = g["entries"][eid]
                    fmx = V.fam_max_of(g, eid, level)
                    need = [g["entries"][f["blank"]["answer"]]["name"] for f in e["archive"][i]["fields"] if "blank" in f]
                    notcol = [g["entries"][f["blank"]["answer"]]["name"] for f in e["archive"][i]["fields"] if "blank" in f and f["blank"]["answer"] not in collected]
                    print(f"    档案未完成: {e['name']} p{i} fam={fam[eid]}/{fmx} 解锁={i in arch_unlocked[eid]} 留白需={need} 未收集={notcol}")
            if not ok:
                break
        else:
            print(f"    进度不足 70%")
            # 诊断：哪些卡未完成、哪些档案未完成
            notdone = [c["id"] for c in cards_by_level.get(level, []) if c["id"] not in done]
            print(f"    未完成卡: {notdone}")
            for cid in notdone:
                c = next(x for x in g["cards"] if x["id"] == cid)
                miss = []
                for b in c["blanks"]:
                    for a in V.blank_answers(b):
                        if a not in collected:
                            miss.append(g["entries"][a]["name"])
                print(f"      {cid} 缺收集: {miss}")
            for eid, i in lv_pages:
                if i not in arch_done[eid]:
                    e = g["entries"][eid]
                    fmx = V.fam_max_of(g, eid, level)
                    print(f"    档案未完成: {e['name']} p{i} fam={fam[eid]}/{fmx} 解锁={i in arch_unlocked[eid]}")
            break
    if not progressed:
        if stamina < st["searchCost"]:
            stamina += st["restGain"]; continue
        break

print(f"\n最终：过闸 {gates_passed}/{len(g['gates'])}，level={level}，体力={stamina}")
