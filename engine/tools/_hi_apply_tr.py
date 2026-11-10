# Apply Hindi path→text maps onto i18n/hi/final_game.json
from __future__ import annotations

import json
import re
from pathlib import Path

MARK_RE = re.compile(r"\{\{e_[a-z0-9_]+\|[^}]*\}\}")
NPC_RE = re.compile(r"\[\[NPC\d\]\]")

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "workspace" / "xidaduo" / "i18n" / "hi" / "final_game.json"
TR_DIR = ROOT / "workspace" / "xidaduo" / "i18n" / "hi"

SKIP_KEYS = {
    "id",
    "type",
    "kind",
    "slot",
    "form",
    "difficulty",
    "len",
    "status",
    "tier",
    "look",
    "art",
    "answer",
    "file",
    "avatar",
    "image",
    "cg",
    "portrait",
    "scene",
    "item",
    "concept",
    "icon",
    "mysteryAvatar",
    "titleImage",
    "endingImage",
    "sceneIcon",
    "favicon",
    "pool",
}
SKIP_VALUES = {"title", "ending", "old", "person", "place", "item", "concept"}

LABELS = {
    "Birth": "जन्म",
    "Name in youth": "किशोरावस्था का नाम",
    "Disquiet": "बेचैनी",
    "Closest friend": "घनिष्ठ मित्र",
    "The company he joined": "जिस पंथ में गया",
    "How he left home": "घर छोड़ने का ढंग",
    "Livelihood": "आजीविका",
    "Three arts": "तीन कलाएँ",
    "Teacher of love": "प्रेम की गुरु",
    "The toy of his decline": "पतन का खिलौना",
    "Possessions": "संपत्ति",
    "Sickness of the heart": "मन की बीमारी",
    "New station": "नई भूमिका",
    "Teacher": "गुरु",
    "Son": "पुत्र",
    "The old arts": "पुरानी कलाएँ",
    "The wound": "घाव",
    "Journey's end": "अंत",
    "Nature": "स्वभाव",
    "The master he followed": "जिनके शरण में गया",
    "The order's dress": "संघ का वेश",
    "That night": "वह रात",
    "Parting": "विदाई",
    "As he is now": "अब जैसा है",
    "The order he belongs to": "जिस संघ से जुड़ा",
    "Place of meeting again": "पुनर्मिलन का स्थान",
    "The old habit": "पुरानी आदत",
    "The last scene": "अंतिम दृश्य",
    "Title": "उपाधि",
    "Garden of teaching": "उपदेश का उद्यान",
    "Vessel of alms": "भिक्षा-पात्र",
    "Bearing": "आचरण",
    "What he taught": "जो सिखाया",
    "Final rest": "अंतिम विश्राम",
    "The city where he stayed": "जहाँ ठहरा",
    "Later years": "उत्तर जीवन",
    "What he left": "जो छोड़ गया",
    "Art": "कला",
    "The eye that sees": "देखने वाली दृष्टि",
    "In her heart": "मन के भीतर",
    "The loved thing in the cage": "पिंजरे की प्रिय वस्तु",
    "The way she lived": "जीने का ढंग",
    "The one she went to see": "जिनके दर्शन को गई",
    "Where the ashes lie": "अस्थियाँ जहाँ रखीं",
    "Cause of death": "मृत्यु का कारण",
    "Last words": "अंतिम वचन",
    "Appearance": "रूप",
    "Temper": "मिजाज",
    "Who brought him": "जिसने पहुँचाया",
    "House": "घर",
    "Hut for travellers": "यात्रियों की कुटिया",
    "The craft that carries men": "लोगों को पार लगाने का साधन",
    "How he received guests": "अतिथि-सत्कार",
    "A strange saying": "एक अजीब बात",
    "The ferry": "घाट",
    "Apprentice": "शिष्य",
    "Unlettered": "निरक्षर",
    "The dead wife": "दिवंगत पत्नी",
    "What taught him": "जिससे सीखा",
    "The sound of perfection": "पूर्णता की ध्वनि",
    "What he left at parting": "विदाई पर जो दिया",
    "How he taught": "सिखाने का ढंग",
    "Farewell": "विदा",
    "Mother": "माता",
    "What he took when he fled": "भागते समय जो ले गया",
    "Origins": "उद्गम",
    "Where he went": "कहाँ गया",
    "Station": "पद",
    "Dwelling": "निवास",
    "The man he was": "जैसा मनुष्य था",
    "Place of practice": "साधना-स्थल",
    "The austerity of a lifetime": "जीवन भर की तपस्या",
    "Age": "आयु",
    "How it ended": "अंत कैसे हुआ",
    "Caste of those who bathe": "स्नान करने वालों की जाति",
    "Use": "उपयोग",
    "An old matter": "एक पुरानी बात",
    "The friend who swore beneath the tree": "पेड़ के नीचे शपथ लेने वाला मित्र",
    "What happened here": "यहाँ क्या हुआ",
    "Dedicated to whom": "किसे अर्पित",
    "The city around it": "आसपास का नगर",
    "How it came to be": "कैसे बना",
    "The look of the place": "जगह का रूप",
    "Before the gate": "द्वार के आगे",
    "The living thing in the garden": "उद्यान का जीव",
    "To whom, in the end, the garden was given": "अंत में उद्यान किसे दिया गया",
    "The old ferryman": "वृद्ध मल्लाह",
    "What lies across": "उस पार क्या है",
    "Form": "आकार",
    "Those who come and go": "आने-जाने वाले",
    "The keeper's dwelling": "पालक का निवास",
    "Who dreamed of it": "जिसने इसे सपना देखा",
    "Habit": "स्वभाव",
    "The dream": "वह स्वप्न",
    "How it was played": "खेलने का ढंग",
    "Why he gambled": "जुआ क्यों खेला",
    "The one lost in it": "इसमें डूबा हुआ",
    "The master who watched him stake everything": "मालिक जिसने दांव देखा",
    "Master": "स्वामी",
    "The pole": "बँस",
    "An old story": "एक पुरानी कथा",
    "The garden of her who held the fan": "पंखा थामे वाली का उद्यान",
    "Scriptures": "शास्त्र",
    "A priest of the caste": "जाति का एक पुरोहित",
    "Daily offices": "नित्य कर्म",
    "Transmission": "परंपरा",
    "The true Self they sought": "जिस आत्मन् को वे खोजते थे",
    "Practice": "अभ्यास",
    "The book that names it": "वह ग्रंथ जो इसका नाम लेता है",
    "Where they bathed and prayed": "जहाँ स्नान और प्रार्थना होती",
    "Meaning": "अर्थ",
    "The difficulty": "कठिनाई",
    "Who murmured it": "जो जपता था",
    "The place that saved him": "जिस जगह ने बचाया",
    "The river's answer": "नदी का उत्तर",
    "How it looked in the city": "नगर में जैसा दिखता",
    "What turns the wheel": "चक्र को घुमाने वाला ईंधन",
    "How one is freed": "मुक्ति कैसे मिले",
    "The cycle it stills": "वह चक्र जिसे यह रोकता है",
    "The elder who sought it and did not arrive": "वृद्ध जिसने चाहा और न पाया",
    "Standing": "स्थान",
    "Custom": "रीति",
    "One who stood for it": "इसका एक प्रतिनिधि",
    "The first gift she gave him": "पहली भेंट जो उसने दी",
}

