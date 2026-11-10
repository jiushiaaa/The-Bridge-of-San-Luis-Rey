# tools/i18n_prose.py — 抽出真正需要人工翻译的散文（去掉 id / look / 路径）
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_ZH = re.compile(
    r"^(e_[a-z0-9_]+|c\d+_\d+|g_[a-z0-9_]+|r_[a-z0-9_]+|portrait|scene|item|concept|mystery|cg)$"
)


def dump_prose(loc: str) -> None:
    src = ROOT / "workspace" / "xidaduo" / "i18n" / loc / "strings.json"
    rows = json.loads(src.read_text(encoding="utf-8"))
    out = []
    for r in rows:
        zh = r["zh"]
        if SKIP_ZH.match(zh):
            continue
        if zh.startswith(("xdd-assets/", "assets/")):
            continue
        if r["path"].startswith("/assets/"):
            continue
        out.append(r)
    dest = ROOT / "workspace" / "xidaduo" / "i18n" / loc / "prose.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(loc, "prose", len(out), "chars", sum(len(x["zh"]) for x in out), "->", dest)


def apply_prose(loc: str) -> None:
    str_path = ROOT / "workspace" / "xidaduo" / "i18n" / loc / "strings.json"
    prose_path = ROOT / "workspace" / "xidaduo" / "i18n" / loc / "prose.json"
    rows = json.loads(str_path.read_text(encoding="utf-8"))
    by_path = {r["path"]: r for r in json.loads(prose_path.read_text(encoding="utf-8"))}
    n = 0
    for r in rows:
        p = by_path.get(r["path"])
        if p and p.get("text"):
            r["text"] = p["text"]
            n += 1
    str_path.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("applied", n, "prose rows ->", str_path)


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit("usage: i18n_prose.py dump|apply LOCALE")
    cmd, loc = sys.argv[1], sys.argv[2]
    if cmd == "dump":
        dump_prose(loc)
    elif cmd == "apply":
        apply_prose(loc)
    else:
        sys.exit("dump|apply")


if __name__ == "__main__":
    main()
