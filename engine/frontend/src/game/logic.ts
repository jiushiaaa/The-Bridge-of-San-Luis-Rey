// 全部玩法规则的 action 函数：操作 GameState 并自动 save()
// 测试与真实游玩共用这一套状态模型
import {
  archivePagesOfLevel,
  assetUrl,
  cardDef,
  cardsOfLevel,
  collectibleEntriesOfLevel,
  correctCell,
  data,
  entryDef,
  entryIdsInText,
  familiarMaxOf,
  gateAfterLevel,
  introPageCount,
  levelQuestion,
  maxLevel,
  recapOf,
  searchableCards,
  timelineOf,
  TYPE_LABEL,
} from './data';
import { t as tr } from '../i18n';
import { allCoachSeen, armCoach, COACH_FLY_MS, markCoach } from './coach';
import { clearSave } from './save';
import { isPhone, pushMobileLayer } from './layout';
import { playCue, sfxCommitSelect, sfxSkipLayer, startLoop, stopAllSfx, stopLoop } from './sfx';
import { getState, getUi, initState, pulseFx, pushToast, setState, setUi } from './store';
import type {
  BlankDef,
  CardDef,
  CardState,
  Difficulty,
  EntryState,
  EntryType,
  GameState,
  GateState,
  LevelStats,
  TabId,
} from './types';
import { blankAnswers } from './types';

const clone = <T,>(v: T): T => structuredClone(v);

/** 进入本卷时定格下来的过场底图：遮罩要接着插画「当前那一帧」继续放大。
 *  过场插画一直在缓慢推近，遮罩若用原始尺寸的图，开洞瞬间画面会错位跳一下。 */
let enterShot: { src: string; scale: number } | null = null;

export function getEnterShot(): { src: string; scale: number } | null {
  return enterShot;
}

/** 读元素当前的实际缩放（动画进行中取的是这一帧的插值矩阵） */
function currentScale(el: Element): number {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return 1;
  try {
    return new DOMMatrixReadOnly(t).a || 1;
  } catch {
    return 1;
  }
}

/** 进入本卷：全屏遮罩从中心开洞，界面本身不动。 */
function startEnterMask(lv: number): void {
  if (typeof document === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const img = document.querySelector('.lv-intro-bg');
  enterShot = {
    src: assetUrl(data.assets.levelIntroImages?.[String(lv)] || data.assets.titleImage),
    scale: img ? currentScale(img) : 1,
  };
  pulseFx('enterMask');
}

// ---------- 初始化 ----------

export function initialState(): GameState {
  return {
    storyId: data.meta.id,
    version: data.meta.version,
    screen: 'title',
    introLevel: null,
    introIdx: 0,
    endingIdx: 0,
    level: 1,
    stamina: data.meta.stamina.start,
    difficulty: 'easy',
    tab: 'cards',
    selectedCardId: null,
    archiveFocus: null,
    cards: {},
    entries: {},
    gates: {},
    rowHints: {},
    typeHints: {},
    stats: { errors: 0, hints: 0, rests: 0, startedAt: Date.now(), finishedAt: null, perLevel: {} },
    flags: { introSeen: {}, coachSeen: {} },
  };
}

function emptyEntryState(): EntryState {
  return { collected: false, familiarity: 0, famCards: [], pagesUnlocked: [], pageFields: {}, pagesDone: [] };
}

function emptyCardState(): CardState {
  return { unlocked: false, done: false, read: false, slotDraft: {}, slotLocked: {}, pos: null };
}

function ensureEntry(s: GameState, id: string): EntryState {
  return (s.entries[id] ??= emptyEntryState());
}

function ensureCard(s: GameState, id: string): CardState {
  return (s.cards[id] ??= emptyCardState());
}

const emptyLevelStats = (): LevelStats => ({ errors: 0, hints: 0, rests: 0 });

function perLevel(s: GameState, lv: number = s.level): LevelStats {
  const pl = (s.stats.perLevel[String(lv)] ??= emptyLevelStats());
  pl.rests ??= 0; // 旧存档：休整改为按关计
  return pl;
}

/** 初始化某关：注入起始词条、解锁 startUnlocked 卡（进时间轴「待归位」区）；熟悉度按关刷新（清零，词条收集状态继承） */
function startLevel(s: GameState, lv: number): void {
  s.level = lv;
  const k = String(lv);
  s.stats.perLevel[k] ??= emptyLevelStats();
  for (const e of Object.values(s.entries)) e.familiarity = 0;
  for (const eid of data.levelStartEntries[k] || []) {
    ensureEntry(s, eid).collected = true;
  }
  for (const c of cardsOfLevel(lv)) {
    if (c.startUnlocked) {
      const cs = ensureCard(s, c.id);
      if (!cs.unlocked) {
        cs.unlocked = true;
        cs.unlockedAt = Date.now();
      }
    }
  }
  const firstCard = cardsOfLevel(lv).find((c) => s.cards[c.id]?.unlocked);
  s.selectedCardId = firstCard?.id ?? null;
}

/**
 * 连片归位判定：沿「正确相对关系」（绿线：相邻两格正确格坐标差 == 当前格差）遍历连通簇，
 * 未锁定成员 >= 4 且全部补完、全部位于正确格 → 一次性全部锁定。
 * 残页（未补完）不参与延伸与计数（既不作为节点也不通过）；已锁定卡可通过（不计入集合）；
 * 放错位置的相对正确簇不会锁定（位置校验兜底）。
 */
function applyClusterLocks(s: GameState, lv: number): string[] {
  const cards = cardsOfLevel(lv);
  const at = new Map<string, CardDef>();
  for (const c of cards) {
    const cs = s.cards[c.id];
    if (cs?.done && cs.pos) at.set(cs.pos.row + ':' + cs.pos.col, c);
  }
  const linked = (a: CardDef, b: CardDef, dr: number, dc: number): boolean => {
    const ac = correctCell(a);
    const bc = correctCell(b);
    return bc.row - ac.row === dr && bc.col - ac.col === dc;
  };
  const DIRS: [number, number][] = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ];
  const seen = new Set<string>();
  const toLock = new Set<string>();
  for (const c of cards) {
    const cs = s.cards[c.id];
    if (!cs?.done || !cs.pos || seen.has(c.id)) continue;
    // BFS 一个连通簇
    const cluster: CardDef[] = [];
    const queue = [c];
    seen.add(c.id);
    while (queue.length > 0) {
      const cur = queue.pop()!;
      cluster.push(cur);
      const cp = s.cards[cur.id]!.pos!;
      for (const [dr, dc] of DIRS) {
        const nb = at.get(cp.row + dr + ':' + (cp.col + dc));
        if (!nb || seen.has(nb.id)) continue;
        if (linked(cur, nb, dr, dc)) {
          seen.add(nb.id);
          queue.push(nb);
        }
      }
    }
    const unlockedSet = cluster.filter((x) => !s.cards[x.id]!.pos!.locked);
    if (unlockedSet.length < 4) continue;
    const allOk = unlockedSet.every((x) => {
      const xs = s.cards[x.id]!;
      const xc = correctCell(x);
      return xs.done && xs.pos!.row === xc.row && xs.pos!.col === xc.col;
    });
    if (allOk) for (const x of unlockedSet) toLock.add(x.id);
  }
  const out = [...toLock];
  for (const id of out) s.cards[id]!.pos!.locked = true;
  return out;
}

/**
 * 行/列归位判定：某行（或某列）的全部设计卡都已补完且放在正确位置
 * → 该行/列中这些卡全部锁定归位（单格正确不再立即锁定）。
 * 若行/列内混入了放置错误的卡（占着本行/列的格子但正确格不在此行/列），本行/列不得判定完成。
 * 随后跑连片归位判定。返回新完成且发生锁定的行号/列号与连片锁定的卡 id。
 */
