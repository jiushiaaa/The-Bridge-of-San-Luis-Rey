"""
腾讯云 VOD AIGC · GPT-Image-2（OG 系列）独立生图模块
================================================================================

【功能概述】
  通过腾讯云点播 VOD 的 CreateAigcImageTask 接口，调用 OG 模型（image2_* 系列，
  与 OpenAI GPT-Image-2 同源）生成图片。完整流程：

    1. 提交生图任务（TC3-HMAC-SHA256 签名鉴权）
    2. 轮询 DescribeTaskDetail 直至 Status == FINISH
    3. 下载 Output.FileInfos[0].FileUrl 返回的 PNG 原图
    4. 按 output_format 做本地后处理（jpg 时转 JPEG，quality=90）

  腾讯 API 本身不直接输出 JPEG；本模块的「jpg」是在下载 PNG 后本地转换。

【默认参数】
  quality        = low          # 画质：low / medium / high → image2_low/medium/high
  resolution     = 1K           # 分辨率档位：1K / 2K / 4K
  aspect_ratio   = 3:2          # 宽高比（9 种，见 ASPECT_RATIOS）
  output_format  = jpg          # 输出格式：jpg（本地转码）/ png（原样保存）
  transparent    = no-transparent  # 透明背景：transparent / no-transparent
                                   # 启用透明时强制 output_format=png（JPEG 不支持透明）

【公开 API】

  generate_image(prompt, **kwargs) -> bytes
      同步生图主入口，返回最终图片二进制。
      参数：
        prompt          绘画提示词（必填）
        resolution      1K / 2K / 4K
        aspect_ratio    1:1, 3:2, 16:9, 4:3, 21:9, 2:3, 3:4, 9:16, 9:21
        quality         low / medium / high
        output_format   jpg / png（或 .jpg / .png）
        transparent     True/False 或 transparent / no-transparent
        reference_images 可选参考图，接受本地路径 / 公网 URL / 已构造好的
                         FileInfo dict，混合列表亦可（单个元素可直接传，无需包成列表）。
                         本地文件会自动读为 Base64 内联上传，无需任何网盘或云存储。
                         腾讯 OG 支持 jpg/jpeg/png/webp，建议所有参考图合计 < 7MB。
        file_infos      可选：直接透传给腾讯 FileInfos 的原始列表（高级用法，
                         会与 reference_images 解析结果合并）。
        timeout         总超时秒数，默认 600
        poll_interval   轮询间隔秒数，默认 3
        session_id      业务追踪 ID
        progress_callback(status, progress, detail)  轮询回调
        return_timing   True 时返回 (bytes, elapsed_seconds)

  generate_and_save(prompt, path, **kwargs) -> float
      生图并写入文件；返回耗时秒数（从提交任务起算）。

  create_task(prompt, **kwargs) -> str
      仅创建任务，返回 TaskId。

  describe_task(task_id) -> dict
      查询任务详情。

  list_output_sizes() -> list[dict]
      列出 3×9=27 种 resolution × aspect_ratio 组合。

  png_to_jpg(png_bytes, quality=90) -> bytes
      PNG 转 JPEG 工具函数。

  build_file_infos(reference_images, extra_file_infos=None) -> list[dict]
      把「本地路径 / 公网 URL / FileInfo dict」统一解析为腾讯 FileInfos 列表：
        · 本地文件  → {"Type": "Base64", "Base64": <无前缀的 base64>}
        · http(s)   → {"Type": "Url", "Url": ...}
        · dict      → 原样透传
      本地文件用 Base64 内联，无需腾讯网盘 / COS / 云点播上传。

【参考图（图生图）】

  参考图通过腾讯 CreateAigcImageTask 的 FileInfos 传入，OG 系列支持
  jpg/jpeg/png/webp，建议所有参考图合计 < 7MB（Base64 后受云 API 10MB 包限制）。
  本模块支持三种来源，均无需注册任何网盘：
    · 本地路径 —— 自动读为 Base64 内联（最省事）
    · 公网 URL —— 传 {"Type": "Url", "Url": ...}
    · 云点播 FileId —— 传 {"Type": "File", "FileId": ...}

【模块调用示例】

  import importlib
  mod = importlib.import_module("ai_gpt-image2-tencent")  # 文件名含连字符

  # 默认参数生图并保存
  elapsed = mod.generate_and_save("一只猫", "out.jpg")

  # 获取二进制 + 耗时
  data, secs = mod.generate_image("一只猫", return_timing=True)

  # 透明背景 PNG
  data = mod.generate_image("logo", transparent="transparent", output_format="png")

  # 参考图（本地 jpg 自动转 Base64；可传单个或多个）
  data = mod.generate_image(
      "参考人物在参考场景中舞剑",
      reference_images=["role.jpg", "scene.jpg"],
      resolution="1K", aspect_ratio="16:9", quality="low",
  )

【命令行示例】

  python ai_gpt-image2-tencent.py "一只猫" -o cat.jpg
  python ai_gpt-image2-tencent.py "logo" -o logo.png --transparent --format png
  python ai_gpt-image2-tencent.py "风景" -o scene.jpg --resolution 2K --aspect-ratio 16:9 --quality medium
  python ai_gpt-image2-tencent.py "人物在场景中舞剑" -o out.jpg --ref role.jpg --ref scene.jpg

【环境变量（凭证，可选覆盖）】
  TENCENT_CLOUD_SECRET_ID
  TENCENT_CLOUD_SECRET_KEY
  TENCENT_CLOUD_SUB_APP_ID

【依赖】
  requests（HTTP）
  Pillow（仅 output_format=jpg 时需要，用于 PNG→JPEG 转码）
"""

