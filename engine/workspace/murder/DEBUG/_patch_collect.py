#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""修复三处「关卡内不可收集」：c1_11+e_xinxia / c3_08+e_amaduo / c4_08+e_tufu。"""
import io, json, sys

def patch(path, cid, seg_idx, old, new):
    cards = json.load(io.open(path, encoding="utf-8"))
    hit = [c for c in cards if c["id"] == cid]
    assert len(hit) == 1, cid
    seg = hit[0]["segments"][seg_idx]
    assert old in seg["text"], (cid, seg_idx, seg["text"][:60])
    seg["text"] = seg["text"].replace(old, new)
    io.open(path, "w", encoding="utf-8").write(json.dumps(cards, ensure_ascii=False, indent=1))
    print("patched", cid)

# 1) c1_11：纳萨提起写给她的信与信匣（e_xinxia L1 可收集，供弗洛拉 L1 档案留白）
patch("workspace/murder/DEBUG/cards_lv1.json", "c1_11", 14,
      "等钱到了手，先给你打一套首饰。",
      "等钱到了手，先给你打一套首饰。还有，你收着我那些信的那只{{e_xinxia|信匣}}，可别弄丢了，等成了亲，我要接着往里写。")

# 2) c3_08：神父在码头人群边出神（e_amaduo L3 可收集，供主教船 L3 档案留白）
patch("workspace/murder/DEBUG/cards_lv3.json", "c3_08", 0,
      "朋友的妹妹{{e_mage|玛戈特}}提着裙摆凑过来听热闹。",
      "朋友的妹妹{{e_mage|玛戈特}}提着裙摆凑过来听热闹。人群边上，{{e_amaduo|阿马尔多}}神父还望着船去的方向出神，像是有心事。")

# 3) c4_08：修女妹妹转述动手的人（e_tufu L4 可收集，供气味 L4 档案留白）
patch("workspace/murder/DEBUG/cards_lv4.json", "c4_08", 13,
      "她说，全镇早知道要出事，就是没人拦得住。",
      "她说，动手的就是凌晨在肉市放话的{{e_tufu|屠夫兄弟}}，全镇早知道要出事，就是没人拦得住。")
