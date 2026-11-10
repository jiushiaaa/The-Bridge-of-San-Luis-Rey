#!/usr/bin/env python3
"""Compile the reviewed SLR authoring files into the inherited game's data schema.

This is an explicit editorial operation, never a build hook: the upstream copy
editor writes final_game.json directly. Use --replace only after reconciling any
edits made there back into authoring/. No assets or translations are fabricated.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOOK = ROOT / "workspace/sanluisrey"
SOURCE = BOOK / "authoring"


def read(name):
    return json.loads((SOURCE / name).read_text(encoding="utf-8"))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def plain_length(text):
    text = re.sub(r"\{\{[^|]+\|([^}]+)\}\}", r"\1", text)
    # Match the upstream authoring validator: NPC placeholders count literally.
    return len(text)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--replace", action="store_true")
    args = parser.parse_args()
    dest = BOOK / "final_game.json"
    if dest.exists() and not args.replace:
        parser.error("final_game.json exists; reconcile copy-editor changes, then use --replace")
    g = read("frame.json")
    frame_sources = g.pop("source_anchors")
    entries = read("entries.json")
    archives = read("archives.json")
    image_reviews = {r['id']: r for r in read('generated-images.json')}
    common = ", finished literary gouache and subtle pencil illustration on warm paper, muted sage, umber, ivory and terracotta palette, painterly realism, eighteenth-century Peru, expressive restraint, no modern objects, no text, no watermark"
    g["meta"]["art"] = {
        "portrait": common + ", square upper-body character portrait, plain cream background, natural soft light",
        "scene": common + ", atmospheric wide environment, no lettering",
        "item": common + ", square intimate still life, simple composition",
        "concept": common + ", restrained symbolic still life, no diagram labels",
        "cg": common + ", cinematic 16:9 narrative composition, an actual moment rather than a posed portrait",
        "icon": common + ", simple readable centered emblem",
    }
    for eid, e in entries.items():
        kind = "avatar" if e["type"] == "person" else "image"
        folder = "avatars" if kind == "avatar" else "entries"
        # The novel says the twins are physically indistinguishable. Reuse the
        # approved face, not a manufactured scar or color code (one asset count).
        portrait_id = "e_esteban" if eid == "e_manuel" else eid
        e[kind] = f"slr-assets/{folder}/{portrait_id}.png"
        e[kind + "Prompt"] = e["look"]
        for vname, v in e.get("variants", {}).items():
            v["avatar"] = f"slr-assets/avatars/{eid}_{vname}.png"
            v["avatarPrompt"] = v["look"]
        e["archive"] = []
        for lv, title, fields in archives.get(eid, []):
            converted = []
            for label, value in fields:
                if value.startswith("e_"):
                    assert value in entries, (eid, value)
                    converted.append({"label": label, "blank": {"answer": value, "pool": entries[value]["type"]}})
                else:
                    converted.append({"label": label, "text": value})
            e["archive"].append({"level": lv, "title": title, "fields": converted})
    g["entries"] = entries
    g["cards"] = []
    g["timelines"] = {}
    provenance = {"frame": frame_sources, "cards": {}}
    age_variants = {
        "c1_01": {"e_maria": "child"}, "c1_02": {"e_maria": "young"},
        "c1_03": {"e_maria": "middle", "e_clara": "child"},
        "c1_04": {"e_maria": "middle"},
        "c3_03": {"e_camila": "child", "e_pio": "young"},
        "c3_04": {"e_pio": "young", "e_camila": "child"},
        **{f"c3_{n:02d}": {"e_camila": "ill"} for n in (13, 14, 15, 17, 18, 20)},
    }
    extra_chars = {
        "c1_05": ["e_clara", "e_maria"], "c1_10": ["e_abbess"], "c1_14": ["e_pepita"],
        "c2_02": ["e_esteban", "e_abbess"], "c2_03": ["e_manuel", "e_esteban"],
        "c2_04": ["e_esteban"], "c2_05": ["e_esteban", "e_camila"],
        "c2_06": ["e_camila"], "c2_14": ["e_camila"], "c2_16": ["e_captain"],
        "c2_18": ["e_captain"], "c2_20": ["e_captain"],
        "c3_04": ["e_camila"], "c3_06": ["e_camila"],
        "c3_07": ["e_pio", "e_archbishop", "e_captain"],
        "c3_10": ["e_jaime"], "c3_12": ["e_jaime"],
        "c3_19": ["e_maria", "e_pepita"],
    }
    for f in sorted(SOURCE.glob("chapter*.json")):
        chapter = json.loads(f.read_text(encoding="utf-8"))
        lv = chapter["level"]
        if "rows" in chapter:
            g["timelines"][str(lv)] = {"rows": chapter["rows"], "cols": chapter["columns"]}
        for src in chapter["cards"]:
            c = {k: src[k] for k in ("id", "row", "col", "title", "form")}
            c["level"] = lv
            c["blanks"] = []
            person_count = 0
            for eid in src["answers"]:
                kind = entries[eid]["type"]
                assert kind in ("person", "place")
                person_count += kind == "person"
                c["blanks"].append({"slot": f"NPC{person_count}" if kind == "person" else "地点", "kind": kind, "answer": eid})
            c["difficulty"] = "easy" if not any(b["kind"] == "place" for b in c["blanks"]) else "hard" if person_count >= 3 else "normal"
            c["segments"] = []
            for role, text in src["text"]:
                seg = {"kind": "narration" if role == "N" else "monologue" if role == "M" else "dialogue", "text": text}
                if role != "N":
                    named = src.get("speakers", {}).get(role)
                    if named:
                        seg["speakerEntry"] = named
                    else:
                        seg["slot"] = "NPC1" if role == "M" else "NPC" + role.removeprefix("D")
                c["segments"].append(seg)
            length = sum(plain_length(s["text"]) for s in c["segments"])
            avg = g["meta"]["cardSpec"]["avg"]
            c["len"] = "S" if length < avg * .8 else "L" if length > avg * 1.175 else "M"
            c["cg"] = f"slr-assets/cg/{c['id']}.png"
            c["cgDark"] = image_reviews.get(c['id'], {}).get('cgDark', False)
            c["cgPrompt"] = src["cg"]
            c["cgChars"] = list(dict.fromkeys([b["answer"] for b in c["blanks"] if b["kind"] == "person"] + extra_chars.get(c["id"], []) + list(src.get("speakers", {}).values())))
            if c["id"] in age_variants:
                c["cgCharVariants"] = age_variants[c["id"]]
            if c["id"] in ("c1_01", "c1_04", "c2_02", "c3_02"):
                c["startUnlocked"] = True
            g["cards"].append(c)
            provenance["cards"][c["id"]] = {"source_anchors": src["sources"], "text_mode": src.get("adaptation", "依据所列原著段落重述场景；对白连接与可感知细节可能有所重构。"), "text_sha256": hashlib.sha256(json.dumps(c["segments"], ensure_ascii=False).encode()).hexdigest()}
    g["assets"] = {
        "titleImage": "slr-assets/title.png", "endingImage": "slr-assets/ending.png",
        "mysteryAvatar": "slr-assets/mystery.png", "sceneIcon": "slr-assets/scene-icon.png", "favicon": "slr-assets/scene-icon.png",
        "levelIntroImages": {str(lv): f"slr-assets/intro-{lv}.png" for lv in (1, 2, 3)},
        "titleImagePrompt": "Intact eighteenth-century Andean plant-fiber suspension footbridge over a misty gorge, five distant travelers, luminous river, vertical painterly literary cover.",
        "endingImagePrompt": "An elderly abbess beside a lantern in a modest convent sickroom at night, ordinary care and warm light, no supernatural effect.",
        "sceneIconPrompt": "A simple hand-painted braided-rope footbridge emblem on warm cream paper, square, no lettering.",
        "bgm": [{k: ("slr-assets/bgm/" + v if k == "file" else v) for k, v in track.items() if k != "seconds"} for track in read("music.json")],
    }
    g["recaps"] = {}
    for lv, pages in read("recaps.json").items():
        g["recaps"][lv] = {"pages": []}
        for i, p in enumerate(pages):
            rows = [i * 2, i * 2 + 1]
            cards = [c["id"] for c in g["cards"] if c["level"] == int(lv) and c["row"] in rows]
            g["recaps"][lv]["pages"].append({"rows": rows, "title": p["title"], "cards": cards, "segments": [{"kind": "narration", "text": p["text"]}]})
    write(dest, g)
    write(BOOK / "provenance.json", provenance)
    print(f"SLR: {len(g['cards'])} cards, {len(entries)} entries, {sum(len(e['archive']) for e in entries.values())} archive pages, {len(g['assets']['bgm'])} music bindings. Assets and language packs require separate verification.")


if __name__ == "__main__":
    main()
