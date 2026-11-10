#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_assets.py — 并发生成游戏全部美术资产（腾讯云 GPT-Image-2）
用法: python tools/gen_assets.py [xdd|bad|murder|weicheng] [只生成指定 rel 路径...]（默认 xdd）

- 数据源：**workspace/{作品}/final_game.json**（prompt 的唯一真源，见 doc/04-art-pipeline.md）
    entries[].avatarPrompt / imagePrompt / look
    cards[].cgPrompt / cgChars
    assets.titleImagePrompt / endingImagePrompt / sceneIconPrompt
    meta.art（六段画风后缀，生图时按用途拼到 prompt 尾部）
- 并发：ThreadPoolExecutor(10)；已存在文件自动跳过（重跑只补缺失，重绘请先删除目标文件）
- 失败自动重试 2 次；结束打印清单与失败列表
- 统一 low 画质 / 1K / jpg（Lumi 规范）
- 单张重绘也可走游戏内 DEBUG 编辑器的「AI 重绘」（tools/regen_image.py）
"""
import concurrent.futures as cf
import importlib.util
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LUMI = ROOT / "Lumi" / "Lumi_API_gpt-image2-tencent.py"

spec = importlib.util.spec_from_file_location("lumi_img", LUMI)
lumi = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lumi)

sys.path.insert(0, str(ROOT / "tools"))
from art_spec import ASSET_PREFIX, GAMES, build_jobs, load_game  # noqa: E402

_args = sys.argv[1:]
GAME = _args[0] if _args and _args[0] in GAMES else "xdd"
OUT_ROOT = ROOT / "workspace" / GAMES[GAME]
DATA = load_game(GAME)
_ASSET_PREFIX = ASSET_PREFIX[GAME]


def gen_one(rel: str, prompt: str, ratio: str, refs=None) -> tuple:
    out = OUT_ROOT / rel
    if out.exists() and out.stat().st_size > 0:
        return rel, True, "跳过(已存在)"
    out.parent.mkdir(parents=True, exist_ok=True)
    # 只用已存在的参考图（定妆照/头像若尚未产出则跳过参考，仍走纯文本生成）
    ref_files = [r for r in (refs or []) if os.path.exists(r) and os.path.getsize(r) > 0]
    kwargs = dict(aspect_ratio=ratio, quality="low", resolution="1K", output_format="jpg")
    if ref_files:
        kwargs["reference_images"] = ref_files
    last = ""
    for attempt in range(3):
        try:
            secs = lumi.generate_and_save(prompt, str(out), **kwargs)
            tag = f" (参考图×{len(ref_files)})" if ref_files else ""
            return rel, True, f"{secs:.0f}s{tag}"
        except Exception as e:  # noqa: BLE001
            last = str(e)[:150]
            time.sleep(3 * (attempt + 1))
    return rel, False, last


def _run_wave(items: list, title: str) -> list:
    """items = [(rel, prompt, ratio, refs)]，10 线程并发，返回失败 rel 列表。"""
    if not items:
        return []
    print(f"\n=== {title}：{len(items)} 张（并发10）===")
    fails = []
    with cf.ThreadPoolExecutor(max_workers=10) as ex:
        futs = {ex.submit(gen_one, rel, p, r, refs): rel for rel, p, r, refs in items}
        for fut in cf.as_completed(futs):
            rel, ok, info = fut.result()
            print(("OK  " if ok else "FAIL") + f" {rel}  {info}", flush=True)
            if not ok:
                fails.append(rel)
    return fails


def main() -> None:
    only = [a for a in _args if a not in GAMES]  # 可选：只生成指定 rel 路径
    # 第一波：头像/特殊图/词条图（无参考图）；第二波：情节卡 CG（依赖头像作参考图）
    wave1, wave2, skipped = build_jobs(GAME, DATA, OUT_ROOT)
    if only:
        wave1 = [it for it in wave1 if it[0] in only]
        wave2 = [it for it in wave2 if it[0] in only]
    if skipped:
        print(f"⚠ {len(skipped)} 张图在 final_game.json 里没有 prompt，已跳过（去 DEBUG 编辑器补写）：")
        for s in skipped[:20]:
            print("   -", s)
        if len(skipped) > 20:
            print(f"   …… 其余 {len(skipped) - 20} 张见 DEBUG/art_prompts_missing.md")
    print(f"游戏 {GAME}：第一波 {len(wave1)} 张 + 第二波 CG {len(wave2)} 张")
    t0 = time.time()
    fails = _run_wave(wave1, "第一波·头像/词条图")
    fails += _run_wave(wave2, "第二波·情节卡 CG")
    print(f"\n完成，耗时 {time.time()-t0:.0f}s，失败 {len(fails)} 张")
    for f in fails:
        print("FAIL:", f)
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
