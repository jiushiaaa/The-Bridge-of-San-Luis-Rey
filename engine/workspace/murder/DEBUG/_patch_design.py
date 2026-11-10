#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性修订 DESIGN.md 卡表必织词条（可收集性/创建必使用核算结论）。"""
import io, sys

P = r"workspace/murder/DEBUG/DESIGN.md"
s = io.open(P, encoding="utf-8").read()

REPL = [
    # c1_06 圣罗曼独白：补码头/单身公寓（词条 L1 第二来源）
    ("- 空位：NPC1=e_shengroman\n- 必织：e_xiusi(希乌斯)",
     "- 空位：NPC1=e_shengroman\n- 必织：e_xiusi(希乌斯) e_matou(码头) e_gongyu(单身公寓)"),
    # c1_08 安赫拉独白：补维卡家
    ("- 必织：e_guangchang(教堂广场) e_pulixi(普里西)",
     "- 必织：e_guangchang(教堂广场) e_pulixi(普里西) e_weikajia(维卡家)"),
    # c1_10 新娘独白：补纳萨 chip（纳萨 L1 唯一可收集 chip）
    ("- 空位：NPC1=e_anhela\n- 必织：e_shengroman(圣罗曼)",
     "- 空位：NPC1=e_anhela\n- 必织：e_shengroman(圣罗曼) e_nasa(纳萨)"),
    # c1_11 散步：补大宅/牧场
    ("- 必织：e_fuluola(弗洛拉) e_migejia(米格尔家) e_laona(老纳)",
     "- 必织：e_fuluola(弗洛拉) e_migejia(米格尔家) e_laona(老纳) e_dazhai(纳家大宅) e_muchang(圣颜牧场)"),
    # c1_13 婚礼独白：补马尔科（其 L1 唯一来源）/老纳
    ("- 空位：NPC1=e_nasa\n- 必织：e_anhela(安赫拉) e_fuluola(弗洛拉)\n- 取材：第一章 · 婚礼狂欢到凌晨（4:20 才回家）",
     "- 空位：NPC1=e_nasa\n- 必织：e_anhela(安赫拉) e_fuluola(弗洛拉) e_marco(马尔科) e_laona(老纳)\n- 取材：第一章 · 婚礼狂欢到凌晨（4:20 才回家）"),
    # c2_05 罗望子树下：补普鲁登家（其唯一第二来源）
    ("- 必织：e_tudao(两把屠刀) e_puludeng(普鲁登)",
     "- 必织：e_tudao(两把屠刀) e_puludeng(普鲁登) e_pulujia(普鲁登家)"),
    # c2_07 兄弟独白：补安赫拉（其 L2 可收集 chip）
    ("- 空位：NPC1=e_tufu\n- 必织：e_pulixi(普里西)",
     "- 空位：NPC1=e_tufu\n- 必织：e_pulixi(普里西) e_anhela(安赫拉)"),
    # c2_10 刮脸独白：补主教船（L2 第二来源）
    ("- 空位：NPC1=e_tufu\n- 必织：e_niunaidian(牛奶店)",
     "- 空位：NPC1=e_tufu\n- 必织：e_niunaidian(牛奶店) e_chuan(主教船)"),
    # c2_13 修女口信：补主教船
    ("- 必织：e_amaduo(阿马尔多) e_jiaotang(神父住处)",
     "- 必织：e_amaduo(阿马尔多) e_jiaotang(神父住处) e_chuan(主教船)"),
    # c3_09 最后一句话：补信匣（其第二来源）
    ("- 必织：e_tufu(屠夫兄弟) e_dazhai(纳家大宅)",
     "- 必织：e_tufu(屠夫兄弟) e_dazhai(纳家大宅) e_xinxia(信匣)"),
    # c4_04 法官：补公立学校/镇监狱
    ("- 必织：e_baogao(预审报告残页) e_suming(宿命) e_amaduo(阿马尔多)",
     "- 必织：e_baogao(预审报告残页) e_suming(宿命) e_amaduo(阿马尔多) e_xuexiao(公立学校) e_jianyu(镇监狱)"),
    # c4_09 母子对话：补纳萨/市政厅
    ("- 必织：e_luyisa(路易萨) e_pulaxida(普拉西达)",
     "- 必织：e_luyisa(路易萨) e_pulaxida(普拉西达) e_nasa(纳萨) e_shizheng(市政厅)"),
    # c4_11 被改变的人们：补玛丽亚/玛丽亚之家
    ("- 必织：e_faguan(预审法官) e_fuluola(弗洛拉)",
     "- 必织：e_faguan(预审法官) e_fuluola(弗洛拉) e_maria(玛丽亚) e_mariajia(玛丽亚之家)"),
    # c4_13 开始写信：补里奥阿查
    ("- 必织：e_guaxila(瓜希拉荒村) e_xin(安赫拉的信)",
     "- 必织：e_guaxila(瓜希拉荒村) e_xin(安赫拉的信) e_liaoacha(里奥阿查)"),
    # c4_15 醉倒独白：补玛丽亚之家（其第二来源）
    ("- 空位：NPC1=e_shengroman\n- 必织：e_bieshu(山丘别墅) e_xiusi(希乌斯)",
     "- 空位：NPC1=e_shengroman\n- 必织：e_bieshu(山丘别墅) e_xiusi(希乌斯) e_mariajia(玛丽亚之家)"),
]

n = 0
for old, new in REPL:
    if s.count(old) != 1:
        print("FAIL count=%d: %s" % (s.count(old), old[:50]))
        sys.exit(1)
    s = s.replace(old, new)
    n += 1
io.open(P, "w", encoding="utf-8").write(s)
print("patched %d spots" % n)
