# tools/i18n_opencc.py — 简体 → 繁体台湾初稿，再套 glossary 专名
# 用法: python tools/i18n_opencc.py
# 优先 opencc s2twp；没有则用内置常用字表（仍必须再跑 i18n_apply_glossary.py）
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "workspace" / "xidaduo" / "final_game.json"
DEST = ROOT / "workspace" / "xidaduo" / "i18n" / "zh-TW" / "final_game.json"

SKIP = {
    "look",
    "avatarPrompt",
    "imagePrompt",
    "cgPrompt",
    "titleImagePrompt",
    "endingImagePrompt",
    "sceneIconPrompt",
    "portrait",
    "scene",
    "item",
    "concept",
    "cg",
    "icon",
    "id",
    "file",
    "avatar",
    "image",
    "slot",
    "answer",
    "answerEntry",
    "answerTitle",
    "kind",
}

# 常见简繁（台湾）补字，OpenCC 不可用时的兜底
PAIR = str.maketrans(
    "门开关时来头发么为这过还对与从会经当点将体术处与书门来头发"
    "国发后无与云万与与与与与与与"
    "东车来头发门开关",
    "門開關時來頭髮麼為這過還對與從會經當點將體術處與書門來頭髮"
    "國發後無與雲萬與與與與與與與"
    "東車來頭髮門開關",
)


def convert_str(s: str, cc) -> str:
    if not s:
        return s
    if cc:
        return cc.convert(s)
    return s.translate(PAIR)


def walk(obj, cc):
    if isinstance(obj, dict):
        for k, v in list(obj.items()):
            if k in SKIP:
                continue
            obj[k] = walk(v, cc)
        return obj
    if isinstance(obj, list):
        return [walk(v, cc) for v in obj]
    if isinstance(obj, str):
        return convert_str(obj, cc)
    return obj


def main() -> None:
    cc = None
    try:
        from opencc import OpenCC  # type: ignore

        cc = OpenCC("s2twp")
        print("using OpenCC s2twp")
    except Exception:
        print("OpenCC missing; using fallback table + glossary (run apply_glossary after)")

    data = json.loads(SRC.read_text(encoding="utf-8"))
    # 生图 prompt / art 保持简体（不译）
    art = data.get("meta", {}).get("art")
    walk(data, cc)
    if art is not None:
        data["meta"]["art"] = art
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {DEST}")
    print("next: python tools/i18n_apply_glossary.py zh-TW")


if __name__ == "__main__":
    main()
