# -*- coding: utf-8 -*-
"""把 5 个 recaps_lvN.json 分片合并进 recaps.json（保留骨架结构，填入 title/segments/cards/images）。"""
import json, io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))

recaps = json.load(open(os.path.join(HERE, "recaps.json"), encoding='utf-8'))
for lv in range(1, 6):
    part = json.load(open(os.path.join(HERE, f"recaps_lv{lv}.json"), encoding='utf-8'))
    pages = part[str(lv)]["pages"]
    # 以骨架为准校验 rows/cards，写入 title/segments（及可选 images）
    skel = recaps[str(lv)]["pages"]
    assert len(pages) == len(skel), f"第{lv}关页数不符：{len(pages)} vs {len(skel)}"
    for i, (wp, sp) in enumerate(zip(pages, skel)):
        assert wp["rows"] == sp["rows"], f"第{lv}关第{i+1}页 rows 不符"
        sp["title"] = wp["title"]
        sp["segments"] = wp["segments"]
        sp["cards"] = wp.get("cards", sp["cards"])
        if wp.get("images"):
            sp["images"] = wp["images"]
    print(f"第{lv}关：{len(pages)} 页合并完成")

json.dump(recaps, open(os.path.join(HERE, "recaps.json"), "w", encoding='utf-8'), ensure_ascii=False, indent=1)
print("recaps.json 已更新")