import argparse
import base64
import hashlib
import hmac
import json
import os
import time
from io import BytesIO

import requests

try:
    from PIL import Image
except ImportError:
    Image = None

# ── 凭证（可用环境变量覆盖）──────────────────────────────────
SECRET_ID = os.environ.get(
    "TENCENT_CLOUD_SECRET_ID", ""
)
SECRET_KEY = os.environ.get(
    "TENCENT_CLOUD_SECRET_KEY", ""
)
SUB_APP_ID = int(os.environ.get("TENCENT_CLOUD_SUB_APP_ID", "1360359933"))

VOD_HOST = "vod.tencentcloudapi.com"
VOD_SERVICE = "vod"
VOD_VERSION = "2018-07-17"

# GPT-Image-2 → 腾讯 OG image2_* 版本
QUALITY_VERSIONS = {
    "low": "image2_low",
    "medium": "image2_medium",
    "high": "image2_high",
}
DEFAULT_QUALITY = "low"

RESOLUTIONS = ("1K", "2K", "4K")
ASPECT_RATIOS = (
    "1:1", "3:2", "16:9", "4:3", "21:9",
    "2:3", "3:4", "9:16", "9:21",
)
DEFAULT_RESOLUTION = "1K"
DEFAULT_ASPECT_RATIO = "3:2"

OUTPUT_FORMATS = ("jpg", "png")
DEFAULT_OUTPUT_FORMAT = "jpg"
JPG_QUALITY = 90

DEFAULT_TRANSPARENT = "no-transparent"

CREATE_RETRY_BACKOFF = (0, 3, 8, 15)
CREATE_RETRYABLE_CODES = frozenset({
    "FailedOperation", "RequestLimitExceeded", "LimitExceeded",
})


def _resolve_quality(quality):
    q = (quality or DEFAULT_QUALITY).strip().lower()
    return q if q in QUALITY_VERSIONS else DEFAULT_QUALITY


def _resolve_output(resolution=None, aspect_ratio=None):
    res = (resolution or DEFAULT_RESOLUTION).strip().upper()
    if res not in RESOLUTIONS:
        res = DEFAULT_RESOLUTION
    ratio = (aspect_ratio or DEFAULT_ASPECT_RATIO).strip()
    if ratio not in ASPECT_RATIOS:
        ratio = DEFAULT_ASPECT_RATIO
    return res, ratio


def _resolve_transparent(transparent=None):
    if isinstance(transparent, bool):
        return transparent
    t = (transparent if transparent is not None else DEFAULT_TRANSPARENT)
    t = str(t).strip().lower()
    if t in ("transparent", "yes", "true", "1", "on"):
        return True
    if t in ("no-transparent", "no_transparent", "opaque", "no", "false", "0", "off"):
        return False
    return False


def _resolve_output_format(output_format=None, *, transparent=False):
    if transparent:
        return "png"
    fmt = (output_format or DEFAULT_OUTPUT_FORMAT).strip().lower().lstrip(".")
    if fmt == "jpeg":
        fmt = "jpg"
    return fmt if fmt in OUTPUT_FORMATS else DEFAULT_OUTPUT_FORMAT