function applyTimelineLocks(s: GameState, lv: number): { rows: number[]; cols: number[]; cluster: string[] } {
  const cards = cardsOfLevel(lv);
  const rowOk = new Map<number, boolean>();
  const colOk = new Map<number, boolean>();
  for (const c of cards) {
    const cs = s.cards[c.id];
    const cc = correctCell(c);
    // 未补完 / 未放置 / 放错 → 该行或该列尚未凑齐
    const ok = !!cs?.done && !!cs.pos && cs.pos.row === cc.row && cs.pos.col === cc.col;
    rowOk.set(cc.row, (rowOk.get(cc.row) ?? true) && ok);
    colOk.set(cc.col, (colOk.get(cc.col) ?? true) && ok);
    // 行/列内若混入了放置错误的卡（占着本行/列的格子但正确格不在此行/列），
    // 即使设计卡全部放对，本行/列也不得判定为完全正确
    if (cs?.pos && (cs.pos.row !== cc.row || cs.pos.col !== cc.col)) {
      rowOk.set(cs.pos.row, false);
      colOk.set(cs.pos.col, false);
    }
  }
  const lockedIds: string[] = [];
  for (const c of cards) {
    const cc = correctCell(c);
    const cs = s.cards[c.id];
    if (!cs?.done || !cs.pos || cs.pos.locked) continue;
    if (cs.pos.row !== cc.row || cs.pos.col !== cc.col) continue;
    if (rowOk.get(cc.row) || colOk.get(cc.col)) {
      cs.pos.locked = true;
      lockedIds.push(c.id);
    }
  }
  // 只报告「真正完成」且本次有新锁定的行/列（避免因行完成而误报列归位）
  const rows = [...new Set(lockedIds.map((id) => correctCell(cardDef(id)!).row))].filter((r) => rowOk.get(r));
  const cols = [...new Set(lockedIds.map((id) => correctCell(cardDef(id)!).col))].filter((c) => colOk.get(c));
  return { rows, cols, cluster: applyClusterLocks(s, lv) };
}

/** 归位扫光特效与提示（需在 setState 之后调用） */
function fxTimelineLocks(lv: number, locks: { rows: number[]; cols: number[]; cluster: string[] }): void {
  const t = timelineOf(lv);
  for (const r of locks.rows) {
    pulseFx(`tlrow:${r}`);
    pushToast(tr('toast.rowLock', { name: t.rows[r] }));
  }
  for (const c of locks.cols) {
    pulseFx(`tlcol:${c}`);
    pushToast(tr('toast.colLock', { name: c === 0 ? tr('common.scene') : t.cols[c] }));
  }
  if (locks.cluster.length > 0) {
    for (const id of locks.cluster) pulseFx('chip:' + id);
    pushToast(tr('toast.clusterLock', { n: locks.cluster.length }));
  }
  // 有新锁定 → 关卡出口进度联动闪光
  const hadLock = locks.rows.length > 0 || locks.cols.length > 0 || locks.cluster.length > 0;
  if (hadLock) pulseFx('gateprog');
  // 本次锁定把本关最后一张卡也归位了 → 全轴完成：左栏收起 + 右栏关卡出口高亮，引导去答本卷之问
  if (hadLock && timelineAllLocked(lv)) {
    pulseFx('tlall');
    pushToast(tr('toast.tlAllDone'));
    playCue('achievement');
  }
}

/** 本关全部情节卡都已归位锁定（时间轴玩法收尾的唯一判据——不是「情节列锁定」，
 *  情节列先满只解锁「回顾本关故事」，角色列的卡还得继续放） */
export function timelineAllLocked(lv: number, s?: GameState): boolean {
  const st = s ?? getState();
  const cards = cardsOfLevel(lv);
  return cards.length > 0 && cards.every((c) => st.cards[c.id]?.pos?.locked);
}

// ---------- 流程：新游戏 / 过场 / 结局 ----------

/** 新游戏：标题页 → 第一卷过场 → 主界面（无片头、无自动说明、无教学） */
export function newGame(): void {
  const s = initialState();
  s.screen = 'game';
  s.stats.startedAt = Date.now();
  startLevel(s, 1);
  s.introLevel = 1;
  s.introIdx = 0;
  setState(s);
  setUi({ showTitle: false });
  playCue('start');
}

export function advanceIntro(): void {
  const s = clone(getState());
  const lv = s.introLevel;
  if (lv == null) return;
  // 页数含末尾的「问句幕」（本卷之问单独一屏，见 LevelIntro）
  if (s.introIdx < introPageCount(lv) - 1) {
    s.introIdx++;
    setState(s);
    playCue('swipe'); // 纸页层：一声翻书
    return;
  }
  const firstEnter = !s.flags.introSeen[String(lv)];
  // 定格底图要在 setState 之前读：状态一变过场就卸载，插画元素也就没了
  if (firstEnter) startEnterMask(lv);
  s.flags.introSeen[String(lv)] = true;
  s.introLevel = null;
  s.introIdx = 0;
  // 首次进关落地情节卡页：玩家刚被交给一个问题，手边就该是可以读的残页（故事页只是把过场再摆一遍）
  if (firstEnter) s.tab = 'cards';
  setState(s);
  playCue(firstEnter ? 'start' : 'back');
}

/** 重看某卷开场过场（默认当前关）；不改关卡进度，播完回到游戏界面 */
export function replayIntro(lv?: number): void {
  const s = clone(getState());
  const target = lv ?? s.level;
  if (!(data.frame.levelIntro[String(target)] || []).length) return;
  s.introLevel = target;
  s.introIdx = 0;
  s.screen = 'game';
  setState(s);
  playCue('open');
}

export function advanceEnding(): void {
  const s = clone(getState());
  if (s.endingIdx >= data.frame.ending.segments.length - 1) return;
  s.endingIdx++;
  setState(s);
  const last = s.endingIdx >= data.frame.ending.segments.length - 1;
  playCue(last ? 'complete' : 'progress-step');
}

export function backToTitle(): void {
  stopAllSfx();
  setUi({ showTitle: true });
  playCue('back');
}

/** 通关后从结局进入「故事」页，从头翻阅全部开场 / 回顾 / 结局 */
export function openFullStory(): void {
  const s = clone(getState());
  s.screen = 'game';
  s.tab = 'notes';
  s.introLevel = null;
  s.introIdx = 0;
  setState(s);
  setUi({
    showTitle: false,
    menuOpen: false,
    storyJumpFirst: true,
    reviewLevel: null,
    reviewCard: null,
    recapLevel: null,
  });
  playCue('open');
}

export function continueGame(): void {
  setUi({ showTitle: false });
  playCue('forward');
}

/** 清档回标题（结局「重新开始」） */
export function restartToTitle(): void {
  stopAllSfx();
  clearSave();
  initState(initialState());
  sfxSkipLayer();
  setUi({
    showTitle: true,
    picker: null,
    blankSheet: null,
    highlightSlot: null,
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
    timelineSel: null,
    reviewLevel: null,
    reviewCard: null,
    recapLevel: null,
    coachFocus: null,
    coachReady: null,
    storyJumpFirst: false,
  });
  playCue('back');
}

// ---------- 界面切换 ----------

export function setTab(tab: TabId): void {
  const s = clone(getState());
  const changed = s.tab !== tab;
  s.tab = tab;
  setState(s);
  if (changed) playCue('select');
  const patch: Parameters<typeof setUi>[0] = { mobilePane: 'list', notesToc: false };
  if (tab !== 'timeline' && getUi().reviewLevel != null) {
    patch.reviewLevel = null;
    patch.reviewCard = null;
    patch.recapLevel = null;
  }
  if (tab !== 'cards' && (getUi().blankSheet || getUi().highlightSlot)) {
    patch.blankSheet = null;
    patch.highlightSlot = null;
  }
  sfxSkipLayer();
  setUi(patch);
}

export function closeMobilePane(): void {
  setUi({ mobilePane: 'list' });
}

export function selectCard(cardId: string): void {
  const s = clone(getState());
  s.selectedCardId = cardId;
  s.tab = 'cards';
  setState(s);
  const patch: Parameters<typeof setUi>[0] = {};
  if (getUi().blankSheet || getUi().highlightSlot) {
    patch.blankSheet = null;
    patch.highlightSlot = null;
  }
  if (isPhone()) {
    if (getUi().mobilePane !== 'detail') pushMobileLayer();
    patch.mobilePane = 'detail';
  }
  if (Object.keys(patch).length) {
    sfxSkipLayer();
    setUi(patch);
  }
  playCue('select');
}

/** 「待排序」入口：跳到时间轴页签并选中该卡（已锁定归位的卡不可选） */
export function gotoTimeline(cardId: string): void {
  const s = clone(getState());
  const cs = s.cards[cardId];
  if (!cs?.unlocked || cs.pos?.locked) return;
  s.tab = 'timeline';
  setState(s);
  setUi({ timelineSel: cardId, mobilePane: 'list', notesToc: false });
  playCue('forward');
}

