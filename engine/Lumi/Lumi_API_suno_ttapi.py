"""通过 TTAPI 网关调用 Suno v5.5，生成纯器乐 BGM（无人声）。

上游 API：https://docs.ttapi.io/api/cn/suno

流程：POST /suno/v1/music → 轮询 GET /suno/v2/fetch → 下载 audioUrl 为本地 mp3。

用法
====
    # 默认灵感描述，输出到 logs/test.mp3
    python -m scripts.ai_suno_ttapi

    # 自定义描述与输出路径
    python -m scripts.ai_suno_ttapi -o output/bgm.mp3 -p "悬疑解谜游戏菜单BGM，钢琴与弦乐，慢板"

    # 仅提交任务并打印 jobId（不等待）
    python -m scripts.ai_suno_ttapi --submit-only
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

import requests

# ── TTAPI 配置 ─────────────────────────────────────────────
TTAPI_KEY = ""
TTAPI_BASE = "https://api.ttapi.io"
SUNO_MV = "chirp-v5-5"  # Suno v5.5

POLL_INTERVAL_SEC = 4
POLL_TIMEOUT_SEC = 600


class SunoTTAPIError(RuntimeError):
    """Suno / TTAPI 调用失败。"""


def _headers() -> dict[str, str]:
    return {
        "TT-API-KEY": TTAPI_KEY,
        "Content-Type": "application/json",
    }


def _extract_job_id(payload: dict[str, Any]) -> str:
    data = payload.get("data") or {}
    for key in ("jobId", "job_id"):
        if data.get(key):
            return str(data[key])
    raise SunoTTAPIError(f"响应中缺少 jobId: {json.dumps(payload, ensure_ascii=False)}")


def submit_instrumental_bgm(
    *,
    description: str,
    title: str = "BGM",
    tags: str = "instrumental, ambient, cinematic, no vocals",
    negative_tags: str = "vocals, singing, lyrics, rap, voice",
    weirdness_constraint: float = 0.35,
    style_weight: float = 0.65,
    hook_url: str | None = None,
) -> str:
    """提交纯器乐生成任务，返回 jobId。"""
    body: dict[str, Any] = {
        "custom": False,
        "instrumental": True,
        "mv": SUNO_MV,
        "gpt_description_prompt": description,
        "title": title,
        "tags": tags,
        "negative_tags": negative_tags,
        "weirdness_constraint": weirdness_constraint,
        "style_weight": style_weight,
        "isStorage": True,
    }
    if hook_url:
        body["hookUrl"] = hook_url

    resp = requests.post(
        f"{TTAPI_BASE}/suno/v1/music",
        headers=_headers(),
        json=body,
        timeout=60,
    )
    try:
        payload = resp.json()
    except ValueError as exc:
        raise SunoTTAPIError(f"音乐提交响应非 JSON (HTTP {resp.status_code}): {resp.text[:500]}") from exc

    if resp.status_code != 200 or payload.get("status") != "SUCCESS":
        raise SunoTTAPIError(
            f"提交失败 HTTP {resp.status_code}: {json.dumps(payload, ensure_ascii=False)}"
        )

    return _extract_job_id(payload)


def fetch_job(job_id: str) -> dict[str, Any]:
    """查询异步任务状态与结果。"""
    resp = requests.get(
        f"{TTAPI_BASE}/suno/v2/fetch",
        headers={"TT-API-KEY": TTAPI_KEY},
        params={"jobId": job_id},
        timeout=60,
    )
    try:
        payload = resp.json()
    except ValueError as exc:
        raise SunoTTAPIError(f"查询响应非 JSON (HTTP {resp.status_code}): {resp.text[:500]}") from exc

    if resp.status_code != 200:
        raise SunoTTAPIError(
            f"查询失败 HTTP {resp.status_code}: {json.dumps(payload, ensure_ascii=False)}"
        )
    return payload


def wait_for_music(
    job_id: str,
    *,
    poll_interval: float = POLL_INTERVAL_SEC,
    timeout_sec: float = POLL_TIMEOUT_SEC,
    log=print,
) -> dict[str, Any]:
    """轮询直到 SUCCESS 或 FAILED / 超时。"""
    deadline = time.monotonic() + timeout_sec
    last_progress = ""

    while time.monotonic() < deadline:
        payload = fetch_job(job_id)
        status = payload.get("status", "")

        if status == "ON_QUEUE":
            data = payload.get("data") or {}
            progress = data.get("progress") or "排队中"
            if progress != last_progress:
                log(f"[Suno] jobId={job_id} 处理中… {progress}")
                last_progress = progress
            time.sleep(poll_interval)
            continue

        if status == "SUCCESS":
            log(f"[Suno] jobId={job_id} 生成完成")
            return payload

        if status == "FAILED":
            raise SunoTTAPIError(
                f"任务失败: {json.dumps(payload, ensure_ascii=False)}"
            )

        raise SunoTTAPIError(
            f"未知状态 {status!r}: {json.dumps(payload, ensure_ascii=False)}"
        )

    raise SunoTTAPIError(f"轮询超时 ({timeout_sec}s)，jobId={job_id}")


def pick_audio_url(fetch_payload: dict[str, Any], index: int = 0) -> str:
    """从 Fetch 成功响应中取出第一条音乐的 audioUrl。"""
    data = fetch_payload.get("data") or {}
    musics = data.get("musics") or []
    if not musics:
        raise SunoTTAPIError(f"结果中无 musics: {json.dumps(fetch_payload, ensure_ascii=False)}")
    if index >= len(musics):
        raise SunoTTAPIError(f"musics 仅 {len(musics)} 条，无法取 index={index}")
    url = musics[index].get("audioUrl")
    if not url:
        raise SunoTTAPIError(f"musics[{index}] 缺少 audioUrl")
    return str(url)


def download_mp3(url: str, dest: Path | str, *, log=print) -> Path:
    """下载远程 mp3 到本地。

    `dest` 接受 `Path` 或 `str`，内部统一转 `Path`（pipeline/bgmgen 等 caller
    经常拼出来的是 `os.path.join` 的 str，避免再次出 `'str' object has
    no attribute 'resolve'`）。
    """
    dest = Path(dest).resolve()
    dest.parent.mkdir(parents=True, exist_ok=True)

    log(f"[Suno] 下载 {url}")
    resp = requests.get(url, timeout=120, stream=True)
    resp.raise_for_status()

    with dest.open("wb") as f:
        for chunk in resp.iter_content(chunk_size=65536):
            if chunk:
                f.write(chunk)

    size_kb = dest.stat().st_size / 1024
    log(f"[Suno] 已保存 {dest} ({size_kb:.1f} KB)")
    return dest


def generate_bgm(
    description: str,
    output_path: Path | str,
    *,
    title: str = "BGM",
    tags: str = "instrumental, ambient, cinematic, no vocals",
    music_index: int = 0,
    poll_interval: float = POLL_INTERVAL_SEC,
    timeout_sec: float = POLL_TIMEOUT_SEC,
    log=print,
) -> Path:
    """端到端：提交纯器乐任务 → 轮询 → 下载 mp3。"""
    job_id = submit_instrumental_bgm(
        description=description,
        title=title,
        tags=tags,
    )
    log(f"[Suno] 已提交 jobId={job_id}")

    result = wait_for_music(
        job_id,
        poll_interval=poll_interval,
        timeout_sec=timeout_sec,
        log=log,
    )
    audio_url = pick_audio_url(result, index=music_index)
    return download_mp3(audio_url, Path(output_path), log=log)


def main() -> int:
    parser = argparse.ArgumentParser(description="Suno v5.5 纯器乐 BGM（TTAPI）")
    parser.add_argument(
        "-p", "--prompt",
        default=(
            "悬疑解谜游戏背景纯音乐，无任何人声与歌词；"
            "低沉钢琴与空灵弦乐，慢板，略带东方韵味，适合地图探索场景"
        ),
        help="灵感模式描述（gpt_description_prompt）",
    )
    parser.add_argument("-o", "--output", default="logs/test.mp3", help="输出 mp3 路径")
    parser.add_argument("--title", default="幻光文游探索BGM", help="曲目标题")
    parser.add_argument("--tags", default="instrumental, ambient, cinematic, puzzle game, no vocals")
    parser.add_argument("--music-index", type=int, default=0, help="取 musics 数组第几条（默认 0）")
    parser.add_argument("--poll-interval", type=float, default=POLL_INTERVAL_SEC)
    parser.add_argument("--timeout", type=float, default=POLL_TIMEOUT_SEC)
    parser.add_argument("--submit-only", action="store_true", help="仅提交，打印 jobId 后退出")
    args = parser.parse_args()

    try:
        if args.submit_only:
            job_id = submit_instrumental_bgm(
                description=args.prompt,
                title=args.title,
                tags=args.tags,
            )
            print(job_id)
            return 0

        generate_bgm(
            args.prompt,
            args.output,
            title=args.title,
            tags=args.tags,
            music_index=args.music_index,
            poll_interval=args.poll_interval,
            timeout_sec=args.timeout,
        )
        return 0
    except (SunoTTAPIError, requests.RequestException) as exc:
        print(f"错误: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
