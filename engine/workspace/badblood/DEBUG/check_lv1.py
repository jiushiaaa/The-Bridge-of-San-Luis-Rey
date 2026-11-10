# -*- coding: utf-8 -*-
"""cards_lv1.json 全量自查：
① JSON 合法 ②字数在档 ③答案真名不出现在正文（子串，chip 按显示名展开后查）
④ easy 无地点空 / normal、hard 恰 1 地点空 ⑤ hard 无人名 chip、无 speakerEntry
⑥ 每卡 ≥1 chip 且必织词条齐 ⑦人名 chip 每卡每人 ≤1 次 ⑧ hints=2
附：dialogue/monologue 的 slot 必须在该卡 blanks；speakerEntry 人物须有本卡 chip；
speaker 配角名不得与 35 个人物词条重名。"""
import json, re, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.path.join(HERE, "cards_lv1.json"), encoding="utf-8"))
print(f"① JSON 合法，共 {len(data)} 张卡")

# 词条 id→name（卷1涉及的全部词条）
NAME = {
 "e_holmes":"霍姆斯","e_sunny":"桑尼","e_shaunak":"沙奈克","e_eddie":"埃迪","e_tony":"托尼",
 "e_mosley":"莫斯利","e_tkemp":"坎普","e_ian":"伊恩","e_fuisz":"富兹","e_robertson":"罗伯特森",
 "e_lucas":"卢卡斯","e_draper":"德雷珀","e_avie":"艾维","e_ana":"安娜",
 "e_dongpaluo":"东帕洛旧楼","e_hillview":"山景大道","e_zurich":"苏黎世","e_nashville":"纳什维尔",
 "e_mclean":"麦克莱恩","e_coupa":"科帕咖啡馆",
 "e_patch":"诊疗贴片","e_theranos1":"希拉洛斯1.0","e_edison":"爱迪生机","e_turtleneck":"黑色高领衫",
 "e_nda":"保密协议","e_fakeit":"演久成真","e_fear":"恐惧文化","e_pt":"能力验证",
}
PERSON35 = {"霍姆斯","桑尼","沙奈克","埃迪","托尼","莫斯利","坎普","伊恩","罗谢尔","富兹","舒尔茨",
 "泰勒","艾瑞卡","比姆","卡雷鲁","博伊斯","亨特","J博士","米克隆","伯德","布莱德利","马蒂斯",
 "舒梅克","丹尼尔","罗伯特森","卢卡斯","德雷珀","艾维","安娜","切尔西","安加丽","帕洛夫",
 "默多克","克莱帕","山本"}
PERSON_EIDS = {"e_holmes","e_sunny","e_shaunak","e_eddie","e_tony","e_mosley","e_tkemp","e_ian",
 "e_fuisz","e_robertson","e_lucas","e_draper","e_avie","e_ana"}

RANGE = {"S": (406, 525), "M": (595, 805), "L": (840, 1050)}
# 必织词条（按 DESIGN §2 卡表；c1_18 另需富兹 chip——§2 收集路径注）
REQUIRED = {
 "c1_01": {"e_robertson","e_patch"},
 "c1_02": {"e_theranos1","e_fakeit"},
 "c1_03": {"e_holmes","e_edison","e_ian"},
 "c1_04": {"e_holmes","e_turtleneck","e_lucas","e_nashville"},
 "c1_05": {"e_nda"},
 "c1_06": {"e_sunny","e_patch"},
 "c1_07": {"e_patch","e_robertson"},
 "c1_08": {"e_draper","e_mosley","e_dongpaluo","e_zurich"},
 "c1_09": {"e_mclean","e_patch"},
 "c1_10": {"e_tkemp","e_theranos1"},
 "c1_11": {"e_eddie","e_pt"},
 "c1_12": {"e_patch"},
 "c1_13": {"e_tony","e_edison"},
 "c1_14": {"e_fear"},
 "c1_15": {"e_ana","e_turtleneck","e_coupa"},
 "c1_16": {"e_avie","e_robertson"},
 "c1_17": {"e_fakeit"},
 "c1_18": {"e_fear","e_hillview","e_fuisz"},
}

CHIP_RE = re.compile(r"\{\{(e_[a-z0-9]+)\|([^}]+)\}\}")
fails = 0

def err(cid, msg):
    global fails
    fails += 1
    print(f"  X {cid}: {msg}")

for c in data:
    cid = c["id"]
    raw = "".join(s["text"] for s in c["segments"])
    body = CHIP_RE.sub(lambda m: m.group(2), raw)  # chip→显示名，[[NPCn]] 保留字面

    # ② 字数
    n = len(body)
    lo, hi = RANGE[c["len"]]
    if not (lo <= n <= hi):
        err(cid, f"字数 {n} 不在 {c['len']} 档 [{lo},{hi}]")

    # ③ 答案真名不得出现在正文（子串）
    for b in c["blanks"]:
        nm = NAME[b["answer"]]
        if nm in body:
            err(cid, f"答案真名「{nm}」出现在正文")
    # hints 也不得直接报名字
    for b in c["blanks"]:
        nm = NAME[b["answer"]]
        for h in c["hints"]:
            if nm in h:
                err(cid, f"hint 直接报了答案「{nm}」")

    # ④ 难度与地点空
    places = [b for b in c["blanks"] if b["kind"] == "place"]
    if c["difficulty"] == "easy" and places:
        err(cid, "easy 卡有地点空")
    if c["difficulty"] in ("normal", "hard") and len(places) != 1:
        err(cid, f"{c['difficulty']} 卡地点空数量={len(places)}")

    # ⑤ hard 全文匿名
    chips = CHIP_RE.findall(raw)
    if c["difficulty"] == "hard":
        for eid, disp in chips:
            if eid in PERSON_EIDS:
                err(cid, f"hard 卡出现人名 chip {eid}")
        for s in c["segments"]:
            if "speakerEntry" in s:
                err(cid, "hard 卡出现 speakerEntry")

    # ⑥ chip ≥1 且必织齐
    if not chips:
        err(cid, "无词条 chip")
    have = {eid for eid, _ in chips}
    miss = REQUIRED[cid] - have
    if miss:
        err(cid, f"缺必织词条 {sorted(miss)}")

    # ⑦ 人名 chip 每人 ≤1 次
    from collections import Counter
    cnt = Counter(eid for eid, _ in chips if eid in PERSON_EIDS)
    for eid, k in cnt.items():
        if k > 1:
            err(cid, f"人名 chip {eid} 出现 {k} 次")

    # ⑧ hints=2
    if len(c["hints"]) != 2:
        err(cid, f"hints 数量={len(c['hints'])}")

    # slot 合法
    blank_slots = {b["slot"] for b in c["blanks"]}
    for s in c["segments"]:
        if "slot" in s and s["slot"] not in blank_slots:
            err(cid, f"段落 slot {s['slot']} 不在 blanks")
        # speakerEntry 人物须有本卡 chip
        if "speakerEntry" in s:
            if s["speakerEntry"] not in have:
                err(cid, f"speakerEntry {s['speakerEntry']} 无本卡 chip")
        # 配角名不得与 35 人重名
        if "speaker" in s and s["speaker"] in PERSON35:
            err(cid, f"配角名「{s['speaker']}」与人物词条重名")

if fails == 0:
    print("②~⑧ 全部通过 OK")
else:
    print(f"共 {fails} 处不合格")
    sys.exit(1)
