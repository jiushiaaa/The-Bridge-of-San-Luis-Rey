import json, re, sys

p = "workspace/murder/DEBUG/entries.json"
data = json.load(open(p, encoding="utf-8"))

# 设计稿 §5 的 60 个词条 + e_mariajia（卡面与§6引用但§5漏列）
expected = {
 "e_nasa":("person","core"),"e_anhela":("person","core"),"e_shengroman":("person","core"),
 "e_tufu":("person","core"),"e_marco":("person","core"),
 "e_pulaxida":("person","major"),"e_beiduoya":("person","major"),"e_keluodi":("person","major"),
 "e_aponte":("person","major"),"e_weiduoli":("person","major"),"e_diveina":("person","major"),
 "e_pulixi":("person","major"),"e_amaduo":("person","major"),"e_puludeng":("person","major"),
 "e_fuluola":("person","major"),"e_maria":("person","major"),"e_faguan":("person","major"),
 "e_pangxiao":("person","minor"),"e_xiusi":("person","minor"),"e_shengjiangjun":("person","minor"),
 "e_laona":("person","minor"),"e_yigulan":("person","minor"),"e_mage":("person","minor"),
 "e_luyisa":("person","minor"),"e_nayier":("person","minor"),
 "e_dazhai":("place","major"),"e_niunaidian":("place","major"),"e_bieshu":("place","major"),
 "e_weikajia":("place","minor"),"e_matou":("place","minor"),"e_guangchang":("place","minor"),
 "e_jiaotang":("place","minor"),"e_gongyu":("place","minor"),"e_julebu":("place","minor"),
 "e_roushi":("place","minor"),"e_pulujia":("place","minor"),"e_migejia":("place","minor"),
 "e_xuexiao":("place","minor"),"e_jianyu":("place","minor"),"e_laozhai":("place","minor"),
 "e_guaxila":("place","minor"),"e_liaoacha":("place","minor"),"e_muchang":("place","minor"),
 "e_shizheng":("place","minor"),"e_mariajia":("place","minor"),
 "e_tudao":("item","major"),"e_qiang":("item","major"),"e_changji":("item","major"),
 "e_xin":("item","major"),"e_lifu":("item","major"),"e_baogao":("item","major"),
 "e_chuan":("item","major"),
 "e_jinggaoxin":("item","minor"),"e_jinianzhang":("item","minor"),"e_xinxia":("item","minor"),
 "e_xiuhuajia":("item","minor"),
 "e_rongyu":("concept","major"),"e_chenmo":("concept","major"),
 "e_suming":("concept","minor"),"e_jiemeng":("concept","minor"),"e_qiwei":("concept","minor"),
}

# §6 留白分配（按 label 清单逐条抄录）
blanks_expected = {
 ("e_nasa",0):["e_laona","e_muchang"], ("e_nasa",1):["e_qiang","e_fuluola"],
 ("e_nasa",2):["e_amaduo","e_faguan"],
 ("e_anhela",0):["e_pulixi","e_shengroman"], ("e_anhela",1):["e_tufu","e_pulixi"],
 ("e_anhela",2):["e_xin","e_guaxila"],
 ("e_shengroman",0):["e_bieshu","e_shengjiangjun"], ("e_shengroman",1):["e_yigulan","e_xin"],
 ("e_tufu",0):["e_roushi","e_anhela"], ("e_tufu",1):["e_puludeng","e_qiwei"],
 ("e_marco",0):["e_nasa","e_shengroman"], ("e_marco",1):["e_baogao","e_luyisa"],
 ("e_pulaxida",0):["e_jiemeng"], ("e_beiduoya",0):["e_qiang"], ("e_keluodi",0):["e_niunaidian"],
 ("e_aponte",0):["e_tudao"], ("e_weiduoli",0):["e_laona"], ("e_diveina",0):["e_nasa"],
 ("e_pulixi",0):["e_anhela"], ("e_amaduo",0):["e_chuan"], ("e_amaduo",1):["e_jinianzhang"],
 ("e_puludeng",0):["e_tufu"], ("e_fuluola",0):["e_xinxia"], ("e_maria",0):["e_mariajia"],
 ("e_faguan",0):["e_baogao"], ("e_dazhai",0):["e_jinggaoxin"], ("e_niunaidian",0):["e_keluodi"],
 ("e_bieshu",0):["e_xiusi"], ("e_tudao",0):["e_aponte"], ("e_qiang",0):["e_nasa"],
 ("e_xin",0):["e_anhela"], ("e_baogao",0):["e_nasa"], ("e_rongyu",0):["e_tufu"],
 ("e_chenmo",0):["e_keluodi"], ("e_guaxila",0):["e_anhela"], ("e_jinggaoxin",0):["e_dazhai"],
 ("e_jinianzhang",0):[], ("e_suming",0):["e_faguan"], ("e_qiwei",0):["e_tufu"],
}