export function setArchiveFocus(entryId: string): void {
  const s = clone(getState());
  const changed = s.archiveFocus !== entryId || s.tab !== 'archive';
  s.archiveFocus = entryId;
  s.tab = 'archive';
  setState(s);
  if (isPhone()) {
    if (getUi().mobilePane !== 'detail') pushMobileLayer();
    sfxSkipLayer();
    setUi({ mobilePane: 'detail' });
  }
  if (changed) playCue('select');
}

/**
 * 这张卡此刻是否「可填写」：填这张卡所需的每个空位（NPC 名 / 地名），至少有一个正确答案词条已被玩家收集。
 * 列表状态章据此把未补完的卡分成「可填写 / 待补全」两态；情节卡页签角标也只计可填写的卡。
 */
export function cardFillable(card: CardDef, s: GameState = getState()): boolean {
  return card.blanks.every((b) => blankAnswers(b).some((ans) => s.entries[ans]?.collected));
}

// ---------- 关卡回顾（只读，README_game §4.4） ----------

/** 该关是否已通关（可回顾）：闸门已过 */
export const levelCleared = (lv: number, s?: GameState): boolean => !!(s ?? getState()).gates[String(lv)]?.passed;

/**
 * 进入/退出某历史关卡的只读回顾。
 * 卡片状态（done / pos.locked）是跨关全局保留的，所以直接换个关卡号渲染时间轴即可，
 * 不动 GameState —— 回顾绝不能像 debugJumpLevel 那样清熟悉度、覆盖当前进度。
 */
export function reviewLevel(lv: number | null): void {
  const s = getState();
  if (lv == null || lv === s.level) {
    setUi({ reviewLevel: null, reviewCard: null, timelineSel: null, recapLevel: null });
    return;
  }
  if (!levelCleared(lv, s)) {
    pushToast(tr('toast.levelClosed'));
    playCue('blocked');
    return;
  }
  setUi({ reviewLevel: lv, reviewCard: null, timelineSel: null, recapLevel: null });
}

/** 时间轴当前呈现的关卡（回顾优先） */
export const shownLevel = (s?: GameState): number => getUi().reviewLevel ?? (s ?? getState()).level;

// ---------- 回顾本关故事（README_game §4.9） ----------

/**
 * 时间行的名字是否已对玩家揭示：整行全部设计卡归位锁定，或花体力点过「提示」，或该关已通关。
 * 时间点名本身就是剧情走向的地图（README_game §4.4），任何地方要显示行名都得先过这一关。
 */
export function rowRevealed(lv: number, row: number, s?: GameState): boolean {
  const st = s ?? getState();
  if (levelCleared(lv, st)) return true;
  if ((st.rowHints?.[String(lv)] ?? []).includes(row)) return true;
  const inRow = cardsOfLevel(lv).filter((c) => correctCell(c).row === row);
  return inRow.length > 0 && inRow.every((c) => st.cards[c.id]?.pos?.locked);
}

/** 情节列（列 0）是否整列归位——「回顾本关故事」的解锁条件 */
export function plotColumnDone(lv: number, s?: GameState): boolean {
  const st = s ?? getState();
  const plot = cardsOfLevel(lv).filter((c) => correctCell(c).col === 0);
  return plot.length > 0 && plot.every((c) => st.cards[c.id]?.pos?.locked);
}

/** 该关是否可以打开回顾长廊：有回顾内容 + （情节列整列归位 或 已通关） */
export function recapAvailable(lv: number, s?: GameState): boolean {
  const pages = recapOf(lv)?.pages;
  if (!pages || pages.length === 0) return false;
  const st = s ?? getState();
  return plotColumnDone(lv, st) || levelCleared(lv, st);
}

export function openRecap(lv: number): void {
  setUi({ recapLevel: lv });
}

export function closeRecap(): void {
  setUi({ recapLevel: null });
}

export function markRead(cardId: string): void {
  const s = clone(getState());
  const cs = ensureCard(s, cardId);
  if (cs.read || !cs.unlocked) return;
  cs.read = true;
  setState(s);
}

// ---------- 搜寻 ----------

export function searchRemaining(entryId: string, s?: GameState): number {
  const st = s ?? getState();
  return searchableCards(entryId, st.level).filter((c) => !st.cards[c.id]?.unlocked).length;
}

/** 搜寻决策共享上下文（一次决策只构建一次，供全部候选卡复用） */
interface SearchCtx {
  /** 潜在词条池：已收集词条 ∪ 本关已解锁卡正文中可收集的 {{词条}} */
  potential: Set<string>;
  /** 本关未解锁卡索引：词条 id → 提及它的卡 id 集合（判断词条是否还有后续搜索价值） */
  lockedTagCards: Map<string, Set<string>>;
  /** 本关已解锁卡的 (col+form) 键，按解锁时间从新到旧（连发抑制用，unlockedAt 推导、不新增存档字段） */
  recentKeys: string[];
}

/** 连发抑制键：同列（同角色）且同形态视为「重复」 */
const streakKey = (c: CardDef): string => c.col + '\u0000' + c.form;

function buildSearchCtx(s: GameState): SearchCtx {
  const potential = new Set<string>();
  for (const [id, e] of Object.entries(s.entries)) if (e.collected) potential.add(id);
  const lockedTagCards = new Map<string, Set<string>>();
  const unlockedCards: CardDef[] = [];
  for (const c of cardsOfLevel(s.level)) {
    const unlocked = !!s.cards[c.id]?.unlocked;
    if (unlocked) unlockedCards.push(c);
    for (const seg of c.segments) {
      for (const eid of entryIdsInText(seg.text)) {
        if (unlocked) {
          potential.add(eid);
        } else {
          let set = lockedTagCards.get(eid);
          if (!set) lockedTagCards.set(eid, (set = new Set()));
          set.add(c.id);
        }
      }
    }
  }
  const recentKeys = unlockedCards
    .sort((a, b) => (s.cards[b.id]?.unlockedAt ?? 0) - (s.cards[a.id]?.unlockedAt ?? 0))
    .map(streakKey);
  return { potential, lockedTagCards, recentKeys };
}

/**
 * 搜寻选卡优先级（高者优先，同分按 cards 数组顺序取早者）。
 * 总原则「回答 > 收集」，严格分层、命中即返回：
 * ① +10000 完美作答（现货）：每个空位都能用已收集词条作答 → 10000 - 空位数（待答项目越少越优先）；
 * ② +1000 完美作答（可预期）：每个空位都能用潜在池（已收集 ∪ 本关已解锁卡可收集词条）作答 → 1000 - 空位数；
 * ③ +100 收集价值：卡面能收集到新的有效词条（未收集，且为人物/地点、或还有其他未解锁卡提及它）
 *    → 100 + 新有效词条的本关熟悉度上限最大值；
 * ④ 兜底（恒 <100）：10×已可作答空位 + 4×潜在池可作答空位 + 2×其余新词条（无搜索价值的物品/概念） - 空位数。
 * 硬规定（独白防连发）：上一张搜到的卡是某 NPC 的独白时，下一次搜卡该 NPC 的独白卡优先级直接置 0
 * （仍可发放：候选池只剩它们时取卡序最早者，永不卡死）。
 * 连发抑制（跨层版，独白外的其他重复）：候选与最近解锁的卡同列（同角色）且同形态时——
 * 连发 1 张：扣 6 分，只在层内让位（空位差 ≤5 < 6 < 层间距）；
 * 连发 ≥2 张：跨层降级到第 3 层之下（min(原分, 99 - 空位数)），强制让可预期作答/收集向的卡插队，
 * 同类连发至多 2 张；候选池全是同类时仍取其中空位最少者（优雅退化，永不卡死）。
 * tools/validate_data.py 的通关模拟用同规则。
 */
