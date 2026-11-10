// 新手引导：聚光蒙版（按首次游玩路径分步）
// 1 落地情节卡页：目标弹窗（标题 = 本卷之问，正文 = 三行收获）→ 只介绍「情节卡」「时间轴」两个页签
// 2–7 情节卡：点词条 → 词条卡 → 填空 → 搜寻 → 新卡/体力 → 推荐搜寻对比
// 8 时间轴：归位 + 关卡出口
import { cardDef, cardsOfLevel, data, entryIdsInText, levelQuestion } from './data';
import { getState, getUi, setState, setUi } from './store';
import type { CardDef, GameState } from './types';

export type CoachId =
  | 'goal'
  | 'tabCards'
  | 'tabTimeline'
  | 'chip'
  | 'entryCard'
  | 'blank'
  | 'search'
  | 'newCard'
  | 'vitals'
  | 'searchDiff'
  | 'timelinePlace'
  | 'timelineGate';

export type CoachKind = 'spot' | 'modal' | 'demo';
export type CoachSide = 'above' | 'below' | 'left' | 'right';

export interface CoachStep {
  id: CoachId;
  kind: CoachKind;
  /** i18n key under coach.* */
  textKey: string;
  titleKey?: string;
  /** 动态标题（优先于 titleKey）：目标弹窗用本卷之问当标题 */
  titleText?: () => string | null;
  lineKeys?: string[];
  okKey?: string;
  prefer?: CoachSide;
  /** true = 镂空仅展示，不可点穿（介绍类）；false = 可点目标完成动作 */
  lockTarget?: boolean;
  /** 动态 CSS 选择器；缺省用 [data-coach-anchor=id] */
  selector?: () => string | null;
  when: (s: GameState) => boolean;
}

const seen = (s: GameState, id: CoachId): boolean => !!(s.flags.coachSeen ?? {})[id];

const goalDone = (s: GameState): boolean => seen(s, 'goal');

function openCard(s: GameState): CardDef | null {
  if (s.tab !== 'cards' || !s.selectedCardId) return null;
  const def = cardDef(s.selectedCardId);
  const cs = s.cards[s.selectedCardId];
  return def && cs?.unlocked && !cs.done ? def : null;
}

function hasEntryChip(s: GameState): boolean {
  const card = openCard(s);
  return !!card && card.segments.some((seg) => entryIdsInText(seg.text).length > 0);
}

function hasSearchable(s: GameState): boolean {
  for (const id of Object.keys(data.entries)) {
    if (!s.entries[id]?.collected) continue;
    for (const c of cardsOfLevel(s.level)) {
      if (s.cards[c.id]?.unlocked) continue;
      if (c.segments.some((seg) => seg.text.includes('{{' + id + '|'))) return true;
    }
  }
  return false;
}

/** 飞行光点约 700ms；再留一点着陆余韵 */
export const COACH_FLY_MS = 820;

