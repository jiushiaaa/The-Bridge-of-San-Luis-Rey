#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_bgm.py — 按 final_game.json 的 assets.bgm 批量生成 BGM（Suno v5.5 via TTAPI，多线程）

规范见 doc/14-bgm-pipeline.md。前置：assets.bgm 每条已写好 prompt（英文描述）/ tags / title / file，
并已通过 python tools/validate_data.py <game>（check_bgm 会拦开篇曲缺失、曲数不足等）。

用法:
    python tools/gen_bgm.py xdd                    # 只生成 file 尚不存在的曲目
    python tools/gen_bgm.py xdd --clean            # 先删 <assets>/audio/*.mp3 再全量重做
    python tools/gen_bgm.py xdd --only l1-intro,l1-vessel
    python tools/gen_bgm.py xdd --force            # 已存在也重做
    python tools/gen_bgm.py xdd --workers 6 --dry-run

每个任务：提交 → 轮询 → 两条 clip 里时长最长的下载到 track.file，另一条存到 workspace/<game>/DEBUG/bgm_alt/<id>.mp3
作备选（DEBUG「背景音乐」编辑器里可用「更换音频」换上）。两条都短于 MIN_DURATION、失败 / 超时 / 限流 → 指数退避重试 RETRIES 次。
结果写 workspace/<game>/DEBUG/bgm_gen_log.json（jobId、时长、耗时、错误）。
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "Lumi"))
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

import requests  # noqa: E402

from Lumi_API_suno_ttapi import (  # noqa: E402
    SunoTTAPIError,
    download_mp3,
    pick_audio_url,
    submit_instrumental_bgm,
    wait_for_music,
)

GAMES = {"xdd": "xidaduo", "bad": "badblood", "murder": "murder", "weicheng": "WeiCheng_QianZhongShu"}

RETRIES = 2
MIN_DURATION = 60  # 秒；短于此视为失败重做（正常 2–4 分钟）
DEFAULT_TAGS = "instrumental, cinematic, game soundtrack, no vocals"
NEGATIVE_TAGS = "vocals, singing, lyrics, rap, voice, choir, spoken word"

_print_lock = threading.Lock()


def log(msg: str) -> None:
    with _print_lock:
        print(msg, flush=True)


def _dur(music: dict) -> float:
    """musics[].duration 有时是字符串，统一转秒数；缺失按 0"""
    try:
        return float(music.get("duration") or 0)
    except (TypeError, ValueError):
        return 0.0


def gen_one(track: dict, game_root: Path, alt_dir: Path) -> dict:
    tid = track["id"]
    dest = game_root / track["file"]
    prompt = (track.get("prompt") or "").strip()
    tags = (track.get("tags") or DEFAULT_TAGS).strip()
    title = track.get("title") or tid
    rec: dict = {"id": tid, "file": track["file"], "ok": False, "attempts": 0}
    t0 = time.monotonic()
    last_err = ""
    for attempt in range(RETRIES + 1):
        rec["attempts"] = attempt + 1
        try:
            job_id = submit_instrumental_bgm(
                description=prompt,
                title=title,
                tags=tags,
                negative_tags=NEGATIVE_TAGS,
            )
            rec["jobId"] = job_id
            log(f"[{tid}] 已提交 jobId={job_id}（第 {attempt + 1} 次）")
            result = wait_for_music(job_id, log=lambda m, _t=tid: None)
            musics = (result.get("data") or {}).get("musics") or []
            # Suno 偶发只出几十秒的短片段：两条 clip 里挑时长 ≥ MIN_DURATION 的做正片，都太短则重做
            durs = [_dur(m) for m in musics]
            order = sorted(range(len(musics)), key=lambda i: -durs[i])
            if not order or durs[order[0]] < MIN_DURATION:
                raise SunoTTAPIError(f"生成结果过短（{durs}s < {MIN_DURATION}s）")
            main_i, alt_i = order[0], (order[1] if len(order) > 1 else None)
            url0 = pick_audio_url(result, main_i)
            download_mp3(url0, dest, log=lambda m: None)
            rec["duration"] = durs[main_i]
            if alt_i is not None and musics[alt_i].get("audioUrl"):
                alt = alt_dir / f"{tid}.mp3"
                try:
                    download_mp3(musics[alt_i]["audioUrl"], alt, log=lambda m: None)
                    rec["alt"] = str(alt.relative_to(ROOT)).replace("\\", "/")
                    rec["altDuration"] = durs[alt_i]
                except (SunoTTAPIError, requests.RequestException) as exc:
                    rec["altError"] = str(exc)
            rec["ok"] = True
            rec["seconds"] = round(time.monotonic() - t0, 1)
            log(f"[{tid}] 完成 {track['file']}（{rec.get('duration')}s，用时 {rec['seconds']}s）")
            return rec
        except (SunoTTAPIError, requests.RequestException, ValueError, KeyError, TypeError) as exc:
            last_err = str(exc)
            wait = min(90, 8 * (2 ** attempt)) + random.uniform(0, 4)
            log(f"[{tid}] 失败（第 {attempt + 1} 次）：{last_err[:160]}；{wait:.0f}s 后重试")
            time.sleep(wait)
    rec["error"] = last_err
    rec["seconds"] = round(time.monotonic() - t0, 1)
    log(f"[{tid}] 放弃：{last_err[:200]}")
    return rec