function searchPriority(card: CardDef, s: GameState, ctx: SearchCtx): number {
  const blanks = card.blanks;
  // 数组答案：任一命中即可作答
  const nowOk = (b: BlankDef) => blankAnswers(b).some((id) => s.entries[id]?.collected);
  const soonOk = (b: BlankDef) => blankAnswers(b).some((id) => ctx.potential.has(id));
  const key = streakKey(card);
  // 硬规定：上一张是同一 NPC（同列）的独白 → 本候选（该 NPC 的独白）优先级为 0
  if (card.form === 'monologue' && ctx.recentKeys[0] === key) return 0;
  // 连发抑制：最近连续解锁的同 (col, form) 张数；1 张层内扣分，≥2 张跨层降级
  let streak = 0;
  for (const k of ctx.recentKeys) {
    if (k !== key) break;
    streak++;
  }
  const pen = streak > 0 ? 6 : 0;
  const demote = (p: number) => (streak >= 2 ? Math.min(p, 99 - blanks.length) : p);
  if (blanks.every(nowOk)) return demote(10000 - blanks.length - pen);
  if (blanks.every(soonOk)) return demote(1000 - blanks.length - pen);
  // 卡面新词条盘点：有效 = 人物/地点 或 有后续搜索价值（另一张未解锁卡也提及它）
  const seen = new Set<string>();
  let famBest = -1;
  let newOther = 0;
  for (const seg of card.segments) {
    for (const eid of entryIdsInText(seg.text)) {
      if (seen.has(eid) || s.entries[eid]?.collected) continue;
      seen.add(eid);
      const type = entryDef(eid)?.type;
      const searchable = [...(ctx.lockedTagCards.get(eid) ?? [])].some((cid) => cid !== card.id);
      if (type === 'person' || type === 'place' || searchable) {
        famBest = Math.max(famBest, familiarMaxOf(eid, s.level));
      } else {
        newOther++;
      }
    }
  }
  // 第 3 层下限钳到 100：层内扣分后仍恒压第 4 层（<100）
  if (famBest >= 0) return demote(Math.max(100, 100 + famBest - pen));
  const answeredNow = blanks.filter(nowOk).length;
  const answeredSoon = blanks.filter((b) => !nowOk(b) && soonOk(b)).length;
  return demote(Math.min(99, answeredNow * 10 + answeredSoon * 4 + newOther * 2 - blanks.length) - pen);
}

/** 全局最佳搜寻目标：所有已收集且有剩余搜寻的词条中，候选卡优先级最高者。
 *  词条库红点导航用（一直点红点即最佳路径）；平手按词条定义序、卡序取早，保证确定性 */
export function bestSearchTarget(s?: GameState): { entryId: string; priority: number } | null {
  const st = s ?? getState();
  const ctx = buildSearchCtx(st);
  let best: { entryId: string; priority: number } | null = null;
  for (const entryId of Object.keys(data.entries)) {
    if (!st.entries[entryId]?.collected) continue;
    for (const c of searchableCards(entryId, st.level)) {
      if (st.cards[c.id]?.unlocked) continue;
      const p = searchPriority(c, st, ctx);
      if (!best || p > best.priority) best = { entryId, priority: p };
    }
  }
  return best;
}

export function searchEntry(entryId: string): void {
  const s = clone(getState());
  const e = s.entries[entryId];
  if (!e?.collected) return;
  const cost = data.meta.stamina.searchCost;
  if (s.stamina < cost) {
    pushToast(tr('toast.noStamina'));
    playCue('blocked');
    return;
  }
  const candidates = searchableCards(entryId, s.level).filter((c) => !s.cards[c.id]?.unlocked);
  if (candidates.length === 0) {
    pushToast(tr('toast.searchEmpty'));
    playCue('info');
    return;
  }
  const ctx = buildSearchCtx(s);
  let card = candidates[0];
  let best = searchPriority(card, s, ctx);
  for (const c of candidates.slice(1)) {
    const p = searchPriority(c, s, ctx);
    if (p > best) {
      best = p;
      card = c;
    }
  }
  s.stamina -= cost;
  const cs = ensureCard(s, card.id);
  cs.unlocked = true;
  cs.unlockedAt = Date.now();
  s.selectedCardId = card.id;
  s.tab = 'cards';
  // 搜寻提示可能已被「知道了」提前关掉；真正搜到第一张新卡时，仍要点亮后续引导
  const teachNew = !s.flags.coachSeen?.newCard;
  markCoach(s, 'search');
  setState(s);
  if (teachNew) armCoach('newCard', card.id, 360);
  pushToast(tr('toast.searchGot'));
  playCue('receive');
}

// ---------- 词条点击 ----------

/** 点击词条 chip；返回是否有新收集（首次收入或本卡熟悉度 +1），供飞行光点动效判断 */
export function clickEntry(entryId: string, cardId?: string): boolean {
  const def = entryDef(entryId);
  if (!def) return false;
  const s = clone(getState());
  const e = ensureEntry(s, entryId);
  let msg = '';
  const firstCollect = !e.collected;
  if (firstCollect) {
    e.collected = true;
    msg = tr('toast.entryIn', { name: def.name });
  }
  let collectedHere = false;
  let famUp = false;
  if (cardId) {
    const cs = s.cards[cardId];
    // 打勾（famCards）与熟悉度自增解耦：熟悉度已满时点击仍记录本卡已点，避免"点击无效"的困惑
    if (cs?.unlocked && !e.famCards.includes(cardId)) {
      e.famCards.push(cardId);
      collectedHere = true;
      if (e.familiarity < familiarMaxOf(entryId, s.level)) {
        e.familiarity++;
        famUp = true;
        msg = msg ? tr('toast.famJoin', { base: msg }) : tr('toast.famUp', { name: def.name });
      } else if (!msg) {
        msg = tr('toast.famFull', { name: def.name });
      }
    }
  }
  const teachChip = !s.flags.coachSeen?.chip;
  const teachEntry = !s.flags.coachSeen?.entryCard && (firstCollect || collectedHere);
  if (teachChip) markCoach(s, 'chip');
  setState(s);
  if (collectedHere && cardId) pulseFx(`entry:${cardId}:${entryId}`);
  if (msg) pushToast(msg);
  if (firstCollect) playCue('reward');
  else if (famUp) playCue('check');
  if (teachEntry) armCoach('entryCard', entryId, COACH_FLY_MS);
  return firstCollect || collectedHere;
}

// ---------- 填卡 ----------

export function setSlotDraft(cardId: string, slot: string, entryId: string): void {
  const s = clone(getState());
  const cs = s.cards[cardId];
  if (!cs?.unlocked || cs.done || cs.slotLocked[slot]) return;
  cs.slotDraft[slot] = entryId;
  setState(s);
  sfxCommitSelect();
}

export function verifyCard(cardId: string): void {
  const def = cardDef(cardId);
  const s = clone(getState());
  const cs = s.cards[cardId];
  if (!def || !cs?.unlocked || cs.done) return;
  if (getUi().hintPeek?.cardId === cardId) return; // 「⚡提示」震动预览中不可验证
  let wrong = 0;
  let right = 0;
  for (const b of def.blanks) {
    if (cs.slotLocked[b.slot]) continue;
    const d = cs.slotDraft[b.slot];
    if (!d) continue;
    if (blankAnswers(b).includes(d)) {
      cs.slotLocked[b.slot] = true;
      right++;
    } else {
      delete cs.slotDraft[b.slot];
      wrong++;
    }
  }
  if (wrong > 0) {
    s.stats.errors += wrong;
    perLevel(s).errors += wrong;
  }
  let doneNow = false;
  let locks = { rows: [] as number[], cols: [] as number[], cluster: [] as string[] };
  if (wrong === 0 && !cs.done && def.blanks.every((b) => cs.slotLocked[b.slot])) {
    cs.done = true;
    cs.doneAt = Date.now();
    doneNow = true;
    s.stamina += data.meta.stamina.completeReward;
    for (const b of def.blanks) {
      // 数组答案（多地点）：给玩家选中的那个词条记熟悉度；未选（旧锁定空）取首个
      const chosen = cs.slotDraft[b.slot] && blankAnswers(b).includes(cs.slotDraft[b.slot])
        ? cs.slotDraft[b.slot]
        : blankAnswers(b)[0];
      const e = ensureEntry(s, chosen);
      if (e.familiarity < familiarMaxOf(chosen, def.level)) e.familiarity++;
    }
    locks = applyTimelineLocks(s, def.level);
  }
  setState(s);
  if (wrong > 0) {
    pulseFx('shake:' + cardId);
    pushToast(tr('toast.verifyFail'));
    playCue('error');
  } else if (doneNow) {
    pulseFx('glow:' + cardId);
    pushToast(tr('toast.cardDone', { n: data.meta.stamina.completeReward }));
    const hadLock = locks.rows.length > 0 || locks.cols.length > 0 || locks.cluster.length > 0;
    playCue(hadLock ? 'checkpoint' : 'complete');
  } else if (right > 0) {
    pulseFx('glow:' + cardId);
    pushToast(tr('toast.verifyPartial'));
    playCue('success');
  } else {
    pushToast(tr('toast.verifyEmpty'));
    playCue('info');
  }
  fxTimelineLocks(def.level, locks);
}

