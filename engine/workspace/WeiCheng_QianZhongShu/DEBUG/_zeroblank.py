# -*- coding: utf-8 -*-
"""检查各作品（含本作品）是否存在 0 留白的档案页。"""
import json, io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.join(HERE, "..", "..", "..")
games = {"xdd": "xidaduo", "bad": "badblood", "murder": "murder", "weicheng": "WeiCheng_QianZhongShu"}
for gid, dirn in games.items():
    p = os.path.join(PROJ, "workspace", dirn, "final_game.json")
    if not os.path.exists(p):
        continue
    d = json.load(open(p, encoding='utf-8'))
    zero = []
    for eid, e in d.get("entries", {}).items():
        for i, page in enumerate(e.get("archive", [])):
            if not any("blank" in f for f in page.get("fields", [])):
                zero.append(f"{eid}#p{i}")
    print(f"{gid}: 0留白档案页 {len(zero)} 处  {zero[:8]}")
