# tools/i18n_check.py — 语言包与简体真源结构对齐（不跑汉字字数红线）
# 用法: python tools/i18n_check.py [de|en|es|fr|ja|ko|hi|zh-TW|all]
from __future__ import annotations

import json
import copy
import re
import sys
from collections import Counter
from pathlib import Path
from i18n_project import BOOK, GAME_ID
from i18n_strings import walk, get_at, set_at

ROOT = Path(__file__).resolve().parents[1]
ZH = BOOK / "final_game.json"
GLOSS = BOOK / "i18n" / "glossary.json"
LOCALES = ("de", "en", "es", "fr", "ja", "ko", "hi", "zh-TW")
MARK_RE = re.compile(r"\{\{(e_[a-z0-9_]+)\|([^}]*)\}\}")
NPC_RE = re.compile(r"\[\[NPC\d\]\]")
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
}


def load(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def marks(text: str) -> tuple[list[str], list[str]]:
    return MARK_RE.findall(text), NPC_RE.findall(text)


def collect_texts(obj, acc: list[str], skip_prompt=True):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if skip_prompt and k in SKIP:
                continue
            collect_texts(v, acc, skip_prompt)
    elif isinstance(obj, list):
        for v in obj:
            collect_texts(v, acc, skip_prompt)
    elif isinstance(obj, str):
        acc.append(obj)


def blank_keys(obj):
    if isinstance(obj, dict):
        return {k: blank_keys(v) for k, v in obj.items() if k in ("slot", "kind", "answer", "answerEntry", "answerTitle", "pool")}
    if isinstance(obj, list):
        return [blank_keys(x) for x in obj]
    return obj


def check(loc: str, pack=None) -> list[str]:
    errs: list[str] = []
    zh = load(ZH)
    if pack is None:
        pack = load(BOOK / "i18n" / loc / "final_game.json")
    gloss = load(GLOSS)
    names = {eid: row[loc] for eid, row in gloss["entries"].items()}

    if pack.get("meta", {}).get("id") != zh["meta"]["id"]:
        errs.append(f"{loc} meta.id mismatch")
    if pack.get("meta", {}).get("version") != zh["meta"]["version"]:
        errs.append(f"{loc} meta.version mismatch")

    zc = {c["id"] for c in zh["cards"]}
    pc = {c["id"] for c in pack["cards"]}
    if zc != pc:
        errs.append(f"{loc} card ids differ: {sorted(zc ^ pc)[:8]}")
    if set(zh["entries"]) != set(pack["entries"]):
        errs.append(f"{loc} entry ids differ")
    if len(zh["gates"]) != len(pack["gates"]):
        errs.append(f"{loc} gate count differs")

    for eid, row in gloss["entries"].items():
        got = pack["entries"].get(eid, {}).get("name")
        if got != row[loc]:
            errs.append(f"{loc} {eid} name {got!r} != glossary {row[loc]!r}")

    zcards = {c["id"]: c for c in zh["cards"]}
    for c in pack["cards"]:
        z = zcards[c["id"]]
        if json.dumps(blank_keys(c.get("blanks")), ensure_ascii=False) != json.dumps(blank_keys(z.get("blanks")), ensure_ascii=False):
            errs.append(f"{loc} {c['id']} blank invariants changed")
        zcols = zh["timelines"][str(c["level"])]["cols"]
        pcols = pack["timelines"][str(c["level"])]["cols"]
        try:
            expect_col = pcols[zcols.index(z["col"])]
            if c.get("col") != expect_col:
                errs.append(f"{loc} {c['id']} col {c.get('col')!r} != {expect_col!r}")
        except (ValueError, KeyError):
            errs.append(f"{loc} {c['id']} col cannot map")
        for zs, ps in zip(z["segments"], c["segments"]):
            zm, zn = marks(zs.get("text", ""))
            pm, pn = marks(ps.get("text", ""))
            if [x[0] for x in zm] != [x[0] for x in pm]:
                errs.append(f"{loc} {c['id']} mark ids differ")
            if zn != pn:
                errs.append(f"{loc} {c['id']} NPC marks differ")
            for eid, shown in pm:
                if eid in names and shown != names[eid]:
                    errs.append(f"{loc} {c['id']} {{{{ {eid}|{shown} }}}} != {names[eid]}")

    # 非汉字玩家文不得仍是大段汉字
    if loc in ("de", "en", "es", "fr", "hi"):
        texts: list[str] = []
        collect_texts(pack.get("meta", {}), texts)
        collect_texts(pack.get("frame", {}), texts)
        collect_texts({"cards": [{"title": c.get("title"), "segments": c.get("segments")} for c in pack["cards"]]}, texts)
        cjk = sum(1 for s in texts if re.search(r"[\u4e00-\u9fff]", s) and not s.strip().startswith("e_"))
        if cjk > 8:
            errs.append(f"{loc} still has {cjk} CJK player strings (translation incomplete)")
    if loc == "ko":
        texts: list[str] = []
        collect_texts(pack.get("meta", {}), texts)
        collect_texts(pack.get("frame", {}), texts)
        collect_texts({"cards": [{"title": c.get("title"), "segments": c.get("segments")} for c in pack["cards"]]}, texts)
        cjk = sum(1 for s in texts if re.search(r"[\u4e00-\u9fff]", s) and not re.search(r"[\uac00-\ud7af]", s) and not s.strip().startswith("e_"))
        if cjk > 8:
            errs.append(f"{loc} still has {cjk} leftover CJK player strings")

    plot = gloss["plotCol"][loc]
    for lv, tl in pack.get("timelines", {}).items():
        ztl = zh["timelines"][lv]
        if len(tl["cols"]) != len(ztl["cols"]) or len(tl["rows"]) != len(ztl["rows"]):
            errs.append(f"{loc} timeline {lv} size differs")
            continue
        if tl["cols"][0] != plot:
            errs.append(f"{loc} timeline {lv} plot col {tl['cols'][0]!r} != {plot!r}")
        for col in tl["cols"][1:]:
            # 列名必须是某人物译名
            if col not in names.values():
                errs.append(f"{loc} timeline {lv} col {col!r} not in glossary")

    # Full structural parity, including segment counts, archive answers, recap
    # rows, source assets, music unlocks and gain. A short zip must not hide loss.
    rows = []
    walk(zh, [], rows)
    masked_source, masked_pack = copy.deepcopy(zh), copy.deepcopy(pack)
    for row in rows:
        pointer = row['path']
        try:
            translated = get_at(pack, pointer)
            if not isinstance(translated, str) or not translated.strip():
                errs.append(f'{loc} empty/non-text player string: {pointer}')
                continue
            zm, zn = marks(row['zh'])
            pm, pn = marks(translated)
            if Counter(eid for eid, _ in zm) != Counter(eid for eid, _ in pm) or Counter(zn) != Counter(pn):
                errs.append(f'{loc} inline reference loss: {pointer}')
            if GAME_ID == 'slr':
                if loc not in ('ja', 'zh-TW') and re.search(r'[\u4e00-\u9fff]', translated):
                    errs.append(f'{loc} untranslated Chinese: {pointer}')
                if loc != 'zh-TW' and len(row['zh']) > 25 and re.search(r'[\u4e00-\u9fff]', row['zh']) and translated == row['zh']:
                    errs.append(f'{loc} untranslated paragraph: {pointer}')
            set_at(masked_source, pointer, '<localized>')
            set_at(masked_pack, pointer, '<localized>')
        except (KeyError, IndexError, TypeError):
            errs.append(f'{loc} missing player field: {pointer}')
    if masked_source != masked_pack:
        errs.append(f'{loc} non-text structure differs (logic, arrays, assets, or metadata)')

    return errs


def main() -> None:
    arg = (sys.argv[1] if len(sys.argv) > 1 else "all").strip()
    targets = LOCALES if arg == "all" else (arg,)
    n = 0
    for loc in targets:
        errs = check(loc)
        if errs:
            print(f"FAIL {loc}: {len(errs)}")
            for e in errs[:40]:
                print(" ", e)
            n += len(errs)
        else:
            print(f"OK {loc}")
    if n:
        sys.exit(1)


if __name__ == "__main__":
    main()