export const HINT_COST = 1; // 「⚡提示」每次消耗体力
export const HINT_PEEK_MS = 3000; // 未收集空位亮出答案的时长

let hintPeekTimer: number | null = null;

/** 收起「⚡提示」的临时答案预览（计时到 / 切卡 / 离开页面 / 页面失焦都会调） */
export function clearHintPeek(): void {
  if (hintPeekTimer != null) {
    window.clearTimeout(hintPeekTimer);
    hintPeekTimer = null;
  }
  if (getUi().hintPeek) setUi({ hintPeek: null });
}

/**
 * 情节卡「⚡提示」（−1 体力）：逐个核对本卡未锁定的空位——
 * - 答案词条已收集但空着 / 填错的 → 直接替玩家填成正确草稿，并闪烁提示；
 * - 答案词条一个都没收集到的 → 临时亮出正确答案并轻微左右震动 3s（`ui.hintPeek`），期间提示按钮显示「尚未收集」、不可验证，
 *   到时（或离开本卡 / 页面失焦）还原为未填状态。
 * 所有空位都已填对时不扣体力，只提示直接验证。
 */
export function hintCard(cardId: string): void {
  const def = cardDef(cardId);
  const s = clone(getState());
  const cs = s.cards[cardId];
  if (!def || !cs?.unlocked || cs.done) return;
  if (getUi().hintPeek?.cardId === cardId) return; // 震动预览中不重复触发
  const filled: string[] = [];
  const peek: Record<string, string> = {};
  for (const b of def.blanks) {
    if (cs.slotLocked[b.slot]) continue;
    const answers = blankAnswers(b);
    const draft = cs.slotDraft[b.slot];
    if (draft && answers.includes(draft)) continue; // 已填对
    const collected = answers.find((id) => s.entries[id]?.collected);
    if (collected) {
      cs.slotDraft[b.slot] = collected;
      filled.push(b.slot);
    } else {
      // 困难难度：未收集的地名不透露具体是什么（空串 = 只震动不亮答案）
      peek[b.slot] = b.kind === 'place' && !isEasy(s) ? '' : answers[0];
    }
  }
  commitHint(s, cardId, filled, peek);
}

/**
 * 「⚡提示」的收尾（情节卡与档案页共用）：没有可做的 → 只提示；否则扣体力、记次数，
 * 替填的位置闪一下（`ui.hintFlash`），未收集的位置亮答案震 3s（`ui.hintPeek`）。
 * key 是作用域：情节卡用 cardId，档案页用 `arc:{entryId}:{pageIdx}`（两者不会撞名）。
 */
function commitHint(s: GameState, key: string, filled: string[], peek: Record<string, string>): void {
  const peekSlots = Object.keys(peek);
  if (filled.length === 0 && peekSlots.length === 0) {
    pushToast(tr('toast.hintNothing'));
    playCue('info');
    return;
  }
  if (s.stamina < HINT_COST) {
    pushToast(tr('toast.noStamina'));
    playCue('error');
    return;
  }
  s.stamina -= HINT_COST;
  s.stats.hints++;
  perLevel(s).hints++;
  setState(s);
  if (filled.length > 0) {
    setUi({ hintFlash: { cardId: key, slots: filled, at: Date.now() } });
    pushToast(tr('toast.hintFill', { n: filled.length }));
  }
  if (peekSlots.length > 0) {
    clearHintPeek();
    setUi({ hintPeek: { cardId: key, slots: peek, until: Date.now() + HINT_PEEK_MS } });
    hintPeekTimer = window.setTimeout(() => {
      hintPeekTimer = null;
      clearHintPeek();
    }, HINT_PEEK_MS);
    pushToast(tr('toast.hintPeek', { n: peekSlots.length }));
    playCue('error');
  } else {
    playCue('success');
  }
}

/** 档案页「⚡提示」的作用域键（`ui.hintPeek / hintFlash` 里的 cardId 字段） */
export const arcHintKey = (entryId: string, pageIdx: number): string => `arc:${entryId}:${pageIdx}`;

/**
 * 档案页「⚡提示」（−1 体力）：规则同情节卡——空位答案已收集则直接替填（闪烁），
 * 未收集则亮出答案震 3s 后还原（困难难度下地名只震不亮）；全对时不扣体力。
 * slots 以字段下标（字符串）为键。
 */
export function hintArchivePage(entryId: string, pageIdx: number): void {
  const def = entryDef(entryId);
  const page = def?.archive?.[pageIdx];
  if (!def || !page) return;
  const key = arcHintKey(entryId, pageIdx);
  if (getUi().hintPeek?.cardId === key) return;
  const s = clone(getState());
  const e = ensureEntry(s, entryId);
  if (!e.pagesUnlocked.includes(pageIdx) || e.pagesDone.includes(pageIdx)) return;
  const filled: string[] = [];
  const peek: Record<string, string> = {};
  page.fields.forEach((f, fi) => {
    if (!f.blank) return;
    const k = pageIdx + ':' + fi;
    const cur = e.pageFields[k];
    if (cur?.locked || cur?.draft === f.blank.answer) return;
    if (s.entries[f.blank.answer]?.collected) {
      e.pageFields[k] = { draft: f.blank.answer, locked: false };
      filled.push(String(fi));
    } else {
      peek[String(fi)] = f.blank.pool === 'place' && !isEasy(s) ? '' : f.blank.answer;
    }
  });
  commitHint(s, key, filled, peek);
}

// ---------- 时间轴 ----------

export function cardAtCell(s: GameState, lv: number, row: number, col: number): string | null {
  for (const c of cardsOfLevel(lv)) {
    const cs = s.cards[c.id];
    if (cs?.pos && cs.pos.row === row && cs.pos.col === col) return c.id;
  }
  return null;
}

// 已锁定的卡也可点选（用于展示「阅读」入口），但不可作为放置来源（placeSelected 会兜底清选）
export function selectChip(cardId: string): void {
  const cs = getState().cards[cardId];
  if (!cs?.unlocked) return;
  const next = getUi().timelineSel === cardId ? null : cardId;
  setUi({ timelineSel: next });
  playCue(next ? 'select' : 'deselect');
}

/** 行头时间点名默认隐藏（防剧透，只显示「时间 N」）：花 1 体力提前揭示；
 *  整行全部补完且放对（锁定）时自动揭示——由渲染层按 rowStats 推导，不入档 */
export function revealRowName(row: number): void {
  const s = clone(getState());
  s.rowHints ??= {};
  const arr = (s.rowHints[String(s.level)] ??= []);
  if (arr.includes(row)) return;
  if (s.stamina < 1) {
    pushToast(tr('toast.noStamina'));
    playCue('blocked');
    return;
  }
  s.stamina -= 1;
  arr.push(row);
  setState(s);
  pushToast(tr('toast.rowHint', { name: timelineOf(s.level).rows[row] }));
  playCue('unlock');
}

/** 词条库分类计数：n = 已收集数（跨关累计）；
 *  max = 本关可收集 ∪ 此前已收集——之前关卡拿到的即使本关不出场也计入，
 *  且本关全部收集后必然 n === max（漏收的旧词条不会把上限抬到够不着） */
export function typeCollectCount(type: EntryType, s: GameState): { n: number; max: number } {
  const collectible = collectibleEntriesOfLevel(s.level);
  let n = 0;
  let max = 0;
  for (const [id, def] of Object.entries(data.entries)) {
    if (def.type !== type) continue;
    const got = !!s.entries[id]?.collected;
    if (got) n++;
    if (got || collectible.has(id)) max++;
  }
  return { n, max };
}

/** 词条库分类总数默认藏为「?」（防剧透）：花 1 体力揭示本关该分类的可收集总数 */
export function revealTypeCount(type: EntryType): void {
  const s = clone(getState());
  s.typeHints ??= {};
  const arr = (s.typeHints[String(s.level)] ??= []);
  if (arr.includes(type)) return;
  if (s.stamina < 1) {
    pushToast(tr('toast.noStamina'));
    playCue('blocked');
    return;
  }
  s.stamina -= 1;
  arr.push(type);
  setState(s);
  const { n, max } = typeCollectCount(type, s);
  pushToast(tr('toast.typeHint', { type: TYPE_LABEL[type], max, n }));
  playCue('unlock');
}

export function placeSelected(row: number, col: number): void {
  const selId = getUi().timelineSel;
  if (!selId) return;
  placeCard(selId, row, col);
}