def main() -> int:
    ap = argparse.ArgumentParser(description="按 assets.bgm 批量生成 BGM（Suno v5.5 / TTAPI）")
    ap.add_argument("game", choices=sorted(GAMES))
    ap.add_argument("--workers", type=int, default=6, help="并发线程数（默认 6，勿超过 10）")
    ap.add_argument("--only", default="", help="只生成这些曲目 id（逗号分隔）")
    ap.add_argument("--clean", action="store_true", help="先删除音频目录下全部 mp3（全量重做）")
    ap.add_argument("--force", action="store_true", help="file 已存在也重新生成")
    ap.add_argument("--dry-run", action="store_true", help="只打印将要提交的任务，不调 API")
    args = ap.parse_args()

    game_root = ROOT / "workspace" / GAMES[args.game]
    data_file = game_root / "final_game.json"
    g = json.loads(data_file.read_text(encoding="utf-8"))
    tracks: list[dict] = g["assets"].get("bgm") or []
    if not tracks:
        print("assets.bgm 为空，先按 doc/14 写好设计再来。", file=sys.stderr)
        return 1

    only = {x.strip() for x in args.only.split(",") if x.strip()}
    missing_prompt = [t["id"] for t in tracks if not (t.get("prompt") or "").strip()]
    if missing_prompt:
        print(f"以下曲目缺 prompt，拒绝生成：{', '.join(missing_prompt)}", file=sys.stderr)
        return 1

    audio_dirs = {(game_root / t["file"]).parent for t in tracks}
    if args.clean and not args.dry_run:
        n = 0
        for d in audio_dirs:
            if d.exists():
                for f in d.glob("*.mp3"):
                    f.unlink()
                    n += 1
        print(f"--clean 已删除 {n} 个 mp3")

    todo = []
    for t in tracks:
        if only and t["id"] not in only:
            continue
        dest = game_root / t["file"]
        if dest.exists() and not args.force and not args.clean:
            continue
        todo.append(t)
    if not todo:
        print("没有需要生成的曲目（已全部存在；--force 可重做）")
        return 0

    print(f"待生成 {len(todo)} 首，并发 {args.workers}：")
    for t in todo:
        print(f"  {t['id']:<16} stage={t['stage']!s:<7} card={t.get('unlockCard') or '-':<8} → {t['file']}")
        print(f"      tags: {t.get('tags') or DEFAULT_TAGS}")
        print(f"      prompt({len(t.get('prompt') or '')}): {(t.get('prompt') or '')[:140]}…")
    if args.dry_run:
        return 0

    alt_dir = game_root / "DEBUG" / "bgm_alt"
    alt_dir.mkdir(parents=True, exist_ok=True)
    log_file = game_root / "DEBUG" / "bgm_gen_log.json"
    prev: dict = {}
    if log_file.exists():
        try:
            prev = {r["id"]: r for r in json.loads(log_file.read_text(encoding="utf-8")).get("tracks", [])}
        except (ValueError, KeyError, TypeError):
            prev = {}

    results: dict[str, dict] = dict(prev)
    started = time.time()
    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 10))) as ex:
        futs = {}
        for i, t in enumerate(todo):
            time.sleep(1.2 if i else 0)  # 错开提交，避免瞬时打满队列（499）
            futs[ex.submit(gen_one, t, game_root, alt_dir)] = t["id"]
        for fut in as_completed(futs):
            rec = fut.result()
            rec["at"] = time.strftime("%Y-%m-%d %H:%M:%S")
            results[rec["id"]] = rec
            log_file.write_text(
                json.dumps({"game": args.game, "updated": time.strftime("%Y-%m-%d %H:%M:%S"), "tracks": list(results.values())},
                           ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

    ok = [r for r in results.values() if r.get("id") in {t["id"] for t in todo} and r.get("ok")]
    bad = [r for r in results.values() if r.get("id") in {t["id"] for t in todo} and not r.get("ok")]
    print(f"\n完成 {len(ok)}/{len(todo)}，总用时 {time.time() - started:.0f}s；日志 {log_file.relative_to(ROOT)}")
    for r in bad:
        print(f"  失败: {r['id']} — {r.get('error', '')[:200]}")
    if bad:
        print("重跑失败项：python tools/gen_bgm.py %s --only %s" % (args.game, ",".join(r["id"] for r in bad)))
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
