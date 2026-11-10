# tools/i18n_clone.py — 从简体真源拷贝结构到某语言包（可译字段仍是中文，再跑 apply / 翻译）
# 用法: python tools/i18n_clone.py [de|en|es|fr|ja|ko|hi|zh-TW|all]
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "workspace" / "xidaduo" / "final_game.json"
LOCALES = ("de", "en", "es", "fr", "ja", "ko", "hi", "zh-TW")


def clone(loc: str) -> None:
    dest = ROOT / "workspace" / "xidaduo" / "i18n" / loc / "final_game.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SRC, dest)
    print(f"cloned -> {dest}")


def main() -> None:
    arg = (sys.argv[1] if len(sys.argv) > 1 else "all").strip()
    targets = LOCALES if arg == "all" else (arg,)
    for loc in targets:
        if loc not in LOCALES:
            sys.exit(f"unknown locale {loc}")
        clone(loc)


if __name__ == "__main__":
    main()