def list_output_sizes():
    return [
        {"resolution": res, "aspect_ratio": ratio}
        for res in RESOLUTIONS
        for ratio in ASPECT_RATIOS
    ]


def png_to_jpg(png_bytes, quality=JPG_QUALITY):
    """将 PNG 字节转为 JPEG；RGBA 透明区域铺白底。"""
    if Image is None:
        raise RuntimeError("output_format=jpg 需要安装 Pillow：pip install Pillow")
    img = Image.open(BytesIO(png_bytes))
    if img.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        img = bg
    elif img.mode == "P":
        img = img.convert("RGBA")
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


def _apply_output_format(png_bytes, output_format):
    if output_format == "jpg":
        return png_to_jpg(png_bytes, quality=JPG_QUALITY)
    return png_bytes


REFERENCE_IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp")


def _file_info_from_path(path):
    """把本地图片路径读为腾讯 FileInfo（Base64 内联，无需上传网盘/云存储）。"""
    ext = os.path.splitext(path)[1].lower()
    if ext not in REFERENCE_IMAGE_EXTS:
        raise ValueError(
            f"参考图格式不支持：{path}（仅支持 {', '.join(REFERENCE_IMAGE_EXTS)}）"
        )
    with open(path, "rb") as f:
        raw = f.read()
    if not raw:
        raise ValueError(f"参考图为空文件：{path}")
    return {"Type": "Base64", "Base64": base64.b64encode(raw).decode("ascii")}


def build_file_infos(reference_images=None, extra_file_infos=None):
    """将参考图来源统一解析为腾讯 FileInfos 列表。

    reference_images 可为单个元素或列表，元素支持：
      · 本地文件路径（str） → Base64 内联；
      · http(s):// 开头的 URL（str） → {"Type": "Url", "Url": ...}；
      · 已构造好的 FileInfo dict → 原样透传。
    extra_file_infos 为需要额外合并的原始 FileInfo 列表（高级用法）。
    """
    result = []
    if reference_images is not None:
        if isinstance(reference_images, (str, bytes, dict)):
            items = [reference_images]
        else:
            items = list(reference_images)
        for item in items:
            if isinstance(item, dict):
                result.append(item)
            elif isinstance(item, str):
                low = item.strip().lower()
                if low.startswith("http://") or low.startswith("https://"):
                    result.append({"Type": "Url", "Url": item})
                else:
                    result.append(_file_info_from_path(item))
            else:
                raise TypeError(f"无法识别的参考图项：{item!r}")
    if extra_file_infos:
        result.extend(extra_file_infos)
    return result