/** 放置指定卡到格子（点选放置与拖拽放置共用） */
export function placeCard(selId: string, row: number, col: number): void {
  const selDef = cardDef(selId);
  const s = clone(getState());
  const sel = s.cards[selId];
  if (!selDef || !sel?.unlocked || sel.pos?.locked) {
    setUi({ timelineSel: null, tlDrag: null });
    return;
  }
  const occId = cardAtCell(s, selDef.level, row, col);
  if (occId === selId) {
    setUi({ timelineSel: null, tlDrag: null });
    return;
  }
  if (occId) {
    const occ = s.cards[occId];
    if (occ?.pos?.locked) {
      pushToast(tr('toast.cellLocked'));
      playCue('blocked');
      return;
    }
    // 交换：被挤出的残页回到待归位区（sel.pos 为 null 时）
    const tmp = occ!.pos!;
    occ!.pos = sel.pos;
    sel.pos = tmp;
  } else {
    sel.pos = { row, col, locked: false };
  }
  const locks = applyTimelineLocks(s, selDef.level);
  setState(s);
  setUi({ timelineSel: null, tlDrag: null });
  const landed = (id: string): boolean => {
    const d = cardDef(id);
    const st = s.cards[id];
    if (!d || !st?.pos || st.pos.locked) return false;
    const cc = correctCell(d);
    return st.pos.row === cc.row && st.pos.col === cc.col;
  };
  // 「单格放对」提示（成功音 + 格子金环）只在简单难度给；困难难度放对与放错手感一致，只有行/列/连片锁定才反馈
  const cellHint = isEasy(s);
  const anyCorrect = cellHint && (landed(selId) || !!(occId && landed(occId)));
  const hadLock = locks.rows.length > 0 || locks.cols.length > 0 || locks.cluster.length > 0;
  playCue(hadLock ? 'checkpoint' : anyCorrect ? 'success' : 'drop');
  fxTimelineLocks(selDef.level, locks);
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (cellHint && !reduce) {
    if (landed(selId)) pulseFx('tlok:' + selId);
    if (occId && landed(occId)) pulseFx('tlok:' + occId);
  }
}

// ---------- 分析 / 档案 ----------

/** 词条当前是否可分析：本关熟悉度满且本关有未解锁档案页 */
export function analyzable(entryId: string, s?: GameState): boolean {
  const st = s ?? getState();
  const def = entryDef(entryId);
  if (!def?.archive) return false;
  const e = st.entries[entryId];
  if (!e || e.familiarity < familiarMaxOf(entryId, st.level)) return false;
  return def.archive.some((p, i) => p.level === st.level && !e.pagesUnlocked.includes(i));
}

/** 分析按钮的展示状态：active 可分析 / done 本关及之前页已分析完 / wait 本关有页但熟悉度未满 / none 无档案 */
export function analyzeState(entryId: string, s: GameState): 'active' | 'done' | 'wait' | 'none' {
  const def = data.entries[entryId];
  if (!def?.archive || def.archive.length === 0) return 'none';
  if (analyzable(entryId, s)) return 'active';
  const hasPageLe = def.archive.some((p) => p.level <= s.level);
  const allLeUnlocked = def.archive.every((p, i) => p.level > s.level || s.entries[entryId]?.pagesUnlocked.includes(i));
  if (hasPageLe && allLeUnlocked) return 'done';
  const hasPageHere = def.archive.some((p) => p.level === s.level);
  return hasPageHere ? 'wait' : 'none';
}

export function analyzeEntry(entryId: string): void {
  if (!analyzable(entryId) || getUi().analyzing) return;
  setUi({ analyzing: entryId });
  playCue('start');
  const processing = startLoop('processing');
  setTimeout(() => {
    try {
      const s = clone(getState());
      const def = entryDef(entryId);
      const e = ensureEntry(s, entryId);
      const idx = def?.archive?.findIndex((p, i) => p.level === s.level && !e.pagesUnlocked.includes(i)) ?? -1;
      if (idx >= 0) {
        e.pagesUnlocked.push(idx);
        s.tab = 'archive';
        s.archiveFocus = entryId;
        setState(s);
        pushToast(tr('toast.archiveOpen'));
        playCue('complete');
      }
    } finally {
      stopLoop(processing);
      setUi({ analyzing: null });
    }
  }, 2000);
}

export function setArchiveDraft(entryId: string, pageIdx: number, fieldIdx: number, picked: string): void {
  const s = clone(getState());
  const e = ensureEntry(s, entryId);
  const key = pageIdx + ':' + fieldIdx;
  if (e.pageFields[key]?.locked) return;
  e.pageFields[key] = { draft: picked, locked: false };
  setState(s);
  sfxCommitSelect();
}

export function checkArchivePage(entryId: string, pageIdx: number): void {
  const def = entryDef(entryId);
  const page = def?.archive?.[pageIdx];
  if (!def || !page) return;
  if (getUi().hintPeek?.cardId === arcHintKey(entryId, pageIdx)) return; // 「⚡提示」震动预览中不可核对
  const s = clone(getState());
  const e = ensureEntry(s, entryId);
  let wrong = 0;
  let right = 0;
  page.fields.forEach((f, fi) => {
    if (!f.blank) return;
    const key = pageIdx + ':' + fi;
    const cur = e.pageFields[key];
    if (!cur || cur.locked || !cur.draft) return;
    if (cur.draft === f.blank.answer) {
      e.pageFields[key] = { draft: cur.draft, locked: true };
      right++;
    } else {
      e.pageFields[key] = { draft: null, locked: false };
      wrong++;
    }
  });
  if (wrong > 0) {
    s.stats.errors += wrong;
    perLevel(s).errors += wrong;
  }
  const allDone = page.fields.every((f, fi) => !f.blank || e.pageFields[pageIdx + ':' + fi]?.locked);
  let completed = false;
  if (allDone && !e.pagesDone.includes(pageIdx)) {
    e.pagesDone.push(pageIdx);
    completed = true;
  }
  setState(s);
  if (wrong > 0) {
    pulseFx(`shake:arc:${entryId}:${pageIdx}`);
    pushToast(tr('toast.archiveFail'));
    playCue('error');
  } else if (completed) {
    pulseFx(`seal:${entryId}:${pageIdx}`);
    pushToast(tr('toast.archiveDone'));
    playCue('complete');
  } else if (right > 0) {
    pushToast(tr('toast.archivePartial'));
    playCue('success');
  } else {
    pushToast(tr('toast.archiveEmpty'));
    playCue('info');
  }
}

// ---------- 闸门 ----------

export interface GateChecklist {
  locked: number;
  cardsTotal: number;
  pagesDone: number;
  pagesTotal: number;
  progress: number; // 加权进度 0..1：归位×25 + 档案×10；>=0.7 开闸，=1 解锁自动填写
  ok: boolean;
}

export function gateChecklist(lv: number, s?: GameState): GateChecklist {
  const st = s ?? getState();
  const cards = cardsOfLevel(lv);
  const locked = cards.filter((c) => st.cards[c.id]?.pos?.locked).length;
  const pages = archivePagesOfLevel(lv);
  const pagesDone = pages.filter((p) => st.entries[p.entryId]?.pagesDone.includes(p.pageIdx)).length;
  // 归位权重为档案的 2.5 倍（25:10）
  const total = cards.length * 25 + pages.length * 10;
  const progress = total > 0 ? (locked * 25 + pagesDone * 10) / total : 1;
  return {
    locked,
    cardsTotal: cards.length,
    pagesDone,
    pagesTotal: pages.length,
    progress,
    ok: progress >= 0.7,
  };
}

function ensureGate(s: GameState, after: number): GateState {
  const g = gateAfterLevel(after)!;
  return (s.gates[String(after)] ??= {
    blanks: g.blanks.map(() => ({ draft: null, locked: false })),
    passed: false,
    stars: 0,
    score: 0,
  });
}

// ---------- 难度与星级（README_game §5） ----------
// 分数 = MaxScore − Deduction（最低 0），再化成 ★ 显示。
// MaxScore：简单 3；困难 5；本关完成度 ≥20% 后才从简单切到困难 → 4（perLevel.hardLate）。
// Deduction：本关每 3 次错误 +1、每 3 次休整 +1；两个计数都按关记，过关即换新关计数。

export const STAR_STEP = 3; // 每 3 次错误 / 休整扣一星
export const HARD_LATE_PROGRESS = 0.2; // 本关完成度达到这个比例后再切困难，满星只按 4 计
export const MAX_STARS_EASY = 3;
export const MAX_STARS_HARD = 5;
export const MAX_STARS_HARD_LATE = 4;

