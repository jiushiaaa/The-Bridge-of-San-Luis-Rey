// DEBUG-文案 · 情节卡编辑器：本关时间轴导航表（点格切卡）/ 规格（关卡/形态/难度/字数档/开局解锁）/ 标题
//   / CG（prompt + 复制 prompt 自行出图 + 换图后自动测亮度）/ 提问（人物空·地点空）/ 逐句正文
// 顶部导航表：本关全部情节卡按时间轴 行×列 铺开，当前卡高亮，点任一格即切到那张卡（有未保存改动先确认）
//   ——玩家侧拿卡是随机的，作者侧需要按故事顺序逐卡过文案；移动卡位去「时间轴」编辑器的格子分配。
// 自动化：删人物空自动重排 NPC 编号并同步三处（blanks、句子发言、正文占位）；
//         正文标记用选择器插入；受影响词条的本关熟悉度上限实时显示 旧→新；
//         地点多答案自动组装数组（任一即对）；字数档 len 按正文实时判定；
//         CG 上传后按亮度自动设置暗系/亮系；改关卡后撞格自动与占位卡交换。
import { useRef } from 'react';
import { deleteCard } from '../../game/content';
import { openCopyedit, saveGameData, switchCopyedit } from '../../game/copyedit';
import {
  allLevels,
  cardDef,
  cardsOfLevel,
  data,
  entryName2id,
  familiarMaxOf,
  FORM_META,
  textLen,
} from '../../game/data';
import { pushToast, setUi } from '../../game/store';
import type { BlankDef, CardDef, CardSeg } from '../../game/types';
import {
  CeShell,
  defaultCgPath,
  EntryPickButton,
  entryName,
  famMaxWith,
  ImageField,
  insertToken,
  measureDark,
  openEntryPicker,
  useDraft,
} from './common';
import Avatar from '../Avatar';
import Icon from '../Icon';

/** 字数档区间（与 tools/validate_data.py 的 check_length_spec 同一套系数） */
const LEN_BANDS: Record<'S' | 'M' | 'L', [number, number]> = { S: [0.58, 0.75], M: [0.85, 1.15], L: [1.2, 1.5] };

/** 按实际字数自动判定 len（落在哪一档就是哪一档；都不落取最近的） */
function autoLen(n: number, avg: number): 'S' | 'M' | 'L' {
  for (const k of ['S', 'M', 'L'] as const) {
    const [lo, hi] = LEN_BANDS[k];
    if (n >= lo * avg && n <= hi * avg) return k;
  }
  return n < 0.8 * avg ? 'S' : n > 1.18 * avg ? 'L' : 'M';
}

interface PersonSlot {
  slot: string;
  answer: string | null;
}

interface SegDraft {
  kind: 'narration' | 'dialogue' | 'monologue';
  speakerMode: 'slot' | 'entry' | 'minor'; // dialogue 专用
  slot: string;
  speakerEntry: string | null;
  speaker: string;
  text: string;
}

interface CardDraft {
  title: string;
  level: number;
  form: CardDef['form'];
  difficulty: NonNullable<CardDef['difficulty']>;
  len: 'S' | 'M' | 'L';
  startUnlocked: boolean;
  row: number;
  col: string;
  cg?: string;
  cgDark?: boolean;
  cgPrompt: string;
  cgChars: string[];
  persons: PersonSlot[];
  hasPlace: boolean;
  placeSlot: string;
  placeAnswers: string[];
  segments: SegDraft[];
}

function toSegDraft(seg: CardSeg): SegDraft {
  const base = { speakerMode: 'slot' as const, slot: '', speakerEntry: null, speaker: '' };
  if (seg.kind === 'narration') return { ...base, kind: 'narration', text: seg.text };
  if (seg.kind === 'monologue') return { ...base, kind: 'monologue', slot: seg.slot, text: seg.text };
  if ('slot' in seg) return { ...base, kind: 'dialogue', slot: seg.slot, text: seg.text };
  if ('speakerEntry' in seg) return { ...base, kind: 'dialogue', speakerMode: 'entry', speakerEntry: seg.speakerEntry, text: seg.text };
  return { ...base, kind: 'dialogue', speakerMode: 'minor', speaker: seg.speaker, text: seg.text };
}

