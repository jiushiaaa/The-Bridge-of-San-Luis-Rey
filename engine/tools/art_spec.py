#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
art_spec.py — 生图规格的唯一定义处（prompt 拼装 / 比例 / 参考图）

gen_assets.py（全量补图）、regen_image.py（单张重绘）、gen_scene_icons.py（主题图标）
共用本模块，保证「批量生成」与「DEBUG 里点一下重绘」拼出来的 prompt 完全一致。

prompt 真源是 workspace/{作品}/final_game.json：
  entries[].avatarPrompt  人物头像原文（拼 art.portrait）
  entries[].imagePrompt   地点/物品/概念图原文（按 type 拼 art.scene/item/concept）
  entries[].look          定妆照速记，情节卡 CG 里逐人声明
  cards[].cgPrompt        情节卡场景原文（拼各人物 look + art.cg）
  cards[].cgChars         CG 中出场的人物词条 id（同时作为图生图参考头像）
  assets.titleImagePrompt / endingImagePrompt / sceneIconPrompt
  meta.art                六段画风后缀
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

GAMES = {"xdd": "xidaduo", "bad": "badblood", "murder": "murder", "weicheng": "WeiCheng_QianZhongShu"}
ASSET_PREFIX = {
    "xdd": "xdd-assets",
    "bad": "bad-assets",
    "murder": "murder-assets",
    "weicheng": "wc-assets",
}

# meta.art 缺省时的兜底画风（新作品未填 art 也能出图）
DEFAULT_ART = {
    "portrait": (
        ", Japanese anime style, bright warm colors, Kyoto Animation feeling, "
        "soft daylight, clean detailed character portrait, upper body, facing viewer, "
        "plain soft warm beige background, no text, no watermark"
    ),
    "scene": (
        ", Japanese anime style, bright warm colors, Kyoto Animation feeling, "
        "soft light, detailed background illustration, no text, no watermark"
    ),
    "item": (
        ", Japanese anime style, bright warm colors, soft light, detailed still life, "
        "clean composition, no text, no watermark"
    ),
    "concept": (
        ", symbolic illustration, Japanese anime style, bright warm colors, "
        "Kyoto Animation feeling, soft light, evocative composition, no written characters, "
        "no text, no watermark"
    ),
    "cg": (
        ", Japanese anime style, bright warm colors, Kyoto Animation feeling, "
        "cinematic 16:9 wide shot, soft cinematic light, expressive evocative composition, "
        "detailed background illustration, no text, no watermark"
    ),
    "icon": (
        ", emblem style game icon, centered symmetrical composition, bold clean shapes, "
        "Japanese anime style, bright colors, Kyoto Animation feeling, soft light, "
        "no text, no letters, no watermark"
    ),
}

# 用途 → 输出比例（Lumi 规范：全部 low / 1K / jpg）
RATIO = {
    "portrait": "1:1",
    "scene": "1:1",
    "item": "1:1",
    "concept": "1:1",
    "cg": "16:9",
    "icon": "1:1",
    "special": "3:2",  # title / ending
}

# 词条类型 → 画风键
TYPE_STYLE = {"person": "portrait", "place": "scene", "item": "item", "concept": "concept"}


def game_root(game: str) -> Path:
    return ROOT / "workspace" / GAMES[game]


def load_game(game: str) -> dict:
    return json.loads((game_root(game) / "final_game.json").read_text(encoding="utf-8"))


def art_of(data: dict, key: str) -> str:
    return (data.get("meta", {}).get("art") or {}).get(key) or DEFAULT_ART[key]


def look_of(data: dict, eid: str, variant: str | None = None) -> str:
    """人物的定妆照速记；指定变体（如 "old" 中老年版）时取 variants.{variant}.look。"""
    e = data.get("entries", {}).get(eid) or {}
    if variant:
        v = (e.get("variants") or {}).get(variant) or {}
        if v.get("look"):
            return v["look"]
    return e.get("look") or ""


def avatar_of(data: dict, eid: str, variant: str | None = None) -> str:
    """人物在某变体下的头像相对路径（变体缺头像时回退基础头像）。"""
    e = data.get("entries", {}).get(eid) or {}
    if variant:
        v = (e.get("variants") or {}).get(variant) or {}
        if v.get("avatar"):
            return v["avatar"]
    return e.get("avatar") or ""


