# tools/i18n_strings.py — 抽出 / 写回可译字符串（path 为 JSON Pointer）
# 用法:
#   python tools/i18n_strings.py extract [de|en|ja|zh-TW]
#   python tools/i18n_strings.py merge [de|en|ja|zh-TW]
from __future__ import annotations

import json
import sys
from pathlib import Path
from i18n_project import BOOK

ROOT = Path(__file__).resolve().parents[1]
ZH = BOOK / "final_game.json"
SKIP_KEYS = {
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
    "mysteryAvatar",
    "titleImage",
    "endingImage",
    "sceneIcon",
    "favicon",
    "portrait",
    "scene",
    "item",
    "concept",
    "icon",
    "type",
    "kind",
    "slot",
    "form",
    "difficulty",
    "len",
    "status",
    "tier",
    "art", "note", "tags", "stage", "unlockCard", "revealAt",
    "answer", "answerEntry", "answerTitle", "pool", "speakerEntry",
    "levelStartEntries", "cgChars", "cgCharVariants",
}


def pointer(parts: list[str]) -> str:
    return "/" + "/".join(p.replace("~", "~0").replace("/", "~1") for p in parts)


def walk(obj, parts: list[str], out: list[dict], parent_key: str | None = None):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in SKIP_KEYS:
                continue
            if k == "prompt" and parts[:2] == ["assets", "bgm"]:
                continue
            walk(v, parts + [k], out, k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            walk(v, parts + [str(i)], out, parent_key)
    elif isinstance(obj, str) and obj.strip():
        # 资源路径不抽
        if obj.startswith(("xdd-assets/", "slr-assets/", "assets/")):
            return
        out.append({"path": pointer(parts), "zh": obj, "text": obj})


def get_at(root, path: str):
    cur = root
    for raw in path.strip("/").split("/"):
        p = raw.replace("~1", "/").replace("~0", "~")
        cur = cur[int(p)] if isinstance(cur, list) else cur[p]
    return cur


def set_at(root, path: str, value: str) -> None:
    parts = [p.replace("~1", "/").replace("~0", "~") for p in path.strip("/").split("/")]
    cur = root
    for p in parts[:-1]:
        cur = cur[int(p)] if isinstance(cur, list) else cur[p]
    last = parts[-1]
    if isinstance(cur, list):
        cur[int(last)] = value
    else:
        cur[last] = value


def extract(loc: str) -> None:
    data = json.loads(ZH.read_text(encoding="utf-8"))
    rows: list[dict] = []
    walk(data, [], rows)
    dest = BOOK / "i18n" / loc / "strings.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"extracted {len(rows)} strings -> {dest}")


def merge(loc: str) -> None:
    pack_path = BOOK / "i18n" / loc / "final_game.json"
    str_path = BOOK / "i18n" / loc / "strings.json"
    data = json.loads(ZH.read_text(encoding="utf-8"))
    rows = json.loads(str_path.read_text(encoding="utf-8"))
    n = 0
    for row in rows:
        text = row.get("text")
        if not isinstance(text, str):
            continue
        set_at(data, row["path"], text)
        n += 1
    pack_path.parent.mkdir(parents=True, exist_ok=True)
    pack_path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"merged {n} strings -> {pack_path}")


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit("usage: i18n_strings.py extract|merge LOCALE")
    cmd, loc = sys.argv[1], sys.argv[2]
    if cmd == "extract":
        extract(loc)
    elif cmd == "merge":
        merge(loc)
    else:
        sys.exit("extract|merge")


if __name__ == "__main__":
    main()
