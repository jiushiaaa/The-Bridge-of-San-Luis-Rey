#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_scene_icons.py — 生成各作品「情节列」主题图标 + 裁切 favicon
用法: python tools/gen_scene_icons.py [xdd|bad|murder|weicheng|all]（默认 all）
      python tools/gen_scene_icons.py bad --favicon-only   只重切 favicon，不生图

- prompt 真源：workspace/{作品}/final_game.json 的 assets.sceneIconPrompt + meta.art.icon
- 图标：1:1 / low / 1K / jpg（Lumi 规范），输出 assets.sceneIcon（已存在跳过；重绘先删除）
- favicon：由图标中心裁切（88%）缩至 64×64 PNG，输出 assets.favicon（图标存在时总是重写）
"""
import importlib.util
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LUMI = ROOT / "Lumi" / "Lumi_API_gpt-image2-tencent.py"

sys.path.insert(0, str(ROOT / "tools"))
from art_spec import GAMES, compose, game_root, load_game  # noqa: E402

FAVICON_CROP = 0.88  # 中心裁切比例
FAVICON_SIZE = 64


def _lumi():
    spec = importlib.util.spec_from_file_location("lumi_img", LUMI)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def make_favicon(icon_path: Path, out_path: Path) -> None:
    img = Image.open(icon_path).convert("RGB")
    w, h = img.size
    side = int(min(w, h) * FAVICON_CROP)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side))
    img = img.resize((FAVICON_SIZE, FAVICON_SIZE), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, format="PNG")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(buf.getvalue())
    print(f"  favicon -> {out_path.relative_to(ROOT)}")


def run(game: str, favicon_only: bool = False) -> bool:
    root = game_root(game)
    data = load_game(game)
    assets = data.get("assets", {})
    icon_rel = assets.get("sceneIcon")
    if not icon_rel:
        print(f"[{game}] final_game.json 未配置 assets.sceneIcon，跳过")
        return True
    icon = root / icon_rel
    if icon.exists():
        print(f"[{game}] scene_icon 已存在，跳过生成（重绘请先删除）")
    elif favicon_only:
        print(f"[{game}] scene_icon 不存在，无法裁 favicon")
        return False
    else:
        raw = assets.get("sceneIconPrompt")
        if not raw:
            print(f"[{game}] 缺 assets.sceneIconPrompt，无法生成（去 DEBUG 的 Meta 编辑器补写）")
            return False
        print(f"[{game}] 生成情节列图标…")
        icon.parent.mkdir(parents=True, exist_ok=True)
        try:
            elapsed = _lumi().generate_and_save(
                compose(data, "icon", raw), str(icon),
                resolution="1K", aspect_ratio="1:1", quality="low", output_format="jpg",
            )
            print(f"  icon -> {icon.relative_to(ROOT)}（{elapsed:.0f}s）")
        except Exception as exc:  # noqa: BLE001
            print(f"  失败：{exc}")
            return False
    fav_rel = assets.get("favicon") or icon_rel.rsplit("/", 1)[0] + "/favicon.png"
    make_favicon(icon, root / fav_rel)
    return True


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    favicon_only = "--favicon-only" in sys.argv
    arg = args[0] if args else "all"
    targets = list(GAMES) if arg == "all" else [arg]
    for t in targets:
        if t not in GAMES:
            print(f"未知游戏 \"{t}\"，可选：{' | '.join(GAMES)} | all")
            return 1
    ok = all(run(t, favicon_only) for t in targets)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
