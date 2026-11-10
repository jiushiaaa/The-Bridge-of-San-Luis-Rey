// DEBUG 内容编辑：结构性增删（情节卡 / 闸门 / 关卡）——这些操作跨多张表，不适合放进单个编辑器的草稿里，
// 一律「立即写回 final_game.json」，写完再打开对应编辑器细调。
// 删除一律先扫描引用点，有引用就拦下并告知位置，绝不制造悬空引用。
import { backCopyedit, openCopyedit, saveGameData, setCeDirty } from './copyedit';
import { allLevels, cardDef, cardsOfLevel, data, maxLevel, timelineOf } from './data';
import { getUi, pushToast } from './store';
import type { CardDef, GameData } from './types';

/** 该关下一个可用的卡 id：c{关}_{两位序号} */
function nextCardId(lv: number): string {
  let n = cardsOfLevel(lv).length + 1;
  while (cardDef(`c${lv}_${String(n).padStart(2, '0')}`)) n++;
  return `c${lv}_${String(n).padStart(2, '0')}`;
}

/** 找一个本关还空着的格子（行优先），全满则回落到 (0, 情节列) */
function freeCell(lv: number): { row: number; col: string } {
  const t = timelineOf(lv);
  const taken = new Set(cardsOfLevel(lv).map((c) => `${c.row}:${c.col}`));
  for (let r = 0; r < t.rows.length; r++) {
    for (const c of t.cols) {
      if (!taken.has(`${r}:${c}`)) return { row: r, col: c };
    }
  }
  return { row: 0, col: t.cols[0] };
}

/** 新建一张空白情节卡并立即打开它的编辑器 */
export async function createCard(lv: number, opts?: { fromDebug?: boolean }): Promise<void> {
  const t = data.timelines[String(lv)];
  if (!t) {
    pushToast(`第${lv}关还没有时间轴，先在「关卡管理」里建关`);
    return;
  }
  const id = nextCardId(lv);
  const { row, col } = freeCell(lv);
  const card: CardDef = {
    id,
    level: lv,
    form: 'scene',
    difficulty: 'normal',
    col,
    row,
    title: '未命名情节卡',
    len: 'M',
    segments: [{ kind: 'narration', text: '' }],
    blanks: [],
  };
  const ok = await saveGameData((g) => {
    // 按关卡与行列插到同关卡片中间，保持 cards 数组大致有序（搜寻平手时按数组序取早者）
    const at = g.cards.findIndex((c) => c.level > lv);
    if (at < 0) g.cards.push(card);
    else g.cards.splice(at, 0, card);
  });
  if (ok) {
    openCopyedit(
      { kind: 'card', cardId: id },
      { fromDebug: opts?.fromDebug, push: !opts?.fromDebug && !!getUi().copyedit },
    );
  }
}

/** 情节卡的全部引用点（闸门答案、回顾页），有引用不许删 */
function cardRefs(g: GameData, id: string): string[] {
  const out: string[] = [];
  for (const gt of g.gates) {
    if (gt.blanks.some((b) => b.answerTitle === id)) out.push(`第${gt.after}关闸门题答案`);
  }
  for (const [lv, r] of Object.entries(g.recaps ?? {})) {
    if (r.pages.some((p) => p.cards.includes(id))) out.push(`第${lv}关故事回顾的覆盖卡`);
  }
  return out;
}

export async function deleteCard(id: string): Promise<boolean> {
  const c = cardDef(id);
  if (!c) return false;
  const refs = cardRefs(data, id);
  if (refs.length > 0) {
    window.alert(`《${c.title}》还被引用着，不能删除：\n\n${refs.join('\n')}`);
    return false;
  }
  if (!window.confirm(`删除情节卡《${c.title}》（${id}）？该卡的正文、填空与存档进度都会一并消失。`)) return false;
  const ok = await saveGameData((g) => {
    g.cards = g.cards.filter((x) => x.id !== id);
  });
  if (ok) {
    setCeDirty(false);
    backCopyedit();
  }
  return ok;
}

// ---------- 闸门 ----------

/** 给缺闸门的关补一扇（关卡链断了会让玩家过不去，且引擎按 gates.after 推导总关数） */
export async function createGate(lv: number): Promise<void> {
  if (data.gates.some((g) => g.after === lv)) return;
  const ok = await saveGameData((g) => {
    g.gates.push({ after: lv, question: '', intro: '', blanks: [] });
    g.gates.sort((a, b) => a.after - b.after);
  });
  if (ok) openCopyedit({ kind: 'gate', after: lv }, { push: !!getUi().copyedit });
}

// ---------- 关卡 ----------

/**
 * 在末尾追加一关：同时补齐时间轴、闸门、过场与回顾的骨架 —— 少任何一样引擎都会少算一关
 * （maxLevel 取自 gates.after，见 doc/10-constraints-decisions.md）。
 */
export async function createLevel(): Promise<void> {
  const lv = maxLevel + 1;
  await saveGameData((g) => {
    g.timelines[String(lv)] = {
      rows: Array.from({ length: 5 }, (_, i) => `新时间点 ${i + 1}`),
      cols: ['情节'],
    };
    g.levelStartEntries[String(lv)] ??= [];
    g.frame.levelIntro[String(lv)] = Array.from({ length: 5 }, () => ({ kind: 'narration' as const, text: '' }));
    g.gates.push({ after: lv, question: '', intro: '', blanks: [] });
    g.gates.sort((a, b) => a.after - b.after);
  });
  pushToast(`已新建第${lv}关（时间轴 5 行 + 空闸门 + 空过场），去各编辑器填内容`);
}

/** 只允许删最后一关，且该关不能还有卡（否则会留下无处可去的孤儿卡） */
export async function deleteLevel(lv: number): Promise<void> {
  const levels = allLevels();
  if (lv !== levels[levels.length - 1]) {
    window.alert('只能删除最后一关：中间关卡被删会让关卡编号断档，引擎按 1..N 连续推导关卡。');
    return;
  }
  if (levels.length <= 1) {
    window.alert('至少要保留一关。');
    return;
  }
  const n = cardsOfLevel(lv).length;
  if (n > 0) {
    window.alert(`第${lv}关还有 ${n} 张情节卡，请先逐张删除或移到别的关。`);
    return;
  }
  const pages = Object.values(data.entries).flatMap((e) => (e.archive ?? []).filter((p) => p.level === lv));
  if (pages.length > 0) {
    window.alert(`第${lv}关还有 ${pages.length} 个档案页，请先在档案编辑器里删除或改关。`);
    return;
  }
  if (!window.confirm(`删除第${lv}关（时间轴、闸门、过场、故事回顾一并删除）？`)) return;
  await saveGameData((g) => {
    delete g.timelines[String(lv)];
    delete g.levelStartEntries[String(lv)];
    delete g.frame.levelIntro[String(lv)];
    if (g.recaps) delete g.recaps[String(lv)];
    g.gates = g.gates.filter((x) => x.after !== lv);
  });
  pushToast(`第${lv}关已删除`);
}
