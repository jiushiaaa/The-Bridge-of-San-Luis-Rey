import json, re, sys

CARDS = json.load(open("workspace/murder/DEBUG/cards_lv1.json", encoding="utf-8"))

RANGES = {"S": (420, 490), "M": (600, 800), "L": (880, 950)}

def strip_text(t):
    t = re.sub(r"\{\{e_[a-z]+\|([^}]*)\}\}", r"\1", t)
    t = re.sub(r"\[\[NPC\d\]\]", "", t)
    return t

def cjk(t):
    return len(re.findall(r"[\u4e00-\u9fff]", t))

REQUIRED = {
    "c1_01": ["e_guangchang"],
    "c1_02": ["e_guangchang"],
    "c1_03": ["e_changji", "e_anhela"],
    "c1_04": ["e_bieshu"],
    "c1_05": [],
    "c1_06": ["e_xiusi", "e_matou", "e_gongyu"],
    "c1_07": ["e_shengjiangjun", "e_anhela"],
    "c1_08": ["e_guangchang", "e_pulixi", "e_weikajia"],
    "c1_09": ["e_pulixi", "e_tufu", "e_pangxiao"],
    "c1_10": ["e_shengroman", "e_nasa"],
    "c1_11": ["e_fuluola", "e_migejia", "e_laona", "e_dazhai", "e_muchang"],
    "c1_12": ["e_beiduoya", "e_shengroman", "e_anhela", "e_muchang"],
    "c1_13": ["e_anhela", "e_fuluola", "e_marco", "e_laona"],
}

BANNED = {  # per-card: answer display names & synonyms that must not appear in body
    "c1_01": ["圣罗曼", "巴亚尔多", "码头"],
    "c1_02": ["圣罗曼", "巴亚尔多", "安赫拉", "维卡", "单身公寓"],
    "c1_03": ["圣罗曼", "巴亚尔多", "屠夫兄弟", "屠夫", "维卡", "社交俱乐部", "俱乐部"],
    "c1_04": ["圣罗曼", "巴亚尔多", "希乌斯", "社交俱乐部", "俱乐部"],
    "c1_05": ["圣罗曼", "巴亚尔多", "安赫拉", "普里西", "维卡", "纳萨", "玛格达莱纳"],  # hard: no person names at all
    "c1_06": ["圣罗曼", "巴亚尔多"],
    "c1_07": ["圣罗曼", "巴亚尔多", "码头"],
    "c1_08": ["安赫拉"],
    "c1_09": ["安赫拉", "维卡家"],
    "c1_10": ["安赫拉"],
    "c1_11": ["纳萨", "教堂广场"],
    "c1_12": ["纳萨", "纳家大宅"],
    "c1_13": ["纳萨"],
}

HARD = {"c1_05"}
EXPECTED_FORM = {"c1_01":"scene","c1_02":"scene","c1_03":"scene","c1_04":"scene","c1_05":"scene",
                 "c1_06":"monologue","c1_07":"dialogue","c1_08":"monologue","c1_09":"dialogue",
                 "c1_10":"monologue","c1_11":"dialogue","c1_12":"dialogue","c1_13":"monologue"}

ok = True
for c in CARDS:
    cid = c["id"]
    body = "".join(s["text"] for s in c["segments"])
    plain = strip_text(body)
    n = cjk(plain)
    n2 = len(re.findall(r"[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]", plain))
    lo, hi = RANGES[c["len"]]
    status = "OK" if lo <= n <= hi else "**OUT OF RANGE**"
    if not (lo <= n <= hi): ok = False
    print(f"{cid} len={c['len']} 汉字={n} 含标点={n2} [{lo}-{hi}] {status}")

    for e in REQUIRED[cid]:
        if "{{" + e + "|" not in body:
            print(f"  !! missing required chip {e}"); ok = False
    for w in BANNED[cid]:
        if w in plain:
            print(f"  !! banned word in body: {w}"); ok = False
    if cid in HARD:
        # no person chips, no speakerEntry, no speaker
        if re.search(r"\{\{e_(nasa|anhela|shengroman|tufu|marco|pulaxida|beiduoya|keluodi|aponte|weiduoli|diveina|pulixi|amaduo|puludeng|fuluola|maria|faguan|pangxiao|xiusi|shengjiangjun|laona|yigulan|mage|luyisa|nayier)\|", body):
            print("  !! hard card has person chip"); ok = False
        for s in c["segments"]:
            if "speakerEntry" in s or "speaker" in s:
                print("  !! hard card has speakerEntry/speaker"); ok = False
    # dialogue ratio
    if c["form"] == "dialogue":
        d = sum(cjk(strip_text(s["text"])) for s in c["segments"] if s["kind"] == "dialogue")
        total = cjk(plain)
        r = d / total if total else 0
        print(f"  dialogue ratio: {r:.0%}" + ("" if r > 0.7 else "  **LOW**"))
        if r <= 0.7: ok = False
    if c["form"] != EXPECTED_FORM[cid]:
        print("  !! form mismatch"); ok = False
    # chip-per-person <= 1
    chips = re.findall(r"\{\{(e_[a-z]+)\|", body)
    from collections import Counter
    for e, cnt in Counter(chips).items():
        if cnt > 1:
            print(f"  !! chip {e} appears {cnt} times"); ok = False
    # speakerEntry chip presence
    for s in c["segments"]:
        if "speakerEntry" in s:
            if "{{" + s["speakerEntry"] + "|" not in body:
                print(f"  !! speakerEntry {s['speakerEntry']} lacks chip"); ok = False
    # hints: no names
    NAMES = ["纳萨","安赫拉","圣罗曼","屠夫兄弟","普里西","希乌斯","弗洛拉","贝多亚","马尔科","老纳","庞西奥","圣将军"]
    for h in c["hints"]:
        for nm in NAMES:
            if nm in h:
                print(f"  !! hint contains name {nm}: {h}"); ok = False
    # narration paragraph sentence count 1-4
    for s in c["segments"]:
        if s["kind"] == "narration":
            sc = len(re.findall(r"[。！？]", s["text"]))
            if sc > 4:
                print(f"  !! narration segment has {sc} sentences: {s['text'][:20]}…"); ok = False
    # gameplay words
    for w in ["残页","归位","词条","时间轴","关卡"]:
        if w in plain:
            print(f"  !! gameplay word {w}"); ok = False

print("\nJSON valid:", True, "| cards:", len(CARDS))
print("ALL OK" if ok else "ISSUES FOUND")
sys.exit(0 if ok else 1)