# 应有档案页的词条及页数
archive_expected = {"e_nasa":3,"e_anhela":3,"e_shengroman":2,"e_tufu":2,"e_marco":2,
 "e_pulaxida":1,"e_beiduoya":1,"e_keluodi":1,"e_aponte":1,"e_weiduoli":1,"e_diveina":1,
 "e_pulixi":1,"e_amaduo":2,"e_puludeng":1,"e_fuluola":1,"e_maria":1,"e_faguan":1,
 "e_dazhai":1,"e_niunaidian":1,"e_bieshu":1,"e_tudao":1,"e_qiang":1,"e_xin":1,"e_baogao":1,
 "e_rongyu":1,"e_chenmo":1,"e_guaxila":1,"e_jinggaoxin":1,"e_jinianzhang":1,"e_suming":1,"e_qiwei":1}

errors = []
def hanzi(s): return len(re.findall(r"[一-鿿]", s))

# 1. 词条齐全
missing = set(expected) - set(data)
extra = set(data) - set(expected)
if missing: errors.append(f"缺词条: {missing}")
if extra: errors.append(f"多词条: {extra}")

total_pages = 0; total_blanks = 0; blank_answers = {}
for eid, (etype, etier) in expected.items():
    e = data.get(eid)
    if not e: continue
    if e["type"] != etype: errors.append(f"{eid} type {e['type']} != {etype}")
    if e["tier"] != etier: errors.append(f"{eid} tier {e['tier']} != {etier}")
    # desc 字数
    n = hanzi(e["desc"])
    rng = {"core":(30,60),"major":(20,40),"minor":(12,30)}[etier]
    if not (rng[0] <= n <= rng[1]): errors.append(f"{eid} desc {n}字 超出{rng}")
    # 图片字段
    key = "avatar" if etype=="person" else "image"
    if key not in e: errors.append(f"{eid} 缺 {key}")
    elif e[key] != f"murder-assets/{'avatars' if etype=='person' else 'images'}/{eid}.jpg":
        errors.append(f"{eid} {key} 路径错: {e[key]}")
    # 档案页
    arch = e.get("archive", [])
    want = archive_expected.get(eid, 0)
    if len(arch) != want: errors.append(f"{eid} 档案页 {len(arch)} != {want}")
    total_pages += len(arch)
    labels = set()
    for pi, page in enumerate(arch):
        fl = page["fields"]
        nb = sum(1 for f in fl if "blank" in f)
        texts = [f["text"] for f in fl if "text" in f]
        total_blanks += nb
        # 字段数与留白数
        if etier=="core":
            if not (5 <= len(fl) <= 6): errors.append(f"{eid} p{pi} core字段数 {len(fl)}")
            if nb < 2: errors.append(f"{eid} p{pi} core留白 {nb} <2")
            if not any(hanzi(t) >= 25 for t in texts): errors.append(f"{eid} p{pi} core缺≥25字长字段")
        elif etier=="major":
            if not (4 <= len(fl) <= 5): errors.append(f"{eid} p{pi} major字段数 {len(fl)}")
            if nb < 1: errors.append(f"{eid} p{pi} major留白 {nb} <1")
            if texts and sum(hanzi(t) for t in texts)/len(texts) < 14:
                errors.append(f"{eid} p{pi} major字段均长 <14")
        else:
            if not (3 <= len(fl) <= 4): errors.append(f"{eid} p{pi} minor字段数 {len(fl)}")
        # 任何字段正文 ≥8 字
        for f in fl:
            if "text" in f and hanzi(f["text"]) < 8: errors.append(f"{eid} p{pi} 字段[{f['label']}] 正文不足8字")
            if "blank" in f:
                b = f["blank"]
                if b["answer"] not in data: errors.append(f"{eid} p{pi} blank答案 {b['answer']} 不存在")
                else:
                    want_pool = data[b["answer"]]["type"]
                    if b["pool"] != want_pool: errors.append(f"{eid} p{pi} blank pool {b['pool']} != {want_pool}")
                blank_answers[b["answer"]] = blank_answers.get(b["answer"],0)+1
        # 同页不重答案
        ans = [f["blank"]["answer"] for f in fl if "blank" in f]
        if len(ans) != len(set(ans)): errors.append(f"{eid} p{pi} 同页留白答案重复")
        # §6 答案核对
        exp = blanks_expected.get((eid,pi))
        if exp is not None and sorted(ans) != sorted(exp):
            errors.append(f"{eid} p{pi} 留白 {ans} != §6 {exp}")
        # 同词条跨页 label 不重复
        for f in fl:
            if f["label"] in labels: errors.append(f"{eid} label 重复: {f['label']}")
            labels.add(f["label"])

print(f"词条数: {len(data)} (设计§5为60; +e_mariajia 补丁)")
print(f"档案页总数: {total_pages}")
print(f"留白总数: {total_blanks}")
print(f"去重答案数: {len(blank_answers)}")
top = max(blank_answers.items(), key=lambda kv: kv[1])
print(f"单答案最多次数: {top[0]} x{top[1]}")
from collections import Counter
types = Counter(e["type"] for e in data.values()); tiers = Counter(e["tier"] for e in data.values())
print(f"类型分布: {dict(types)}; tier分布: {dict(tiers)}")
if errors:
    print("\n错误:")
    for x in errors: print(" -", x)
    sys.exit(1)
print("\nALL CHECKS PASSED")
