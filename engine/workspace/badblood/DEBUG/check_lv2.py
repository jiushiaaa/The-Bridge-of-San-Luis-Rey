# -*- coding: utf-8 -*-
"""cards_lv2.json 自查：字数/匿名/难度/必织词条/chip 唯一/hints"""
import json, re, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

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
PERSON_IDS = set("e_holmes e_sunny e_shaunak e_eddie e_tony e_mosley e_tkemp e_ian e_rochelle e_fuisz "
 "e_shultz e_tyler e_erika e_beam e_carreyrou e_boies e_hunter e_jay e_miquelon e_burd e_bradley "
 "e_mattis e_shoemaker e_daniel e_robertson e_lucas e_draper e_avie e_ana e_chelsea e_anjali "
 "e_parloff e_murdoch e_clapper e_yamamoto".split())

REQUIRED = {  # 必织词条（chip）
 "c2_01":["e_holmes","e_fear"], "c2_02":["e_hopkins","e_fakeit"], "c2_03":["e_edison","e_hunter"],
 "c2_04":["e_holmes","e_yamamoto","e_pt"], "c2_05":["e_minilab","e_fear"],
 "c2_06":["e_holmes","e_sunny","e_advia","e_nanotainer","e_tyler","e_ian"],
 "c2_07":["e_scatter","e_fakeit"], "c2_08":["e_pt","e_edison"], "c2_09":["e_mexico","e_fear"],
 "c2_10":["e_fear","e_chelsea","e_hillview"], "c2_11":["e_robertson"],
 "c2_12":["e_minilab","e_burd","e_pleasanton"], "c2_13":["e_shoemaker","e_tampa"], "c2_14":["e_edison"],
 "c2_15":["e_rochelle","e_boies"], "c2_16":["e_anjali","e_facebook"], "c2_17":["e_fakeit"],
 "c2_18":["e_shultz"], "c2_19":["e_scatter","e_miquelon","e_deerfield"], "c2_20":["e_pt"],
 "c2_21":["e_erika","e_daniel"], "c2_22":["e_parloff","e_pagemill","e_mattis","e_newark"],
}
EXPECTED = {  # id: (difficulty, len)
 "c2_01":("normal","L"),"c2_02":("hard","L"),"c2_03":("normal","M"),"c2_04":("normal","L"),
 "c2_05":("hard","L"),"c2_06":("normal","L"),"c2_07":("hard","L"),"c2_08":("normal","L"),
 "c2_09":("normal","M"),"c2_10":("easy","S"),"c2_11":("normal","S"),"c2_12":("normal","M"),
 "c2_13":("normal","M"),"c2_14":("normal","M"),"c2_15":("easy","S"),"c2_16":("easy","S"),
 "c2_17":("easy","S"),"c2_18":("easy","S"),"c2_19":("normal","M"),"c2_20":("normal","M"),
 "c2_21":("easy","S"),"c2_22":("easy","S"),
}
RANGES = {"S":(406,525),"M":(595,805),"L":(840,1050)}

def visible(text):
    text = re.sub(r"\{\{e_[a-z0-9]+\|([^}]*)\}\}", r"\1", text)
    return text  # [[NPCn]] 按字面保留

def main():
    cards = json.load(open("cards_lv2.json", encoding="utf-8"))
    ok = True
    assert len(cards) == 22, f"卡数 {len(cards)} != 22"
    for c in cards:
        cid = c["id"]; errs = []
        diff, ln = EXPECTED[cid]
        if c["difficulty"] != diff or c["len"] != ln:
            errs.append(f"难度/len 不符 {c['difficulty']}/{c['len']}")
        body = "".join(s["text"] for s in c["segments"])
        n = len(visible(body))
        lo, hi = RANGES[ln]
        if not (lo <= n <= hi):
            errs.append(f"字数 {n} 不在 [{lo},{hi}]")
        # 匿名：全部答案 name 不得出现于正文
        for b in c["blanks"]:
            nm = NAMES[b["answer"]]
            if nm in body:
                errs.append(f"答案名 {nm} 出现在正文")
        # 难度-地点空
        places = [b for b in c["blanks"] if b["kind"] == "place"]
        if diff == "easy" and places: errs.append("easy 有地点空")
        if diff in ("normal","hard") and len(places) != 1: errs.append(f"地点空数 {len(places)}")
        # hard 匿名
        chips = re.findall(r"\{\{(e_[a-z0-9]+)\|[^}]*\}\}", body)
        if diff == "hard":
            if any(e in PERSON_IDS for e in chips): errs.append("hard 有人名 chip")
            if any("speakerEntry" in s for s in c["segments"]): errs.append("hard 有 speakerEntry")
        # chip 数量与必织
        if len(chips) < 1: errs.append("无 chip")
        for e in REQUIRED[cid]:
            if e not in chips: errs.append(f"缺必织 chip {e}")
        # 人名 chip 每人 ≤1 次
        from collections import Counter
        for e, cnt in Counter(chips).items():
            if e in PERSON_IDS and cnt > 1: errs.append(f"人名 chip {e} 出现 {cnt} 次")
        # speakerEntry 的人物必须有 chip
        for s in c["segments"]:
            if "speakerEntry" in s and s["speakerEntry"] not in chips:
                errs.append(f"speakerEntry {s['speakerEntry']} 无 chip")
            if s.get("slot") and s["slot"] not in [b["slot"] for b in c["blanks"]]:
                errs.append(f"slot {s['slot']} 不在 blanks")
        # 配角名不得与人物词条重名
        for s in c["segments"]:
            sp = s.get("speaker")
            if sp and sp in NAMES.values(): errs.append(f"配角名 {sp} 与词条重名")
        # hints
        if len(c.get("hints", [])) != 2: errs.append("hints != 2")
        else:
            for b in c["blanks"]:
                nm = NAMES[b["answer"]]
                if any(nm in h for h in c["hints"]): errs.append(f"hints 含答案名 {nm}")
        status = "OK" if not errs else "FAIL: " + "; ".join(errs)
        if errs: ok = False
        print(f"{cid} {c['title']} {diff}/{ln} 字数{n} {status}")
    print("ALL PASS" if ok else "HAS FAILURES")

main()
