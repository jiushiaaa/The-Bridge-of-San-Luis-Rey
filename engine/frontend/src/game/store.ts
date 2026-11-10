// 集中式 store：GameState（入存档）+ UiState（瞬态），基于 useSyncExternalStore
import { useEffect, useState, useSyncExternalStore } from 'react';
import { saveGame } from './save';
import { sfxOnUiChange } from './sfx';
import type { CardForm, GameState } from './types';

// ---------- 可种子化随机数（mulberry32，?seed= 复现用） ----------

let rngState = (Date.now() >>> 0) || 1;

export function seedRandom(seed: number): void {
  rngState = (seed >>> 0) || 1;
}

export function random(): number {
  rngState |= 0;
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------- 游戏状态 ----------

let state: GameState = null as unknown as GameState;
const listeners = new Set<() => void>();

export function getState(): GameState {
  return state;
}

/** 每次状态变更都会写存档并通知订阅者 */
export function setState(next: GameState): void {
  state = next;
  saveGame(next);
  listeners.forEach((l) => l());
}

/** 初始化（不写存档，但通知订阅者） */
export function initState(s: GameState): void {
  state = s;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** 供 BGM 等模块在存档变更后对照解锁（不入 React） */
export const subscribeGame = subscribe;

export function useGame(): GameState {
  return useSyncExternalStore(subscribe, getState);
}

// ---------- 瞬态 UI 状态（不入存档） ----------

export interface PickerItem {
  key: string;
  name: string;
  desc?: string;
  entryId?: string; // 有则显示头像/印章
  fam?: boolean; // 有则以圆点样式显示该词条熟悉度（与词条库一致）
  form?: CardForm; // 有则显示形态图标（情节标题候选）
  indent?: boolean; // 有则整行缩进两格（非情节类标题）
  cardId?: string; // 有则按情节卡取 CG 图（关卡出口「剧情」表格候选）
}

export interface PickerGroup {
  label: string;
  items: PickerItem[];
  keepOrder?: boolean; // 有则尊重传入顺序，弹窗不再按熟悉度重排
  layout?: 'timeline'; // 按时间轴行列排成表格（图 + 名字），用于关卡出口剧情候选
}

export interface PickerConf {
  title: string;
  groups: PickerGroup[];
  onPick: (key: string) => void;
  wide?: boolean; // 有则弹窗显著加宽（档案概念候选：左图右文卡）
  entryLayout?: 'cards5'; // 词条候选统一渲染为「图片 + 名字」5 列卡片（关卡出口选择答案）
}

export interface ToastMsg {
  id: number;
  text: string;
}

/** DEBUG-文案 编辑器目标（见 components/copyedit/ 与 doc/06-copyedit-editor.md） */
export type CopyeditConf =
  | { kind: 'entries' }
  | { kind: 'card'; cardId: string }
  | { kind: 'timeline'; level: number }
  | { kind: 'gate'; after: number }
  | { kind: 'archive'; entryId: string }
  | { kind: 'frame'; target: 'intro'; level: number }
  | { kind: 'frame'; target: 'ending' }
  | { kind: 'meta' }
  | { kind: 'levels' }
  | { kind: 'recap'; level: number }
  | { kind: 'bgm' };

/** 保存后自动质检（tools/validate_data.py）的结果状态 */
export interface CeValidation {
  state: 'running' | 'ok' | 'fail' | 'unavailable';
  output: string;
}

export type EntryView = 'full' | 'compact';
export const ENTRY_VIEWS: EntryView[] = ['full', 'compact'];
const ENTRY_VIEW_KEY = 'baima:entryView';

function loadEntryView(): EntryView {
  try {
    const v = localStorage.getItem(ENTRY_VIEW_KEY);
    return v === 'compact' ? 'compact' : 'full';
  } catch {
    return 'full';
  }
}

/** 切换词条库显示模式并记住（跨作品共用一个偏好） */
export function setEntryView(v: EntryView): void {
  setUi({ entryView: v });
  try {
    localStorage.setItem(ENTRY_VIEW_KEY, v);
  } catch {
    /* ignore */
  }
}

export interface UiState {
  showTitle: boolean; // 标题页覆盖层（读档后先进标题）
  toasts: ToastMsg[];
  picker: PickerConf | null;
  /** 情节卡底部填空抽屉：展开时显示该 slot 的候选（非居中弹窗） */
  blankSheet: { cardId: string; slot: string } | null;
  /** 正文/发言人列高亮的 slot（悬停空白按钮或抽屉打开时；通常为人名 NPCn） */
  highlightSlot: string | null;
  /** 情节卡「⚡提示」：尚未收集到答案的空位临时亮出正确答案（震动 3s 后 / 离开本卡时还原）。slots: slot → 答案词条 id */
  hintPeek: { cardId: string; slots: Record<string, string>; until: number } | null;
  /** 「⚡提示」刚替玩家填对的空位（闪一下；带时间戳，重开卡片不再重放） */
  hintFlash: { cardId: string; slots: string[]; at: number } | null;
  hintOpen: boolean;
  guideOpen: boolean; // 顶栏主动打开玩法说明
  menuOpen: boolean; // 顶栏「菜单」弹层（音量 / 玩法说明 / 回标题）
  debugOpen: boolean; // DEBUG-进度 弹层（仅非离线版顶栏入口）
  copyedit: CopyeditConf | null; // DEBUG-文案 编辑器（仅后端在线时可开）
  /** 从 DEBUG 总览点进编辑器时为 true，返回时重开总览 */
  copyeditFromDebug: boolean;
  /** 编辑器返回栈（关卡管理 → 时间轴 等） */
  ceStack: CopyeditConf[];
  ceValidation: CeValidation | null; // 编辑器保存后的质检结果
  analyzing: string | null; // 正在分析的词条 id
  gateFx: { stars: number; max: number; gate: number } | null; // 过关动画（max = 该关满星数）
  entryDrawer: boolean; // 窄屏下词条库抽屉（右栏被收进页签栏时的弹出形态）
  /** 竖版主从页：list=列表｜detail=情节卡对话 / 档案详情 */
  mobilePane: 'list' | 'detail';
  /** 竖版故事页目录半屏抽屉 */
  notesToc: boolean;
  /** 词条库列表显示模式：full=完整（含简介）｜compact=精简（不显示简介，节省空间）。存 localStorage */
  entryView: EntryView;
  timelineSel: string | null; // 时间轴上选中的卡
  tlDrag: string | null; // 时间轴上正在拖拽的卡（HTML5 DnD 期间非空，用于格子高亮与落点校验）
  reviewLevel: number | null; // 时间轴正在只读回顾的历史关卡（null = 玩当前关）
  reviewCard: string | null; // 回顾模式下浮层打开的情节卡
  recapLevel: number | null; // 正在展示「回顾本关故事」的关卡
  coachFocus: string | null;
  /** 对应 CoachId；动画结束后才允许出现的步骤 */
  coachReady: string | null;
  /** 打开故事页时跳到目录第一篇（通关后「查看全部故事」） */
  storyJumpFirst: boolean;
  fx: Record<string, number>; // 动画脉冲计数器（shake/glow 等）
}

const initialUi: UiState = {
  showTitle: true,
  toasts: [],
  picker: null,
  blankSheet: null,
  highlightSlot: null,
  hintPeek: null,
  hintFlash: null,
  hintOpen: false,
  guideOpen: false,
  menuOpen: false,
  debugOpen: false,
  copyedit: null,
  copyeditFromDebug: false,
  ceStack: [],
  ceValidation: null,
  analyzing: null,
  gateFx: null,
  entryDrawer: false,
  mobilePane: 'list',
  notesToc: false,
  entryView: loadEntryView(),
  timelineSel: null,
  tlDrag: null,
  reviewLevel: null,
  reviewCard: null,
  recapLevel: null,
  coachFocus: null,
  coachReady: null,
  storyJumpFirst: false,
  fx: {},
};

let ui: UiState = initialUi;
const uiListeners = new Set<() => void>();

export function getUi(): UiState {
  return ui;
}

export function setUi(p: Partial<UiState>): void {
  const prev = ui;
  ui = { ...ui, ...p };
  sfxOnUiChange(prev, ui);
  uiListeners.forEach((l) => l());
}

function subscribeUi(l: () => void): () => void {
  uiListeners.add(l);
  return () => {
    uiListeners.delete(l);
  };
}

export function useUi(): UiState {
  return useSyncExternalStore(subscribeUi, getUi);
}

// ---------- toast 与动画脉冲 ----------

let toastSeq = 0;

/** 屏幕上同时最多几条 toast：超出时最旧的被顶掉（一次归位可连报多条，堆多了会糊住底部界面） */
const TOAST_MAX = 2;

export function pushToast(text: string): void {
  const id = ++toastSeq;
  setUi({ toasts: [...getUi().toasts, { id, text }].slice(-TOAST_MAX) });
  setTimeout(() => {
    setUi({ toasts: getUi().toasts.filter((t) => t.id !== id) });
  }, 2600);
}

export function pulseFx(key: string): void {
  const fx = getUi().fx;
  setUi({ fx: { ...fx, [key]: (fx[key] || 0) + 1 } });
}

/** 动画脉冲 hook：每次 pulseFx(key) 后返回 true 持续 ms 毫秒。
 *  在渲染期同步点亮，避免首帧没有 class、对勾动画从全尺寸再缩回去。 */
export function useFxActive(key: string, ms = 700): boolean {
  const n = useUi().fx[key] || 0;
  const [tick, setTick] = useState({ n: 0, on: false });
  if (n !== tick.n) setTick({ n, on: n > 0 });
  useEffect(() => {
    if (!tick.on) return;
    const t = setTimeout(() => setTick((p) => (p.n === n ? { n, on: false } : p)), ms);
    return () => clearTimeout(t);
  }, [n, ms, tick.on]);
  return tick.on;
}
