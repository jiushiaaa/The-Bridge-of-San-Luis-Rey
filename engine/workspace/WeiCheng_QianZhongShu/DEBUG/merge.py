# -*- coding: utf-8 -*-
"""把 DEBUG 下的分片（frame_gates / entries_* / cards_lv*）组装成 final_game.json。"""
import json, io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # workspace/WeiCheng_QianZhongShu

def load(name):
    with open(os.path.join(HERE, name), encoding='utf-8') as f:
        return json.load(f)

meta = {
    "id": "weicheng",
    "title": "围城",
    "subtitle": "城外的人想冲进去，城里的人想逃出来",
    "version": 2,
    "stamina": {"start": 8, "perLevel": 4, "searchCost": 1, "completeReward": 1, "restGain": 2},
    "cardSpec": {"avg": 750},
    "status": "wip",
    "art": {
        "portrait": ", Japanese anime style, bright warm colors, Kyoto Animation feeling, soft daylight, clean detailed character portrait, upper body, facing viewer, plain soft warm beige background, 1930s Republican-era China clothing, no text, no watermark",
        "scene": ", Japanese anime style, bright warm colors, Kyoto Animation feeling, soft light, detailed background illustration, 1930s Republican-era China setting, no text, no watermark",
        "item": ", Japanese anime style, bright warm colors, soft light, detailed still life, clean composition, 1930s Republican-era China object, no text, no watermark",
        "concept": ", symbolic illustration, Japanese anime style, bright warm colors, Kyoto Animation feeling, soft light, evocative composition, 1930s Republican-era China mood, no written characters, no text, no watermark",
        "cg": ", Japanese anime style, bright warm colors, Kyoto Animation feeling, cinematic 16:9 wide shot, soft cinematic light, expressive evocative composition, detailed background illustration, 1930s Republican-era China setting, no text, no watermark",
        "icon": ", emblem style game icon, centered symmetrical composition, bold clean shapes, Japanese anime style, bright colors, Kyoto Animation feeling, soft light, no text, no letters, no watermark",
    },
}

timelines = {
    "1": {"rows": ["印度洋上", "西贡之夜", "香港·靠岸", "上海·岳家", "故乡·讲台"],
          "cols": ["名场面", "方鸿渐", "苏文纨", "鲍小姐"]},
    "2": {"rows": ["战时的春天", "苏家花园", "峨嵋春", "一把折扇", "酒宴与月亮", "雨季·决裂"],
          "cols": ["名场面", "方鸿渐", "苏文纨", "唐晓芙", "赵辛楣"]},
    "3": {"rows": ["同情兄", "船上", "雨路", "金华", "鹰潭与南城", "吉安", "山那边"],
          "cols": ["名场面", "方鸿渐", "赵辛楣", "孙柔嘉"]},
    "4": {"rows": ["初到平成", "校长室", "克莱登", "课堂上", "导师制", "汪家晚宴", "春假", "订婚与解聘"],
          "cols": ["名场面", "方鸿渐", "赵辛楣", "孙柔嘉"]},
    "5": {"rows": ["离开三闾", "桂林到香港", "香港", "两个家庭", "小家庭", "报馆", "冬至", "老钟"],
          "cols": ["名场面", "方鸿渐", "孙柔嘉", "李妈"]},
}

levelStartEntries = {
    "1": ["e_fanghongjian", "e_suwenwan"],
    "2": ["e_zhaoxinmei"],
    "3": ["e_sunroujia"],
    "4": ["e_gaosongnian"],
    "5": ["e_lutaitai"],
}

assets = {
    "mysteryAvatar": "wc-assets/images/npc_unknown.png",
    "titleImage": "wc-assets/images/title.jpg",
    "endingImage": "wc-assets/images/ending.jpg",
    "sceneIcon": "wc-assets/images/scene_icon.jpg",
    "favicon": "wc-assets/images/favicon.png",
    "titleImagePrompt": "1930s Republican-era China, a young Chinese man in a loose Western suit standing on the deck of an ocean liner at golden dawn, the sea stretching to the horizon, a walled city gate faintly visible in the clouds, hopeful yet uncertain journey mood",
    "endingImagePrompt": "1930s Republican-era China, an old antique mechanical clock on a wooden table in a dim empty room at night, its hands pointing to six, a broken ivory comb beside it, melancholic serene mood, warm lamplight",
    "sceneIconPrompt": "an ancient Chinese city wall with its gate wide open, a small figure hesitating between inside and outside, an old clock face faintly merged into the wall bricks, symbolic of a besieged fortress and the passage of time",
}

def main():
    fg = load("frame_gates.json")
    entries = {}
    for name in ("entries_a.json", "entries_b.json", "entries_c.json"):
        part = load(name)
        for k, v in part.items():
            if k in entries:
                print(f"!! 词条重复: {k}")
            entries[k] = v
    cards = []
    for lv in range(1, 6):
        cards.extend(load(f"cards_lv{lv}.json"))

    out = {
        "meta": meta,
        "frame": fg["frame"],
        "levelStartEntries": levelStartEntries,
        "timelines": timelines,
        "gates": fg["gates"],
        "assets": assets,
        "entries": entries,
        "cards": cards,
    }
    path = os.path.join(ROOT, "final_game.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"OK: {len(entries)} entries, {len(cards)} cards -> {path}")

if __name__ == "__main__":
    main()
