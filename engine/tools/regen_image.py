#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
regen_image.py — 单张图片重绘（游戏内 DEBUG 编辑器的「AI 重绘」后端）
用法:
  python tools/regen_image.py bad bad-assets/cg/c1_01.jpg
      按 final_game.json 里现存的 prompt 重绘（拼装规则与 gen_assets.py 完全一致）
  python tools/regen_image.py bad bad-assets/cg/c1_01.jpg --prompt "…" --ratio 16:9 --ref e_holmes
      直接给原文 prompt（不含画风后缀，脚本按用途自动拼）；--ref 可重复，值为人物词条 id

与 gen_assets.py 的区别：**总是覆盖**已存在的文件（重绘的语义就是覆盖）。
旧图备份由调用方（backend/server.js）负责。
"""
import argparse
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LUMI = ROOT / "Lumi" / "Lumi_API_gpt-image2-tencent.py"
sys.path.insert(0, str(ROOT / "tools"))

from art_spec import (  # noqa: E402
    ASSET_PREFIX,
    GAMES,
    RATIO,
    TYPE_STYLE,
    avatar_path,
    compose,
    game_root,
    load_game,
    resolve_one,
)


def style_of(game: str, data: dict, rel: str) -> str:
    """按素材路径推断用途（画风键）。"""
    px = ASSET_PREFIX[game]
    if rel.startswith(f"{px}/avatars/"):
        return "portrait"
    if rel.startswith(f"{px}/cg/"):
        return "cg"
    assets = data.get("assets", {})
    if rel == assets.get("sceneIcon"):
        return "icon"
    if rel in (assets.get("titleImage"), assets.get("endingImage")):
        return "scene"
    eid = Path(rel).stem
    return TYPE_STYLE.get(data.get("entries", {}).get(eid, {}).get("type", "concept"), "concept")


def main() -> int:
    ap = argparse.ArgumentParser(description="单张重绘游戏素材图")
    ap.add_argument("game", choices=list(GAMES))
    ap.add_argument("path", help="素材相对路径，如 bad-assets/cg/c1_01.jpg")
    ap.add_argument("--prompt", help="原文 prompt（不含画风后缀）；不给则用 final_game.json 里的")
    ap.add_argument("--ratio", help="输出比例；不给则按用途推断")
    ap.add_argument("--ref", action="append", default=[], help="参考图人物词条 id，可重复")
    args = ap.parse_args()

    root = game_root(args.game)
    data = load_game(args.game)
    rel = args.path.replace("\\", "/").lstrip("/")

    if args.prompt:
        style = style_of(args.game, data, rel)
        prompt = compose(data, style, args.prompt, args.ref)
        ratio = args.ratio or (RATIO["special"] if rel in (
            data.get("assets", {}).get("titleImage"), data.get("assets", {}).get("endingImage")
        ) else RATIO[style])
        refs = [str(root / avatar_path(args.game, c)) for c in args.ref]
    else:
        try:
            prompt, ratio, refs = resolve_one(args.game, data, rel)
        except KeyError:
            print(f"final_game.json 里找不到 {rel} 对应的条目或它还没有 prompt", file=sys.stderr)
            return 2
        ratio = args.ratio or ratio

    out = root / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    spec = importlib.util.spec_from_file_location("lumi_img", LUMI)
    lumi = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(lumi)

    ref_files = [r for r in refs if Path(r).exists() and Path(r).stat().st_size > 0]
    kwargs = dict(aspect_ratio=ratio, quality="low", resolution="1K", output_format="jpg")
    if ref_files:
        kwargs["reference_images"] = ref_files
    last = ""
    for attempt in range(2):
        try:
            secs = lumi.generate_and_save(prompt, str(out), **kwargs)
            print(f"OK {rel} {secs:.0f}s (参考图×{len(ref_files)})")
            return 0
        except Exception as exc:  # noqa: BLE001
            last = str(exc)[:300]
    print(f"FAIL {rel} {last}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
