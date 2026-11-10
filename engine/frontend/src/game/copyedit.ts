// DEBUG-文案 编辑器数据通道（非离线版专属，见 doc/06-copyedit-editor.md）：
//   启动时从后端 GET /api/data 拉最新 final_game.json 覆盖构建期内联数据（改文案不用重新 build）；
//   编辑器保存 = 全量 JSON POST 给后端写回文件 + 内存热替换 + 存档消毒（改数据不坏档）+ 自动质检。
// 后端未运行 / 离线单文件版：available 恒为 false，所有 DEBUG-文案 按钮不渲染，游戏行为与从前完全一致。
import { offlineBuild } from '../debug';
import { getLocale } from '../i18n';
import { bumpAssetVersion, data, familiarMaxOf, GAME_ID, getZhSource, replaceGameData, setZhSource } from './data';
import { getState, getUi, pushToast, setState, setUi, type CopyeditConf } from './store';
import type { ArchiveBlankState, GameData } from './types';

let available = false;

/** 后端在线且拉取数据成功时为 true（启动时判定一次；中途起后端需刷新页面）。
 *  非简体游玩时隐藏编辑入口，避免把语言包写回简体真源。 */
export const copyeditAvailable = (): boolean => available && getLocale() === 'zh-CN';

// ---------- 未保存改动标记（Esc / 点遮罩关闭前确认） ----------

let dirty = false;
export const ceDirty = (): boolean => dirty;
export const setCeDirty = (v: boolean): void => {
  dirty = v;
};
export function closeCopyedit(): void {
  dirty = false;
  setUi({ copyedit: null, ceStack: [], copyeditFromDebug: false, ceValidation: null });
}

/** 从 DEBUG 总览或其它编辑器打开。fromDebug 会关掉总览并记住返回；push 把当前编辑器压进返回栈。 */
export function openCopyedit(conf: CopyeditConf, opts?: { fromDebug?: boolean; push?: boolean }): void {
  const ui = getUi();
  let stack = ui.ceStack;
  let fromDebug = ui.copyeditFromDebug;
  if (opts?.fromDebug) {
    stack = [];
    fromDebug = true;
  } else if (opts?.push && ui.copyedit) {
    stack = [...ui.ceStack, ui.copyedit];
  } else if (!opts?.push) {
    stack = [];
    fromDebug = false;
  }
  setUi({
    copyedit: conf,
    ceValidation: null,
    ceStack: stack,
    copyeditFromDebug: fromDebug,
    ...(opts?.fromDebug ? { debugOpen: false } : {}),
  });
}

/** 同层切换编辑目标（如情节卡编辑器顶部的时间轴表格点选另一张卡）：
 *  不动返回栈与 fromDebug，只换目标；有未保存改动先确认。返回是否已切换。 */
export function switchCopyedit(conf: CopyeditConf): boolean {
  if (dirty && !window.confirm('有未保存的修改，切换会丢弃，继续？')) return false;
  dirty = false;
  setUi({ copyedit: conf, ceValidation: null });
  return true;
}

export function copyeditCanBack(): boolean {
  const u = getUi();
  return u.copyeditFromDebug || u.ceStack.length > 0;
}

/** 返回上一层编辑器，或从 DEBUG 总览进来时回到总览 */
export function backCopyedit(): void {
  if (dirty && !window.confirm('有未保存的修改，返回会丢弃，继续？')) return;
  dirty = false;
  const ui = getUi();
  if (ui.ceStack.length > 0) {
    const prev = ui.ceStack[ui.ceStack.length - 1];
    setUi({ copyedit: prev, ceStack: ui.ceStack.slice(0, -1), ceValidation: null });
    return;
  }
  const fromDebug = ui.copyeditFromDebug;
  setUi({
    copyedit: null,
    ceStack: [],
    copyeditFromDebug: false,
    ceValidation: null,
    ...(fromDebug ? { debugOpen: true } : {}),
  });
}

// ---------- 启动拉取 ----------

