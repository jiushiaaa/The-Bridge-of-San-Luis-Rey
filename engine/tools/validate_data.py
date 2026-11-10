#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
validate_data.py — workspace/{作品}/final_game.json 全量质检
用法: python tools/validate_data.py [xdd|bad|murder|weicheng] [--strict-assets] [--author|--director]
      （默认 xdd）

字数红线（cardSpec.avg / S-M-L tier）只跑简体真源 final_game.json；
i18n/{de,en,ja,zh-TW}/ 语言包用 tools/i18n_check.py，不套汉字字数规格。

两档严重度（README_game §9「使用者与时机」）：
  完整性错误 —— 引用不存在、坐标冲突、通不了关……**任何模式都拦**；
  设计规范   —— 字数档、分层规格、留白分布、故事框措辞……
                 meta.status = "wip"（使用者是 AI，缺省）时强制；
                 meta.status = "final"（使用者是内容总监）时降级为「建议」，退出码仍为 0。
  --author 强制严格（CI 恒用），--director 强制宽松。

检查项：
1. Schema：必填字段、类型、引用存在、时间轴坐标唯一且越界、每卡≥1词条标签、
   空位答案类型匹配、档案 blank 答案存在且类型匹配 pool。
1b. 关卡数一致性（关卡数一律从数据推导，不写死）：编号从 1 连续到最大关，
   每关都有时间轴 / 情节卡 / 闸门 / 过场（前端 maxLevel 取自 gates.after，末关漏闸门会少一关）。
2. 时间轴内容量：每行≥2 卡、情节列每行恰 1 张、每个角色列≥2 卡、角色列填充 >40%。
3. 字数量化（meta.cardSpec.avg 存在时）：每卡 len 必填 S/M/L，
   S ∈ [58%,75%]X、M ∈ [85%,115%]X、L ∈ [120%,150%]X、全卡平均 ∈ [92%,108%]X。
4. 分段完整性：dialogue/monologue 的 slot 必须在该卡 blanks 中；speakerEntry 存在；
   speaker（纯配角文本名）非空且不得与人物表角色重名（重名应改用 speakerEntry）。
5. 匿名铁律：空位答案的真名（标签或裸文本）不得出现在本卡正文（白名单除外）。
   —— 「困难卡不许出现人名」这件事就是由本条覆盖的：受限的只有**本卡待猜**的人，
   不在待猜之列的第三方照常可以做 chip。
5b. 对话呈现：同卡同一人物 chip ≤1 次；speakerEntry 发言人必须在本卡有可收集 chip。
6. 熟悉度可达性（分关）：有档案页的词条，在该页所在关须有熟悉度来源（上限 = 该关标签卡数+答案卡数）。
7. 空位答案可收集：每个答案词条须在某卡正文中作为标签出现，或在关卡开局赠送。
8. 自动通关模拟（新搜寻规则：每次搜寻只解锁 1 张卡、按优先级选卡）：证明全部关卡可通关、
   全程体力不为负、闸门候选池可达（进度 = 归位×25 + 档案×10，≥70% 开闸）、档案留白答案均可收集。
9. 资产存在性：人物头像 / 档案图 / 特殊图（默认警告，--strict-assets 转错误）。
10. 重要度分层 tier（写了该字段的词条强制）：desc 字数、档案页数、每页字段数、
   每页留白数、字段正文字数下限（README_game §4.2）。
11. 档案留白答案分布：单答案 ≤12% 且 ≤5 次、同页不重答案、同词条跨页 label 不重复、
   全作去重率 ≥60%（README_game §4.3）。
12. 一事一卡：任意两卡正文 ≥20 字连续重合、或同一条 ≥12 字台词出现在两卡（README_game §4.1）。
13. 人物弧光断线（警告）：某人物第 N 关与第 N+2 关有来源、第 N+1 关断线（README_game §4.1）。
14. 故事框只讲故事：过场/结局旁白不得含玩家称呼、全 frame 不得含玩法词汇、发言人不得是框架
   叙述者、subtitle/credit 不挂身份词、结局 ≥8 段（README_game §4.7）。
14b. 过场规格：每卷恒 5 段（首段 ≤16 字卷名段 + 4 段正文）；正文每段 60~130 字（警告）；
   第 1 卷正文 ≥2 个「？」（全作之问 + 本卷之问，警告）；末段含「？」（警告，见 check_hook）。
   第一人称、视点、钩子前置、先出场再提问、留白、图文对位等写法项不可机械校验，靠复查（README_game §6）。
15. 回顾本关故事（写了 recaps 才查）：页数 = int(行数×0.5+0.5) 且 < 行数、各页 rows 为连续区间
   且恰好铺满全关、每页字数为覆盖卡总字数的 10~20%、引用的卡与词条存在（README_game §4.9）。
16. 背景音乐（写了 assets.bgm 才查，doc/14-bgm-pipeline.md）：id/file 唯一、stage 合法、unlockCard 所在关 == stage、
   每关恰 1 首开篇曲；规范：每关曲数 ≥ max(round(字数/1500), 2)、每曲有 prompt；警告：缺封面/结局曲、同 row 绑多首。
