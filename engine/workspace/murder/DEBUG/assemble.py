#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""组装 workspace/murder/final_game.json（entries + cards_lv1..4 + frame + gates + 静态段）。"""
import io, json, os

D = os.path.dirname(os.path.abspath(__file__))

def load(name):
    return json.load(io.open(os.path.join(D, name), encoding="utf-8"))

cards = []
for f in ["cards_lv1.json", "cards_lv2.json", "cards_lv3.json", "cards_lv4.json"]:
    cards += load(f)

game = {
    "meta": {
        "id": "murder",
        "title": "一桩事先张扬的凶杀案",
        "subtitle": "全镇都知道，只有他不知道",
        "version": 2,
        "stamina": {"start": 8, "perLevel": 4, "searchCost": 1, "completeReward": 1, "restGain": 2},
        "cardSpec": {"avg": 700},
    },
    "frame": load("frame.json"),
    "entries": load("entries.json"),
    "cards": cards,
    "timelines": {
        "1": {"rows": ["外乡人到港", "门厅一瞥", "唱机与逼婚", "山丘上的别墅", "婚礼与退婚"],
              "cols": ["名场面", "圣罗曼", "安赫拉", "纳萨"]},
        "2": {"rows": ["餐桌上的名字", "肉市磨刀", "牛奶店的等待", "镇长收走的刀", "罗望子树下", "全镇都知道了"],
              "cols": ["名场面", "屠夫兄弟", "克洛蒂", "阿庞特"]},
        "3": {"rows": ["厨房里的兔子", "梦与礼服", "死亡之门", "主教不停船", "两条路", "门闩"],
              "cols": ["名场面", "纳萨", "贝多亚", "普拉西达"]},
        "4": {"rows": ["我们无罪", "学校里的解剖", "月食之夜", "找不到证据的法官", "牢房里的气味", "宾馆窗前", "好吧，我来了"],
              "cols": ["名场面", "马尔科", "安赫拉", "圣罗曼"]},
    },
    "levelStartEntries": {
        "1": ["e_fuluola", "e_beiduoya"],
        "2": ["e_rongyu"],
        "3": ["e_qiang"],
        "4": ["e_marco"],
    },
    "gates": load("gates.json"),
    "assets": {
        "mysteryAvatar": "murder-assets/images/npc_unknown.png",
        "titleImage": "murder-assets/images/title.jpg",
        "endingImage": "murder-assets/images/ending.jpg",
        "sceneIcon": "murder-assets/images/scene_icon.jpg",
        "favicon": "murder-assets/images/favicon.png",
    },
}

out = os.path.join(D, "..", "final_game.json")
io.open(out, "w", encoding="utf-8").write(json.dumps(game, ensure_ascii=False, indent=1))
print("assembled %d cards, %d entries -> %s" % (len(cards), len(game["entries"]), out))