export interface StarBreakdown {
  max: number;
  errors: number;
  rests: number;
  errDed: number;
  restDed: number;
  stars: number;
}

function levelStatsOf(s: GameState, lv: number): LevelStats {
  const pl = s.stats.perLevel[String(lv)];
  return { errors: pl?.errors ?? 0, hints: pl?.hints ?? 0, rests: pl?.rests ?? 0, hardLate: pl?.hardLate };
}

/** 某关此刻的满星数（按当前难度与该关是否「迟切困难」） */
export function maxStarsOf(s: GameState = getState(), lv: number = s.level): number {
  if (s.difficulty !== 'hard') return MAX_STARS_EASY;
  return levelStatsOf(s, lv).hardLate ? MAX_STARS_HARD_LATE : MAX_STARS_HARD;
}

/** 某关此刻的星级明细：满星、错误/休整次数与各自扣星、当前星数 */
export function starBreakdown(s: GameState = getState(), lv: number = s.level): StarBreakdown {
  const pl = levelStatsOf(s, lv);
  const max = maxStarsOf(s, lv);
  const errDed = Math.floor(pl.errors / STAR_STEP);
  const restDed = Math.floor(pl.rests / STAR_STEP);
  return { max, errors: pl.errors, rests: pl.rests, errDed, restDed, stars: Math.max(0, max - errDed - restDed) };
}

/** 某关此刻的星数（0..满星） */
export function liveStars(s: GameState = getState(), lv: number = s.level): number {
  return starBreakdown(s, lv).stars;
}

/** 简单 → 困难 是否需要先确认（本关完成度已 ≥20%，切过去满星只按 4 计） */
export function hardSwitchLate(s: GameState = getState()): boolean {
  return gateChecklist(s.level, s).progress >= HARD_LATE_PROGRESS;
}

/** 切换难度。困难 → 简单随时可切；简单 → 困难时若本关完成度 ≥20%，本关记 hardLate（满星 4） */
export function setDifficulty(next: Difficulty): void {
  const s = clone(getState());
  if (s.difficulty === next) return;
  if (next === 'hard' && hardSwitchLate(s)) perLevel(s).hardLate = true;
  s.difficulty = next;
  setState(s);
  pushToast(tr(next === 'hard' ? 'toast.diffHard' : 'toast.diffEasy'));
  playCue('toggle-on');
}

/** 简单难度才给的引导：列表「可填写」、最佳搜寻红圈、单格放对提示、提示亮出未收集的地名 */
export const isEasy = (s: GameState = getState()): boolean => s.difficulty !== 'hard';

/** 关卡得分 = round(100 × 闸门进度) + 星级加成（每星 100：5/4/3/2/1/0 → 500/400/300/200/100/0） */
function gateScore(progress: number, stars: number): number {
  return Math.round(progress * 100) + stars * 100;
}

export function setGateDraft(after: number, idx: number, key: string): void {
  const s = clone(getState());
  const g = ensureGate(s, after);
  if (g.passed || g.blanks[idx]?.locked) return;
  g.blanks[idx].draft = key;
  setState(s);
  sfxCommitSelect();
}

/** 闸门候选池：档案页（level≤当前关）均完成的词条 / 已归位揭示的卡标题 */
export function gateCandidates(after: number, s?: GameState) {
  const st = s ?? getState();
  // 候选应包含玩家已收集的全部词条（此前误按「档案是否补完」过滤，会漏掉正确答案）
  const entries = Object.entries(data.entries).filter(([id]) => !!st.entries[id]?.collected);
  const titles = data.cards.filter((c) => st.cards[c.id]?.pos?.locked);
  return { entries, titles };
}

export function checkGate(after: number): void {
  const gd = gateAfterLevel(after);
  if (!gd) return;
  const s = clone(getState());
  const g = ensureGate(s, after);
  let wrong = 0;
  let right = 0;
  gd.blanks.forEach((b, i) => {
    const cur = g.blanks[i];
    if (!cur || cur.locked || !cur.draft) return;
    const want = b.answerEntry ? 'entry:' + b.answerEntry : 'title:' + b.answerTitle;
    if (cur.draft === want) {
      cur.locked = true;
      right++;
    } else {
      cur.draft = null;
      wrong++;
    }
  });
  if (wrong > 0) {
    s.stats.errors += wrong;
    perLevel(s).errors += wrong;
  }
  const all = g.blanks.every((b) => b.locked);
  if (all && !g.passed) {
    const sb = starBreakdown(s, after);
    g.maxStars = sb.max;
    g.stars = sb.stars;
    g.score = gateScore(gateChecklist(after, s).progress, g.stars);
    g.passed = true;
  }
  setState(s);
  if (wrong > 0) {
    pushToast(tr('toast.gateFail'));
    playCue('error');
    return;
  }
  if (g.passed) {
    setUi({ gateFx: { stars: g.stars, max: g.maxStars ?? MAX_STARS_EASY, gate: after } });
    playCue(after >= maxLevel ? 'achievement' : 'level-up');
    setTimeout(() => advanceAfterGate(after), 2200);
  } else if (right > 0) {
    pushToast(tr('toast.gatePartial'));
    playCue('success');
  } else {
    pushToast(tr('toast.gateEmpty'));
    playCue('info');
  }
}

/** 自动填写：进度 100% 时可用，把全部正确答案填入选中态（不锁定、不提交），
 * 仍由玩家自己点「核对答案」；纯福利，不影响评级与得分 */
export function autoFillGate(after: number): void {
  const gd = gateAfterLevel(after);
  const chk = gateChecklist(after);
  if (!gd || !chk.ok || chk.progress < 1) return;
  const s = clone(getState());
  const g = ensureGate(s, after);
  if (g.passed) return;
  gd.blanks.forEach((b, i) => {
    if (!g.blanks[i].locked) g.blanks[i].draft = b.answerEntry ? 'entry:' + b.answerEntry : 'title:' + b.answerTitle!;
  });
  setState(s);
  pushToast(tr('toast.gateAuto'));
  playCue('info');
}

/** 过关后：非末关进下一关过场，末关进结局 */
function advanceAfterGate(after: number): void {
  sfxSkipLayer();
  setUi({ gateFx: null, reviewLevel: null, reviewCard: null, recapLevel: null });
  const s = clone(getState());
  if (after >= maxLevel) {
    s.screen = 'ending';
    s.endingIdx = 0;
    s.stats.finishedAt = Date.now();
  } else {
    const next = after + 1;
    s.stamina += data.meta.stamina.perLevel;
    startLevel(s, next);
    s.introLevel = next;
    s.introIdx = 0;
    s.tab = 'cards';
  }
  setState(s);
}

// ---------- 体力 ----------

export function rest(): void {
  const s = clone(getState());
  s.stamina += data.meta.stamina.restGain;
  s.stats.rests++;
  perLevel(s).rests++;
  setState(s);
  pushToast(tr('toast.rested', { n: data.meta.stamina.restGain }));
  playCue('reward');
}

// ---------- 常驻提示（状态推导，永不为空） ----------

export interface HintItem {
  text: string;
  act?: () => void;
}

export function currentHints(): HintItem[] {
  const s = getState();
  const out: HintItem[] = [];
  // 首条固定是本卷之问：提醒玩家这一关到底在解什么（README_game §4.5）
  const q = levelQuestion(s.level);
  if (q) out.push({ text: tr('hint.question', { q }) });
  const undone = cardsOfLevel(s.level).filter((c) => s.cards[c.id]?.unlocked && !s.cards[c.id]?.done);
  if (undone.length > 0) {
    out.push({ text: tr('hint.undone', { n: undone.length }), act: () => selectCard(undone[0].id) });
  }
  const ana = Object.keys(data.entries).filter((id) => analyzable(id, s));
  if (ana.length > 0) out.push({ text: tr('hint.analyze', { name: entryDef(ana[0])!.name }) });
  // 搜寻建议与词条库红点一致：指向优先级最高的词条（最佳路径）
  const bestSearch = bestSearchTarget(s);
  if (bestSearch && s.stamina > 0) {
    out.push({ text: tr('hint.search', { name: entryDef(bestSearch.entryId)!.name }) });
  }
  const misplaced = cardsOfLevel(s.level).filter((c) => {
    const cs = s.cards[c.id];
    return cs?.done && !cs.pos?.locked;
  });
  if (misplaced.length > 0) out.push({ text: tr('hint.place'), act: () => setTab('timeline') });
  const arc = archivePagesOfLevel(s.level).filter((p) => {
    const e = s.entries[p.entryId];
    return e?.pagesUnlocked.includes(p.pageIdx) && !e.pagesDone.includes(p.pageIdx);
  });
  if (arc.length > 0) {
    out.push({
      text: tr('hint.archive', { name: entryDef(arc[0].entryId)!.name }),
      act: () => setArchiveFocus(arc[0].entryId),
    });
  }
  if (gateChecklist(s.level, s).ok) {
    out.push({ text: tr('hint.gate'), act: () => setTab('timeline') });
  }
  // 「下一步做什么」永不为空：只有本卷之问那一条时也要给一条可操作的兜底
  if (out.length <= (q ? 1 : 0)) out.push({ text: tr('hint.fallback') });
  return out;
}

