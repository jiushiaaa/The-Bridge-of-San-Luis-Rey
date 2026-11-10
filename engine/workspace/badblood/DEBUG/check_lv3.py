# -*- coding: utf-8 -*-
"""卷3卡面自查：JSON合法/字数/匿名/难度一致/chip/词条/hints"""
import json, re, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE = __file__.rsplit("\\", 1)[0].rsplit("/", 1)[0]
cards = json.load(open(BASE + "/cards_lv3.json", encoding="utf-8"))

# 词条 id -> name（DESIGN §5）
NAMES = {
 "e_holmes":"霍姆斯","e_sunny":"桑尼","e_shaunak":"沙奈克","e_eddie":"埃迪","e_tony":"托尼",
 "e_mosley":"莫斯利","e_tkemp":"坎普","e_ian":"伊恩","e_rochelle":"罗谢尔","e_fuisz":"富兹",
 "e_shultz":"舒尔茨","e_tyler":"泰勒","e_erika":"艾瑞卡","e_beam":"比姆","e_carreyrou":"卡雷鲁",
 "e_boies":"博伊斯","e_hunter":"亨特","e_jay":"J博士","e_miquelon":"米克隆","e_burd":"伯德",
 "e_bradley":"布莱德利","e_mattis":"马蒂斯","e_shoemaker":"舒梅克","e_daniel":"丹尼尔",
 "e_robertson":"罗伯特森","e_lucas":"卢卡斯","e_draper":"德雷珀","e_avie":"艾维","e_ana":"安娜",
 "e_chelsea":"切尔西","e_anjali":"安加丽","e_parloff":"帕洛夫","e_murdoch":"默多克",
 "e_clapper":"克莱帕","e_yamamoto":"山本",
 "e_dongpaluo":"东帕洛旧楼","e_hillview":"山景大道","e_facebook":"脸书旧楼","e_newark":"纽瓦克工厂",
 "e_pagemill":"佩奇磨坊路","e_coupa":"科帕咖啡馆","e_deerfield":"迪尔菲尔德","e_pleasanton":"普莱森顿",
 "e_hoover":"胡佛研究所","e_tampa":"坦帕基地","e_mclean":"麦克莱恩","e_zurich":"苏黎世",
 "e_nashville":"纳什维尔","e_phoenix":"凤凰城","e_wsjhq":"报社总部","e_aacc":"费城会场","e_mexico":"墨西哥城",
 "e_patch":"诊疗贴片","e_theranos1":"希拉洛斯1.0","e_edison":"爱迪生机","e_minilab":"迷你实验室",
 "e_nanotainer":"纳米容器","e_advia":"西门子分析仪","e_hopkins":"霍普金斯信","e_scatter":"散点图",
 "e_turtleneck":"黑色高领衫","e_nda":"保密协议",
 "e_fakeit":"演久成真","e_fear":"恐惧文化","e_pt":"能力验证","e_mattanza":"拉马坦萨",
}
PERSON_IDS = [k for k in NAMES if not k.startswith(("e_dongpaluo",)) and k in
 {"e_holmes","e_sunny","e_shaunak","e_eddie","e_tony","e_mosley","e_tkemp","e_ian","e_rochelle","e_fuisz",
  "e_shultz","e_tyler","e_erika","e_beam","e_carreyrou","e_boies","e_hunter","e_jay","e_miquelon","e_burd",
  "e_bradley","e_mattis","e_shoemaker","e_daniel","e_robertson","e_lucas","e_draper","e_avie","e_ana",
  "e_chelsea","e_anjali","e_parloff","e_murdoch","e_clapper","e_yamamoto"}]
PERSON_NAMES = {NAMES[k] for k in PERSON_IDS}

# 卡表：必织词条
REQUIRED = {
 "c3_01":["e_fuisz","e_pt"], "c3_02":["e_clapper","e_daniel","e_fakeit"], "c3_03":["e_nanotainer"],
 "c3_04":["e_nda"], "c3_05":["e_nda"], "c3_06":["e_minilab"],
 "c3_07":["e_mattanza","e_parloff","e_tyler","e_newark"], "c3_08":["e_pt","e_phoenix"],
 "c3_09":["e_minilab","e_fakeit"], "c3_10":["e_beam"], "c3_11":["e_edison"], "c3_12":["e_nda"],
 "c3_13":["e_pt"], "c3_14":["e_nanotainer"], "c3_15":["e_shultz","e_erika","e_hoover"],
 "c3_16":["e_boies"], "c3_17":["e_mattanza"], "c3_18":["e_murdoch","e_wsjhq"], "c3_19":["e_fakeit"],
 "c3_20":["e_beam"], "c3_21":["e_yamamoto","e_nda"], "c3_22":["e_pt"], "c3_23":["e_fear"],
 "c3_24":["e_holmes","e_sunny","e_wsjhq","e_aacc"],
}
LEN_RANGE = {"S": (406, 525), "M": (595, 805), "L": (840, 1050)}

