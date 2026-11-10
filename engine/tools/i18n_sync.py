# tools/i18n_sync.py — 语言包增量同步：简体改过之后，只把改动/新增的文本交给翻译，其余复用旧译文
# 用法:
#   python tools/i18n_sync.py export [de|en|es|fr|ja|ko|hi|zh-TW|all] [--base GITREF] [--chunks N]
#   python tools/i18n_sync.py check  LOCALE CHUNK        （单个 _sync_tr_{CHUNK}.json 自检，译者交稿前跑）
#   python tools/i18n_sync.py merge  [de|en|es|fr|ja|ko|hi|zh-TW|all] [--keep]
#
# 基线 = 上次同步语言包时的简体真源（git 里的 workspace/xidaduo/final_game.json，缺省 HEAD）。
# export：骨架 = 当前简体深拷贝（非文本字段一律跟随简体）；可译文本若「基线与当前简体同值」就复用旧译文，
#   情节卡段落按 (speaker, text) 序列 diff 对齐；frame / gates / BGM 曲名每次整段重译。
#   产出 i18n/{loc}/_sync_base.json（骨架）与 _sync_todo_{k}.json（[{path, zh, ref, ctx}]，ref 为旧译参考）。
# 翻译：每个 _sync_todo_{k}.json 译成 _sync_tr_{k}.json（{path: 译文}）。
# merge：把 _sync_tr_*.json 写回骨架 → i18n/{loc}/final_game.json，校验标记后删除 _sync_* 临时文件。
# 之后必跑：python tools/i18n_apply_glossary.py all && python tools/i18n_check.py all
from __future__ import annotations

import copy
import difflib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / "workspace" / "xidaduo"
ZH = GAME / "final_game.json"
ZH_GIT = "workspace/xidaduo/final_game.json"
LOCALES = ("de", "en", "es", "fr", "ja", "ko", "hi", "zh-TW")
LATIN_LIKE = {"de", "en", "es", "fr", "hi"}  # 这些语言的译文里不该残留汉字

CJK = re.compile(r"[\u4e00-\u9fff]")
MARK = re.compile(r"\{\{(e_[a-z0-9_]+)\|[^}]*\}\}")
NPC = re.compile(r"\[\[NPC\d\]\]")

# 不交给翻译的键：prompt / 画风 / 备注（与简体同值），专名类（glossary 脚本统一写）
SKIP_KEYS = {
    "look", "avatarPrompt", "imagePrompt", "cgPrompt", "titleImagePrompt", "endingImagePrompt",
    "sceneIconPrompt", "art", "note", "tags",
    "col", "cols", "name", "slot", "kind", "answer", "answerEntry", "answerTitle", "pool",
}
ALWAYS_RETRANSLATE = ("frame", "gates")