# "Appearance" used twice in dump (相貌 and 样子) - both map to रूप which is fine.
# "Form" used for 形貌 and 形制 - both आकार is ok-ish; 形制 is more  बनावट.
# I'll leave Form as आकार; 形制 path can override in JSON if needed.

SPEAKERS = {
    "Woman": "स्त्री",
    "Elder monk": "वृद्ध भिक्षु",
    "Ferryman": "मल्लाह",
    "Servant": "सेवक",
    "Spice merchant": "मसाला-व्यापारी",
    "Steward": "प्रबंधक",
}


def skip_key(k: str) -> bool:
    return k.endswith("Prompt") or k in SKIP_KEYS


def get_at(root, path: str):
    cur = root
    for raw in path.strip("/").split("/"):
        cur = cur[int(raw)] if isinstance(cur, list) else cur[raw]
    return cur


def set_at(root, path: str, value: str) -> None:
    parts = path.strip("/").split("/")
    cur = root
    for p in parts[:-1]:
        cur = cur[int(p)] if isinstance(cur, list) else cur[p]
    last = parts[-1]
    if isinstance(cur, list):
        cur[int(last)] = value
    else:
        cur[last] = value


def load_maps() -> dict[str, str]:
    tr: dict[str, str] = {}
    for p in sorted(TR_DIR.glob("_tr_*.json")):
        data = json.loads(p.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            tr.update(data)
        elif isinstance(data, list):
            for row in data:
                tr[row["path"]] = row["text"]
    return tr


def patch_by_key(obj, n_acc: list[int]) -> None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            if skip_key(k):
                continue
            if k == "label" and isinstance(v, str) and v in LABELS:
                obj[k] = LABELS[v]
                n_acc[0] += 1
            elif k == "speaker" and isinstance(v, str) and v in SPEAKERS:
                obj[k] = SPEAKERS[v]
                n_acc[0] += 1
            else:
                patch_by_key(v, n_acc)
    elif isinstance(obj, list):
        for v in obj:
            patch_by_key(v, n_acc)


def remaining(obj, parts, out):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if skip_key(k):
                continue
            remaining(v, parts + [k], out)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            remaining(v, parts + [str(i)], out)
    elif isinstance(obj, str) and obj.strip():
        if obj.startswith(("xdd-assets/", "assets/")):
            return
        if obj in SKIP_VALUES:
            return
        import re

        if re.fullmatch(r"e_[a-z0-9_]+|c\d+_\d+|g_[a-z0-9_]+|r_[a-z0-9_]+", obj):
            return
        stripped = MARK_RE.sub("", obj)
        stripped = NPC_RE.sub("", stripped)
        if re.search(r"[A-Za-z]{3,}", stripped):
            out.append("/" + "/".join(parts))


def main() -> None:
    data = json.loads(PACK.read_text(encoding="utf-8"))
    tr = load_maps()
    n = 0
    missing = []
    for path, text in tr.items():
        try:
            old = get_at(data, path)
        except Exception:
            missing.append(path + " (bad path)")
            continue
        if not isinstance(old, str):
            missing.append(path + " (not str)")
            continue
        set_at(data, path, text)
        n += 1
    keyed = [0]
    patch_by_key(data, keyed)
    PACK.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"label/speaker patches {keyed[0]}")
    left = []
    remaining(data, [], left)
    print(f"applied {n} paths, map size {len(tr)}, leftover latin {len(left)}")
    for p in left[:30]:
        print(" ", p)


if __name__ == "__main__":
    main()
