# -*- coding: utf-8 -*-
"""快速检查分片 JSON 的结构与字数。用法: python _check.py <file.json> [file2.json ...]"""
import json, io, sys, os, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))

TAG = re.compile(r"\{\{[^|}]+\|([^}]*)\}\}")
NPC = re.compile(r"\[\[NPC\d+\]\]")

def text_len(segments):
    # 与 tools/validate_data.py 的 card_text_len 完全一致：
    # 词条标签按显示名计，[[NPCn]] 按字面计，保留空白。
    n = 0
    for s in segments:
        t = s.get("text", "")
        t = TAG.sub(lambda m: m.group(1), t)
        n += len(t)
    return n

def check_cards(path):
    cards = json.load(open(path, encoding='utf-8'))
    print(f"\n== {os.path.basename(path)}: {len(cards)} 张卡 ==")
    spec = {"S": (406, 525), "M": (595, 805), "L": (840, 1050)}  # [58%,75%]X / [85%,115%]X / [120%,150%]X, X=700
    for c in cards:
        n = text_len(c["segments"])
        ln = c.get("len", "?")
        lo, hi = spec.get(ln, (0, 9999))
        flag = "" if lo <= n <= hi else "  <<< 字数超档!"
        blanks = len(c.get("blanks", []))
        print(f"  {c['id']} [{c['col']}/r{c['row']}] {c['form']}/{c['difficulty']}/{ln}  {n}字  空位{blanks}  {c['title']}{flag}")

def check_entries(path):
    d = json.load(open(path, encoding='utf-8'))
    persons = [k for k, v in d.items() if v.get("type") == "person"]
    places = [k for k, v in d.items() if v.get("type") == "place"]
    items = [k for k, v in d.items() if v.get("type") == "item"]
    concepts = [k for k, v in d.items() if v.get("type") == "concept"]
    print(f"\n== {os.path.basename(path)}: 共{len(d)} (人{len(persons)} 地{len(places)} 物{len(items)} 概念{len(concepts)}) ==")
    for k, v in d.items():
        arc = v.get("archive", [])
        ndesc = len(re.sub(r"\s", "", v.get("desc", "")))
        print(f"  {k} [{v.get('type')}/{v.get('tier','-')}] desc {ndesc}字  档案{len(arc)}页  {v.get('name')}")

for p in sys.argv[1:]:
    fp = p if os.path.isabs(p) else os.path.join(HERE, p)
    data = json.load(open(fp, encoding='utf-8'))
    if isinstance(data, list):
        check_cards(fp)
    else:
        check_entries(fp)
