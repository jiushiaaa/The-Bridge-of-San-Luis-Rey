// 游戏数据入口：内联各作品 final_game.json，按 离线注入 __GAME_ID → URL ?game= → 默认 xdd 选择
import { getLocale, subscribeLocale, t, type Locale } from '../i18n';
import rawXdd from '../../../workspace/xidaduo/final_game.json?raw';
import rawXddDe from '../../../workspace/xidaduo/i18n/de/final_game.json?raw';
import rawXddEn from '../../../workspace/xidaduo/i18n/en/final_game.json?raw';
import rawXddEs from '../../../workspace/xidaduo/i18n/es/final_game.json?raw';
import rawXddFr from '../../../workspace/xidaduo/i18n/fr/final_game.json?raw';
import rawXddJa from '../../../workspace/xidaduo/i18n/ja/final_game.json?raw';
import rawXddKo from '../../../workspace/xidaduo/i18n/ko/final_game.json?raw';
import rawXddHi from '../../../workspace/xidaduo/i18n/hi/final_game.json?raw';
import rawXddTw from '../../../workspace/xidaduo/i18n/zh-TW/final_game.json?raw';
import rawBad from '../../../workspace/badblood/final_game.json?raw';
import rawMurder from '../../../workspace/murder/final_game.json?raw';
import rawWeicheng from '../../../workspace/WeiCheng_QianZhongShu/final_game.json?raw';
import type {
  ArchivePage,
  CardDef,
  CardForm,
  EntryDef,
  EntryType,
  GameData,
  RecapDef,
  TimelineDef,
} from './types';

// 离线单包只内联「当前作品」的数据：构建时经 VITE_ONLY_GAME 注入某个 id，
// 其余作品的 ?raw 导入因分支恒假被 Rollup 摇树移除；dev/未注入时内联全部，便于 ?game= 切换。
const ONLY = (import.meta.env as Record<string, string | undefined>).VITE_ONLY_GAME;
type LocalePack = Partial<Record<Locale, string>> & { 'zh-CN': string };

const xddPack = (): LocalePack => ({
  'zh-CN': rawXdd,
  de: rawXddDe,
  en: rawXddEn,
  es: rawXddEs,
  fr: rawXddFr,
  ja: rawXddJa,
  ko: rawXddKo,
  hi: rawXddHi,
  'zh-TW': rawXddTw,
});
const zhOnly = (raw: string): LocalePack => ({ 'zh-CN': raw });

const REGISTRY: Record<string, LocalePack> =
  ONLY === 'xdd'
    ? { xdd: xddPack() }
    : ONLY === 'bad'
      ? { bad: zhOnly(rawBad) }
      : ONLY === 'murder'
        ? { murder: zhOnly(rawMurder) }
        : ONLY === 'weicheng'
          ? { weicheng: zhOnly(rawWeicheng) }
          : {
              xdd: xddPack(),
              bad: zhOnly(rawBad),
              murder: zhOnly(rawMurder),
              weicheng: zhOnly(rawWeicheng),
            };

declare global {
  interface Window {
    /** 离线单文件版注入的游戏 id（build_offline.mjs 写入） */
    __GAME_ID?: string;
  }
}

function pickGameId(): string {
  if (typeof window !== 'undefined') {
    const injected = window.__GAME_ID;
    if (injected && REGISTRY[injected]) return injected;
    const q = new URLSearchParams(window.location.search).get('game');
    if (q && REGISTRY[q]) return q;
  }
  // 仅内联单作品时回退到该作品；否则默认悉达多
  return REGISTRY['xdd'] ? 'xdd' : Object.keys(REGISTRY)[0];
}

export const GAME_ID = pickGameId();

function pickRaw(locale: Locale): string {
  // 语言包走 i18n/{locale}/final_game.json；缺包回退简体
  const pack = REGISTRY[GAME_ID];
  return pack[locale] ?? pack['zh-CN'];
}