/** main.tsx 启动时调用：离线版直接跳过；后端不在线时静默失败（1.5s 超时） */
export async function initCopyedit(): Promise<void> {
  if (offlineBuild) return;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    const r = await fetch(`api/data?game=${GAME_ID}`, { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return;
    const next = (await r.json()) as GameData;
    if (next?.meta?.id !== GAME_ID) return;
    setZhSource(next);
    available = true;
    // 仅简体展示时用磁盘真源覆盖内联包；其它语言保持已选语言包
    if (getLocale() === 'zh-CN') replaceGameData(next);
  } catch {
    // 后端未运行：编辑按钮不显示，游戏照常使用内联数据
  }
}

// ---------- 保存（全量回写 + 热替换 + 消毒 + 质检） ----------

/** 编辑器保存入口：对当前数据的深拷贝执行 mutate，POST 给后端写回文件，
 *  成功后热替换内存数据、消毒存档并触发全量重渲染。返回是否成功。
 *  结构性增删（建卡/建关等，见 game/content.ts）也走这里，只是不经过编辑器草稿。 */
export async function saveGameData(mutate: (draft: GameData) => void): Promise<boolean> {
  const old = structuredClone(data);
  const draft = structuredClone(getZhSource() ?? data);
  mutate(draft);
  try {
    const r = await fetch(`api/data?game=${GAME_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!r.ok || !j?.ok) {
      pushToast(`保存失败：${j?.error ?? `HTTP ${r.status}`}`);
      return false;
    }
  } catch {
    pushToast('保存失败：无法连接后端');
    return false;
  }
  setZhSource(draft);
  if (getLocale() === 'zh-CN') replaceGameData(draft);
  sanitizeState(old);
  pushToast('已保存并生效');
  void runValidate();
  return true;
}

/** 存档消毒：数据被编辑后，把存档中因此失效/越界/错位的部分自动修正，保证不坏档。
 *  规则（全自动，见 doc/06-copyedit-editor.md）：
 *  ① blanks 变动的卡 → 重置该卡填空作答与补完状态（解锁/已读/放置位保留，归位锁定解除）
 *  ② 设计位（row/col）变动且玩家已按旧位锁定 → 解除锁定（可重新归位）
 *  ③ 时间轴行列变动 → 越界的玩家放置清空、rowHints 过滤
 *  ④ 全词条熟悉度按新上限封顶（上限由 familiarMaxOf 自动重算）
 *  ⑤ 档案字段结构/答案变动 → 相应留白作答重置，pagesDone 按「全部留白已核对」重推
 *  ⑥ 闸门题数变动 → 该闸门作答重置（passed/得分保留） */
function sanitizeState(old: GameData): void {
  const s = structuredClone(getState());
  const oldCards = new Map(old.cards.map((c) => [c.id, c]));

  for (const c of data.cards) {
    const cs = s.cards[c.id];
    if (!cs) continue;
    const prev = oldCards.get(c.id);
    if (prev && JSON.stringify(prev.blanks) !== JSON.stringify(c.blanks)) {
      cs.done = false;
      delete cs.doneAt;
      cs.slotDraft = {};
      cs.slotLocked = {};
      if (cs.pos) cs.pos.locked = false;
    } else if (prev && cs.pos?.locked && (prev.row !== c.row || prev.col !== c.col)) {
      cs.pos.locked = false;
    }
    // 被删除的 slot 的作答残留清理
    for (const k of Object.keys(cs.slotDraft)) if (!c.blanks.some((b) => b.slot === k)) delete cs.slotDraft[k];
    for (const k of Object.keys(cs.slotLocked)) if (!c.blanks.some((b) => b.slot === k)) delete cs.slotLocked[k];
    // 时间轴越界放置清空
    if (cs.pos) {
      const t = data.timelines[String(c.level)];
      if (!t || cs.pos.row >= t.rows.length || cs.pos.col >= t.cols.length) cs.pos = null;
    }
  }

  s.rowHints ??= {};
  for (const [lv, arr] of Object.entries(s.rowHints)) {
    const t = data.timelines[lv];
    s.rowHints[lv] = t ? arr.filter((r) => r < t.rows.length) : [];
  }
  s.typeHints ??= {};

  for (const [id, e] of Object.entries(s.entries)) {
    const max = data.entries[id] ? familiarMaxOf(id, s.level) : 0;
    if (e.familiarity > max) e.familiarity = max;
  }

  for (const [id, def] of Object.entries(data.entries)) {
    const e = s.entries[id];
    if (!e) continue;
    const pages = def.archive ?? [];
    const oldPages = old.entries[id]?.archive ?? [];
    e.pagesUnlocked = e.pagesUnlocked.filter((i) => i < pages.length);
    const nextFields: Record<string, ArchiveBlankState> = {};
    for (const [key, st] of Object.entries(e.pageFields)) {
      const [pi, fi] = key.split(':').map(Number);
      const f = pages[pi]?.fields[fi];
      if (!f?.blank) continue; // 字段被删或改成纯文本
      const oldF = oldPages[pi]?.fields[fi];
      if (st.locked && (!oldF?.blank || oldF.blank.answer !== f.blank.answer)) continue; // 答案改了：该空重答
      nextFields[key] = st;
    }
    e.pageFields = nextFields;
    e.pagesDone = e.pagesDone.filter((pi) => {
      const p = pages[pi];
      return !!p && p.fields.every((f, fi) => !f.blank || e.pageFields[pi + ':' + fi]?.locked);
    });
  }

  for (const g of data.gates) {
    const gs = s.gates[String(g.after)];
    if (gs && gs.blanks.length !== g.blanks.length) {
      gs.blanks = g.blanks.map(() => ({ draft: null, locked: false }));
    }
  }

  setState(s); // 写档 + 全量重渲染
}

// ---------- 换图 ----------

/** 素材路径前缀（如 "xdd-assets"），由已有资源路径推导，新增图片时拼默认路径用 */
export function assetPrefix(): string {
  const p = data.assets.titleImage || data.assets.mysteryAvatar || '';
  const i = p.replace(/^\/+/, '').indexOf('/');
  return i > 0 ? p.replace(/^\/+/, '').slice(0, i) : 'assets';
}

/** 上传并覆盖 relPath 指向的素材文件（图片 / mp3）；成功后 bump 版本号强刷所有引用处 */
export async function uploadAsset(relPath: string, file: File | Blob, label = '素材'): Promise<boolean> {
  try {
    const r = await fetch(`api/upload?game=${GAME_ID}&path=${encodeURIComponent(relPath)}`, {
      method: 'POST',
      body: file,
    });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!r.ok || !j?.ok) {
      pushToast(`${label}上传失败：${j?.error ?? `HTTP ${r.status}`}`);
      return false;
    }
  } catch {
    pushToast(`${label}上传失败：无法连接后端`);
    return false;
  }
  bumpAssetVersion(relPath);
  setState(structuredClone(getState())); // 触发全界面重渲染以刷新引用
  pushToast(`${label}已替换（立即生效）`);
  return true;
}

export const uploadImage = (relPath: string, file: File | Blob): Promise<boolean> => uploadAsset(relPath, file, '图片');

/** 换 BGM 音频：写盘后若正在播这一曲则立即重载新文件 */
export async function uploadAudio(relPath: string, file: File | Blob, trackId?: string): Promise<boolean> {
  const ok = await uploadAsset(relPath, file, '音频');
  if (ok && trackId) {
    const m = await import('./bgm');
    m.reloadBgmFile(trackId);
  }
  return ok;
}

/** 由主题图标重切 favicon（换过 sceneIcon 后调一次） */
export async function rebuildFavicon(): Promise<boolean> {
  try {
    const r = await fetch(`api/favicon?game=${GAME_ID}`, { method: 'POST' });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; output?: string } | null;
    if (!j?.ok) {
      pushToast(`favicon 生成失败：${(j?.output ?? '').slice(0, 90)}`);
      return false;
    }
  } catch {
    pushToast('favicon 生成失败：无法连接后端');
    return false;
  }
  if (data.assets.favicon) bumpAssetVersion(data.assets.favicon);
  pushToast('favicon 已重切');
  return true;
}

// ---------- 自动质检 ----------

/** 保存成功后异步运行 tools/validate_data.py，结果显示在编辑器底部（python 缺失时降级提示） */
export async function runValidate(): Promise<void> {
  setUi({ ceValidation: { state: 'running', output: '' } });
  try {
    const r = await fetch(`api/validate?game=${GAME_ID}`, { method: 'POST' });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; code?: number; output?: string } | null;
    if (!j) {
      setUi({ ceValidation: { state: 'unavailable', output: '质检服务无响应' } });
      return;
    }
    if (j.code === -1) {
      setUi({ ceValidation: { state: 'unavailable', output: j.output || 'python 不可用' } });
      return;
    }
    setUi({ ceValidation: { state: j.ok ? 'ok' : 'fail', output: j.output ?? '' } });
    if (!j.ok) pushToast('数据质检发现问题（见编辑器底部）');
  } catch {
    setUi({ ceValidation: { state: 'unavailable', output: '无法连接后端' } });
  }
}