export const STEPS: CoachStep[] = [
  {
    // 落地情节卡页即弹：标题是本卷之问（数据里没有时回退「你的目标」），三行讲收获而不是流程
    id: 'goal',
    kind: 'modal',
    titleKey: 'coach.goalTitle',
    titleText: () => levelQuestion(getState().level),
    textKey: 'coach.goalText',
    lineKeys: ['coach.goal1', 'coach.goal2', 'coach.goal3'],
    okKey: 'coach.start',
    when: (s) => !seen(s, 'goal') && s.tab === 'cards',
  },
  {
    id: 'tabCards',
    kind: 'spot',
    textKey: 'coach.tabCards',
    okKey: 'coach.next',
    prefer: 'below',
    lockTarget: true,
    selector: () => '.tab[data-tab="cards"]',
    when: (s) => s.tab === 'cards' && seen(s, 'goal') && !seen(s, 'tabCards'),
  },
  {
    id: 'tabTimeline',
    kind: 'spot',
    textKey: 'coach.tabTimeline',
    okKey: 'coach.next',
    prefer: 'below',
    lockTarget: true,
    selector: () => '.tab[data-tab="timeline"]',
    when: (s) => s.tab === 'cards' && seen(s, 'tabCards') && !seen(s, 'tabTimeline'),
  },
  {
    id: 'chip',
    kind: 'spot',
    textKey: 'coach.chip',
    okKey: 'coach.gotIt',
    prefer: 'below',
    lockTarget: false,
    selector: () => '.chat-body .entry-chip',
    when: (s) => goalDone(s) && s.tab === 'cards' && !seen(s, 'chip') && hasEntryChip(s),
  },
  {
    id: 'entryCard',
    kind: 'spot',
    textKey: 'coach.entryCard',
    okKey: 'coach.gotIt',
    prefer: 'left',
    lockTarget: true,
    selector: () => {
      const id = getUi().coachFocus;
      return id ? `[data-entry-id="${CSS.escape(id)}"]` : null;
    },
    when: (s) =>
      goalDone(s) &&
      !seen(s, 'entryCard') &&
      getUi().coachReady === 'entryCard' &&
      !!getUi().coachFocus,
  },
  {
    id: 'blank',
    kind: 'spot',
    textKey: 'coach.blank',
    okKey: 'coach.gotIt',
    prefer: 'above',
    lockTarget: true,
    selector: () => '[data-coach-anchor="blank"]',
    when: (s) => {
      if (!goalDone(s) || !seen(s, 'chip') || seen(s, 'blank') || s.tab !== 'cards') return false;
      // 点过词条后的说明；若跳过了 entryCard（点了「知道了」未点词条），chip 已看过也可出
      if (!seen(s, 'entryCard') && getUi().coachReady === 'entryCard') return false;
      const card = openCard(s);
      return !!card && card.blanks.length > 0;
    },
  },
  {
    id: 'search',
    kind: 'spot',
    textKey: 'coach.search',
    okKey: 'coach.gotIt',
    prefer: 'left',
    lockTarget: false,
    selector: () => {
      const bestBtn = document.querySelector('.entry-search[data-search-best]');
      const card = (bestBtn ?? document.querySelector('.entry-search'))?.closest('[data-entry-id]');
      const id = card?.getAttribute('data-entry-id');
      if (id) return `[data-entry-id="${CSS.escape(id)}"]`;
      return '[data-coach-anchor="search"]';
    },
    when: (s) => {
      if (!goalDone(s) || seen(s, 'search') || s.tab !== 'cards') return false;
      if (!seen(s, 'blank')) {
        const card = openCard(s);
        if (card && card.blanks.length > 0) return false;
        if (!seen(s, 'chip')) return false;
      }
      return hasSearchable(s);
    },
  },
  {
    id: 'newCard',
    kind: 'spot',
    textKey: 'coach.newCard',
    okKey: 'coach.gotIt',
    prefer: 'right',
    lockTarget: true,
    selector: () => {
      const id = getUi().coachFocus;
      return id ? `[data-card-item="${CSS.escape(id)}"]` : null;
    },
    when: (s) =>
      !seen(s, 'newCard') && getUi().coachReady === 'newCard' && !!getUi().coachFocus,
  },
  {
    id: 'vitals',
    kind: 'spot',
    textKey: 'coach.vitals',
    okKey: 'coach.gotIt',
    prefer: 'below',
    lockTarget: true,
    selector: () => '[data-coach-anchor="vitals"]',
    when: (s) => seen(s, 'newCard') && !seen(s, 'vitals'),
  },
  {
    id: 'searchDiff',
    kind: 'demo',
    titleKey: 'coach.searchDiffTitle',
    textKey: 'coach.searchDiff',
    okKey: 'coach.gotIt',
    when: (s) =>
      !seen(s, 'searchDiff') &&
      (getUi().coachReady === 'searchDiff' || (seen(s, 'vitals') && s.tab === 'cards')),
  },
  {
    id: 'timelinePlace',
    kind: 'spot',
    textKey: 'coach.timelinePlace',
    okKey: 'coach.next',
    prefer: 'right',
    lockTarget: true,
    selector: () => '[data-coach-anchor="timelinePlace"]',
    when: (s) => goalDone(s) && s.tab === 'timeline' && !seen(s, 'timelinePlace'),
  },
  {
    id: 'timelineGate',
    kind: 'spot',
    textKey: 'coach.timelineGate',
    okKey: 'coach.gotIt',
    prefer: 'left',
    lockTarget: true,
    selector: () => '[data-coach-anchor="timelineGate"], [data-gate-panel]',
    when: (s) =>
      goalDone(s) && s.tab === 'timeline' && seen(s, 'timelinePlace') && !seen(s, 'timelineGate'),
  },
];

const BY_ID = new Map(STEPS.map((st) => [st.id, st]));

export const coachStep = (id: CoachId): CoachStep | undefined => BY_ID.get(id);

export const coachText = (id: CoachId): string => BY_ID.get(id)?.textKey ?? '';

export const allCoachSeen = (): Record<string, boolean> =>
  Object.fromEntries(STEPS.map((st) => [st.id, true]));

export function activeCoach(s: GameState): CoachId | null {
  if (s.screen !== 'game' || s.introLevel != null) return null;
  for (const step of STEPS) {
    if (seen(s, step.id)) continue;
    if (step.when(s)) return step.id;
  }
  return null;
}

export function markCoach(s: GameState, ...ids: CoachId[]): void {
  s.flags.coachSeen ??= {};
  for (const id of ids) s.flags.coachSeen[id] = true;
}

export function dismissCoach(id: CoachId): void {
  const cur = getState();
  if (cur.flags.coachSeen?.[id]) return;
  const s = structuredClone(cur);
  markCoach(s, id);
  setState(s);
  const ui = getUi();
  const patch: { coachReady?: string | null; coachFocus?: string | null } = {};
  if (ui.coachReady === id) patch.coachReady = null;
  // 体力说明关掉后，马上接上「推荐 / 普通搜寻」对比
  if (id === 'vitals' && !s.flags.coachSeen?.searchDiff) patch.coachReady = 'searchDiff';
  if (Object.keys(patch).length) setUi(patch);
}

/** 延迟点亮某一步（等飞行光点 / 列表刷新） */
export function armCoach(id: CoachId, focus: string | null, delayMs: number): void {
  setUi({ coachFocus: focus, coachReady: null });
  window.setTimeout(() => {
    const s = getState();
    if (s.flags.coachSeen?.[id]) return;
    setUi({ coachFocus: focus, coachReady: id });
  }, delayMs);
}