def compose(data: dict, style_key: str, raw: str, chars=None, char_variants=None) -> str:
    """把原文 prompt 拼成送给生图接口的完整 prompt。

    情节卡 CG 会在场景描述后逐一声明出场人物的定妆照（look），再接画风后缀——
    这是跨图形象一致的两条保险之一（另一条是把人物头像作为参考图传入）。
    char_variants：{词条 id: 变体名}，让同一张 CG 里的角色使用指定年龄段的形象。
    """
    text = (raw or "").strip()
    if style_key == "cg" and chars:
        cvars = char_variants or {}
        looks = "; ".join(look_of(data, c, cvars.get(c)) for c in chars if look_of(data, c, cvars.get(c)))
        if looks:
            text += ". The scene features " + looks
    return text + art_of(data, style_key)


def avatar_path(game: str, eid: str) -> str:
    return f"{ASSET_PREFIX[game]}/avatars/{eid}.jpg"


def build_jobs(game: str, data: dict, out_root: Path):
    """展开全量生图任务。

    返回 (wave1, wave2, skipped)：
      wave1 = 无参考图的头像 / 词条图 / 特殊图 / 主题图标
      wave2 = 情节卡 CG（依赖 wave1 的头像作参考图，必须后跑）
      skipped = 没有 prompt、无法生成的相对路径清单
    """
    px = ASSET_PREFIX[game]
    wave1, wave2, skipped = [], [], []

    for eid, e in data["entries"].items():
        if e.get("avatar"):
            raw = e.get("avatarPrompt") or e.get("look")
            if raw:
                wave1.append((e["avatar"], compose(data, "portrait", raw), RATIO["portrait"], None))
            else:
                skipped.append(f"{e['avatar']}（词条 {eid} 缺 avatarPrompt）")
        # 形象变体头像（如中老年版）：以基础头像为参考图，保持同一人物辨识度
        for vname, v in (e.get("variants") or {}).items():
            if not v.get("avatar"):
                continue
            raw = v.get("avatarPrompt") or v.get("look")
            if raw:
                base_refs = [str(out_root / e["avatar"])] if e.get("avatar") else None
                wave1.append((v["avatar"], compose(data, "portrait", raw), RATIO["portrait"], base_refs))
            else:
                skipped.append(f"{v['avatar']}（词条 {eid} 变体 {vname} 缺 avatarPrompt）")
        if e.get("image"):
            style = TYPE_STYLE.get(e.get("type", "concept"), "concept")
            raw = e.get("imagePrompt")
            if raw:
                wave1.append((e["image"], compose(data, style, raw), RATIO[style], None))
            else:
                skipped.append(f"{e['image']}（词条 {eid} 缺 imagePrompt）")

    assets = data.get("assets", {})
    for path_key, prompt_key, style in (
        ("titleImage", "titleImagePrompt", "scene"),
        ("endingImage", "endingImagePrompt", "scene"),
        ("sceneIcon", "sceneIconPrompt", "icon"),
    ):
        rel = assets.get(path_key)
        if not rel:
            continue
        raw = assets.get(prompt_key)
        ratio = RATIO["special"] if style == "scene" else RATIO[style]
        if raw:
            wave1.append((rel, compose(data, style, raw), ratio, None))
        else:
            skipped.append(f"{rel}（assets 缺 {prompt_key}）")

    for c in data["cards"]:
        if not c.get("cg"):
            continue
        raw = c.get("cgPrompt")
        if not raw:
            skipped.append(f"{c['cg']}（卡 {c['id']} 缺 cgPrompt）")
            continue
        chars = c.get("cgChars") or []
        cvars = c.get("cgCharVariants") or {}
        refs = [str(out_root / ap) for ch in chars if (ap := avatar_of(data, ch, cvars.get(ch)))]
        wave2.append((c["cg"], compose(data, "cg", raw, chars, cvars), RATIO["cg"], refs))

    return wave1, wave2, skipped


def resolve_one(game: str, data: dict, rel: str):
    """按素材相对路径反查该图的生成规格（供 regen_image.py 单张重绘）。

    返回 (prompt, ratio, refs)；找不到对应条目时抛 KeyError。
    """
    out_root = game_root(game)
    wave1, wave2, _ = build_jobs(game, data, out_root)
    for r, prompt, ratio, refs in wave1 + wave2:
        if r == rel:
            return prompt, ratio, refs or []
    raise KeyError(rel)
