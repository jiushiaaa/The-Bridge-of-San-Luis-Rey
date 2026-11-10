# tools/i18n_tw_polish.py — OpenCC 之后的台湾用词润色（不改 id / prompt / 路径）
from __future__ import annotations

import json
import re
from pathlib import Path
from i18n_project import BOOK

ROOT = Path(__file__).resolve().parents[1]
PATH = BOOK / "i18n" / "zh-TW" / "final_game.json"
SKIP = {
    "id",
    "file",
    "avatar",
    "image",
    "cg",
    "look",
    "avatarPrompt",
    "imagePrompt",
    "cgPrompt",
    "titleImagePrompt",
    "endingImagePrompt",
    "sceneIconPrompt",
    "type",
    "kind",
    "slot",
    "form",
    "answer",
    "answerEntry",
    "answerTitle",
}

# 长词优先
PAIRS = [
    ("信息", "訊息"),
    ("質量", "品質"),
    ("軟件", "軟體"),
    ("網絡", "網路"),
    ("默認", "預設"),
    ("視頻", "影片"),
    ("穀歌", "Google"),
    ("其它", "其他"),
    ("賬戶", "帳戶"),
    ("註釋", "註解"),
    ("代碼", "程式碼"),
    ("文件夾", "資料夾"),
    ("屏幕", "螢幕"),
    ("鼠標", "滑鼠"),
    ("打印", "列印"),
    ("服務器", "伺服器"),
    ("用戶", "使用者"),
    ("數據", "資料"),
    ("字符", "字元"),
    ("激活", "啟用"),
    ("交互", "互動"),
    ("概率", "機率"),
    ("算法", "演算法"),
]


def polish(s: str) -> str:
    out = s
    for a, b in PAIRS:
        out = out.replace(a, b)
    return out


def walk(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in SKIP:
                continue
            if isinstance(v, str) and not v.startswith(("xdd-assets/", "assets/")):
                obj[k] = polish(v)
            else:
                walk(v)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            if isinstance(v, str) and not v.startswith(("xdd-assets/", "assets/")):
                obj[i] = polish(v)
            else:
                walk(v)


def main() -> None:
    data = json.loads(PATH.read_text(encoding="utf-8"))
    walk(data)
    PATH.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("polished", PATH)


if __name__ == "__main__":
    main()