def plain(text):
    # chip -> 显示名；[[NPCn]] 保持字面
    return re.sub(r"\{\{e_[a-z0-9]+\|([^}]*)\}\}", r"\1", text)

ok_all = True
for c in cards:
    errs = []
    cid = c["id"]
    full = "".join(s["text"] for s in c["segments"])
    plainfull = "".join(plain(s["text"]) for s in c["segments"])
    n = len(plainfull)
    lo, hi = LEN_RANGE[c["len"]]
    if not (lo <= n <= hi):
        errs.append(f"字数 {n} 不在 {c['len']}[{lo},{hi}]")
    # ③ 答案真名不得出现在正文（去标记后 chip 显示名也算；同时查原文）
    answers = [b["answer"] for b in c["blanks"]]
    for a in answers:
        nm = NAMES[a]
        if nm in plainfull:
            errs.append(f"答案名「{nm}」出现在正文")
    # ④ 难度与地点空
    places = [b for b in c["blanks"] if b["kind"] == "place"]
    if c["difficulty"] == "easy" and places:
        errs.append("easy 卡有地点空")
    if c["difficulty"] in ("normal", "hard") and len(places) != 1:
        errs.append(f"{c['difficulty']} 卡地点空数={len(places)}≠1")
    # ⑤ hard 无人名 chip、无 speakerEntry
    chips = re.findall(r"\{\{(e_[a-z0-9]+)\|([^}]*)\}\}", full)
    if c["difficulty"] == "hard":
        for eid, disp in chips:
            if eid in PERSON_IDS:
                errs.append(f"hard 卡有人名 chip {eid}")
        for s in c["segments"]:
            if "speakerEntry" in s:
                errs.append("hard 卡有 speakerEntry")
    # ⑥ ≥1 chip 且必织齐
    if not chips:
        errs.append("无 chip")
    chip_ids = {e for e, _ in chips}
    for req in REQUIRED[cid]:
        if req not in chip_ids:
            errs.append(f"缺必织词条 {req}")
    # chip 显示名与词条名一致提示（不强制）
    for eid, disp in chips:
        if eid not in NAMES:
            errs.append(f"未知词条 {eid}")
    # ⑦ 人名 chip 每卡每人 ≤1
    from collections import Counter
    cnt = Counter(e for e, _ in chips if e in PERSON_IDS)
    for e, k in cnt.items():
        if k > 1:
            errs.append(f"人名 chip {e} 出现 {k} 次")
    # speaker 配角不得与 35 人物词条重名
    for s in c["segments"]:
        if s.get("speaker") in PERSON_NAMES:
            errs.append(f"配角名 {s['speaker']} 与人物词条重名")
        if "speakerEntry" in s:
            eid = s["speakerEntry"]
            if eid not in chip_ids:
                errs.append(f"speakerEntry {eid} 正文无 chip")
    # slot 必须在 blanks
    blank_slots = {b["slot"] for b in c["blanks"]}
    for s in c["segments"]:
        if "slot" in s and s["slot"] not in blank_slots:
            errs.append(f"段 slot {s['slot']} 不在 blanks")
    # [[NPCn]] 引用检查
    for m in re.findall(r"\[\[(NPC\d+)\]\]", full):
        if m not in blank_slots:
            errs.append(f"正文引用 {m} 不在 blanks")
    # ⑧ hints
    if len(c.get("hints", [])) != 2:
        errs.append(f"hints 数={len(c.get('hints', []))}")
    # hints 不直接报答案名
    for a in answers:
        nm = NAMES[a]
        for h in c.get("hints", []):
            if nm in h:
                errs.append(f"hint 直接含答案名「{nm}」")
    status = "OK" if not errs else "FAIL: " + "；".join(errs)
    if errs:
        ok_all = False
    print(f"{cid} {c['title']} {c['len']}档 字数={n} chips={len(chips)} -> {status}")

print("\n总卡数:", len(cards))
print("全部通过" if ok_all and len(cards) == 24 else "存在未通过项！")