def _sign_request(action, payload, *, timestamp=None):
    ts = timestamp if timestamp is not None else int(time.time())
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    payload_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()

    ct = "application/json; charset=utf-8"
    canonical_headers = (
        f"content-type:{ct}\n"
        f"host:{VOD_HOST}\n"
        f"x-tc-action:{action.lower()}\n"
    )
    signed_headers = "content-type;host;x-tc-action"
    canonical_request = (
        "POST\n/\n\n"
        f"{canonical_headers}\n{signed_headers}\n{payload_hash}"
    )

    algorithm = "TC3-HMAC-SHA256"
    date = time.strftime("%Y-%m-%d", time.gmtime(ts))
    scope = f"{date}/{VOD_SERVICE}/tc3_request"
    string_to_sign = (
        f"{algorithm}\n{ts}\n{scope}\n"
        f"{hashlib.sha256(canonical_request.encode()).hexdigest()}"
    )

    def _hmac(key, msg):
        return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

    signing_key = _hmac(
        _hmac(_hmac(("TC3" + SECRET_KEY).encode(), date), VOD_SERVICE),
        "tc3_request",
    )
    signature = hmac.new(
        signing_key, string_to_sign.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    headers = {
        "Authorization": (
            f"{algorithm} Credential={SECRET_ID}/{scope}, "
            f"SignedHeaders={signed_headers}, Signature={signature}"
        ),
        "Content-Type": ct,
        "Host": VOD_HOST,
        "X-TC-Action": action,
        "X-TC-Timestamp": str(ts),
        "X-TC-Version": VOD_VERSION,
    }
    return headers, body


def _call_vod(action, payload, *, timeout=30):
    headers, body = _sign_request(action, payload)
    resp = requests.post(
        f"https://{VOD_HOST}",
        headers=headers,
        data=body.encode("utf-8"),
        timeout=timeout,
    )
    if resp.status_code >= 300:
        raise RuntimeError(
            f"Tencent {action} HTTP {resp.status_code}: {resp.text[:200]}"
        )
    obj = resp.json()
    response = obj.get("Response") or {}
    error = response.get("Error")
    if error:
        req_id = response.get("RequestId") or obj.get("RequestId") or ""
        hint = f"（RequestId={req_id}）" if req_id else ""
        raise RuntimeError(
            f"Tencent {action} 调用失败："
            f"{error.get('Code', '?')} - {error.get('Message', '?')}{hint}"
        )
    return response


def create_task(
    prompt,
    *,
    resolution=DEFAULT_RESOLUTION,
    aspect_ratio=DEFAULT_ASPECT_RATIO,
    quality=DEFAULT_QUALITY,
    transparent=DEFAULT_TRANSPARENT,
    reference_images=None,
    file_infos=None,
    session_id=None,
):
    """创建生图任务，返回 TaskId。"""
    resolution, aspect_ratio = _resolve_output(resolution, aspect_ratio)
    payload = {
        "SubAppId": SUB_APP_ID,
        "ModelName": "OG",
        "ModelVersion": QUALITY_VERSIONS[_resolve_quality(quality)],
        "Prompt": prompt,
        "OutputConfig": {
            "StorageMode": "Temporary",
            "Resolution": resolution,
            "AspectRatio": aspect_ratio,
        },
    }
    if _resolve_transparent(transparent):
        payload["ExtInfo"] = json.dumps({
            "AdditionalParameters": json.dumps(
                {"background": "transparent"}, separators=(",", ":")
            ),
        }, separators=(",", ":"))
    resolved_file_infos = build_file_infos(reference_images, file_infos)
    if resolved_file_infos:
        payload["FileInfos"] = resolved_file_infos
    if session_id:
        payload["SessionId"] = str(session_id)[:64]

    last_err = None
    for attempt_idx, wait_s in enumerate(CREATE_RETRY_BACKOFF):
        if wait_s > 0:
            time.sleep(wait_s)
        try:
            response = _call_vod("CreateAigcImageTask", payload)
            task_id = response.get("TaskId")
            if not task_id:
                raise RuntimeError(
                    f"Tencent CreateAigcImageTask 未返回 TaskId: {response}"
                )
            return task_id
        except RuntimeError as exc:
            last_err = exc
            if any(c in str(exc) for c in CREATE_RETRYABLE_CODES):
                if attempt_idx < len(CREATE_RETRY_BACKOFF) - 1:
                    continue
            raise
    if last_err:
        raise last_err
    raise RuntimeError("Tencent CreateAigcImageTask 未知失败")


def describe_task(task_id):
    return _call_vod("DescribeTaskDetail", {
        "TaskId": str(task_id),
        "SubAppId": SUB_APP_ID,
    })


def _poll_and_download(task_id, *, timeout, poll_interval, progress_callback):
    deadline = time.time() + float(timeout)
    last_status = ""
    while time.time() < deadline:
        time.sleep(max(0.5, float(poll_interval)))
        try:
            detail = describe_task(task_id)
        except Exception as exc:
            last_status = f"轮询异常：{exc}"
            if progress_callback:
                try:
                    progress_callback("UNKNOWN", None, {"error": str(exc)})
                except Exception:
                    pass
            continue

        aigc = detail.get("AigcImageTask") or {}
        status = (aigc.get("Status") or "").upper()
        last_status = status or last_status
        if progress_callback:
            try:
                progress_callback(status, aigc.get("Progress"), detail)
            except Exception:
                pass

        if status == "FINISH":
            outputs = (aigc.get("Output") or {}).get("FileInfos") or []
            if not outputs:
                raise RuntimeError(
                    f"Tencent 任务 {task_id} 完成但 Output.FileInfos 为空：{detail}"
                )
            url = outputs[0].get("FileUrl")
            if not url:
                raise RuntimeError(
                    f"Tencent 任务 {task_id} 完成但 FileUrl 为空：{outputs}"
                )
            r = requests.get(url, timeout=60)
            if r.status_code >= 300 or not r.content:
                raise RuntimeError(
                    f"下载 Tencent 输出图失败 HTTP {r.status_code}（TaskId={task_id}）"
                )
            return r.content

        if status in ("FAIL", "FAILED", "ERROR"):
            err = aigc.get("Message") or aigc.get("ErrCode") or "未知错误"
            raise RuntimeError(f"Tencent 任务失败（TaskId={task_id}）：{err}")

    raise RuntimeError(
        f"Tencent 任务 {task_id} 等待超时（{timeout}s 未完成，最近状态：{last_status}）"
    )


def generate_image(
    prompt,
    *,
    resolution=DEFAULT_RESOLUTION,
    aspect_ratio=DEFAULT_ASPECT_RATIO,
    quality=DEFAULT_QUALITY,
    output_format=DEFAULT_OUTPUT_FORMAT,
    transparent=DEFAULT_TRANSPARENT,
    reference_images=None,
    file_infos=None,
    timeout=600.0,
    poll_interval=3.0,
    session_id=None,
    progress_callback=None,
    return_timing=False,
):
    """同步生图：创建任务 → 轮询 → 下载 → 格式后处理，返回图片二进制。"""
    if not session_id:
        session_id = f"img_{int(time.time())}_{os.urandom(4).hex()}"

    use_transparent = _resolve_transparent(transparent)
    fmt = _resolve_output_format(output_format, transparent=use_transparent)

    t0 = time.time()
    task_id = create_task(
        prompt,
        resolution=resolution,
        aspect_ratio=aspect_ratio,
        quality=quality,
        transparent=use_transparent,
        reference_images=reference_images,
        file_infos=file_infos,
        session_id=session_id,
    )

    png_bytes = _poll_and_download(
        task_id,
        timeout=timeout,
        poll_interval=poll_interval,
        progress_callback=progress_callback,
    )
    result = _apply_output_format(png_bytes, fmt)
    elapsed = time.time() - t0

    if return_timing:
        return result, elapsed
    return result


def generate_and_save(prompt, path, **kwargs):
    """生图并保存到 path；返回耗时秒数（从提交任务起算）。"""
    ext = os.path.splitext(path)[1].lower().lstrip(".")
    if ext in ("jpg", "jpeg"):
        kwargs.setdefault("output_format", "jpg")
    elif ext == "png":
        kwargs.setdefault("output_format", "png")

    data, elapsed = generate_image(prompt, return_timing=True, **kwargs)
    with open(path, "wb") as f:
        f.write(data)
    return elapsed


def _cli_progress(status, progress, _detail):
    pct = f" {progress}%" if progress is not None else ""
    print(f"[{status}{pct}]", flush=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description="腾讯渠道 GPT-Image-2 生图")
    parser.add_argument("prompt", help="绘画提示词")
    parser.add_argument("-o", "--output", default="output.jpg", help="输出文件路径")
    parser.add_argument(
        "--resolution", default=DEFAULT_RESOLUTION, choices=RESOLUTIONS,
        help="输出分辨率档位",
    )
    parser.add_argument(
        "--aspect-ratio", default=DEFAULT_ASPECT_RATIO, choices=ASPECT_RATIOS,
        help="输出宽高比",
    )
    parser.add_argument(
        "--quality", default=DEFAULT_QUALITY, choices=["low", "medium", "high"],
        help="画质档位",
    )
    parser.add_argument(
        "--format", dest="output_format", default=DEFAULT_OUTPUT_FORMAT,
        choices=["jpg", "png"], help="输出格式（jpg 为下载后本地转码）",
    )
    parser.add_argument(
        "--transparent", action="store_true",
        help="启用透明背景（强制 png，通过 ExtInfo 传给腾讯 OG 模型）",
    )
    parser.add_argument(
        "--ref", dest="reference_images", action="append", metavar="PATH_OR_URL",
        help="参考图（图生图）；可重复传入。本地路径自动转 Base64，或直接给公网 URL",
    )
    parser.add_argument("--timeout", type=float, default=600, help="超时秒数")
    args = parser.parse_args(argv)

    refs = args.reference_images or None
    print(
        f"生图中… prompt={args.prompt!r} "
        f"resolution={args.resolution} aspect_ratio={args.aspect_ratio} "
        f"quality={args.quality} format={args.output_format} "
        f"transparent={'yes' if args.transparent else 'no'} "
        f"ref={len(refs) if refs else 0}"
    )
    elapsed = generate_and_save(
        args.prompt,
        args.output,
        resolution=args.resolution,
        aspect_ratio=args.aspect_ratio,
        quality=args.quality,
        output_format=args.output_format,
        transparent="transparent" if args.transparent else "no-transparent",
        reference_images=refs,
        timeout=args.timeout,
        progress_callback=_cli_progress,
    )
    print(f"已保存：{args.output}，耗时 {elapsed:.1f}s（从提交任务起算）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
