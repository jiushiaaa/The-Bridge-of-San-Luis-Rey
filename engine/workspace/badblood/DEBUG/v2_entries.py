#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""坏血 v2 修订 · 词条与档案：新增受害者/见证者词条，全词条标 tier（core/major/minor），
按分层规格扩写 desc 与档案字段，打散过度集中在主角身上的档案留白，闸3 换一道「代价」向的题。
按 id upsert，可重复执行。用法: python workspace/badblood/DEBUG/v2_entries.py
"""
import json
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "final_game.json"

AV = "bad-assets/avatars/%s.jpg"
IM = "bad-assets/images/%s.jpg"


def blank(label, answer, pool):
    return {"label": label, "blank": {"answer": answer, "pool": pool}}


def text(label, t):
    return {"label": label, "text": t}


# ------------------------------------------------------------ 新增词条

NEW_ENTRIES = {
    "e_glunz": {
        "name": "格伦兹",
        "type": "person",
        "tier": "major",
        "desc": "感恩节夜里被一份错报告送进急诊的病人，独立房地产经纪人",
        "avatar": AV % "e_glunz",
        "archive": [{
            "level": 3,
            "title": "三千美元的一夜",
            "fields": [
                text("身份", "五十多岁的独立房地产经纪人，自己买保险，自负额高得吓人"),
                text("那一夜", "感恩节的晚上在急诊室待了四个小时，抽血、心电、CT做了一整套"),
                text("代价", "急诊加随后两次核磁共振自付三千美元，保险不管虚惊一场"),
                blank("把她送去急诊的家庭医生", "e_sundene", "person"),
                blank("她贴在冰箱门上的那张纸", "e_bill", "item"),
            ]
        }]
    },
    "e_sundene": {
        "name": "桑德内",
        "type": "person",
        "tier": "major",
        "desc": "沙漠城市郊区的家庭医生，十几个病人结果可疑，替记者做了对比检测",
        "avatar": AV % "e_sundene",
        "archive": [{
            "level": 3,
            "title": "十几份可疑报告",
            "fields": [
                text("执业", "在这座沙漠城市郊区开家庭诊所，病人多是十几年的熟脸"),
                text("发现", "半年里十几个病人的钾和钙高得没道理，去别处重查多半正常"),
                text("投诉", "写信给那家公司，对方连收到这封信都不肯承认"),
                text("反击", "给记者开检测单，自己也两边各抽一次，把样本凑多一点"),
                blank("她最有代表性的那位病人", "e_glunz", "person"),
            ]
        }]
    },
    "e_dupuy": {
        "name": "杜普伊",
        "type": "person",
        "tier": "minor",
        "desc": "第一间实验室的技术员，把违规操作一条条记下来的人",
        "avatar": AV % "e_dupuy",
        "archive": [{
            "level": 2,
            "title": "记笔记的人",
            "fields": [
                text("资历", "休斯敦来的临床技术员，拿执照七年，监管条文背得最熟"),
                text("记录", "过期试剂、未校准的机器、被污染的染色剂，逐条拍照上报"),
                text("结局", "被解雇两次，第二次当场带出大门，眼镜和执照都锁在抽屉里"),
                blank("她邮件里点名的那种空气", "e_fear", "concept"),
            ]
        }]
    },
    "e_gardner": {
        "name": "加德纳",
        "type": "person",
        "tier": "minor",
        "desc": "斯坦福医学院教授，最早说那个构想做不到的人",
        "avatar": AV % "e_gardner",
        "archive": [{
            "level": 3,
            "title": "最早说不的人",
            "fields": [
                text("身份", "斯坦福医学院教授，做过多年生物技术评审"),
                text("旧事", "创业之初她就说过：那个贴片在物理上做不到"),
                text("结盟", "官司之后，她与宿敌、遗孀一起成了怀疑派"),
                blank("与她结盟的那位遗孀", "e_rochelle", "person"),
            ]
        }]
    },
    "e_meadow": {
        "name": "草地东环路",
        "type": "place",
        "tier": "major",
        "desc": "帕洛阿尔托的单层石砌小楼，公司第一间临床实验室，里面全是商用设备",
        "image": IM % "e_meadow",
        "archive": [{
            "level": 2,
            "title": "没有专有设备的实验室",
            "fields": [
                text("位置", "帕洛阿尔托一条以草地命名的环路，一栋单层石砌小楼"),
                text("家当", "一屋子买来的商用分析仪，没有一台是自家的机器"),
                text("人手", "缺有经验的技术员，违规操作屡屡被人记录在案"),
                blank("被破解来稀释指尖血的那台商用机", "e_advia", "item"),
            ]
        }]
    },
    "e_bill": {
        "name": "三千美元的账单",
        "type": "item",
        "tier": "minor",
        "desc": "虚惊一场的急诊收费单，保险拒付，由病人自己付清",
        "image": IM % "e_bill",
        "archive": [{
            "level": 3,
            "title": "一个普通人的代价",
            "fields": [
                text("来历", "一份错报告引出的急诊、CT与两次核磁共振"),
                text("金额", "三千美元，保险以虚惊一场为由拒付"),
                text("去处", "被贴在冰箱门上，后来成了报道里的一条证据"),
                blank("自己付清这笔钱的人", "e_glunz", "person"),
            ]
        }]
    },
}

# ------------------------------------------------------------ 重要度分层

CORE = ["e_holmes", "e_sunny", "e_ian", "e_tyler", "e_fuisz"]
MAJOR = [
    "e_shaunak", "e_tony", "e_mosley", "e_tkemp", "e_shultz", "e_erika", "e_beam",
    "e_carreyrou", "e_boies", "e_hunter", "e_burd", "e_shoemaker", "e_daniel",
    "e_glunz", "e_sundene", "e_meadow", "e_edison", "e_minilab", "e_fakeit", "e_facebook",
]

# ------------------------------------------------------------ desc 补写（分层字数）

DESC = {
    "e_sunny": "总裁兼COO，比创始人大近二十岁的秘密男友，靠恐吓维持秩序的人",
    "e_ian": "第一位资深科学家，剑桥生物化学博士，五十项专利在身，痴迷免疫测定",
    "e_tyler": "前国务卿的孙子，初级研究员，化名向州卫生部求证、最早站出来的人",
    "e_fuisz": "创始人家的童年邻居，医生、发明家、自称干过特工，二十年交情打成官司",
    "e_mosley": "首席财务官，2006年入职，因当面揭穿演示造假被当场解雇",
    "e_erika": "初级实验员，在质控一线的吹哨人，一封投诉信引爆了监管检查",
    "e_carreyrou": "《华尔街日报》调查记者，跑医疗条线多年，靠逐条核实撬开独角兽",
    "e_shoemaker": "军方的药监事务专家，中校，把监管底线顶在了四星上将前面",
    "e_minilab": "代号4S的台式实验室，被称作「人类迄今最重要的东西」",
    "e_zurich": "瑞士，欧洲大药企的地盘，那场「太完美了」的演示在这里",
}

# ------------------------------------------------------------ 档案补写（按 tier 规格）

ARCHIVES = {
    # ---- core：每页 5~6 字段、≥2 留白、至少一个 ≥25 字的细节字段
    "e_holmes": [
        {"level": 1, "title": "斯坦福辍学生", "fields": [
            text("出身", "华盛顿特区名流家庭，祖辈创立过酵母帝国又败落"),
            text("志向", "九岁宣称「不，总统将会娶我，因为我会拥有10亿美元」"),
            text("学历", "斯坦福大学化学工程系，读到大二辍学创业"),
            text("标志", "黑色高领衫、压低的嗓音、每天只睡四小时，整天嚼巧克力咖啡豆"),
            blank("第一位投资人", "e_draper", "person"),
            blank("最初构想", "e_patch", "item"),
        ]},
        {"level": 2, "title": "独角兽女王", "fields": [
            text("巅峰", "公司估值九十亿美元，她的个人身家将近五十亿"),
            text("阵仗", "二十人保安团队、「老鹰一号」代号、一辆没有车牌的奥迪"),
            text("权柄", "2013年起每股一百票、握有99.7%投票权——「董事会只是个摆设」"),
            blank("秘密男友", "e_sunny", "person"),
            blank("象征着装", "e_turtleneck", "item"),
        ]},
        {"level": 3, "title": "被告", "fields": [
            text("崩塌", "报道、突检、禁业，十八个月内尽失"),
            text("代价", "作废与纠正的检测结果接近一百万份，投资者损失约十亿美元"),
            text("结局", "与SEC和解：放弃投票控制权、罚款五十万；随后被刑事起诉"),
            text("总结", "她不是任何人的傀儡——「在这里所有事情我说了算」"),
            blank("被她抛弃的搭档", "e_sunny", "person"),
            blank("让她现形的那篇头版出自谁手", "e_carreyrou", "person"),
        ]},
    ],
    "e_sunny": [
        {"level": 2, "title": "商业竞价网富豪", "fields": [
            text("来历", "互联网泡沫里卖掉一家公司，套现四千多万美元"),
            text("管理", "恐吓式——「我挣的钱够养活我家七代人，我根本不用待在这儿」"),
            text("笑话", "把「末端执行器」听成「末端因子」，工程师照着这个错名做了一整份PPT"),
            blank("女友", "e_holmes", "person"),
            blank("管理风格", "e_fear", "concept"),
        ]},
        {"level": 3, "title": "被抛弃的搭档", "fields": [
            text("分手", "2016年5月被分手并解雇，恐惧机器的总教头自己被清了出去"),
            text("现身", "2017年的取证会上坐在长桌另一端，试图用眼神压住那位年轻证人"),
            text("指控", "与她一同被指控「精心策划、持续多年的欺诈」，各缴五十万美元保释金"),
            blank("他曾挡在实验室门口的巡视员", "e_yamamoto", "person"),
            blank("他被赶走那年发布的机器", "e_minilab", "item"),
        ]},
    ],
    "e_ian": [
        {"level": 1, "title": "第一位资深科学家", "fields": [
            text("学位", "剑桥大学生物化学博士，来公司前做过多年体外诊断"),
            text("资历", "约五十项专利的发明人，其中十九项来自上一家公司"),
            text("执念", "设备里做的检测，必须和大实验室里做的一样准——这是他的底线"),
            text("性情", "书呆子式的英国人，开会时把「数据」两个字挂在嘴边"),
            blank("雇他的创始人", "e_holmes", "person"),
            blank("他从图纸守到样机的机器", "e_edison", "item"),
        ]},
        {"level": 2, "title": "无声的呼救", "fields": [
            text("遭遇", "向老教授发牢骚被转手出卖，先遭解雇，又在同事求情后降职召回"),
            text("诊断", "他说那对当家人是「一对二联性精神病」"),
            text("结局", "被传唤作证后服毒，八天后离世；公司不办纪念仪式"),
            blank("出卖他的教授", "e_robertson", "person"),
            blank("遗孀", "e_rochelle", "person"),
        ]},
    ],
    "e_tyler": [
        {"level": 2, "title": "孙子", "fields": [
            text("家世", "前国务卿之孙，全家的骄傲进了那家公司"),
            text("发现", "不合格的轮次被直接丢弃重跑，梅毒检测的敏感度对外虚报成九成五"),
            text("代价", "辞职后被骂「唯一的原因在于你是舒尔茨先生的孙子」"),
            blank("祖父", "e_shultz", "person"),
            blank("战友", "e_erika", "person"),
        ]},
        {"level": 3, "title": "拒签的人", "fields": [
            text("伏击", "祖父家的客厅里，两名律师从楼上下来，递过一份限制令"),
            text("选择", "祖父把「两年不起诉」改成「永远」，他仍然拒签"),
            text("代价", "父母为他的律师费花掉四十多万美元，他从记者视野里消失了一阵"),
            text("终局", "2017年的取证会上被前总裁当面盯了八个半小时，他一句台词也不需要"),
            blank("摊牌地点", "e_hoover", "place"),
            blank("同月辞职的另一个年轻人", "e_erika", "person"),
        ]},
    ],
    "e_fuisz": [
        {"level": 1, "title": "童年邻居", "fields": [
            text("身份", "医生、发明家，自称还替政府干过不能说的差事"),
            text("交恶", "邻家女孩创业做验血，一次也没来请教过他，他耿耿于怀两年"),
            text("手笔", "申请了一项居家血检异常警告的专利，私下管它叫「杀手」"),
            blank("他认定自己早想到十年的那个构想", "e_patch", "item"),
            blank("住所", "e_mclean", "place"),
        ]},
        {"level": 3, "title": "怀疑派盟主", "fields": [
            text("动机", "官司烧掉两百多万、当庭落泪，他不认错，只认一件事：那机器不管用"),
            text("串线", "把教授、遗孀、离职的实验室主管连成一张网"),
            text("笔记", "「对CLIA的人撒谎/作弊」「告诉伊莎没准备好但她坚持继续」"),
            blank("被他请去和盟友通话的前主管", "e_beam", "person"),
            blank("盟友遗孀", "e_rochelle", "person"),
        ]},
    ],
    # ---- major：每页 4~5 字段、≥1 留白、字段正文平均 ≥14 字
    "e_shaunak": [
        {"level": 1, "title": "一号员工", "fields": [
            text("身份", "联合创始人，化学工程博士，本来有教职在等他"),
            text("入职", "2004年5月成为公司第一个雇员，工号001"),
            text("性情", "务实，习惯把「能不能做到」放在「想不想做到」前面"),
            text("离场", "2007年底友好离职，113万股以50美分一股回售"),
            blank("他从头参与的那台原型机", "e_theranos1", "item"),
        ]},
    ],
    "e_mosley": [
        {"level": 1, "title": "说真话的CFO", "fields": [
            text("职位", "首席财务官，2006年3月入职，每份投资人材料都要过他手"),
            text("发现", "投资者看到的「实时结果」，是提前录好的回放"),
            text("结局", "当面质问后被当场解雇，后来还被公司用私人资料抹黑"),
            text("名言", "「我们是在欺骗投资者。」"),
            blank("造假演示发生地", "e_zurich", "place"),
        ]},
    ],
    "e_tkemp": [
        {"level": 1, "title": "发送结果的人", "fields": [
            text("职位", "生物信息主管，来公司前在IBM待了三十年"),
            text("软肋", "唯唯诺诺，老板要什么数字，他就找得出什么数字"),
            text("关键一票", "演示当天设备死机，他从加州远程发出了假结果"),
            blank("演示发生地", "e_zurich", "place"),
        ]},
    ],
    "e_erika": [
        {"level": 3, "title": "引爆检查的信", "fields": [
            text("岗位", "初级实验员，在质控一线看着「极端值」被删掉"),
            text("遭遇", "辞职信被人事没收，后来在新公司停车场被递了一封恐吓信"),
            text("反击", "2015年9月19日一封投诉信，直接引爆了那场监管检查"),
            blank("收信的巡视员", "e_yamamoto", "person"),
            blank("战友", "e_tyler", "person"),
        ]},
    ],
    "e_carreyrou": [
        {"level": 3, "title": "调查记者", "fields": [
            text("供职", "财经大报的调查记者，跑医疗条线多年，揭过药企黑幕"),
            text("开局", "一通深夜电话从医生入行时的誓言讲起，他记了一个多小时"),
            text("方法", "化名暗访、亲身对比检测、每条线索都要第二个信源"),
            blank("供职报社", "e_wsjhq", "place"),
        ]},
        {"level": 3, "title": "拉马坦萨", "fields": [
            text("策略", "像西西里渔夫围捕鱼群：耐心收网，等对手自己乱"),
            text("遭遇", "律师团上门对峙四小时，信源被跟踪、被威胁、被要求签声明"),
            text("底牌", "四十多家健康中心、上百通信源电话、一叠并排钉住的报告"),
            blank("引爆他调查的博主", "e_clapper", "person"),
        ]},
    ],
    "e_burd": [
        {"level": 2, "title": "健康游戏", "fields": [
            text("身份", "老牌超市连锁的掌门人，痴迷「健康生意」"),
            text("豪赌", "掏出三亿五千万美元改造门店，代号「霸王龙计划」"),
            text("结局", "被迫退休，从此她再也不接他的电话"),
            blank("超市总部", "e_pleasanton", "place"),
        ]},
    ],
    "e_facebook": [
        {"level": 2, "title": "侏罗纪公园与诺曼底", "fields": [
            text("来历", "从一家社交网站手里盘下的旧办公楼，二楼整层是实验室"),
            text("分区", "商用设备那半边叫「侏罗纪公园」，专有设备那半边叫「诺曼底」"),
            text("规矩", "巡视员来了只看得到侏罗纪公园，另一半的门一直锁着"),
            blank("锁着那半边里永远差一口气的机器", "e_minilab", "item"),
        ]},
    ],
    "e_fakeit": [
        {"level": 2, "title": "先装成，再做到", "fields": [
            text("出处", "硅谷的老话：先把姿态摆足，再让现实追上来"),
            text("边界", "卖软件可以演，卖验血不行——医生要拿着结果给病人开药"),
            text("顶点", "上千项检测、九十亿估值，全建在一句还没兑现的承诺上"),
            blank("它在募资材料里最漂亮的证物", "e_scatter", "item"),
        ]},
    ],
    # ---- minor：把指向主角的留白换成更有信息量的问题
    "e_avie": [
        {"level": 1, "title": "被逼退的董事", "fields": [
            text("出身", "苹果前高管，做过操作系统，较真到近乎固执"),
            text("罪状", "质疑收入预测与高管更替，要求董事会把账本摆出来"),
            text("结局", "被逼辞职，平安夜收到律师威胁邮件"),
            blank("用来威胁他的那叠纸", "e_nda", "item"),
        ]},
    ],
    "e_nda": [
        {"level": 1, "title": "沉默的代价", "fields": [
            text("用途", "入职签、离职签、领英上只许写「一家私人生物公司」"),
            text("威力", "告发者当天被解雇，签完厚厚一叠才被允许收拾抽屉"),
            text("延伸", "互不诋毁、材料交还或「永久销毁」、律师信随时上门"),
            blank("靠它把人按住的那种空气", "e_fear", "concept"),
        ]},
    ],
}

GATE3_VICTIM_BLANK = {
    "prompt": "感恩节夜里被一份错报告送进急诊、自付三千美元的病人",
    "answerEntry": "e_glunz",
}


def main() -> None:
    g = json.loads(DATA.read_text(encoding="utf-8"))
    entries = g["entries"]

    for eid, e in NEW_ENTRIES.items():
        entries[eid] = e

    for eid, e in entries.items():
        e["tier"] = "core" if eid in CORE else "major" if eid in MAJOR else "minor"
        # 字段顺序：把 tier 放在 desc 之后，便于人工阅读
        ordered = {}
        for k in ("name", "type", "tier", "desc", "avatar", "image", "archive"):
            if k in e:
                ordered[k] = e[k]
        for k, v in e.items():
            if k not in ordered:
                ordered[k] = v
        entries[eid] = ordered

    for eid, d in DESC.items():
        entries[eid]["desc"] = d

    for eid, pages in ARCHIVES.items():
        entries[eid]["archive"] = pages

    # 闸3：换掉一道高管题，改问受害者（README_game §4.7）
    gate3 = next(x for x in g["gates"] if x["after"] == 3)
    gate3["blanks"] = [b for b in gate3["blanks"] if b.get("answerEntry") != "e_murdoch"]
    gate3["blanks"].insert(4, GATE3_VICTIM_BLANK)

    DATA.write_text(json.dumps(g, ensure_ascii=False, indent=1), encoding="utf-8")
    n_blanks = sum(1 for e in entries.values() for p in e.get("archive", [])
                   for f in p["fields"] if "blank" in f)
    print(f"词条改造完成：+{len(NEW_ENTRIES)} 词条，全量 tier，档案留白共 {n_blanks} 处")


if __name__ == "__main__":
    main()