function fromSegDraft(sd: SegDraft): CardSeg {
  if (sd.kind === 'narration') return { kind: 'narration', text: sd.text };
  if (sd.kind === 'monologue') return { kind: 'monologue', slot: sd.slot, text: sd.text };
  if (sd.speakerMode === 'slot') return { kind: 'dialogue', slot: sd.slot, text: sd.text };
  if (sd.speakerMode === 'entry') return { kind: 'dialogue', speakerEntry: sd.speakerEntry ?? '', text: sd.text };
  return { kind: 'dialogue', speaker: sd.speaker, text: sd.text };
}

function buildBlanks(d: CardDraft): BlankDef[] {
  return [
    ...d.persons.map((p) => ({ slot: p.slot, kind: 'person' as const, answer: p.answer ?? '' })),
    ...(d.hasPlace
      ? [
          {
            slot: d.placeSlot,
            kind: 'place' as const,
            answer: d.placeAnswers.length === 1 ? d.placeAnswers[0] : d.placeAnswers,
          },
        ]
      : []),
  ];
}

function buildCard(base: CardDef, d: CardDraft): CardDef {
  const out: CardDef = {
    ...base,
    title: d.title.trim(),
    level: d.level,
    form: d.form,
    difficulty: d.difficulty,
    len: d.len,
    row: d.row,
    col: d.col,
    cg: d.cg,
    cgDark: d.cgDark,
    cgPrompt: d.cgPrompt.trim() || undefined,
    cgChars: d.cgChars.length > 0 ? [...d.cgChars] : undefined,
    segments: d.segments.map(fromSegDraft),
    blanks: buildBlanks(d),
  };
  if (d.startUnlocked) out.startUnlocked = true;
  else delete out.startUnlocked;
  return out;
}