// ---------- 调试动作（?debug=1 面板与 window.__game 使用） ----------

export function debugUnlockLevel(): void {
  const s = clone(getState());
  for (const c of cardsOfLevel(s.level)) {
    const cs = ensureCard(s, c.id);
    if (!cs.unlocked) {
      cs.unlocked = true;
      cs.unlockedAt = Date.now();
    }
  }
  setState(s);
  pushToast(tr('toast.debugUnlock'));
}

export function debugFillLevel(): void {
  const s = clone(getState());
  for (const c of cardsOfLevel(s.level)) {
    const cs = ensureCard(s, c.id);
    if (!cs.unlocked) cs.unlockedAt = Date.now();
    if (!cs.done) cs.doneAt = Date.now();
    cs.unlocked = true;
    cs.done = true;
    cs.read = true;
    for (const b of c.blanks) cs.slotLocked[b.slot] = true;
    const cc = correctCell(c);
    for (const other of cardsOfLevel(s.level)) {
      if (other.id === c.id) continue;
      const os = s.cards[other.id];
      if (os?.pos && os.pos.row === cc.row && os.pos.col === cc.col) os.pos = null;
    }
    cs.pos = { row: cc.row, col: cc.col, locked: true };
  }
  for (const p of archivePagesOfLevel(s.level)) {
    const e = ensureEntry(s, p.entryId);
    e.collected = true;
    if (!e.pagesUnlocked.includes(p.pageIdx)) e.pagesUnlocked.push(p.pageIdx);
    p.page.fields.forEach((f, fi) => {
      if (f.blank) e.pageFields[p.pageIdx + ':' + fi] = { draft: f.blank.answer, locked: true };
    });
    if (!e.pagesDone.includes(p.pageIdx)) e.pagesDone.push(p.pageIdx);
  }
  setState(s);
  pushToast(tr('toast.debugFill'));
}

export function debugStamina(): void {
  const s = clone(getState());
  s.stamina = 99;
  setState(s);
}

/** DEBUG：改本关错误次数（评星用本关累计） */
export function debugSetLevelErrors(n: number): void {
  const s = clone(getState());
  perLevel(s).errors = Math.max(0, Math.floor(n) || 0);
  setState(s);
}

/** DEBUG：改本关休整次数（评星用本关累计） */
export function debugSetRests(n: number): void {
  const s = clone(getState());
  perLevel(s).rests = Math.max(0, Math.floor(n) || 0);
  setState(s);
}

/** 收集本关全部词条并把熟悉度读满（档案随即全部可分析） */
export function debugCollectEntries(): void {
  const s = clone(getState());
  let n = 0;
  for (const id of Object.keys(data.entries)) {
    const max = familiarMaxOf(id, s.level);
    const e = ensureEntry(s, id);
    if (!e.collected || e.familiarity < max) n++;
    e.collected = true;
    e.familiarity = Math.max(e.familiarity, max);
  }
  setState(s);
  pushToast(tr('toast.debugEntries', { n }));
}

/** 已解锁但未补完的卡：一键填写全部正确答案（不归位，可继续测试时间轴） */
export function debugSolveUnlocked(): void {
  const s = clone(getState());
  let n = 0;
  for (const c of cardsOfLevel(s.level)) {
    const cs = s.cards[c.id];
    if (!cs?.unlocked || cs.done) continue;
    for (const b of c.blanks) {
      cs.slotDraft[b.slot] = blankAnswers(b)[0];
      cs.slotLocked[b.slot] = true;
      const e = ensureEntry(s, blankAnswers(b)[0]);
      e.collected = true;
    }
    cs.done = true;
    cs.read = true;
    cs.doneAt = Date.now();
    n++;
  }
  applyTimelineLocks(s, s.level);
  setState(s);
  pushToast(n > 0 ? tr('toast.debugSolve', { n }) : tr('toast.debugSolveNone'));
}

/** 已补完的卡：一键放到时间轴正确格并锁定 */
export function debugPlaceDone(): void {
  const s = clone(getState());
  let n = 0;
  for (const c of cardsOfLevel(s.level)) {
    const cs = s.cards[c.id];
    if (!cs?.done || cs.pos?.locked) continue;
    const cc = correctCell(c);
    for (const other of cardsOfLevel(s.level)) {
      if (other.id === c.id) continue;
      const os = s.cards[other.id];
      if (os?.pos && !os.pos.locked && os.pos.row === cc.row && os.pos.col === cc.col) os.pos = null;
    }
    cs.pos = { row: cc.row, col: cc.col, locked: true };
    n++;
  }
  setState(s);
  pushToast(n > 0 ? tr('toast.debugPlace', { n }) : tr('toast.debugPlaceNone'));
}

/** 本关全部档案页直接解锁（跳过熟悉度与分析读条；留白仍需玩家补全） */
export function debugUnlockArchives(): void {
  const s = clone(getState());
  let n = 0;
  for (const p of archivePagesOfLevel(s.level)) {
    const e = ensureEntry(s, p.entryId);
    e.collected = true;
    if (!e.pagesUnlocked.includes(p.pageIdx)) {
      e.pagesUnlocked.push(p.pageIdx);
      n++;
    }
  }
  setState(s);
  pushToast(n > 0 ? tr('toast.debugArc', { n }) : tr('toast.debugArcNone'));
}

export function debugJumpLevel(lv: number): void {
  setUi({ reviewLevel: null, reviewCard: null, recapLevel: null });
  const s = clone(getState());
  s.stamina += data.meta.stamina.perLevel;
  startLevel(s, lv);
  s.tab = 'cards';
  s.introLevel = null;
  s.flags.introSeen[String(lv)] = true;
  s.screen = 'game';
  setState(s);
}

/** 直达结局前态：全卡归位、全档案完成、末关闸门前置满足 */
export function debugPreEnding(): void {
  const s = clone(getState());
  for (const c of data.cards) {
    const cs = ensureCard(s, c.id);
    if (!cs.unlocked) cs.unlockedAt = Date.now();
    if (!cs.done) cs.doneAt = Date.now();
    cs.unlocked = true;
    cs.done = true;
    cs.read = true;
    for (const b of c.blanks) cs.slotLocked[b.slot] = true;
    const cc = correctCell(c);
    cs.pos = { row: cc.row, col: cc.col, locked: true };
  }
  for (const [id, def] of Object.entries(data.entries)) {
    const e = ensureEntry(s, id);
    e.collected = true;
    e.familiarity = familiarMaxOf(id, maxLevel);
    (def.archive || []).forEach((p, i) => {
      if (!e.pagesUnlocked.includes(i)) e.pagesUnlocked.push(i);
      p.fields.forEach((f, fi) => {
        if (f.blank) e.pageFields[i + ':' + fi] = { draft: f.blank.answer, locked: true };
      });
      if (!e.pagesDone.includes(i)) e.pagesDone.push(i);
    });
  }
  for (const g of data.gates) {
    const gs = ensureGate(s, g.after);
    if (g.after < maxLevel) {
      gs.passed = true;
      gs.maxStars = maxStarsOf(s, g.after);
      gs.stars = gs.maxStars;
    }
  }
  s.level = maxLevel;
  s.stamina = 99;
  s.screen = 'game';
  s.tab = 'timeline';
  s.introLevel = null;
  s.flags = {
    introSeen: Object.fromEntries(Array.from({ length: maxLevel }, (_, i) => [String(i + 1), true])),
    coachSeen: allCoachSeen(),
  };
  setState(s);
}

export function debugClear(): void {
  restartToTitle();
}