export const data: GameData = JSON.parse(pickRaw(getLocale()));

/** DEBUG 编辑器拉到的简体真源；非简体游玩时切回 zh-CN 用它，避免把语言包写回磁盘 */
let zhSource: GameData | null = null;
export const getZhSource = (): GameData | null => zhSource;
export function setZhSource(next: GameData | null): void {
  zhSource = next;
}

subscribeLocale((loc) => {
  if (loc === 'zh-CN' && zhSource) replaceGameData(zhSource);
  else replaceGameData(JSON.parse(pickRaw(loc)));
  if (typeof document !== 'undefined' && data.meta.title) document.title = data.meta.title;
});

// ---------- 基础查询 ----------

const cardMap = new Map<string, CardDef>(data.cards.map((c) => [c.id, c]));
const name2id = new Map<string, string>(Object.entries(data.entries).map(([id, e]) => [e.name, id]));

export const cardDef = (id: string): CardDef | undefined => cardMap.get(id);
export const entryDef = (id: string): EntryDef | undefined => data.entries[id];
export const cardsOfLevel = (lv: number): CardDef[] => data.cards.filter((c) => c.level === lv);
export const timelineOf = (lv: number): TimelineDef => data.timelines[String(lv)];
export const entryName2id = (name: string): string | undefined => name2id.get(name);
export const gateAfterLevel = (lv: number) => data.gates.find((g) => g.after === lv);
export const maxLevel = Math.max(...data.gates.map((g) => g.after));

/** 本卷之问（README_game §4.5）：无 question 的老数据回退到 intro；两者都空则 null */
export const levelQuestion = (lv: number): string | null => {
  const g = gateAfterLevel(lv);
  const q = (g?.question ?? g?.intro ?? '').trim();
  return q || null;
};

/** 过场总页数 = 正文段数 + 问句幕（有本卷之问才多这一屏） */
export const introPageCount = (lv: number): number => {
  const segs = data.frame.levelIntro[String(lv)] || [];
  return segs.length + (levelQuestion(lv) ? 1 : 0);
};

/** 作品全部关卡号（升序，一律从数据推导，绝不写死） */
export const allLevels = (): number[] =>
  Object.keys(data.timelines)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

/** 内容总监模式：作品已标 final，DEBUG 编辑时规范类问题只提示不拦截（README_game §9） */
export const directorMode = (): boolean => data.meta.status === 'final';

/** 素材路径转 URL（相对路径：dev/后端从根路径提供，离线版相对 html 所在目录）。
 *  DEBUG-文案 编辑器换图后 bumpAssetVersion 记录版本号，追加 ?v= 强制浏览器重新加载
 *  （仅编辑器上传后产生，离线版恒为空，不影响 file:// 加载） */
const assetVer = new Map<string, number>();

export const assetUrl = (p: string): string => {
  const rel = p.replace(/^\/+/, '');
  const v = assetVer.get(rel);
  return v ? `${rel}?v=${v}` : rel;
};

export function bumpAssetVersion(p: string): void {
  assetVer.set(p.replace(/^\/+/, ''), Date.now());
}

/** DEBUG-文案 编辑器：整体替换内存中的游戏数据并重建派生缓存。
 *  保持 data 对象引用不变（全工程直接引用 data），随后由调用方触发一次全量重渲染 */
export function replaceGameData(next: GameData): void {
  for (const k of Object.keys(data)) delete (data as unknown as Record<string, unknown>)[k];
  Object.assign(data, next);
  cardMap.clear();
  for (const c of data.cards) cardMap.set(c.id, c);
  name2id.clear();
  for (const [id, e] of Object.entries(data.entries)) name2id.set(e.name, id);
  famMaxCache.clear();
  collectibleCache.clear();
}

// ---------- 文本内联标记 ----------

const ENTRY_RE = /\{\{(e_[a-z0-9_]+)\|[^}]*\}\}/g;

