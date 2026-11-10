# tools/i18n_apply_tr.py — 把 tr_a.json / tr_b.json（path→译文）写回 prose，再 merge 进 final_game.json
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def apply(loc: str) -> None:
    folder = ROOT / "workspace" / "xidaduo" / "i18n" / loc
    tr: dict[str, str] = {}
    for name in ("tr_a.json", "tr_b.json", "tr_c.json"):
        p = folder / name
        if p.exists():
            tr.update(json.loads(p.read_text(encoding="utf-8")))
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
    targets = ("de", "en", "ja") if loc == "all" else (loc,)
    for t in targets:
        apply(t)


if __name__ == "__main__":
    main()