def load(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def dump(p: Path, data) -> None:
    p.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def git_json(ref: str):
    raw = subprocess.run(["git", "show", f"{ref}:{ZH_GIT}"], cwd=ROOT, capture_output=True, check=True).stdout
    return json.loads(raw.decode("utf-8-sig"))


def ptr(parts) -> str:
    return "/" + "/".join(str(p).replace("~", "~0").replace("/", "~1") for p in parts)


def parse_ptr(path: str) -> list[str]:
    return [p.replace("~1", "/").replace("~0", "~") for p in path.strip("/").split("/")]


def get_at(root, parts):
    cur = root
    for p in parts:
        if isinstance(cur, list):
            i = int(p)
            if i >= len(cur):
                return None
            cur = cur[i]
        elif isinstance(cur, dict):
            if p not in cur:
                return None
            cur = cur[p]
        else:
            return None
    return cur


def set_at(root, parts, value) -> None:
    cur = root
    for p in parts[:-1]:
        cur = cur[int(p)] if isinstance(cur, list) else cur[p]
    last = parts[-1]
    if isinstance(cur, list):
        cur[int(last)] = value
    else:
        cur[last] = value


def leaves(obj, parts=()):
    """可译叶子：含汉字、且不在 SKIP_KEYS 下的字符串。产出 (相对路径 tuple, 文本)"""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in SKIP_KEYS:
                continue
            yield from leaves(v, parts + (k,))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from leaves(v, parts + (str(i),))
    elif isinstance(obj, str) and CJK.search(obj):
        yield parts, obj


def usable(loc: str, text) -> bool:
    if not isinstance(text, str) or not text.strip():
        return False
    return not (loc in LATIN_LIKE and CJK.search(text))


class Builder:
    def __init__(self, loc: str, zh_new, zh_base, old):
        self.loc = loc
        self.new = zh_new
        self.base = zh_base
        self.old = old
        self.out = copy.deepcopy(zh_new)
        self.todo: list[dict] = []
        self.reused = 0

    def need(self, parts, zh, ref=None, ctx="", ref_zh=None):
        ok = usable(self.loc, ref)
        row = {"path": ptr(parts), "zh": zh, "ref": ref if ok else None, "ctx": ctx}
        if ok and ref_zh and ref_zh != zh:
            row["ref_zh"] = ref_zh
        self.todo.append(row)

    def reuse(self, parts, text):
        set_at(self.out, list(parts), text)
        self.reused += 1

    def by_path(self, prefix: tuple, base_prefix: tuple | None = None, old_prefix: tuple | None = None, ctx=""):
        """同路径比对：基线与当前简体同值 → 复用旧包同路径译文"""
        base_prefix = prefix if base_prefix is None else base_prefix
        old_prefix = base_prefix if old_prefix is None else old_prefix
        node = get_at(self.new, list(prefix))
        for rel, zh in leaves(node):
            b = get_at(self.base, list(base_prefix + rel))
            o = get_at(self.old, list(old_prefix + rel))
            if b == zh and usable(self.loc, o):
                self.reuse(prefix + rel, o)
            else:
                self.need(prefix + rel, zh, o, ctx, b if isinstance(b, str) else None)

    def retranslate(self, prefix: tuple, ctx=""):
        """旧包对应的简体版本不明（frame / gates 曾单独改过），不给逐条参考，译者自行参阅旧包"""
        node = get_at(self.new, list(prefix))
        for rel, zh in leaves(node):
            self.need(prefix + rel, zh, None, ctx)

    def cards(self):
        base_cards = {c["id"]: c for c in self.base["cards"]}
        old_cards = {c["id"]: c for c in self.old.get("cards", [])}
        for ci, card in enumerate(self.new["cards"]):
            cid = card["id"]
            ctx = f"{cid}《{card.get('title', '')}》"
            b = base_cards.get(cid)
            o = old_cards.get(cid)
            # 卡面除 segments 之外的字段：同路径
            for rel, zh in leaves({k: v for k, v in card.items() if k != "segments"}):
                bv = get_at(b, list(rel)) if b else None
                ov = get_at(o, list(rel)) if o else None
                if bv == zh and usable(self.loc, ov):
                    self.reuse(("cards", str(ci)) + rel, ov)
                else:
                    self.need(("cards", str(ci)) + rel, zh, ov, ctx, bv if isinstance(bv, str) else None)
            # 段落：按序列 diff 对齐
            nsegs = card["segments"]
            bsegs = b["segments"] if b else []
            osegs = o["segments"] if o else []
            aligned = b is not None and o is not None and len(bsegs) == len(osegs)
            key = lambda s: (s.get("speaker"), s.get("text"))  # noqa: E731
            same: dict[int, int] = {}  # new j → base i（整段相同）
            if aligned:
                sm = difflib.SequenceMatcher(a=[key(s) for s in bsegs], b=[key(s) for s in nsegs], autojunk=False)
                for tag, i1, _i2, j1, j2 in sm.get_opcodes():
                    if tag == "equal":
                        for k in range(j2 - j1):
                            same[j1 + k] = i1 + k
            for j, seg in enumerate(nsegs):
                spk = seg.get("speaker") or "旁白"
                sctx = f"{ctx} 第{j + 1}/{len(nsegs)}段 说话人:{spk}"
                bi = same.get(j)
                for rel, zh in leaves(seg):
                    seg_path = ("cards", str(ci), "segments", str(j)) + rel
                    ov = get_at(osegs[bi], list(rel)) if bi is not None else None
                    if bi is not None and usable(self.loc, ov):
                        self.reuse(seg_path, ov)
                        continue
                    # 参考译文：同卡旧简体里最相似的一段（相似度 ≥ 0.45）
                    ref = ref_zh = None
                    if aligned:
                        best = 0.45
                        for i, bs in enumerate(bsegs):
                            bz = get_at(bs, list(rel))
                            if not isinstance(bz, str):
                                continue
                            r = difflib.SequenceMatcher(None, bz, zh, autojunk=False).ratio()
                            if r > best:
                                best, ref, ref_zh = r, get_at(osegs[i], list(rel)), bz
                    self.need(seg_path, zh, ref, sctx, ref_zh)

    def bgm(self):
        old_by_id = {t.get("id"): t for t in (self.old.get("assets", {}).get("bgm") or [])}
        for i, t in enumerate(self.new.get("assets", {}).get("bgm") or []):
            ref = (old_by_id.get(t["id"]) or {}).get("title")
            self.need(("assets", "bgm", str(i), "title"), t["title"], ref,
                      f"BGM 曲名 id={t['id']} stage={t.get('stage')}（短，诗意，4~30 字母/字）")

    def build(self):
        self.cards()
        for eid in self.new["entries"]:
            if eid in self.base["entries"] and eid in self.old.get("entries", {}):
                self.by_path(("entries", eid), ctx=f"词条 {eid}《{self.new['entries'][eid].get('name')}》")
            else:
                self.retranslate(("entries", eid), ctx=f"词条 {eid}")
        for sec in ("meta", "timelines", "recaps", "levelStartEntries"):
            if sec in self.new:
                self.by_path((sec,), ctx=sec)
        for sec in ALWAYS_RETRANSLATE:
            self.retranslate((sec,), ctx=sec)
        self.bgm()
        return self.out


def export(loc: str, base_ref: str, chunks: int) -> None:
    zh_new = load(ZH)
    zh_base = git_json(base_ref)
    pack = GAME / "i18n" / loc / "final_game.json"
    old = load(pack) if pack.exists() else {}
    b = Builder(loc, zh_new, zh_base, old)
    skel = b.build()
    d = GAME / "i18n" / loc
    for f in d.glob("_sync_*.json"):
        f.unlink()
    dump(d / "_sync_base.json", skel)
    total = sum(len(t["zh"]) for t in b.todo)
    per = max(1, -(-total // max(1, chunks)))
    parts: list[list[dict]] = [[]]
    acc = 0
    for t in b.todo:
        if acc >= per and len(parts) < chunks:
            parts.append([])
            acc = 0
        parts[-1].append(t)
        acc += len(t["zh"])
    for k, rows in enumerate(parts, 1):
        dump(d / f"_sync_todo_{k}.json", rows)
    print(f"{loc}: reused {b.reused}, to translate {len(b.todo)} strings / {total} chars -> {len(parts)} chunk(s)")


def check_marks(zh: str, tr: str) -> str | None:
    if [m for m in MARK.findall(zh)] != [m for m in MARK.findall(tr)]:
        return "{{eid|…}} 标记顺序/数量不一致"
    if NPC.findall(zh) != NPC.findall(tr):
        return "[[NPCn]] 标记不一致"
    return None


def verify(loc: str, todo: list[dict], tr: dict) -> list[str]:
    errs: list[str] = []
    for t in todo:
        text = tr.get(t["path"])
        if not isinstance(text, str) or not text.strip():
            errs.append(f"缺译文 {t['path']}")
            continue
        if loc in LATIN_LIKE and CJK.search(MARK.sub("", text)):
            errs.append(f"仍含汉字 {t['path']}: {text[:40]}")
        bad = check_marks(t["zh"], text)
        if bad:
            errs.append(f"{bad} {t['path']}")
    return errs


def check_chunk(loc: str, k: str) -> bool:
    d = GAME / "i18n" / loc
    todo = load(d / f"_sync_todo_{k}.json")
    tr = load(d / f"_sync_tr_{k}.json")
    errs = verify(loc, todo, tr)
    extra = set(tr) - {t["path"] for t in todo}
    if extra:
        errs.append(f"多出 {len(extra)} 个不在待译清单里的 path，例如 {sorted(extra)[0]}")
    for e in errs[:40]:
        print("  ", e)
    print(f"{'FAIL' if errs else 'OK'} {loc} chunk {k}: {len(todo)} strings, {len(errs)} problem(s)")
    return not errs


def merge(loc: str, keep: bool) -> bool:
    d = GAME / "i18n" / loc
    skel = load(d / "_sync_base.json")
    todo = [t for f in sorted(d.glob("_sync_todo_*.json")) for t in load(f)]
    tr: dict[str, str] = {}
    for f in sorted(d.glob("_sync_tr_*.json")):
        tr.update(load(f))
    errs = verify(loc, todo, tr)
    for t in todo:
        if isinstance(tr.get(t["path"]), str):
            set_at(skel, parse_ptr(t["path"]), tr[t["path"]])
    if errs:
        print(f"FAIL {loc}: {len(errs)}")
        for e in errs[:30]:
            print("  ", e)
        return False
    dump(d / "final_game.json", skel)
    if not keep:
        for f in d.glob("_sync_*.json"):
            f.unlink()
    print(f"OK {loc}: merged {len(todo)} strings -> {d / 'final_game.json'}")
    return True


def main() -> None:
    args = sys.argv[1:]
    if len(args) >= 3 and args[0] == "check":
        sys.exit(0 if check_chunk(args[1], args[2]) else 1)
    if len(args) < 2 or args[0] not in ("export", "merge"):
        sys.exit("usage: i18n_sync.py export|merge LOCALE|all | check LOCALE CHUNK")
    cmd, arg = args[0], args[1]
    targets = LOCALES if arg == "all" else (arg,)
    for loc in targets:
        if loc not in LOCALES:
            sys.exit(f"unknown locale {loc}")
    if cmd == "export":
        base = args[args.index("--base") + 1] if "--base" in args else "HEAD"
        chunks = int(args[args.index("--chunks") + 1]) if "--chunks" in args else 1
        for loc in targets:
            export(loc, base, chunks)
    else:
        ok = all([merge(loc, "--keep" in args) for loc in targets])
        if not ok:
            sys.exit(1)


if __name__ == "__main__":
    main()