/** 文本中提及的词条 id 列表 */
export function entryIdsInText(text: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  ENTRY_RE.lastIndex = 0;
  while ((m = ENTRY_RE.exec(text))) out.push(m[1]);
  return out;
}

/** 卡正文是否提及某词条 */
export const cardMentionsEntry = (card: CardDef, entryId: string): boolean =>
  card.segments.some((s) => s.text.includes('{{' + entryId + '|'));

/** 某关中可通过搜寻某词条解锁的卡（保持 cards 数组顺序） */
export const searchableCards = (entryId: string, lv: number): CardDef[] =>
  cardsOfLevel(lv).filter((c) => cardMentionsEntry(c, entryId));

/** 某关内词条的熟悉度上限 = 该关正文 tag 卡数 + 单一答案卡数（分关刷新，进场时熟悉度清零）。
 *  上限 = 本关来源数，不做容错折扣（实测 80% 容错体验不佳，已取消）。
 *  数组答案（多地点任一即对）不计入上限：补完只给所选词条 +1，计入会让未被选的词条永远攒不满 */
const famMaxCache = new Map<string, number>();
export function familiarMaxOf(entryId: string, lv: number): number {
  const key = entryId + ':' + lv;
  const hit = famMaxCache.get(key);
  if (hit !== undefined) return hit;
  let n = 0;
  for (const c of cardsOfLevel(lv)) {
    if (cardMentionsEntry(c, entryId) || c.blanks.some((b) => b.answer === entryId)) n++;
  }
  famMaxCache.set(key, n);
  return n;
}

/** 某关能收集到的全部词条 = 开局赠送 + 该关卡面正文中可点的 {{词条}}
 *  （空位答案必然满足其一，见 doc/07-content-authoring.md 的加卡红线） */
const collectibleCache = new Map<number, Set<string>>();
export function collectibleEntriesOfLevel(lv: number): Set<string> {
  const hit = collectibleCache.get(lv);
  if (hit) return hit;
  const out = new Set<string>(data.levelStartEntries[String(lv)] ?? []);
  for (const c of cardsOfLevel(lv)) {
    for (const seg of c.segments) for (const id of entryIdsInText(seg.text)) out.add(id);
  }
  collectibleCache.set(lv, out);
  return out;
}

/** 卡的正确格（行、列下标） */
export function correctCell(card: CardDef): { row: number; col: number } {
  const t = timelineOf(card.level);
  const col = t.cols.indexOf(card.col);
  return { row: card.row, col: col >= 0 ? col : 0 };
}

/** 去除内联标记后的纯文本（用于摘要） */
export function plainText(text: string): string {
  return text.replace(/\{\{e_[a-z0-9_]+\|([^}]*)\}\}/g, '$1').replace(/\[\[(NPC\d)\]\]/g, '$1');
}

/** 卷名：约定取 levelIntro 首段旁白（如「第一卷 · 弃家求道」） */
export function levelChapterTitle(lv: number): string {
  const intro = data.frame.levelIntro[String(lv)] || [];
  return intro[0] ? plainText(intro[0].text) : t('common.vol', { n: lv });
}

/** 首段超过这个字数就说明这部作品没按「第N卷 · 名字」的约定写，那一段是正文不是卷名 */
export const CHAPTER_TITLE_MAX = 16;

