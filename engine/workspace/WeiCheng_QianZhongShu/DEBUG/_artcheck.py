# -*- coding: utf-8 -*-
"""核查美术 prompt 是否齐全：人物 avatarPrompt+look、地点/物品/概念 imagePrompt、每卡 cgPrompt、assets 三张特殊图。"""
import json, io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
d = json.load(open(os.path.join(ROOT, "final_game.json"), encoding='utf-8'))

miss = []
for eid, e in d["entries"].items():
    if e["type"] == "person":
        if not e.get("avatarPrompt"): miss.append(f"{eid} 缺 avatarPrompt")
        if not e.get("look"): miss.append(f"{eid} 缺 look")
    else:
        if not e.get("imagePrompt"): miss.append(f"{eid} 缺 imagePrompt")
for c in d["cards"]:
    if not c.get("cgPrompt"): miss.append(f"{c['id']} 缺 cgPrompt")
for k in ("titleImagePrompt", "endingImagePrompt", "sceneIconPrompt"):
    if not d["assets"].get(k): miss.append(f"assets 缺 {k}")
if not d["meta"].get("art"): miss.append("meta 缺 art")

print(f"缺失 {len(miss)} 项")
for m in miss:
    print(" ", m)
print(f"\n词条 {len(d['entries'])}，卡 {len(d['cards'])}，meta.art 六段={'齐' if d['meta'].get('art') else '缺'}")
