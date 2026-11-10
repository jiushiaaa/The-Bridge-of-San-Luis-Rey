#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
migrate_art_prompts.py — 把散落在脚本里的生图 prompt 一次性迁进 final_game.json
用法: python tools/migrate_art_prompts.py [xdd|bad|murder|all]（默认 all）

**一次性迁移已完成**（gen_assets.py / gen_scene_icons.py 现已改为从 JSON 读 prompt，
旧的硬编码表不复存在）。此后重跑本脚本只做两件无害的事：补 meta 缺省字段、
重新扫一遍还缺 prompt 的图并刷新缺口清单——所有写入都是 setdefault，绝不覆盖
后来在 DEBUG 编辑器里手写的 prompt。

迁移后 final_game.json 是全部生图 prompt 的唯一真源（doc/04-art-pipeline.md）：
  meta.art                      ← gen_assets.py 的 STYLE_* + gen_scene_icons.py 的 STYLE_ICON
  entries[eid].look             ← CHAR_LOOK_*（定妆照速记）
  entries[eid].avatarPrompt     ← MANIFEST_* 的 avatars/*.jpg（不含画风后缀）
  entries[eid].imagePrompt      ← MANIFEST_* 的 images/e_*.jpg（剥掉画风后缀）
  assets.titleImagePrompt / endingImagePrompt   ← MANIFEST_* 的 title/ending
  assets.sceneIconPrompt        ← gen_scene_icons.py 的 GAMES（剥掉 STYLE_ICON）
  cards[].cgPrompt / cgChars    ← CG_*（场景原文 + 出场人物）
  meta.status                   ← 缺省写入 "wip"（见 README_game §9）

画风后缀在生图时按用途重新拼接（人物头像 portrait / 地点 scene / 物品 item /
概念 concept / 情节卡 cg），所以库里存的一律是「不带后缀的原文」。
缺 prompt 的条目写进 workspace/{作品}/DEBUG/art_prompts_missing.md 待人工补写。
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAMES = {"xdd": "xidaduo", "bad": "badblood", "murder": "murder"}
PREFIX = {"xdd": "xdd-assets", "bad": "bad-assets", "murder": "murder-assets"}


def load_tables() -> dict:
    """执行 gen_assets.py 的「表定义」部分，取出 STYLE_/CHAR_LOOK_/MANIFEST_/CG_。

    只截取到 GAMES 定义之前：那之后的代码依赖 sys.argv，且会真正加载 Lumi 生图模块。
    一次性迁移完成后 gen_assets.py 已改为从 JSON 读表、旧表不复存在 —— 此时返回空表，
    本脚本退化为「重扫缺口、补 meta 缺省字段」的巡检工具（见模块 docstring）。
    """
    src = (ROOT / "tools" / "gen_assets.py").read_text(encoding="utf-8")
    if "# GAMES: id →" not in src:
        return {}
    head = src.split("# GAMES: id →")[0]
    for line in (
        'spec = importlib.util.spec_from_file_location("lumi_img", LUMI)',
        "lumi = importlib.util.module_from_spec(spec)",
        "spec.loader.exec_module(lumi)",
    ):
        head = head.replace(line + "\n", "")
    ns: dict = {"__file__": str(ROOT / "tools" / "gen_assets.py")}
    try:
        exec(compile(head, "gen_assets.py", "exec"), ns)  # noqa: S102
    except Exception:  # noqa: BLE001
        return {}
    return ns


def load_icon_prompts() -> tuple:
    """取 gen_scene_icons.py 的主题图标 prompt 与 STYLE_ICON。

    脚本迁移完成后（gen_scene_icons.py 已改为从 final_game.json 读 prompt）这里取不到表，
    此时回落到 art_spec 的内置画风、并让本脚本跳过 sceneIconPrompt（json 里已有，不动它）。
    """
    src = (ROOT / "tools" / "gen_scene_icons.py").read_text(encoding="utf-8")
    head = src.split("FAVICON_CROP")[0]
    for line in (
        'spec = importlib.util.spec_from_file_location("lumi_img", LUMI)',
        "lumi = importlib.util.module_from_spec(spec)",
        "spec.loader.exec_module(lumi)",
        "from PIL import Image",
    ):
        head = head.replace(line + "\n", "")
    ns: dict = {"__file__": str(ROOT / "tools" / "gen_scene_icons.py")}
    try:
        exec(compile(head, "gen_scene_icons.py", "exec"), ns)  # noqa: S102
        return ns["GAMES"], ns["STYLE_ICON"]
    except Exception:  # noqa: BLE001
        sys.path.insert(0, str(ROOT / "tools"))
        from art_spec import DEFAULT_ART  # noqa: PLC0415

        return {}, DEFAULT_ART["icon"]


sys.path.insert(0, str(ROOT / "tools"))
from art_spec import DEFAULT_ART  # noqa: E402

TB = load_tables()
ICON_GAMES, STYLE_ICON = load_icon_prompts()

ART = {
    "portrait": TB.get("STYLE_PORTRAIT", DEFAULT_ART["portrait"]),
    "scene": TB.get("STYLE_SCENE", DEFAULT_ART["scene"]),
    "item": TB.get("STYLE_ITEM", DEFAULT_ART["item"]),
    "concept": TB.get("STYLE_CONCEPT", DEFAULT_ART["concept"]),
    "cg": TB.get("STYLE_CG", DEFAULT_ART["cg"]),
    "icon": STYLE_ICON,
}
ALL_STYLES = list(ART.values())


def strip_style(text: str) -> str:
    """剥掉结尾的画风后缀（生图时按用途重新拼接，库里只存原文）。"""
    t = text.strip()
    for s in ALL_STYLES:
        if t.endswith(s):
            return t[: -len(s)].rstrip().rstrip(",").rstrip()
    return t


def migrate(game: str) -> None:
    root = ROOT / "workspace" / GAMES[game]
    data_file = root / "final_game.json"
    g = json.loads(data_file.read_text(encoding="utf-8"))
    px = PREFIX[game]
    suffix = game.upper()
    manifest = TB.get(f"MANIFEST_{suffix}", {})
    cg_table = TB.get(f"CG_{suffix}", {})
    char_look = TB.get(f"CHAR_LOOK_{suffix}", {})

    g["meta"].setdefault("status", "wip")
    g["meta"].setdefault("art", dict(ART))

    missing = {"avatar": [], "image": [], "cg": [], "special": []}

    # ---- 词条：定妆照 / 头像 prompt / 词条图 prompt ----
    # 一律 setdefault：重跑不覆盖后来在 DEBUG 编辑器里手写/改过的 prompt
    for eid, e in g["entries"].items():
        if eid in char_look:
            e.setdefault("look", char_look[eid])
        av_key = f"{px}/avatars/{eid}.jpg"
        if av_key in manifest:
            e.setdefault("avatarPrompt", strip_style(manifest[av_key][0]))
        elif eid in char_look:
            # MANIFEST 里没有条目但有定妆照：定妆照本身就是合格的头像 prompt
            e.setdefault("avatarPrompt", char_look[eid])
        if not e.get("avatarPrompt") and e.get("avatar"):
            missing["avatar"].append(f"{eid}（{e['name']}）→ {e['avatar']}")
        img_key = f"{px}/images/{eid}.jpg"
        if img_key in manifest:
            e.setdefault("imagePrompt", strip_style(manifest[img_key][0]))
        if not e.get("imagePrompt") and e.get("image"):
            missing["image"].append(f"{eid}（{e['name']}）→ {e['image']}")

    # ---- 特殊图 ----
    assets = g["assets"]
    for key, field in (("title", "titleImagePrompt"), ("ending", "endingImagePrompt")):
        mk = f"{px}/images/{key}.jpg"
        if mk in manifest:
            assets.setdefault(field, strip_style(manifest[mk][0]))
        if not assets.get(field):
            missing["special"].append(f"{field} → {mk}")
    if game in ICON_GAMES:
        assets.setdefault("sceneIconPrompt", strip_style(ICON_GAMES[game][2]))

    # ---- 情节卡 CG ----
    # 补充源：CG_* 缺失时回落到各作 DEBUG 下的增量 manifest
    extra_by_cid: dict = {}
    xdd_extra = root / "DEBUG" / "new_cg_manifest.json"
    if xdd_extra.exists():
        for cid, v in json.loads(xdd_extra.read_text(encoding="utf-8")).items():
            extra_by_cid[cid] = (v.get("prompt", ""), v.get("chars", []))

    for c in g["cards"]:
        cid = c["id"]
        src = cg_table.get(cid) or extra_by_cid.get(cid)
        if src and not c.get("cgPrompt"):
            scene, chars = src
            c["cgPrompt"] = strip_style(scene)
            c["cgChars"] = list(chars)
        if not c.get("cgPrompt") and c.get("cg"):
            missing["cg"].append(f"{cid}《{c['title']}》→ {c['cg']}")

    # ---- 写回（保持原缩进风格）----
    old = data_file.read_text(encoding="utf-8")
    indent = 1
    for line in old.split("\n"):
        stripped = line.lstrip(" ")
        if stripped.startswith('"') and line != stripped:
            indent = len(line) - len(stripped)
            break
    data_file.write_text(
        json.dumps(g, ensure_ascii=False, indent=indent) + ("\n" if old.endswith("\n") else ""),
        encoding="utf-8",
    )

    total_missing = sum(len(v) for v in missing.values())
    print(f"[{game}] 已迁移 → {data_file.relative_to(ROOT)}；缺 prompt {total_missing} 项")
    report = root / "DEBUG" / "art_prompts_missing.md"
    report.parent.mkdir(parents=True, exist_ok=True)
    if total_missing == 0:
        if report.exists():
            report.unlink()
        return
    lines = [
        f"# {game} · 缺失生图 prompt 清单",
        "",
        "这些图片文件存在，但历史 prompt 已不可考。请在游戏内 DEBUG 编辑器里补写",
        "（词条编辑器 / 情节卡编辑器 / Meta 编辑器的 prompt 栏），补写后即可一键 AI 重绘。",
        "",
    ]
    for kind, label in (("avatar", "人物头像"), ("image", "词条图"), ("cg", "情节卡 CG"), ("special", "特殊图")):
        if missing[kind]:
            lines.append(f"## {label}（{len(missing[kind])}）")
            lines.append("")
            lines += [f"- {x}" for x in missing[kind]]
            lines.append("")
    report.write_text("\n".join(lines), encoding="utf-8")
    print(f"       缺口清单 → {report.relative_to(ROOT)}")


def main() -> int:
    arg = sys.argv[1] if len(sys.argv) > 1 else "all"
    targets = list(GAMES) if arg == "all" else [arg]
    for t in targets:
        if t not in GAMES:
            print(f"未知游戏 \"{t}\"，可选：{' | '.join(GAMES)} | all")
            return 1
    for t in targets:
        migrate(t)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
