# tools/i18n_apply_tr.py — 把 tr_a.json / tr_b.json（path→译文）写回 prose，再 merge 进 final_game.json
from __future__ import annotations

import json
import sys
from pathlib import Path
from i18n_project import BOOK

ROOT = Path(__file__).resolve().parents[1]


def apply(loc: str) -> None:
    folder = BOOK / "i18n" / loc
    tr: dict[str, str] = {}
    for p in sorted(folder.glob('tr_*.json')):
        part = json.loads(p.read_text(encoding='utf-8'))
        conflict = [key for key, value in part.items() if key in tr and tr[key] != value]
        if conflict:
            raise ValueError(f'Conflicting translations in {p.name}: {conflict[:5]}')
        tr.update(part)
    prose_path = folder / "prose.json"
    rows = json.loads(prose_path.read_text(encoding="utf-8"))
    missing = [r["path"] for r in rows if r["path"] not in tr]
    if missing:
        print(f"WARN {loc}: {len(missing)} paths missing from tr_*.json e.g. {missing[:5]}")
    n = 0
    for r in rows:
        if r["path"] in tr:
            r["text"] = tr[r["path"]]
            n += 1
    prose_path.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{loc}: wrote {n}/{len(rows)} prose texts")


def main() -> None:
    loc = sys.argv[1] if len(sys.argv) > 1 else "all"
    targets = ("de", "en", "es", "fr", "ja", "ko", "hi", "zh-TW") if loc == "all" else (loc,)
    for t in targets:
        apply(t)


if __name__ == "__main__":
    main()