"""
import itertools
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Windows 控制台默认 gbk，报告里的中文与 ✔ 会触发 UnicodeEncodeError 让成功也退非零码
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")
GAMES = {"xdd": "xidaduo", "bad": "badblood", "murder": "murder", "weicheng": "WeiCheng_QianZhongShu"}
_args = [a for a in sys.argv[1:] if not a.startswith("--")]
GAME = _args[0] if _args else "xdd"
if GAME not in GAMES:
    sys.exit(f"未知游戏 {GAME}，可选：{' | '.join(GAMES)}")
DATA = ROOT / "workspace" / GAMES[GAME] / "final_game.json"
ASSET_ROOT = ROOT / "workspace" / GAMES[GAME]

TAG_RE = re.compile(r"\{\{([^|}]+)\|([^}]*)\}\}")


def blank_answers(b: dict) -> list:
    """空位的全部正确词条（数组答案展开）。"""
    return b["answer"] if isinstance(b["answer"], list) else [b["answer"]]

# 匿名铁律白名单（按游戏分开登记）：(卡id, 词条id) 允许真名在本卡正文出现
LEAK_OK_BY_GAME = {
    "xdd": set(),
    "bad": set(),
    "murder": set(),
    "weicheng": set(),
}
LEAK_OK = LEAK_OK_BY_GAME[GAME]

# 词条重要度分层规格（README_game §4.2）；仅对写了 tier 的词条生效，老作品可缺省
TIER_VALUES = ("core", "major", "minor")
TIER_SPEC = {
    "core": {"desc": (30, 60), "pages": (2, 4), "fields": (5, 6), "blanks": 2, "long_field": 25},
    "major": {"desc": (20, 40), "pages": (1, 2), "fields": (4, 5), "blanks": 1, "avg_field": 14},
    "minor": {"desc": (12, 30), "pages": (0, 1), "fields": (3, 4), "blanks": 0},
}
FIELD_TEXT_MIN = 8       # 任何档案字段正文字数下限（禁止「职位：CFO」式标签）
BLANK_SHARE_MAX = 0.12   # 单词条被引用为档案留白答案的占比上限
BLANK_COUNT_MAX = 5      # 单词条被引用为档案留白答案的绝对次数上限
BLANK_UNIQUE_MIN = 0.60  # 全作档案留白答案去重率下限
DUP_RUN_MIN = 20         # 两卡正文重合片段字数（>= 此值即报）
DUP_QUOTE_MIN = 12       # 同一条台词在两卡重复的字数下限

# 过场/结局只讲故事（README_game §4.7）
FRAME_INTRO_SEGS = 5     # 每卷过场恒 5 段：1 段卷名 + 4 段正文（多一页就多让玩家点一下）
FRAME_INTRO_MIN = FRAME_INTRO_SEGS
FRAME_TITLE_MAX = 16     # 卷名段「第N卷 · 名字」的字数上限（与前端 data.ts 的 CHAPTER_TITLE_MAX 一致）
FRAME_SEG_MIN = 60       # 过场正文每段字数区间（警告级）：一屏一段，目标 100 字左右
FRAME_SEG_MAX = 130
FRAME_LV1_QUESTIONS = 2  # 第 1 卷正文至少两个「？」：全作之问 + 本卷之问（警告级）
FRAME_ENDING_MIN = 8     # 结局最少段数
SECOND_PERSON = ("你", "您", "玩家")          # 旁白里的玩家称呼
FRAME_BANNED_WORDS = (                       # 故事框里不得出现的玩法词汇
    "残页", "页序", "拼回", "拼齐", "归位", "词条", "时间轴", "完形填空",
    "活计", "关卡", "存档", "补回名字", "本关",
)
FRAME_BANNED_SPEAKERS = (                    # 派活式框架叙述者 / 玩家身份
    "拾遗", "修复员", "老编辑", "老馆员", "老商人", "守屋", "整理残卷",
)

# 老作品豁免：曾把「一事一卡」「档案留白答案分布」在部分作品降级为警告。
# 历史欠账已清完，各作一律按硬性规范执行；新作品同样不得再加豁免。
LEGACY_EXEMPT: dict = {
    "xdd": set(),
    "bad": set(),
    "murder": set(),
}

errors: list = []      # 完整性错误：数据自身坏了（引用不存在、坐标冲突、缺字段），任何模式都拦
spec_errors: list = []  # 规范建议：字数/分层/分布/措辞等设计红线，内容总监模式下只提示
warnings: list = []

_spec_mode = False  # 由 run_spec() 打开：其间 err() 记入 spec_errors


def err(msg: str) -> None:
    """报一个问题。整篇「设计规范类」检查由 run_spec 包住，其余一律算完整性错误。

    完整性错误 = 违反了它数据就是坏的（引用不存在、坐标冲突、通不了关），任何模式都拦；
    规范错误 = README_game 的量化红线（字数、分层、分布、措辞），内容总监模式下降级为建议。
    见 README_game §9「使用者与时机」。
    """
    (spec_errors if _spec_mode else errors).append(msg)


def spec_err(msg: str) -> None:
    """在完整性检查内部单独标记一条规范类问题。"""
    spec_errors.append(msg)


def run_spec(fn, g: dict) -> None:
    """以「设计规范」严重度运行整个检查函数。"""
    global _spec_mode
    _spec_mode = True
    try:
        fn(g)
    finally:
        _spec_mode = False


def report(kind: str, msg: str) -> None:
    """按作品豁免表决定报错还是降级为警告（规范类）。"""
    if kind in LEGACY_EXEMPT.get(GAME, set()):
        warnings.append(f"[legacy 豁免 {kind}] {msg}")
    else:
        spec_errors.append(msg)


def card_full_text(card: dict) -> str:
    return "\n".join(s["text"] for s in card["segments"])


def card_tag_ids(card: dict) -> set:
    ids = set()
    for s in card["segments"]:
        ids.update(m.group(1) for m in TAG_RE.finditer(s["text"]))
    return ids


def game_levels(g: dict) -> list:
    """作品的关卡集合，**一律从数据推导、不得写死关卡数**（三关与更多关共用同一套检查）。
    真源 = timelines 的键，并入 cards.level 与 gates.after 兜底（缺项由 check_levels 单独报错）。"""
    lv = {int(k) for k in g.get("timelines", {})}
    lv |= {int(c["level"]) for c in g.get("cards", [])}
    lv |= {int(x["after"]) for x in g.get("gates", [])}
    return sorted(lv)


def max_level_of(g: dict) -> int:
    return max(game_levels(g), default=1)


def _allowed_page_levels(g: dict) -> set:
    """档案页合法关卡集合：1 到最大关卡（按 game_levels 推导，无固定值）。"""
    return set(range(1, max_level_of(g) + 1))


def check_schema(g: dict) -> None:
    meta = g["meta"]
    for k in ("id", "title", "subtitle", "version", "stamina"):
        if k not in meta:
            err(f"meta 缺字段 {k}")
    for k in ("start", "perLevel", "searchCost", "completeReward", "restGain"):
        if k not in meta["stamina"]:
            err(f"meta.stamina 缺字段 {k}")
    if "starCaps" in meta:
        # 评星规则已固定在引擎里（简单满 3 / 困难满 5，每 3 次错误或休整扣一星），不再按关配置
        spec_err("meta.starCaps 已废弃（评星规则固定在引擎），请删除该字段")

    entries = g["entries"]
    for eid, e in entries.items():
        if e["type"] not in ("person", "place", "item", "concept"):
            err(f"词条 {eid} 类型非法: {e['type']}")
        if e["type"] == "person" and "avatar" not in e:
            err(f"人物词条 {eid} 缺 avatar")
        for vname, v in (e.get("variants") or {}).items():
            if not isinstance(v, dict) or not (v.get("look") or v.get("avatarPrompt")):
                err(f"词条 {eid} 形象变体 {vname} 缺 look/avatarPrompt")
        for page in e.get("archive", []):
            if page["level"] not in _allowed_page_levels(g):
                err(f"{eid} 档案页 level 非法: {page['level']}")
            for f in page["fields"]:
                has_text, has_blank = "text" in f, "blank" in f
                if has_text == has_blank:
                    err(f"{eid} 档案页[{page['title']}] 字段须 text/blank 二选一: {f}")
                if has_blank:
                    ans = f["blank"]["answer"]
                    if ans not in entries:
                        err(f"{eid} 档案 blank 答案不存在: {ans}")
                    elif entries[ans]["type"] != f["blank"]["pool"]:
                        err(f"{eid} 档案 blank 答案 {ans} 类型与 pool 不符")

    seen_cells = set()
    for c in g["cards"]:
        cid = c["id"]
        tl = g["timelines"].get(str(c["level"]))
        if tl is None:
            err(f"{cid} 关卡 {c['level']} 无时间轴")
            continue
        if c["col"] not in tl["cols"]:
            err(f"{cid} 列名 {c['col']} 不在本关 cols 中")
        if not (0 <= c["row"] < len(tl["rows"])):
            err(f"{cid} 行号越界: {c['row']}")
        cell = (c["level"], c["row"], c["col"])
        if cell in seen_cells:
            err(f"时间轴格子重复占用: {cell}")
        seen_cells.add(cell)
        if c["form"] not in ("scene", "dialogue", "monologue"):
            err(f"{cid} form 非法: {c['form']}")
        tags = card_tag_ids(c)
        if not tags:
            err(f"{cid} 正文无任何词条标签（永远无法被搜寻解锁）")
        for t in tags:
            if t not in entries:
                err(f"{cid} 正文标签指向不存在的词条: {t}")
        slots = {b["slot"] for b in c["blanks"]}
        for b in c["blanks"]:
            for ans in blank_answers(b):
                if ans not in entries:
                    err(f"{cid} 空位答案不存在: {ans}")
                elif entries[ans]["type"] != b["kind"]:
                    err(f"{cid} 空位 {b['slot']} 答案类型与 kind 不符")
        # 生图形象变体引用：cgCharVariants 的键须 ⊆ cgChars，变体名须存在于该词条 variants
        for ch, vname in (c.get("cgCharVariants") or {}).items():
            if ch not in (c.get("cgChars") or []):
                err(f"{cid} cgCharVariants[{ch}] 不在本卡 cgChars 中")
            elif vname not in (entries.get(ch, {}).get("variants") or {}):
                err(f"{cid} cgCharVariants[{ch}] 引用了词条 {ch} 不存在的变体: {vname}")
        # 难度一致性（设计规范，非完整性）：easy 不得有地点空；hard 的登场人物必须全匿名。
        # hard **不禁止**正文出现人名标签——只是本卡待猜的那些人不能露名，而那一条由匿名铁律
        # （check_anonymity）统管，与难度无关。被顺带提及的第三方（「XX 的公司」）照常可以做 chip，
        # 否则困难卡连交代背景都做不到。见 README_game §4.1。
        diff = c.get("difficulty", "normal")
        has_place = any(b["kind"] == "place" for b in c["blanks"])
        if diff == "easy" and has_place:
            spec_err(f"{cid} 标为 easy 但仍有地点空")
        if diff != "easy" and not has_place:
            spec_err(f"{cid} 未标 easy 但无地点空")
        if diff == "hard":
            if any("speakerEntry" in s for s in c["segments"]):
                spec_err(f"{cid} 标为 hard 但仍含 speakerEntry（登场人物须全部匿名待填）")
        if "hints" in c:
            spec_err(f"{cid} 仍带 hints 字段（情节卡提示文案已废弃，请删除）")
        # 分段完整性
        person_names = {e["name"] for e in entries.values() if e["type"] == "person"}
        for s in c["segments"]:
            if s["kind"] in ("dialogue", "monologue"):
                if "slot" in s and s["slot"] not in slots:
                    err(f"{cid} 段发言人 {s['slot']} 不在空位中")
                if "speakerEntry" in s and s["speakerEntry"] not in entries:
                    err(f"{cid} 段 speakerEntry 不存在: {s['speakerEntry']}")
                if "speaker" in s:
                    sp = s["speaker"]
                    if not isinstance(sp, str) or not sp.strip():
                        err(f"{cid} 段 speaker 为空")
                    elif sp in person_names:
                        err(f"{cid} 段 speaker「{sp}」是人物表角色，应改用 speakerEntry 气泡")
                if not any(k in s for k in ("slot", "speakerEntry", "speaker")):
                    err(f"{cid} {s['kind']} 段缺发言人（slot/speakerEntry/speaker）")
            elif s["kind"] != "narration":
                err(f"{cid} 未知段类型: {s['kind']}")

    for lv, eids in g["levelStartEntries"].items():
        for eid in eids:
            if eid not in entries:
                err(f"levelStartEntries[{lv}] 引用不存在: {eid}")

    for gate in g["gates"]:
        for b in gate["blanks"]:
            if "answerEntry" in b and b["answerEntry"] not in entries:
                err(f"闸门[{gate['title']}] 答案词条不存在: {b['answerEntry']}")
            if "answerTitle" in b and not any(c["id"] == b["answerTitle"] for c in g["cards"]):
                err(f"闸门[{gate['title']}] 答案卡不存在: {b['answerTitle']}")

    check_bgm(g)

    # 时间轴列名应能映射到词条（名场面除外）
    name2id = {e["name"]: eid for eid, e in entries.items()}
    for lv, tl in g["timelines"].items():
        for col in tl["cols"]:
            if col != "名场面" and col not in name2id:
                warnings.append(f"第{lv}关时间轴列「{col}」无法映射到词条（列头将无头像）")


BGM_CHARS_PER_TRACK = 1500  # 每关曲数 = max(round(本关情节卡总字数 / 1500), 2)，含开篇曲（与 tools/bgm_plan.py 同）
BGM_MIN_PER_LEVEL = 2


def check_bgm(g: dict) -> None:
    """背景音乐（doc/14-bgm-pipeline.md）：assets.bgm 为空则整段跳过（BGM 可选）。
    完整性：id 唯一、file 唯一、stage 合法、unlockCard 存在且所在关 == stage、每关恰 1 首开篇曲（stage=lv 且无 unlockCard）。
    规范（spec）：每关曲数 ≥ 公式值、每曲有 prompt（生成真源，DEBUG 复制用）。
    警告：缺封面曲 / 结局曲、同关两首卡曲绑同一 row（分布不均）。"""
    bgm = g["assets"].get("bgm") or []
    if not bgm:
        return
    cards = {c["id"]: c for c in g["cards"]}
    levels = game_levels(g)
    seen_id: set = set()
    seen_file: set = set()
    for t in bgm:
        tid = t.get("id")
        if not tid or tid in seen_id:
            err(f"BGM id 缺失或重复: {tid}")
        seen_id.add(tid)
        f = t.get("file")
        if not f or f in seen_file:
            err(f"BGM {tid} file 缺失或重复: {f}")
        seen_file.add(f)
        if not t.get("title"):
            err(f"BGM {tid} 缺 title")
        st = t.get("stage")
        if not (st in ("title", "ending") or (isinstance(st, int) and st in levels)):
            err(f"BGM {tid} stage 非法: {st!r}（title / ending / 关卡号）")
        uc = t.get("unlockCard")
        if uc:
            c = cards.get(uc)
            if not c:
                err(f"BGM {tid} unlockCard 不存在: {uc}")
            elif c["level"] != st:
                err(f"BGM {tid} 绑定的卡 {uc} 属第{c['level']}关，但 stage={st}")
        if not (t.get("prompt") or "").strip():
            spec_err(f"BGM {tid} 缺 prompt（生成真源；DEBUG「背景音乐」里可复制）")
    if not any(t.get("stage") == "title" for t in bgm):
        warnings.append("BGM 缺封面曲（stage=title）")
    if not any(t.get("stage") == "ending" for t in bgm):
        warnings.append("BGM 缺结局曲（stage=ending）")
    for lv in levels:
        tracks = [t for t in bgm if t.get("stage") == lv]
        intro = [t for t in tracks if not t.get("unlockCard")]
        if len(intro) != 1:
            err(f"第{lv}关 BGM 开篇曲（stage={lv} 且无 unlockCard）须恰 1 首，现有 {len(intro)}")
        chars = sum(card_text_len(c) for c in g["cards"] if c["level"] == lv)
        need = max(round(chars / BGM_CHARS_PER_TRACK), BGM_MIN_PER_LEVEL)
        if len(tracks) < need:
            spec_err(f"第{lv}关 BGM 仅 {len(tracks)} 首，正文 {chars} 字应有 ≥{need} 首（max(round(字数/{BGM_CHARS_PER_TRACK}), {BGM_MIN_PER_LEVEL})，含开篇曲）")
        rows = Counter(cards[t["unlockCard"]]["row"] for t in tracks if t.get("unlockCard") in cards)
        for r, n in rows.items():
            if n > 1:
                warnings.append(f"第{lv}关 BGM 有 {n} 首卡曲同绑时间轴第{r}行（应按行铺开）")


def check_levels(g: dict) -> None:
    """关卡数一致性：关卡编号须从 1 连续到最大关，且每关都要有时间轴、情节卡、闸门、过场。
    尤其是闸门——**前端 maxLevel 取自 gates.after**（data.ts），校验器与通关 bot 取自 timelines，
    两处不一致会静默错位（末关漏写闸门时前端会少一关、档案页 level 被误判非法）。"""
    levels = game_levels(g)
    if not levels:
        err("数据里找不到任何关卡（timelines / cards / gates 全空）")
        return
    mx = levels[-1]
    if levels != list(range(1, mx + 1)):
        err(f"关卡编号不连续: {levels}（须从 1 连续到 {mx}）")
    lv_tl = {int(k) for k in g.get("timelines", {})}
    lv_card = {int(c["level"]) for c in g.get("cards", [])}
    lv_gate = {int(x["after"]) for x in g.get("gates", [])}
    intros = g.get("frame", {}).get("levelIntro", {})
    for lv in range(1, mx + 1):
        if lv not in lv_tl:
            err(f"第{lv}关缺 timelines[\"{lv}\"]")
        if lv not in lv_card:
            err(f"第{lv}关没有任何情节卡")
        if lv not in lv_gate:
            err(f"第{lv}关缺闸门（gates 无 after={lv}；前端 maxLevel 取自 gates，末关漏写会少一关）")
        if str(lv) not in intros:
            err(f"第{lv}关缺过场 frame.levelIntro[\"{lv}\"]")
        if str(lv) not in g.get("levelStartEntries", {}):
            warnings.append(f"第{lv}关缺 levelStartEntries[\"{lv}\"]（无起始赠送词条时建议显式写空数组）")


def check_timeline_density(g: dict) -> None:
    """时间轴内容量强制规则：
    ①每行卡片数 >= 2；②情节列（cols[0]）每行恰 1 张；③每个角色列卡片数 >= 2；
    ④角色列已填格子总数 > 角色列格子总数 × 40%（严格大于）。"""
    for lv, tl in g["timelines"].items():
        cards = [c for c in g["cards"] if c["level"] == int(lv)]
        rows_n = len(tl["rows"])
        pcols = [c for c in tl["cols"] if c != "名场面"]
        scene_col = tl["cols"][0]
        for r in range(rows_n):
            n = sum(1 for c in cards if c["row"] == r)
            if n < 2:
                err(f"第{lv}关时间轴第{r}行「{tl['rows'][r]}」仅 {n} 张卡（须 >=2）")
            n_scene = sum(1 for c in cards if c["row"] == r and c["col"] == scene_col)
            if n_scene != 1:
                err(f"第{lv}关时间轴第{r}行情节列卡片数为 {n_scene}（须恰为 1）")
        for col in pcols:
            n = sum(1 for c in cards if c["col"] == col)
            if n < 2:
                err(f"第{lv}关时间轴角色列「{col}」仅 {n} 张卡（须 >=2）")
        filled = sum(1 for c in cards if c["col"] in pcols)
        total = rows_n * len(pcols)
        if total > 0 and filled * 100 <= total * 40:
            err(f"第{lv}关时间轴角色列填充 {filled}/{total} = {filled * 100 // total}%（须 >40%）")


TAG_STRIP_RE = re.compile(r"\{\{e_[a-z0-9_]+\|([^}]*)\}\}")


def card_text_len(card: dict) -> int:
    """卡面正文字数（词条标签按显示名计，[[NPCn]] 按字面计）。"""
    return sum(len(TAG_STRIP_RE.sub(lambda m: m.group(1), s["text"])) for s in card["segments"])


def check_length_spec(g: dict) -> None:
    """字数量化（meta.cardSpec.avg = X 存在时强制）：
    每卡必填 len（S/M/L）；S ∈ [58%,75%]X；M ∈ [85%,115%]X；L ∈ [120%,150%]X；
    全卡平均 ∈ [92%,108%]X。"""
    spec = g["meta"].get("cardSpec")
    if not spec:
        return
    x = spec["avg"]
    bands = {"S": (0.58, 0.75), "M": (0.85, 1.15), "L": (1.20, 1.50)}
    lens = []
    for c in g["cards"]:
        n = card_text_len(c)
        lens.append(n)
        lv = c.get("len")
        if lv not in bands:
            err(f"{c['id']} 缺 len 字段或非法（meta.cardSpec 存在时必填 S/M/L）")
            continue
        lo, hi = bands[lv]
        if not (lo * x <= n <= hi * x):
            err(f"{c['id']} len={lv} 但正文 {n} 字，超出 [{int(lo * x)},{int(hi * x)}] 区间")
    if lens:
        avg = sum(lens) / len(lens)
        if not (0.92 * x <= avg <= 1.08 * x):
            err(f"全卡平均字数 {avg:.0f}，不在 [{int(0.92 * x)},{int(1.08 * x)}] 区间（X={x}）")


def check_dialogue_rules(g: dict) -> None:
    """对话呈现三规则：
    ②同卡同一人物词条 chip 至多出现一次（应配置在该人物首次登场处）；
    ③有 speakerEntry 气泡发言的非匿名人物，必须在本卡正文中有可收集 chip。"""
    for c in g["cards"]:
        cnt = Counter()
        for s in c["segments"]:
            for m in TAG_RE.finditer(s["text"]):
                if g["entries"][m.group(1)]["type"] == "person":
                    cnt[m.group(1)] += 1
        for eid, n in cnt.items():
            if n > 1:
                err(f"{c['id']} 人物词条 {eid} 在同卡出现 {n} 次（至多 1 次，置于首次登场处）")
        tags = card_tag_ids(c)
        for s in c["segments"]:
            se = s.get("speakerEntry")
            if se and g["entries"][se]["type"] == "person" and se not in tags:
                err(f"{c['id']} 发言人 {se} 有气泡对话但卡内无可收集 chip")


def check_entry_tier(g: dict) -> None:
    """重要度分层规格（README_game §4.2）：core/major/minor 各自的 desc 字数、档案页数、
    每页字段数、每页留白数、字段正文字数；未写 tier 的词条跳过（老作品兼容）。"""
    for eid, e in g["entries"].items():
        tier = e.get("tier")
        if tier is None:
            continue
        if tier not in TIER_VALUES:
            err(f"词条 {eid} tier 非法: {tier}（可选 {'/'.join(TIER_VALUES)}）")
            continue
        spec = TIER_SPEC[tier]
        d = len(e.get("desc", "").strip())
        lo, hi = spec["desc"]
        if not (lo <= d <= hi):
            err(f"词条 {eid}（tier={tier}）desc {d} 字，超出 [{lo},{hi}]")
        pages = e.get("archive", [])
        plo, phi = spec["pages"]
        if not (plo <= len(pages) <= phi):
            err(f"词条 {eid}（tier={tier}）档案 {len(pages)} 页，须 [{plo},{phi}] 页")
        if tier == "core" and len({p["level"] for p in pages}) < 2:
            err(f"词条 {eid}（tier=core）档案页须跨 ≥2 个关卡（复看钩子）")
        flo, fhi = spec["fields"]
        for p in pages:
            fields = p["fields"]
            if not (flo <= len(fields) <= fhi):
                err(f"词条 {eid} 档案页[{p['title']}] {len(fields)} 个字段，须 [{flo},{fhi}] 个")
            nb = sum(1 for f in fields if "blank" in f)
            if nb < spec["blanks"]:
                err(f"词条 {eid} 档案页[{p['title']}] 仅 {nb} 处留白，tier={tier} 须 ≥{spec['blanks']}")
            texts = [f["text"].strip() for f in fields if "text" in f]
            for t in texts:
                if len(t) < FIELD_TEXT_MIN:
                    err(f"词条 {eid} 档案页[{p['title']}] 字段正文过短（{len(t)}<{FIELD_TEXT_MIN}）:「{t}」")
            if texts and "long_field" in spec and max(len(t) for t in texts) < spec["long_field"]:
                err(f"词条 {eid} 档案页[{p['title']}] 缺 ≥{spec['long_field']} 字的细节/金句型字段（tier=core 要求）")
            if texts and "avg_field" in spec:
                avg = sum(len(t) for t in texts) / len(texts)
                if avg < spec["avg_field"]:
                    err(f"词条 {eid} 档案页[{p['title']}] 字段正文平均 {avg:.0f} 字，tier={tier} 须 ≥{spec['avg_field']}")


def check_archive_blank_distribution(g: dict) -> None:
    """档案留白答案分布（README_game §4.3）：单答案 ≤12% 且 ≤5 次；同页留白不得同答案；
    同词条跨页 label 不重复；全作去重率 ≥60%。防「所有问题都在问主角」。"""
    cnt = Counter()
    total = 0
    for eid, e in g["entries"].items():
        labels = Counter()
        for p in e.get("archive", []):
            page_answers = []
            for f in p["fields"]:
                if "blank" not in f:
                    continue
                total += 1
                cnt[f["blank"]["answer"]] += 1
                page_answers.append(f["blank"]["answer"])
                labels[f["label"]] += 1
            dup = [a for a, n in Counter(page_answers).items() if n > 1]
            if dup:
                report("blank_distribution",
                       f"词条 {eid} 档案页[{p['title']}] 同页多处留白指向同一答案: {dup}")
        for lb, n in labels.items():
            if n > 1:
                report("blank_distribution", f"词条 {eid} 档案留白 label「{lb}」在多页重复（{n} 次）")
    if not total:
        return
    cap = min(BLANK_COUNT_MAX, max(1, int(total * BLANK_SHARE_MAX)))
    for a, n in cnt.most_common():
        if n > cap:
            report("blank_distribution",
                   f"档案留白答案过度集中: {a} 被引用 {n} 次（全作 {total} 处，上限 {cap}）")
    uniq = len(cnt)
    if uniq < total * BLANK_UNIQUE_MIN:
        report("blank_distribution",
               f"档案留白答案去重率 {uniq}/{total} = {uniq * 100 // total}%（须 ≥{int(BLANK_UNIQUE_MIN * 100)}%）")


_PUNCT_RE = re.compile(r"[\s，。、；：？！…—「」『』（）()“”\"'·《》〈〉～~\-–,.;:?!]")
_NPC_RE = re.compile(r"\[\[NPC\d\]\]")


def _norm_text(text: str) -> str:
    """归一化：词条标签取显示名、去 NPC 占位符、去标点空白。"""
    t = TAG_STRIP_RE.sub(lambda m: m.group(1), text)
    t = _NPC_RE.sub("", t)
    return _PUNCT_RE.sub("", t)


def check_card_duplication(g: dict) -> None:
    """一事一卡（README_game §4.1）：任意两卡正文 ≥DUP_RUN_MIN 字连续重合，
    或同一条 ≥DUP_QUOTE_MIN 字台词出现在两张卡 → 同一件事被讲了两遍。"""
    grams: dict = {}
    for c in g["cards"]:
        t = _norm_text(card_full_text(c))
        seen = set()
        for i in range(len(t) - DUP_RUN_MIN + 1):
            gram = t[i:i + DUP_RUN_MIN]
            if gram in seen:
                continue
            seen.add(gram)
            grams.setdefault(gram, []).append(c["id"])
    reported = set()
    for gram, ids in grams.items():
        uniq = sorted(set(ids))
        if len(uniq) < 2:
            continue
        for a, b in itertools.combinations(uniq, 2):
            if (a, b) in reported:
                continue
            reported.add((a, b))
            report("card_duplication",
                   f"{a} 与 {b} 正文重合 ≥{DUP_RUN_MIN} 字（一事一卡）:「{gram}」")

    quotes: dict = {}
    for c in g["cards"]:
        for s in c["segments"]:
            if s["kind"] not in ("dialogue", "monologue"):
                continue
            q = _norm_text(s["text"])
            if len(q) >= DUP_QUOTE_MIN:
                quotes.setdefault(q, set()).add(c["id"])
    for q, ids in quotes.items():
        if len(ids) > 1:
            pair = tuple(sorted(ids))
            if pair in reported:
                continue
            reported.add(pair)
            report("card_duplication", f"同一条台词出现在 {'/'.join(pair)}:「{q[:30]}…」")


def check_frame_story(g: dict) -> None:
    """过场与结局只讲故事（README_game §4.7）：
    ①旁白不得用第二人称（你/您/玩家）——旁白是故事的叙述者，不是对玩家说话的人；
    ②全部 frame 文本不得出现玩法词汇（残页/页序/拼回/归位/词条/时间轴/完形填空/活计…）；
    ③发言人不得是「派活」式的框架叙述者或玩家身份；
    ④meta.subtitle 与 ending.credit 不得挂身份词；
    ⑤每卷过场恒 5 段（首段为 ≤16 字的卷名段 + 4 段正文，正文每段 60~130 字为警告级）、结局 ≥8 段。"""
    frame = g.get("frame", {})
    intros = frame.get("levelIntro", {})
    ending = frame.get("ending", {})

    def scan(where: str, seg: dict) -> None:
        t = seg.get("text", "")
        if seg.get("kind") == "narration":
            hit = [w for w in SECOND_PERSON if w in t]
            if hit:
                report("frame_story",
                       f"{where} 旁白出现玩家称呼 {hit}（故事框不得对玩家说话）:「{t[:24]}…」")
        hit = [w for w in FRAME_BANNED_WORDS if w in t]
        if hit:
            report("frame_story",
                   f"{where} 出现玩法词汇 {hit}（操作说明只放 UI 层）:「{t[:24]}…」")
        sp = seg.get("speaker")
        if sp and any(w in sp for w in FRAME_BANNED_SPEAKERS):
            report("frame_story", f"{where} 发言人「{sp}」是框架叙述者/玩家身份，不得出现在故事里")

    for lv, segs in intros.items():
        if len(segs) != FRAME_INTRO_SEGS:
            report("frame_story", f"第{lv}卷过场 {len(segs)} 段（规格恒 {FRAME_INTRO_SEGS} 段：1 段卷名 + 4 段正文，README_game §4.7）")
        for seg in segs:
            scan(f"第{lv}卷过场", seg)
        if not segs:
            continue
        # 首段必须是「第N卷 · 名字」式卷名（前端据此做题名幕；超长就会被当成正文排）
        head = segs[0]
        head_len = recap_len(head.get("text", ""))
        if head.get("kind") != "narration" or head_len > FRAME_TITLE_MAX:
            report("frame_story", f"第{lv}卷过场首段应为 ≤{FRAME_TITLE_MAX} 字的卷名段（「第N卷 · 名字」）:「{head.get('text', '')[:24]}…」")
        # 正文每段一屏，字数落在区间内（警告级）
        for i, seg in enumerate(segs[1:], 2):
            n = recap_len(seg.get("text", ""))
            if n < FRAME_SEG_MIN or n > FRAME_SEG_MAX:
                warnings.append(f"第{lv}卷过场第{i}段 {n} 字（正文每段建议 {FRAME_SEG_MIN}~{FRAME_SEG_MAX} 字，README_game §4.7）:「{seg.get('text', '')[:20]}…」")
        # 第 1 卷要立两个问题：全作之问 + 本卷之问（警告级）
        if str(lv) == "1":
            marks = sum(seg.get("text", "").count("？") + seg.get("text", "").count("?") for seg in segs[1:])
            if marks < FRAME_LV1_QUESTIONS:
                warnings.append(f"第 1 卷过场正文只有 {marks} 个「？」（须同时抛出全作之问与本卷之问，README_game §4.7）")

    e_segs = ending.get("segments", [])
    if len(e_segs) < FRAME_ENDING_MIN:
        report("frame_story", f"结局仅 {len(e_segs)} 段（须 ≥{FRAME_ENDING_MIN}）")
    for seg in e_segs:
        scan("结局", seg)

    for label, text in (("meta.subtitle", g["meta"].get("subtitle", "")),
                        ("ending.credit", ending.get("credit", "")),
                        ("ending.title", ending.get("title", ""))):
        hit = [w for w in FRAME_BANNED_SPEAKERS if w in text]
        if hit:
            report("frame_story", f"{label} 含玩家身份词 {hit}:「{text}」")


QUESTION_MAX = 30           # 本卷之问 / 全作之问的字数上限
GATE_START_MIN = 3          # 每卷开局可见（revealAt=start）的题至少几道
START_UNLOCKED_LV1 = 2      # 第 1 关开局解锁的卡数


def _check_question_text(label: str, q: str) -> None:
    """问句三件事：以「？」结尾、≤30 字、不对玩家说话也不出现玩法词汇（README_game §4.5 / §4.7）。"""
    q = q.strip()
    if not q.endswith(("？", "?")):
        report("hook", f"{label} 要以「？」结尾:「{q}」")
    if len(q) > QUESTION_MAX:
        report("hook", f"{label} {len(q)} 字，规范 ≤{QUESTION_MAX} 字:「{q}」")
    hit = [w for w in SECOND_PERSON if w in q]
    if hit:
        report("hook", f"{label} 出现玩家称呼 {hit}:「{q}」")
    hit = [w for w in FRAME_BANNED_WORDS if w in q]
    if hit:
        report("hook", f"{label} 出现玩法词汇 {hit}:「{q}」")
    hit = [w for w in FRAME_BANNED_SPEAKERS if w in q]
    if hit:
        report("hook", f"{label} 含身份词 {hit}:「{q}」")


def check_hook(g: dict) -> None:
    """悬念前置（README_game §4.1 首卡规则 / §4.5 本卷之问与谜题清单 / §4.7 过场末段问句）：
    ①每卷 gates[].question 必填且合规；②meta.tagline 若有同规则；
    ③每卷 revealAt=start 的题 ≥3 道，且题面不得含本卷任何空位答案词条的名字（开局可见的题不许泄底）；
    ④每卷过场末段应含「？」（警告级）；⑤第 1 关 startUnlocked 恰 2 张（警告级）。"""
    tagline = g["meta"].get("tagline")
    if tagline:
        _check_question_text("meta.tagline（全作之问）", tagline)

    for gate in g.get("gates", []):
        lv = gate.get("after")
        q = (gate.get("question") or "").strip()
        if not q:
            report("hook", f"第{lv}关闸门缺「本卷之问」question（一句问句说清这一卷要弄清楚的事）")
        else:
            _check_question_text(f"第{lv}关 question", q)

        # 本关全部空位答案的显示名：开局可见的题面里不许出现
        names = set()
        for c in g["cards"]:
            if c.get("level") != lv:
                continue
            for b in c.get("blanks", []):
                for a in blank_answers(b):
                    nm = g["entries"].get(a, {}).get("name")
                    if nm:
                        names.add(nm)
        start_n = 0
        for i, b in enumerate(gate.get("blanks", []), 1):
            if b.get("revealAt", "gate") not in ("start", "gate"):
                err(f"第{lv}关第{i}题 revealAt 只能是 start / gate:「{b.get('revealAt')}」")
            if b.get("revealAt") != "start":
                continue
            start_n += 1
            hit = sorted(nm for nm in names if nm in b.get("prompt", ""))
            if hit:
                report("hook", f"第{lv}关第{i}题开局可见，题面却写出了本关待猜的 {hit}（改写或改为 gate）:"
                               f"「{b.get('prompt', '')[:30]}…」")
        if start_n < GATE_START_MIN:
            report("hook", f"第{lv}关开局可见的题只有 {start_n} 道（须 ≥{GATE_START_MIN}，其余在 70% 前显示「？？？」）")

    for lv, segs in g.get("frame", {}).get("levelIntro", {}).items():
        if not segs:
            continue
        last = segs[-1].get("text", "")
        if "？" not in last and "?" not in last:
            warnings.append(f"第{lv}卷过场末段没有落成问句（README_game §4.7）:「{last[:30]}…」")

    lv1 = [c["id"] for c in g["cards"] if c.get("level") == 1 and c.get("startUnlocked")]
    if len(lv1) != START_UNLOCKED_LV1:
        warnings.append(f"第 1 关开局解锁 {len(lv1)} 张卡 {lv1}（首卡规则要求恰 {START_UNLOCKED_LV1} 张：钩子正文版 + 覆盖「填/搜/收」）")


def check_arc_continuity(g: dict) -> None:
    """人物弧光断线（警告级，README_game §4.1）：某人物第 N 关与第 N+2 关都有来源、
    第 N+1 关却完全断线——立场反转会显得突兀，应补一张过渡卡或过渡提及。"""
    levels = game_levels(g)
    for eid, e in g["entries"].items():
        if e["type"] != "person":
            continue
        present = {lv for lv in levels if fam_max_of(g, eid, lv) > 0}
        for lv in sorted(present):
            if lv + 2 in present and lv + 1 not in present:
                warnings.append(
                    f"人物 {eid} 第{lv}关与第{lv + 2}关出场、第{lv + 1}关断线："
                    f"若此间立场有转变须补过渡卡（README_game §4.1 弧光过渡）")


def check_anonymity(g: dict) -> None:
    for c in g["cards"]:
        text = card_full_text(c)
        tags = card_tag_ids(c)
        for b in c["blanks"]:
            for ans in blank_answers(b):
                if (c["id"], ans) in LEAK_OK:
                    continue
                name = g["entries"][ans]["name"]
                if ans in tags:
                    err(f"匿名违规: {c['id']} 答案 {ans} 以标签形式出现在本卡")
                if name in TAG_RE.sub("", text):
                    err(f"匿名违规: {c['id']} 答案真名「{name}」以裸文本出现在本卡")


_FAM_MAX_CACHE: dict = {}  # (eid, level) → 上限；单游戏单进程，可安全缓存（模拟高频调用）


def fam_max_of(g: dict, eid: str, level: int) -> int:
    """某关内词条熟悉度上限（与前端 familiarMaxOf 同规则）：
    上限 = 本关来源数（该关正文 tag 卡数 + 单一答案卡数），不做容错折扣。
    数组答案卡不计入（补完只给所选词条 +1，计入会让未被选的词条上限不可达）。"""
    key = (eid, level)
    hit = _FAM_MAX_CACHE.get(key)
    if hit is not None:
        return hit
    n = 0
    for c in g["cards"]:
        if c["level"] != level:
            continue
        if eid in card_tag_ids(c) or any(b["answer"] == eid for b in c["blanks"]):
            n += 1
    _FAM_MAX_CACHE[key] = n
    return n


def check_familiar_and_collectable(g: dict) -> None:
    tag_cards = {eid: set() for eid in g["entries"]}
    for c in g["cards"]:
        for t in card_tag_ids(c):
            tag_cards[t].add(c["id"])
    start = {eid for eids in g["levelStartEntries"].values() for eid in eids}
    # 分关熟悉度：有档案页的词条，在该页所在关必须有熟悉度来源（否则无法分析解锁）
    for eid, e in g["entries"].items():
        for p in e.get("archive", []):
            if fam_max_of(g, eid, p["level"]) < 1:
                err(f"词条 {eid} 在第{p['level']}关无熟悉度来源，档案页无法解锁")
    for c in g["cards"]:
        for b in c["blanks"]:
            if not any(a in start or tag_cards[a] for a in blank_answers(b)):
                err(f"{c['id']} 空位答案 {blank_answers(b)} 全游戏不可收集")


def build_search_ctx(g: dict, level: int, collected: set, unlocked: set) -> tuple:
    """搜寻决策共享上下文（与前端 buildSearchCtx 同构）：
    potential = 已收集词条 ∪ 本关已解锁卡正文可收集的 {{词条}}；
    locked_tag_cards = 本关未解锁卡索引（词条 id → 提及它的卡 id 集合）。"""
    potential = set(collected)
    locked_tag_cards: dict = {}
    for c in g["cards"]:
        if c["level"] != level:
            continue
        if c["id"] in unlocked:
            potential |= card_tag_ids(c)
        else:
            for t in card_tag_ids(c):
                locked_tag_cards.setdefault(t, set()).add(c["id"])
    return potential, locked_tag_cards


def search_priority(g: dict, card: dict, level: int, collected: set,
                    potential: set, locked_tag_cards: dict, recent_keys=()) -> int:
    """与前端 logic.ts searchPriority 同规则（总原则「回答>收集」，严格分层、命中即返回）：
    ① +10000 完美作答（现货）：每个空位都能用已收集词条作答 → 10000 - 空位数；
    ② +1000 完美作答（可预期）：每个空位都能用潜在池作答 → 1000 - 空位数；
    ③ +100 收集价值：卡面能收集到新的有效词条（人物/地点或还有其他未解锁卡提及它）
       → 100 + 新有效词条的本关熟悉度上限最大值；
    ④ 兜底 <100：10×已可作答空位 + 4×潜在池可作答空位 + 2×其余新词条 - 空位数。
    硬规定（独白防连发）：上一张搜到的卡是某 NPC 的独白时，该 NPC 的独白候选优先级直接置 0。
    连发抑制（跨层版，独白外的其他重复）：候选与最近解锁的卡同列（同角色）且同形态时——
    连发 1 张扣 6 分（只在层内让位）；连发 ≥2 张跨层降级到 min(原分, 99 - 空位数)，
    同类连发至多 2 张；候选池全是同类时仍取空位最少者（优雅退化）。
    recent_keys = 本关已解锁卡的 (col, form) 键，从新到旧。"""
    blanks = card["blanks"]
    key = (card["col"], card["form"])
    if card["form"] == "monologue" and recent_keys and recent_keys[0] == key:
        return 0
    streak = 0
    for k in recent_keys:
        if k != key:
            break
        streak += 1
    pen = 6 if streak > 0 else 0

    def demote(p):
        return min(p, 99 - len(blanks)) if streak >= 2 else p

    now_ok = [any(a in collected for a in blank_answers(b)) for b in blanks]
    if all(now_ok):
        return demote(10000 - len(blanks) - pen)
    soon_ok = [any(a in potential for a in blank_answers(b)) for b in blanks]
    if all(soon_ok):
        return demote(1000 - len(blanks) - pen)
    fam_best = -1
    new_other = 0
    for eid in card_tag_ids(card):
        if eid in collected:
            continue
        etype = g["entries"][eid]["type"]
        searchable = any(cid != card["id"] for cid in locked_tag_cards.get(eid, ()))
        if etype in ("person", "place") or searchable:
            fam_best = max(fam_best, fam_max_of(g, eid, level))
        else:
            new_other += 1
    if fam_best >= 0:
        return demote(max(100, 100 + fam_best - pen))
    n_now = sum(now_ok)
    n_soon = sum(1 for i, ok in enumerate(soon_ok) if ok and not now_ok[i])
    return demote(min(99, n_now * 10 + n_soon * 4 + new_other * 2 - len(blanks)) - pen)


def simulate(g: dict) -> None:
    """新搜寻规则（每次 1 张、按优先级选卡）下的自动通关模拟。
    完成度优先：本卷无其他可推进事项时才尝试过闸（熟悉度上限=全部来源后，
    须集满本卷来源才能解锁档案页，提前过闸会永久错过上卷档案页）。"""
    st = g["meta"]["stamina"]
    max_level = max_level_of(g)
    level = 1
    stamina = st["start"]
    rests = 0
    collected = set()
    fam = {eid: 0 for eid in g["entries"]}
    clicked = {eid: set() for eid in g["entries"]}   # 每卡每词条只计一次
    ans_fam_done = set()                             # 已发过答案熟悉度的卡
    unlocked = set()
    unlock_order = []                                # 解锁顺序（连发抑制用，对应前端 unlockedAt）
    done = set()
    placed = set()
    arch_unlocked = {eid: set() for eid in g["entries"]}
    arch_done = {eid: set() for eid in g["entries"]}
    gates_passed = 0

    def collect(eid):
        collected.add(eid)

    for eid in g["levelStartEntries"].get("1", []):
        collect(eid)

    cards_by_level = {}
    for c in g["cards"]:
        cards_by_level.setdefault(c["level"], []).append(c)

    def gate_pool_ok(gate):
        for b in gate["blanks"]:
            if "answerEntry" in b:
                eid = b["answerEntry"]
                pages = [i for i, p in enumerate(g["entries"][eid].get("archive", []))
                         if p["level"] <= gate["after"]]
                if not all(i in arch_done[eid] for i in pages):
                    return False, f"闸门答案 {eid} 的档案未完成，不在候选池"
            else:
                if b["answerTitle"] not in placed:
                    return False, f"闸门答案卡 {b['answerTitle']} 未归位"
        return True, ""

    steps = 0
    while steps < 5000:
        steps += 1
        progressed = False

        # 1) 点读已解锁卡中的全部标签
        for c in g["cards"]:
            if c["id"] in unlocked:
                for t in card_tag_ids(c):
                    collect(t)
                    if c["id"] not in clicked[t]:
                        clicked[t].add(c["id"])
                        fam[t] = min(fam[t] + 1, fam_max_of(g, t, level))
                        progressed = True

        # 2) 完成所有答案已收集的已解锁卡
        for c in g["cards"]:
            if c["id"] in unlocked and c["id"] not in done:
                if all(any(a in collected for a in blank_answers(b)) for b in c["blanks"]):
                    done.add(c["id"])
                    stamina += st["completeReward"]
                    progressed = True
                    if c["id"] not in ans_fam_done:
                        ans_fam_done.add(c["id"])
                        for b in c["blanks"]:
                            t = next((a for a in blank_answers(b) if a in collected), blank_answers(b)[0])
                            fam[t] = min(fam[t] + 1, fam_max_of(g, t, level))

        # 3) 归位
        for cid in done:
            if cid not in placed:
                placed.add(cid)
                progressed = True

        # 4) 分析（本关档案页，本关熟悉度满）
        for eid, e in g["entries"].items():
            if fam[eid] >= fam_max_of(g, eid, level):
                for i, p in enumerate(e.get("archive", [])):
                    if p["level"] == level and i not in arch_unlocked[eid]:
                        arch_unlocked[eid].add(i)
                        progressed = True

        # 5) 补全档案页
        for eid, e in g["entries"].items():
            for i in arch_unlocked[eid]:
                if i in arch_done[eid]:
                    continue
                page = e["archive"][i]
                if all(f["blank"]["answer"] in collected
                       for f in page["fields"] if "blank" in f):
                    arch_done[eid].add(i)
                    progressed = True

        # 6) 搜寻（每次只解锁 1 张；全局最佳 = 所有已收集词条的候选卡中优先级最高者，
        #    模拟玩家一直点词条库红点走最佳路径；同分按卡序取早，与前端 bestSearchTarget 同构）
        if stamina >= st["searchCost"]:
            potential, locked_tag_cards = build_search_ctx(g, level, collected, unlocked)
            recent_keys = [(c["col"], c["form"]) for c in reversed(unlock_order)
                           if c["level"] == level]
            best_card = None
            best_p = None
            for c in cards_by_level.get(level, []):
                if c["id"] in unlocked or not (card_tag_ids(c) & collected):
                    continue  # 候选：本关未解锁且正文含任一已收集词条（可被搜寻到）
                p = search_priority(g, c, level, collected, potential, locked_tag_cards, recent_keys)
                if best_p is None or p > best_p:
                    best_p, best_card = p, c
            if best_card is not None:
                unlocked.add(best_card["id"])
                unlock_order.append(best_card)
                stamina -= st["searchCost"]
                progressed = True

        # 7) 闸门（归位×25 + 档案×10 加权进度 >= 70% 即可开闸；
        #    模拟采取完成度优先策略：本卷无其他进展时才过闸）
        gate = next((x for x in g["gates"] if x["after"] == level), None)
        if gate is not None and not progressed:
            lv_cards = [c["id"] for c in cards_by_level.get(level, [])]
            placed_n = sum(1 for cid in lv_cards if cid in placed)
            lv_pages = [(eid, i) for eid, e in g["entries"].items()
                        for i, p in enumerate(e.get("archive", []))
                        if p["level"] == level]
            arch_n = sum(1 for eid, i in lv_pages if i in arch_done[eid])
            total = len(lv_cards) * 25 + len(lv_pages) * 10
            if total > 0 and (placed_n * 25 + arch_n * 10) * 10 >= total * 7:
                ok, why = gate_pool_ok(gate)
                if ok:
                    gates_passed += 1
                    if level == max_level:
                        break
                    level += 1
                    stamina += st["perLevel"]
                    for eid in fam:  # 熟悉度按关刷新（清零，词条收集状态继承）
                        fam[eid] = 0
                    for eid in g["levelStartEntries"].get(str(level), []):
                        collect(eid)
                    progressed = True
                # 进度够但候选池未齐（闸门答案的档案未补完）：继续补齐后再过

        if not progressed:
            if stamina < st["searchCost"]:
                stamina += st["restGain"]
                rests += 1
                continue
            break

    if stamina < 0:
        err(f"模拟: 体力出现负值 {stamina}")
    if gates_passed < len(g["gates"]):
        stuck = [c["id"] for c in g["cards"] if c["id"] not in unlocked][:8]
        err(f"模拟: 未能通关（过闸门 {gates_passed}/{len(g['gates'])}），"
            f"未解锁卡示例 {stuck}，level={level} stamina={stamina}")
    else:
        print(f"模拟通关 OK：剩余体力 {stamina}，休整 {rests} 次，步数 {steps}")


def check_assets(g: dict, strict: bool) -> None:
    need = [g["assets"]["mysteryAvatar"], g["assets"]["titleImage"], g["assets"]["endingImage"]]
    need += list((g["assets"].get("levelIntroImages") or {}).values())
    need += [g["assets"][k] for k in ("sceneIcon", "favicon") if k in g["assets"]]
    for eid, e in g["entries"].items():
        if "avatar" in e:
            need.append(e["avatar"])
        if "image" in e:
            need.append(e["image"])
    for c in g["cards"]:
        if "cg" in c:
            need.append(c["cg"])
    for t in g["assets"].get("bgm") or []:
        if t.get("file"):
            need.append(t["file"])
    missing = [p for p in need if not (ASSET_ROOT / p).exists()]
    for p in missing:
        (err if strict else warnings.append)(f"资产缺失: {p}")


# ---------- 回顾本关故事（README_game §4.9 / doc/12-story-recap.md） ----------

RECAP_SHARE = (0.10, 0.20)  # 每页字数 / 覆盖卡正文总字数


def recap_page_count(rows: int) -> int:
    """建议页数 = int(时间段数 × 0.5 + 0.5)，且必须 < 时间段数（与前端 data.ts 同公式）。"""
    return max(1, min(rows - 1, int(rows * 0.5 + 0.5)))


def recap_len(text: str) -> int:
    """回顾字数口径：去标记、去全部空白后的字符数。

    前端 data.ts 的 textLen、tools/init_recaps.py、tools/apply_recaps.py 必须与此一致，
    否则「写作时看到达标、校验时又不达标」。
    """
    return len(re.sub(r"\s", "", TAG_STRIP_RE.sub(lambda m: m.group(1), text)))


def recap_card_len(card: dict) -> int:
    return sum(recap_len(s["text"]) for s in card["segments"])


def check_recap(g: dict) -> None:
    """回顾长廊：页数公式、行区间连续且铺满全关、每页字数占比、引用存在。

    没写 recaps 的作品跳过（新功能，老数据补完前不拦）；写了就按规格全量校验。
    """
    recaps = g.get("recaps")
    if not recaps:
        return
    cards_by_id = {c["id"]: c for c in g["cards"]}
    for lv in game_levels(g):
        key = str(lv)
        rec = recaps.get(key)
        tl = g.get("timelines", {}).get(key)
        if not tl:
            continue
        nrows = len(tl["rows"])
        if not rec or not rec.get("pages"):
            spec_err(f"第{lv}关缺 recaps（回顾本关故事）")
            continue
        pages = rec["pages"]
        want = recap_page_count(nrows)
        if len(pages) != want:
            spec_err(f"第{lv}关回顾 {len(pages)} 页，建议 {want} 页（int(行数×0.5+0.5)，行数 {nrows}）")
        if len(pages) >= nrows:
            err(f"第{lv}关回顾页数 {len(pages)} 必须小于时间段数 {nrows}")
        seen_rows: list = []
        for pi, p in enumerate(pages, 1):
            tag = f"第{lv}关回顾第{pi}页"
            rows = p.get("rows") or []
            if not rows:
                err(f"{tag} 未指定覆盖的时间行 rows")
                continue
            if any(not isinstance(r, int) or r < 0 or r >= nrows for r in rows):
                err(f"{tag} rows 越界: {rows}（本关 {nrows} 行）")
                continue
            if rows != list(range(rows[0], rows[0] + len(rows))):
                err(f"{tag} rows 必须是连续区间: {rows}")
            seen_rows += rows
            if not p.get("title"):
                spec_err(f"{tag} 缺标题")
            # 覆盖卡：默认应为这些行的全部卡
            ids = p.get("cards") or []
            for cid in ids:
                c = cards_by_id.get(cid)
                if not c:
                    err(f"{tag} 引用了不存在的卡 {cid}")
                elif c["level"] != lv:
                    err(f"{tag} 引用了第{c['level']}关的卡 {cid}")
            for img in p.get("images") or []:
                if not (ASSET_ROOT / img).exists():
                    warnings.append(f"{tag} 预览图不存在: {img}")
            segs = p.get("segments") or []
            if not segs:
                err(f"{tag} 没有正文段落")
                continue
            words = 0
            for s in segs:
                if s.get("kind") == "quote":
                    if s.get("entry") not in g["entries"]:
                        err(f"{tag} 引语指向不存在的词条 {s.get('entry')}")
                elif s.get("kind") != "narration":
                    err(f"{tag} 段落 kind 非法: {s.get('kind')}（只能 narration / quote）")
                words += recap_len(s.get("text", ""))
            base = sum(recap_card_len(cards_by_id[cid]) for cid in ids if cid in cards_by_id)
            if base > 0:
                lo, hi = int(base * RECAP_SHARE[0]), int(base * RECAP_SHARE[1])
                if not (lo <= words <= hi):
                    spec_err(f"{tag} 正文 {words} 字，应为覆盖卡总字数({base})的 10~20% 即 [{lo},{hi}]")
        if sorted(seen_rows) != list(range(nrows)):
            err(f"第{lv}关回顾各页的 rows 未恰好铺满全部 {nrows} 行且不重叠：{sorted(seen_rows)}")


def main() -> None:
    strict_assets = "--strict-assets" in sys.argv
    print(f"校验游戏: {GAME}（{DATA.relative_to(ROOT)}）")
    g = json.loads(DATA.read_text(encoding="utf-8"))
    # 使用者与时机（README_game §9）：wip 期（使用者=AI）强制全部规范；
    # 作品标 final 后（使用者=内容总监）规范类降级为建议，只有完整性错误仍拦。
    # --author 强制严格（CI 恒用），--director 强制宽松。
    status = g["meta"].get("status", "wip")
    director = ("--director" in sys.argv) or (status == "final" and "--author" not in sys.argv)

    # 完整性检查：任何模式都拦
    check_schema(g)
    check_levels(g)
    check_familiar_and_collectable(g)
    check_recap(g)
    simulate(g)
    # 设计规范检查：内容总监模式下降级为建议
    for fn in (
        check_timeline_density,
        check_length_spec,
        check_anonymity,
        check_dialogue_rules,
        check_entry_tier,
        check_archive_blank_distribution,
        check_card_duplication,
        check_frame_story,
        check_hook,
        check_arc_continuity,
    ):
        run_spec(fn, g)
    check_assets(g, strict_assets)

    for w in warnings:
        print("WARN:", w)
    if director:
        print(f"\n【内容总监模式】meta.status = {status}：以下 {len(spec_errors)} 条设计规范问题只作建议，不阻断。")
        for e in spec_errors:
            print("建议:", e)
        hard = errors
    else:
        hard = errors + spec_errors
    if hard:
        print(f"\n共 {len(hard)} 个错误：")
        for e in hard:
            print("ERR:", e)
        sys.exit(1)
    print("全部校验通过 ✔")


if __name__ == "__main__":
    main()
