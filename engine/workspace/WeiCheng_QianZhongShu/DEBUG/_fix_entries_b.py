# -*- coding: utf-8 -*-
"""修正 entries_b.json 中 3 个 minor 档案的结构：字段数组 -> 页数组。"""
import json, io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
p = os.path.join(HERE, "entries_b.json")
d = json.load(open(p, encoding='utf-8'))

wrap = {
    "e_aliu": (1, "船上侍者"),
    "e_wangmeiyu": (3, "鹰潭女子"),
    "e_shentaitai": (2, "沙龙名媛"),
}
for eid, (lv, title) in wrap.items():
    arc = d[eid].get("archive")
    if arc and isinstance(arc, list) and arc and "label" in arc[0]:
        d[eid]["archive"] = [{"level": lv, "title": title, "fields": arc}]
        print(f"fixed {eid}: 1 页 {len(arc)} 字段")

json.dump(d, open(p, "w", encoding='utf-8'), ensure_ascii=False, indent=1)
print("saved")