export function isChapterTitle(text: string): boolean {
  const dense = (text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const max = dense >= text.length * 0.4 ? CHAPTER_TITLE_MAX : 48;
  return text.length <= max;
}

/** 卷名短标签：拿不到合规卷名时退回「第N卷」，供页签这类窄处使用 */
export function levelChapterLabel(lv: number): string {
  const title = levelChapterTitle(lv);
  return isChapterTitle(title) ? title : t('common.vol', { n: lv });
}

// ---------- 档案 ----------

export interface ArchivePageRef {
  entryId: string;
  pageIdx: number;
  page: ArchivePage;
}

/** 某关的全部档案页 */
export function archivePagesOfLevel(lv: number): ArchivePageRef[] {
  const out: ArchivePageRef[] = [];
  for (const [entryId, def] of Object.entries(data.entries)) {
    (def.archive || []).forEach((page, pageIdx) => {
      if (page.level === lv) out.push({ entryId, pageIdx, page });
    });
  }
  return out;
}

// ---------- 回顾本关故事 ----------

export const recapOf = (lv: number): RecapDef | undefined => data.recaps?.[String(lv)];

/** 建议页数 = int(时间段数 × 0.5 + 0.5)，且必须 < 时间段数（README_game §4.9） */
export function recapPageCount(rows: number): number {
  return Math.max(1, Math.min(rows - 1, Math.floor(rows * 0.5 + 0.5)));
}

/** 按建议页数把行下标切成连续区间（前面的区间优先多一行） */
export function recapRowGroups(rows: number): number[][] {
  const n = recapPageCount(rows);
  const base = Math.floor(rows / n);
  const extra = rows % n;
  const out: number[][] = [];
  let r = 0;
  for (let i = 0; i < n; i++) {
    const size = base + (i < extra ? 1 : 0);
    out.push(Array.from({ length: size }, (_, k) => r + k));
    r += size;
  }
  return out;
}

/** 去标记后的字数（与 tools/validate_data.py 的 card_text_len 同规则：不含空白） */
export const textLen = (t: string): number => plainText(t).replace(/\s/g, '').length;

/** 一批卡的正文总字数（回顾页字数区间的分母） */
export function cardsTextLen(ids: string[]): number {
  let n = 0;
  for (const id of ids) {
    const c = cardDef(id);
    if (c) for (const seg of c.segments) n += textLen(seg.text);
  }
  return n;
}

/** 某关某组行覆盖到的卡 id（按 行 → 列 排序，情节列在前） */
export function cardsOfRows(lv: number, rows: number[]): string[] {
  const set = new Set(rows);
  return cardsOfLevel(lv)
    .filter((c) => set.has(correctCell(c).row))
    .sort((a, b) => {
      const ac = correctCell(a);
      const bc = correctCell(b);
      return ac.row - bc.row || ac.col - bc.col;
    })
    .map((c) => c.id);
}

// ---------- 展示常量 ----------

export const FORM_META: Record<CardForm, { label: string }> = {
  get scene() {
    return { label: t('form.scene') };
  },
  get dialogue() {
    return { label: t('form.dialogue') };
  },
  get monologue() {
    return { label: t('form.monologue') };
  },
};

export const TYPE_COLOR: Record<EntryType, string> = {
  person: '#8a6a3f',
  place: '#3e5c4b',
  item: '#9a5b2f',
  concept: '#5b6b8a',
};

export const TYPE_LABEL: Record<EntryType, string> = {
  get person() {
    return t('type.person');
  },
  get place() {
    return t('type.place');
  },
  get item() {
    return t('type.item');
  },
  get concept() {
    return t('type.concept');
  },
};

export const TYPE_ORDER: EntryType[] = ['person', 'place', 'item', 'concept'];

/** 未知人名槽位配色（NPC1…）：固定色相，便于多人对话分辨；与 CSS .slot-tint-N 同步 */
export const SLOT_TINT_COLORS = ['#a8412c', '#2f7a5c', '#3a5f9a', '#7a4a8c'] as const;

/** 槽位 → tint 下标（NPC1→0…；非 NPCn 返回 -1） */
export function slotTintIndex(slot: string): number {
  const m = /^NPC(\d+)$/i.exec(slot);
  if (!m) return -1;
  return (Math.max(1, parseInt(m[1], 10)) - 1) % SLOT_TINT_COLORS.length;
}

/** 槽位 → CSS 类名 `slot-tint-N`；非人名槽返回空串 */
export function slotTintClass(slot: string): string {
  const i = slotTintIndex(slot);
  return i < 0 ? '' : `slot-tint-${i}`;
}