const ENTRY_TAG_RE = /\{\{(e_[a-z0-9_]+)\|/g;
const stripAll = (t: string): string => t.replace(/\{\{e_[a-z0-9_]+\|[^}]*\}\}/g, '').replace(/\[\[NPC\d\]\]/g, '');

export default function CardEditor({ cardId }: { cardId: string }) {
  const card = cardDef(cardId)!;
  const taRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const [draft, upd] = useDraft<CardDraft>(() => {
    const place = card.blanks.find((b) => b.kind === 'place');
    return {
      title: card.title,
      level: card.level,
      form: card.form,
      difficulty: card.difficulty ?? 'normal',
      len: card.len ?? 'M',
      startUnlocked: !!card.startUnlocked,
      row: card.row,
      col: card.col,
      cg: card.cg,
      cgDark: card.cgDark,
      cgPrompt: card.cgPrompt ?? '',
      cgChars: [...(card.cgChars ?? [])],
      persons: card.blanks
        .filter((b) => b.kind === 'person')
        .map((b) => ({ slot: b.slot, answer: typeof b.answer === 'string' ? b.answer : (b.answer[0] ?? null) })),
      hasPlace: !!place,
      placeSlot: place?.slot ?? '地点',
      placeAnswers: place ? (Array.isArray(place.answer) ? [...place.answer] : [place.answer]) : [],
      segments: card.segments.map(toSegDraft),
    };
  });

  // ---------- 人物空增删（自动重排编号） ----------

  const addPerson = () =>
    upd((d) => {
      const maxIdx = d.persons.reduce((m, p) => Math.max(m, Number(p.slot.replace(/\D/g, '')) || 0), 0);
      d.persons.push({ slot: `NPC${Math.min(maxIdx + 1, 9)}`, answer: null });
    });

  const removePerson = (idx: number) => {
    const p = draft.persons[idx];
    const usedBySeg = draft.segments.findIndex(
      (sd) => sd.kind !== 'narration' && (sd.kind === 'monologue' || sd.speakerMode === 'slot') && sd.slot === p.slot,
    );
    if (usedBySeg >= 0) {
      pushToast(`第 ${usedBySeg + 1} 句由 ${p.slot} 发言，请先修改该句的气泡名`);
      return;
    }
    const inText = draft.segments.reduce((n, sd) => n + (sd.text.split(`[[${p.slot}]]`).length - 1), 0);
    if (inText > 0) {
      pushToast(`正文中还有 ${inText} 处 [[${p.slot}]] 占位，请先在句子里删除`);
      return;
    }
    upd((d) => {
      d.persons.splice(idx, 1);
      // 编号规范化为 NPC1..n，三处同步（人物空、句子发言、正文占位）
      const renames: [string, string][] = [];
      d.persons.forEach((pp, i) => {
        const want = `NPC${i + 1}`;
        if (pp.slot !== want) renames.push([pp.slot, want]);
      });
      for (const [from, to] of renames) {
        for (const pp of d.persons) if (pp.slot === from) pp.slot = to;
        for (const sd of d.segments) {
          if (sd.slot === from) sd.slot = to;
          sd.text = sd.text.split(`[[${from}]]`).join(`[[${to}]]`);
        }
      }
    });
    pushToast('人物空已删除，其余编号已自动重排');
  };

  // ---------- 句子操作 ----------

  const changeKind = (i: number, kind: SegDraft['kind']) => {
    if ((kind === 'monologue' || false) && draft.persons.length === 0) {
      pushToast('先在上方添加人物空，独白才有发言人');
      return;
    }
    upd((d) => {
      const sd = d.segments[i];
      sd.kind = kind;
      if (kind === 'monologue' && !d.persons.some((p) => p.slot === sd.slot)) sd.slot = d.persons[0]?.slot ?? '';
      if (kind === 'dialogue' && sd.speakerMode === 'slot' && !d.persons.some((p) => p.slot === sd.slot)) {
        if (d.persons.length > 0) sd.slot = d.persons[0].slot;
        else sd.speakerMode = 'minor';
      }
    });
  };

  const changeMode = (i: number, mode: SegDraft['speakerMode']) => {
    if (mode === 'slot' && draft.persons.length === 0) {
      pushToast('先在上方添加人物空');
      return;
    }
    upd((d) => {
      const sd = d.segments[i];
      sd.speakerMode = mode;
      if (mode === 'slot' && !d.persons.some((p) => p.slot === sd.slot)) sd.slot = d.persons[0]?.slot ?? '';
    });
  };

  const moveSeg = (i: number, dir: -1 | 1) =>
    upd((d) => {
      const j = i + dir;
      [d.segments[i], d.segments[j]] = [d.segments[j], d.segments[i]];
    });

  const addSegBelow = (i: number) =>
    upd((d) => {
      d.segments.splice(i + 1, 0, {
        kind: 'narration',
        speakerMode: 'slot',
        slot: '',
        speakerEntry: null,
        speaker: '',
        text: '',
      });
    });

  const insertEntryTag = (i: number) =>
    openEntryPicker('插入词条标记（在光标处）', null, (id) => {
      const token = `{{${id}|${entryName(id)}}}`;
      upd((d) => void (d.segments[i].text = insertToken(taRefs.current[i], d.segments[i].text, token)));
    });

  const insertNpcTag = (i: number) => {
    const doIns = (slot: string) =>
      upd((d) => void (d.segments[i].text = insertToken(taRefs.current[i], d.segments[i].text, `[[${slot}]]`)));
    if (draft.persons.length === 0) {
      pushToast('先在上方添加人物空');
      return;
    }
    if (draft.persons.length === 1) return doIns(draft.persons[0].slot);
    setUi({
      picker: {
        title: '插入哪个人物占位？',
        groups: [
          {
            label: '',
            keepOrder: true,
            items: draft.persons.map((p) => ({
              key: p.slot,
              name: `${p.slot}${p.answer ? `（答案：${entryName(p.answer)}）` : ''}`,
            })),
          },
        ],
        onPick: doIns,
      },
    });
  };

  // ---------- 校验与自动反馈 ----------

  const errors: string[] = []; // 完整性：引用不存在、结构不成立
  const specErrors: string[] = []; // 设计规范：字数、难度、匿名铁律（内容总监模式下只提示）
  const warnings: string[] = [];
  if (!draft.title.trim()) errors.push('标题不能为空');
  if (draft.segments.length === 0) errors.push('至少要有一句正文');
  const tl = data.timelines[String(draft.level)];
  if (!tl) errors.push(`第${draft.level}关没有时间轴，先在「关卡管理」里新建`);
  else {
    if (draft.row < 0 || draft.row >= tl.rows.length) errors.push(`行下标 ${draft.row} 越界（本关 ${tl.rows.length} 行）`);
    if (!tl.cols.includes(draft.col)) errors.push(`列「${draft.col}」不在第${draft.level}关的时间轴列里`);
  }
  const occupant = cardsOfLevel(draft.level).find(
    (c) => c.id !== cardId && c.row === draft.row && c.col === draft.col,
  );
  if (occupant) warnings.push(`第${draft.level}关这一格已被《${occupant.title}》占用，保存时两张卡会自动交换位置`);
  draft.persons.forEach((p) => {
    if (!p.answer) errors.push(`人物空 ${p.slot} 还没有选择答案`);
  });
  if (draft.hasPlace && draft.placeAnswers.length === 0) errors.push('地点空至少要选择一个地点答案');
  draft.segments.forEach((sd, i) => {
    if (
      (sd.kind === 'monologue' || (sd.kind === 'dialogue' && sd.speakerMode === 'slot')) &&
      !draft.persons.some((p) => p.slot === sd.slot)
    ) {
      errors.push(`第 ${i + 1} 句的发言空「${sd.slot || '未选'}」不存在`);
    }
    if (sd.kind === 'dialogue' && sd.speakerMode === 'entry' && !sd.speakerEntry) errors.push(`第 ${i + 1} 句还没有选择具名发言人`);
    if (sd.kind === 'dialogue' && sd.speakerMode === 'minor') {
      const nm = sd.speaker.trim();
      if (!nm) errors.push(`第 ${i + 1} 句配角的名字不能为空`);
      else if (entryName2id(nm)) errors.push(`第 ${i + 1} 句配角名「${nm}」与词条重名（配角必须用不在人物表里的名字）`);
    }
    for (const m of sd.text.matchAll(/\[\[(NPC\d)\]\]/g)) {
      if (!draft.persons.some((p) => p.slot === m[1])) errors.push(`第 ${i + 1} 句的占位 [[${m[1]}]] 没有对应人物空`);
    }
    for (const m of sd.text.matchAll(ENTRY_TAG_RE)) {
      if (!data.entries[m[1]]) errors.push(`第 ${i + 1} 句的词条标记 ${m[1]} 指向不存在的词条`);
    }
  });
  if (!draft.segments.some((sd) => /\{\{e_[a-z0-9_]+\|/.test(sd.text))) {
    warnings.push('正文没有任何词条标记，本卡将无法通过「搜寻」解锁');
  }
  // 匿名铁律：本卡待猜答案的真名不得出现在正文。
  // 标签形式是确定无疑的违规（chip 直接把答案送给玩家），按规范级错误拦；
  // 裸文本只能做子串匹配，中文没有词边界（「简」会命中「简单」），做不到零误报，
  // 所以这里只给提示，以保存后 validate_data.py 的判定为准。
  const answerIds = [...draft.persons.map((p) => p.answer), ...(draft.hasPlace ? draft.placeAnswers : [])].filter(
    (x): x is string => !!x,
  );
  for (const aid of new Set(answerIds)) {
    const nm = entryName(aid);
    if (draft.segments.some((sd) => sd.text.includes(`{{${aid}|`))) {
      specErrors.push(`答案「${nm}」以词条标签出现在本卡正文（匿名铁律：待猜的人不能露名）`);
    } else if (nm && draft.segments.some((sd) => stripAll(sd.text).includes(nm))) {
      warnings.push(`答案「${nm}」的真名可能在正文明文中出现（匿名铁律，若非特许请改写正文）`);
    }
  }
  const dupAns = draft.persons.map((p) => p.answer).filter((a, i, arr) => a && arr.indexOf(a) !== i);
  for (const a of new Set(dupAns)) warnings.push(`多个人物空使用同一答案「${entryName(a)}」`);
  if (draft.difficulty === 'easy' && draft.hasPlace) specErrors.push('难度 easy（独白卡）按规则不应有地点空');
  // hard = **登场人物**全部匿名待填，所以不许有具名发言人。
  // 它并不禁止正文出现人名标签：受限的只是本卡待猜的那几个人，那由上面的匿名铁律统管；
  // 顺带提及的第三方（「XX 的公司」）照常可以做 chip，否则困难卡连背景都交代不了。
  if (draft.difficulty === 'hard' && draft.segments.some((sd) => sd.kind === 'dialogue' && sd.speakerMode === 'entry')) {
    specErrors.push('难度 hard 不应使用具名发言人（登场人物须全部匿名待填）');
  }
  // 字数档：正文实时字数落在哪一档
  const bodyLen = draft.segments.reduce((n, sd) => n + textLen(sd.text), 0);
  const avg = data.meta.cardSpec?.avg ?? 0;
  const suggestLen = avg > 0 ? autoLen(bodyLen, avg) : draft.len;
  if (avg > 0) {
    const [lo, hi] = LEN_BANDS[draft.len];
    if (bodyLen < lo * avg || bodyLen > hi * avg) {
      specErrors.push(
        `正文 ${bodyLen} 字，不在字数档 ${draft.len} 的区间 [${Math.round(lo * avg)},${Math.round(hi * avg)}]（建议改档为 ${suggestLen}）`,
      );
    }
  }
  for (const ch of draft.cgChars) {
    if (!data.entries[ch]) errors.push(`CG 参考人物 ${ch} 不存在`);
    else if (!data.entries[ch].avatar) warnings.push(`CG 参考人物「${entryName(ch)}」没有头像`);
  }

  // 熟悉度上限自动反馈：涉及词条 旧→新
  const draftCard = buildCard(card, draft);
  const famIds = new Set<string>();
  const collectIds = (c: CardDef) => {
    for (const seg of c.segments) for (const m of seg.text.matchAll(ENTRY_TAG_RE)) famIds.add(m[1]);
    for (const b of c.blanks) if (typeof b.answer === 'string' && b.answer) famIds.add(b.answer);
  };
  collectIds(card);
  collectIds(draftCard);
  const famDiffs = [...famIds]
    .filter((id) => data.entries[id])
    .map((id) => ({ id, from: familiarMaxOf(id, card.level), to: famMaxWith(draftCard, id, card.level) }))
    .filter((x) => x.from !== x.to);

  const save = () =>
    saveGameData((g) => {
      const c = g.cards.find((x) => x.id === cardId);
      if (!c) return;
      const from = { level: c.level, row: c.row, col: c.col };
      // 撞格自动交换：目标格已有卡时把它挪到本卡原来的位置（时间轴坐标必须唯一）
      const occ = g.cards.find(
        (x) => x.id !== cardId && x.level === draft.level && x.row === draft.row && x.col === draft.col,
      );
      Object.assign(c, buildCard(c, draft));
      if (occ) {
        occ.level = from.level;
        occ.row = from.row;
        occ.col = from.col;
      }
    });

  const slotSelect = (i: number, sd: SegDraft) => (
    <select
      className="ce-select"
      value={sd.slot}
      onChange={(e) => upd((d) => void (d.segments[i].slot = e.target.value))}
    >
      {draft.persons.map((p) => (
        <option key={p.slot} value={p.slot}>
          {p.slot}
          {p.answer ? `（${entryName(p.answer)}）` : ''}
        </option>
      ))}
      {!draft.persons.some((p) => p.slot === sd.slot) && sd.slot ? <option value={sd.slot}>{sd.slot}（已不存在）</option> : null}
    </select>
  );

  // ---------- 本关时间轴导航表（点格切卡） ----------
  // 用磁盘上的真实坐标（card.*）而不是草稿：草稿改了关卡也不该让表格跟着跳，表格始终代表「这张卡现在所在的关」。
  const navTl = data.timelines[String(card.level)];
  const navCards = cardsOfLevel(card.level);
  const navCardAt = (ri: number, cn: string) => navCards.find((c) => c.row === ri && c.col === cn);
  const gotoCard = (id: string) => {
    if (id === cardId) return;
    switchCopyedit({ kind: 'card', cardId: id });
  };

  return (
    <CeShell
      title={`DEBUG-文案 · 情节卡《${card.title}》（${card.id}）`}
      onSave={save}
      errors={errors}
      specErrors={specErrors}
      warnings={warnings}
    >
      {/* 本关全部情节卡：按时间轴顺序铺开，点格切换编辑目标 */}
      <div className="ce-sec ce-card-nav">
        <div className="ce-sec-title">
          第{card.level}关 · 全部情节卡（按时间轴顺序，点击切换要修改的卡）
          <span className="ce-spacer" />
          <button
            className="ce-mini-btn"
            title="移动本卡的时间轴格位，去时间轴编辑器的「每格应放的故事卡」里点格换卡"
            onClick={() => openCopyedit({ kind: 'timeline', level: card.level }, { push: true })}
          >
            调整格位 →
          </button>
        </div>
        {navTl ? (
          <table className="ce-tl-grid ce-card-nav-grid">
            <thead>
              <tr>
                <th className="ce-tl-rowhead" />
                {navTl.cols.map((cn, ci) => {
                  const eid = ci === 0 ? undefined : entryName2id(cn);
                  return (
                    <th key={cn}>
                      <span className="ce-card-nav-colhead">
                        {eid ? <Avatar entryId={eid} size={18} /> : null}
                        {ci === 0 ? `情节列（${cn}）` : cn}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {navTl.rows.map((rn, ri) => (
                <tr key={ri}>
                  <th className="ce-tl-rowhead">
                    {ri + 1}. {rn}
                  </th>
                  {navTl.cols.map((cn) => {
                    const occ = navCardAt(ri, cn);
                    const isCur = occ?.id === cardId;
                    return (
                      <td key={cn}>
                        {occ ? (
                          <button
                            className={`ce-tl-cellbtn${isCur ? ' current' : ''}`}
                            title={isCur ? '正在编辑这张卡' : `《${occ.title}》（${occ.id}）——点击切换到这张卡`}
                            aria-current={isCur ? 'true' : undefined}
                            onClick={() => gotoCard(occ.id)}
                          >
                            {occ.title}
                            <span className="ce-tl-cell-form">
                              {FORM_META[occ.form].label}
                              {occ.difficulty === 'hard' ? ' · 困难' : occ.difficulty === 'easy' ? ' · 简单' : ''}
                              {occ.startUnlocked ? ' · 开局' : ''}
                            </span>
                          </button>
                        ) : (
                          <span className="ce-tl-cellbtn empty ce-card-nav-empty" title="这一格暂无卡">
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="ce-note">第{card.level}关没有时间轴，先在「关卡管理」里新建</div>
        )}
        <div className="ce-note" style={{ marginTop: 6 }}>
          本卡在 第{card.row + 1}行 · {navTl?.rows[card.row] ?? '?'}　列：{card.col}
          {navTl && card.col !== navTl.cols[0] ? '　（角色列的卡，列主人物必须是本卡的 NPC1）' : ''}
          　本关共 {navCards.length} 张卡。切卡前请先保存，未保存的改动会被丢弃。
        </div>
      </div>

      {/* 规格 */}
      <div className="ce-sec">
        <div className="ce-sec-title">
          规格
          <span className="ce-spacer" />
          <button className="ce-mini-btn danger" onClick={() => void deleteCard(cardId)}>
            删除这张卡
          </button>
        </div>
        <div className="ce-row">
          <span className="ce-row-label">关卡</span>
          <select
            className="ce-select"
            value={draft.level}
            onChange={(e) => {
              const lv = Number(e.target.value);
              upd((d) => {
                d.level = lv;
                const t = data.timelines[String(lv)];
                if (t) {
                  if (!t.cols.includes(d.col)) d.col = t.cols[0];
                  if (d.row >= t.rows.length) d.row = t.rows.length - 1;
                }
              });
            }}
          >
            {allLevels().map((lv) => (
              <option key={lv} value={lv}>
                第{lv}关
              </option>
            ))}
          </select>
          <span className="ce-row-label">形态</span>
          <select
            className="ce-select"
            value={draft.form}
            onChange={(e) => upd((d) => void (d.form = e.target.value as CardDef['form']))}
          >
            {(['scene', 'dialogue', 'monologue'] as const).map((f) => (
              <option key={f} value={f}>
                {FORM_META[f].label}
              </option>
            ))}
          </select>
          <span className="ce-row-label">难度</span>
          <select
            className="ce-select"
            value={draft.difficulty}
            onChange={(e) => upd((d) => void (d.difficulty = e.target.value as CardDraft['difficulty']))}
          >
            <option value="easy">简单（无地点空）</option>
            <option value="normal">普通</option>
            <option value="hard">困难（全文匿名）</option>
          </select>
          <label className="ce-note">
            <input
              type="checkbox"
              checked={draft.startUnlocked}
              onChange={(e) => upd((d) => void (d.startUnlocked = e.target.checked))}
            />{' '}
            开局即解锁
          </label>
        </div>
        <div className="ce-row">
          <span className="ce-row-label">字数档</span>
          <select
            className="ce-select"
            value={draft.len}
            onChange={(e) => upd((d) => void (d.len = e.target.value as CardDraft['len']))}
          >
            {(['S', 'M', 'L'] as const).map((k) => (
              <option key={k} value={k}>
                {k}
                {avg > 0 ? `（${Math.round(LEN_BANDS[k][0] * avg)}~${Math.round(LEN_BANDS[k][1] * avg)} 字）` : ''}
              </option>
            ))}
          </select>
          <span className="ce-note">
            正文实际 <b>{bodyLen}</b> 字
            {avg > 0 ? `　全作均值 X=${avg}　按字数应为 ${suggestLen} 档` : ''}
          </span>
          {avg > 0 && suggestLen !== draft.len ? (
            <button className="ce-mini-btn" onClick={() => upd((d) => void (d.len = suggestLen))}>
              自动设为 {suggestLen}
            </button>
          ) : null}
        </div>
      </div>

      {/* 基本信息 */}
      <div className="ce-sec">
        <div className="ce-sec-title">基本信息</div>
        <div className="ce-row">
          <span className="ce-row-label">标题</span>
          <input
            className="ce-input"
            style={{ width: 320 }}
            value={draft.title}
            onChange={(e) => upd((d) => void (d.title = e.target.value))}
          />
        </div>
        <div className="ce-row">
          <ImageField
            label="本卡 CG 背景图（16:9，补完后显示）"
            wide
            path={draft.cg}
            defaultPath={defaultCgPath(cardId)}
            onPath={(p) => upd((d) => void (d.cg = p))}
            prompt={draft.cgPrompt}
            onPrompt={(v) => upd((d) => void (d.cgPrompt = v))}
            refs={draft.cgChars}
            promptHint="只写镜头与画面本身；出场人物的定妆照请自行写进 prompt。出图后用「更换图片」换上"
            onUploaded={(f) =>
              void measureDark(f).then((dark) => {
                if (dark === null) return;
                upd((d) => void (d.cgDark = dark));
                pushToast(`已自动检测 CG 亮度：${dark ? '暗系' : '亮系'}`);
              })
            }
          />
        </div>
        <div className="ce-row">
          <span className="ce-row-label">CG 出场人物</span>
          {draft.cgChars.map((ch) => (
            <span className="ce-place-chip" key={ch}>
              {entryName(ch)}
              <button
                className="ce-mini-btn danger"
                title="不再作为本 CG 的定妆参考"
                onClick={() => upd((d) => void (d.cgChars = d.cgChars.filter((x) => x !== ch)))}
              >
                <Icon name="close" size={10} />
              </button>
            </span>
          ))}
          <button
            className="ce-mini-btn"
            onClick={() =>
              openEntryPicker(
                '添加 CG 出场人物（拼定妆照 + 传头像参考图）',
                ['person'],
                (id) => upd((d) => void (d.cgChars.includes(id) || d.cgChars.push(id))),
                new Set(draft.cgChars),
              )
            }
          >
            ＋添加人物
          </button>
          <label className="ce-note">
            <input
              type="checkbox"
              checked={!!draft.cgDark}
              onChange={(e) => upd((d) => void (d.cgDark = e.target.checked))}
            />{' '}
            暗系 CG（换图后自动检测，可手动改）
          </label>
        </div>
      </div>

      {/* 提问区 */}
      <div className="ce-sec">
        <div className="ce-sec-title">
          本卡提问（填空）
          <button className="btn" onClick={addPerson}>
            ＋添加人物空
          </button>
        </div>
        {draft.persons.length === 0 ? <div className="ce-note">（本卡没有人物空）</div> : null}
        {draft.persons.map((p, i) => (
          <div className="ce-blank-row" key={p.slot}>
            <span className="ce-row-label">{p.slot}</span>
            <EntryPickButton
              value={p.answer}
              types={['person']}
              placeholder="选择这个空的人物答案"
              title={`为 ${p.slot} 选择人物答案`}
              onPick={(id) => upd((d) => void (d.persons[i].answer = id))}
            />
            <button className="ce-mini-btn danger" onClick={() => removePerson(i)}>
              删除此空
            </button>
          </div>
        ))}
        <div className="ce-blank-row">
          <label className="ce-row-label">
            <input
              type="checkbox"
              checked={draft.hasPlace}
              onChange={(e) => upd((d) => void (d.hasPlace = e.target.checked))}
            />{' '}
            地点空
          </label>
          {draft.hasPlace ? (
            <>
              {draft.placeAnswers.map((pid) => (
                <span className="ce-place-chip" key={pid}>
                  <Icon name="pin" size={12} />
                  {entryName(pid)}
                  <button
                    className="ce-mini-btn danger"
                    title="移除该地点答案"
                    onClick={() => upd((d) => void (d.placeAnswers = d.placeAnswers.filter((x) => x !== pid)))}
                  >
                    <Icon name="close" size={10} />
                  </button>
                </span>
              ))}
              <button
                className="ce-mini-btn"
                onClick={() =>
                  openEntryPicker(
                    '添加地点答案（可多选，任一即对）',
                    ['place'],
                    (id) => upd((d) => void (d.placeAnswers.includes(id) || d.placeAnswers.push(id))),
                    new Set(draft.placeAnswers),
                  )
                }
              >
                ＋添加地点答案
              </button>
              <span className="ce-note">多个地点＝本卡涉及多地，玩家选中任一都算对（自动存为数组）</span>
            </>
          ) : (
            <span className="ce-note">（无地点空；独白卡通常不设）</span>
          )}
        </div>
        {famDiffs.length > 0 ? (
          <div className="ce-fam-diff">
            保存后自动重算的本关熟悉度上限：
            {famDiffs.map((x) => (
              <span key={x.id} style={{ marginRight: 12 }}>
                <b>{entryName(x.id)}</b> {x.from} → <b>{x.to}</b>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* 逐句正文 */}
      <div className="ce-sec">
        <div className="ce-sec-title">
          正文（{draft.segments.length} 句）
          <span className="ce-note">「＋词条 / ＋待猜NPC」在光标处插入标记</span>
        </div>
        {draft.segments.map((sd, i) => (
          <div key={i}>
            <div className="ce-seg">
              <div className="ce-seg-head">
                <span className="ce-seg-idx">{i + 1}.</span>
                <select className="ce-select" value={sd.kind} onChange={(e) => changeKind(i, e.target.value as SegDraft['kind'])}>
                  <option value="narration">旁白</option>
                  <option value="dialogue">对话</option>
                  <option value="monologue">斜体独白</option>
                </select>
                {sd.kind === 'dialogue' ? (
                  <>
                    <select
                      className="ce-select"
                      value={sd.speakerMode}
                      onChange={(e) => changeMode(i, e.target.value as SegDraft['speakerMode'])}
                    >
                      <option value="slot">待猜NPC</option>
                      <option value="entry">词条库人物</option>
                      <option value="minor">临时龙套</option>
                    </select>
                    {sd.speakerMode === 'slot' ? (
                      slotSelect(i, sd)
                    ) : sd.speakerMode === 'entry' ? (
                      <EntryPickButton
                        value={sd.speakerEntry}
                        types={['person']}
                        placeholder="选择发言人"
                        title="选择这句的具名发言人"
                        onPick={(id) => upd((d) => void (d.segments[i].speakerEntry = id))}
                      />
                    ) : (
                      <input
                        className="ce-input"
                        style={{ width: 130 }}
                        placeholder="配角名（如：酒保）"
                        value={sd.speaker}
                        onChange={(e) => upd((d) => void (d.segments[i].speaker = e.target.value))}
                      />
                    )}
                  </>
                ) : sd.kind === 'monologue' ? (
                  slotSelect(i, sd)
                ) : null}
                <span className="ce-seg-tools">
                  <button className="ce-mini-btn" onClick={() => insertEntryTag(i)}>
                    ＋词条
                  </button>
                  <button className="ce-mini-btn" disabled={draft.persons.length === 0} onClick={() => insertNpcTag(i)}>
                    ＋待猜NPC
                  </button>
                  <button className="ce-mini-btn" disabled={i === 0} onClick={() => moveSeg(i, -1)}>
                    ↑
                  </button>
                  <button className="ce-mini-btn" disabled={i === draft.segments.length - 1} onClick={() => moveSeg(i, 1)}>
                    ↓
                  </button>
                  <button
                    className="ce-mini-btn danger"
                    onClick={() => {
                      if (window.confirm(`删除第 ${i + 1} 句？`)) upd((d) => void d.segments.splice(i, 1));
                    }}
                  >
                    删除
                  </button>
                </span>
              </div>
              <textarea
                ref={(el) => {
                  taRefs.current[i] = el;
                }}
                className="ce-textarea"
                rows={Math.max(2, Math.ceil(sd.text.length / 42))}
                value={sd.text}
                onChange={(e) => upd((d) => void (d.segments[i].text = e.target.value))}
              />
            </div>
            <div className="ce-add-line">
              <button className="ce-mini-btn" onClick={() => addSegBelow(i)}>
                ＋插入一句
              </button>
            </div>
          </div>
        ))}
        {draft.segments.length === 0 ? (
          <div className="ce-add-line">
            <button className="ce-mini-btn" onClick={() => addSegBelow(-1)}>
              ＋添加第一句
            </button>
          </div>
        ) : null}
      </div>
    </CeShell>
  );
}
