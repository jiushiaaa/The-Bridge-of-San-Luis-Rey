# tools/i18n_apply_glossary.py — 把 glossary 专名写入语言包：词条 name、时间轴列、卡 col、{{eid|显示名}}
# 列名按简体源的下标对齐，避免 OpenCC 异体字对不上。
# 用法: python tools/i18n_apply_glossary.py [de|en|es|fr|ja|ko|hi|zh-TW|all]
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from i18n_project import BOOK

ROOT = Path(__file__).resolve().parents[1]
ZH = BOOK / "final_game.json"
GLOSS = BOOK / "i18n" / "glossary.json"
LOCALES = ("de", "en", "es", "fr", "ja", "ko", "hi", "zh-TW")
MARK_RE = re.compile(r"\{\{(e_[a-z0-9_]+)\|[^}]*\}\}")
SLOT_KEEP = {"slot", "kind", "answer", "answerEntry", "answerTitle"}


def load_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def dump_json(p: Path, data) -> None:
    p.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def patch_text(text: str, names: dict[str, str]) -> str:
    def repl(m: re.Match[str]) -> str:
        eid = m.group(1)
        name = names.get(eid)
        if not name:
            return m.group(0)
        return "{{" + eid + "|" + name + "}}"

    return MARK_RE.sub(repl, text)


def walk_text(obj, names: dict[str, str]):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in (
                "look",
                "avatarPrompt",
                "imagePrompt",
                "cgPrompt",
                "titleImagePrompt",
                "endingImagePrompt",
                "sceneIconPrompt",
            ):
                continue
            if isinstance(v, str) and "{{" in v:
                obj[k] = patch_text(v, names)
            else:
                walk_text(v, names)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            if isinstance(v, str) and "{{" in v:
                obj[i] = patch_text(v, names)
            else:
                walk_text(v, names)


def restore_blank_keys(dst, src) -> None:
    if isinstance(src, dict) and isinstance(dst, dict):
        for k in SLOT_KEEP:
            if k in src:
                dst[k] = src[k]
        for k, v in src.items():
            if k in dst:
                restore_blank_keys(dst[k], v)
    elif isinstance(src, list) and isinstance(dst, list) and len(src) == len(dst):
        for a, b in zip(dst, src):
            restore_blank_keys(a, b)


def localize(data, zh, gloss, loc: str) -> None:
    entries = gloss["entries"]
    plot = gloss["plotCol"][loc]
    names = {eid: row[loc] for eid, row in entries.items()}
    zh_name_to_id = {row["zh-CN"]: eid for eid, row in entries.items()}

    for eid, row in entries.items():
        if eid in data["entries"]:
            data["entries"][eid]["name"] = row[loc]

    for lv, ztl in zh.get("timelines", {}).items():
        tl = data["timelines"][lv]
        cols = []
        for i, zcol in enumerate(ztl["cols"]):
            if i == 0:
                cols.append(plot)
            else:
                eid = zh_name_to_id.get(zcol)
                cols.append(names[eid] if eid else zcol)
        tl["cols"] = cols

    zcards = {c["id"]: c for c in zh["cards"]}
    for card in data["cards"]:
        z = zcards[card["id"]]
        zcols = zh["timelines"][str(card["level"])]["cols"]
        pcols = data["timelines"][str(card["level"])]["cols"]
        try:
            card["col"] = pcols[zcols.index(z["col"])]
        except ValueError:
            card["col"] = plot
        restore_blank_keys(card.get("blanks"), z.get("blanks"))
        for seg in card.get("segments", []):
            if "text" in seg:
                seg["text"] = patch_text(seg["text"], names)

    for zg, pg in zip(zh.get("gates", []), data.get("gates", [])):
        restore_blank_keys(pg.get("blanks"), zg.get("blanks"))

    walk_text(data.get("frame"), names)
    walk_text(data.get("recaps"), names)
    walk_text(data.get("gates"), names)


def apply(loc: str) -> None:
    path = BOOK / "i18n" / loc / "final_game.json"
    data = load_json(path)
    localize(data, load_json(ZH), load_json(GLOSS), loc)
    dump_json(path, data)
    print(f"glossary applied -> {path}")


def main() -> None:
    arg = (sys.argv[1] if len(sys.argv) > 1 else "all").strip()
    targets = LOCALES if arg == "all" else (arg,)
    for loc in targets:
        apply(loc)


if __name__ == "__main__":
    main()
