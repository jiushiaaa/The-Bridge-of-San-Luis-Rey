// DEBUG-文案 · 故事回顾编辑器（【回顾本关故事】的多页图文，见 README_game §4.9 / doc/12-story-recap.md）
// 自动化：按建议页数一键切分行区间；改行区间后自动重算覆盖卡与默认预览图；
//         每页实时显示「本页字数 / 覆盖卡总字数」与 10~20% 的目标区间；引用的卡与词条用选择器挑。
import { saveGameData } from '../../game/copyedit';
import {
  cardDef,
  cardsOfRows,
  cardsTextLen,
  recapOf,
  recapPageCount,
  recapRowGroups,
  textLen,
  timelineOf,
} from '../../game/data';
import { pushToast } from '../../game/store';
import type { RecapPage, RecapSeg } from '../../game/types';
import { CeShell, EntryPickButton, entryName, openCardPicker, useDraft } from './common';
import Icon from '../Icon';

const SHARE = [0.1, 0.2] as const;

interface RecapDraft {
  pages: RecapPage[];
}

/** 按行区间生成一页骨架（覆盖卡自动算好；预览图留空＝运行时自动取这些卡的 CG） */
function blankPage(lv: number, rows: number[], title: string): RecapPage {
  return { rows, title, cards: cardsOfRows(lv, rows), segments: [{ kind: 'narration', text: '' }] };
}

export default function RecapEditor({ level }: { level: number }) {
  const t = timelineOf(level);
  const nrows = t?.rows.length ?? 0;
  const want = nrows > 0 ? recapPageCount(nrows) : 0;
  const [draft, upd] = useDraft<RecapDraft>(() => ({
    pages: structuredClone(recapOf(level)?.pages ?? []),
  }));

  const resetPages = () => {
    if (draft.pages.some((p) => p.segments.some((s) => s.text.trim()))) {
      if (!window.confirm(`按建议切成 ${want} 页会清空已写好的正文，确定？`)) return;
    }
    upd((d) => {
      d.pages = recapRowGroups(nrows).map((rows) =>
        blankPage(level, rows, `${t.rows[rows[0]]}${rows.length > 1 ? ` — ${t.rows[rows[rows.length - 1]]}` : ''}`),
      );
    });
    pushToast(`已按建议切成 ${want} 页`);
  };

  /** 改行区间后重算覆盖卡（预览图跟着自动变，因为默认就取这些卡的 CG） */
  const setRows = (pi: number, start: number, count: number) =>
    upd((d) => {
      const rows = Array.from({ length: count }, (_, k) => start + k).filter((r) => r >= 0 && r < nrows);
      d.pages[pi].rows = rows;
      d.pages[pi].cards = cardsOfRows(level, rows);
    });

  const addSeg = (pi: number, kind: RecapSeg['kind']) =>
    upd((d) => {
      d.pages[pi].segments.push(
        kind === 'quote' ? { kind: 'quote', entry: '', text: '' } : { kind: 'narration', text: '' },
      );
    });

  const moveSeg = (pi: number, si: number, dir: -1 | 1) =>
    upd((d) => {
      const j = si + dir;
      const segs = d.pages[pi].segments;
      [segs[si], segs[j]] = [segs[j], segs[si]];
    });

  // ---------- 校验 ----------

  const errors: string[] = [];
  const specErrors: string[] = [];
  const warnings: string[] = [];
  if (nrows === 0) errors.push(`第${level}关没有时间轴`);
  if (draft.pages.length > 0) {
    if (draft.pages.length >= nrows) errors.push(`页数 ${draft.pages.length} 必须小于时间段数 ${nrows}`);
    if (draft.pages.length !== want) specErrors.push(`共 ${draft.pages.length} 页，建议 ${want} 页（int(行数×0.5+0.5)）`);
    const seen: number[] = [];
    draft.pages.forEach((p, pi) => {
      if (p.rows.length === 0) errors.push(`第 ${pi + 1} 页没有覆盖任何时间行`);
      if (!p.title.trim()) specErrors.push(`第 ${pi + 1} 页缺标题`);
      if (p.segments.length === 0 || p.segments.every((s) => !s.text.trim())) errors.push(`第 ${pi + 1} 页正文是空的`);
      p.segments.forEach((s, si) => {
        if (s.kind === 'quote' && !s.entry) errors.push(`第 ${pi + 1} 页第 ${si + 1} 段的引语还没选发言人`);
      });
      for (const cid of p.cards) if (!cardDef(cid)) errors.push(`第 ${pi + 1} 页引用了不存在的卡 ${cid}`);
      seen.push(...p.rows);
    });
    const sorted = [...seen].sort((a, b) => a - b);
    if (JSON.stringify(sorted) !== JSON.stringify([...Array(nrows).keys()])) {
      errors.push(`各页的时间行必须恰好铺满全部 ${nrows} 行且不重叠（当前：${sorted.join(',')}）`);
    }
  }

  const save = () =>
    saveGameData((g) => {
      if (draft.pages.length === 0) {
        // 本关没有回顾：删掉这一关；整个 recaps 都空了就连键一起去掉，别在数据里留个空壳
        if (g.recaps) {
          delete g.recaps[String(level)];
          if (Object.keys(g.recaps).length === 0) delete g.recaps;
        }
      } else {
        g.recaps ??= {};
        g.recaps[String(level)] = {
          pages: draft.pages.map((p) => ({
            rows: [...p.rows],
            title: p.title.trim(),
            cards: [...p.cards],
            ...(p.images && p.images.length > 0 ? { images: [...p.images] } : {}),
            segments: p.segments
              .filter((s) => s.text.trim())
              .map((s) => (s.kind === 'quote' ? { kind: 'quote' as const, entry: s.entry, text: s.text.trim() } : { kind: 'narration' as const, text: s.text.trim() })),
          })),
        };
      }
    });

  return (
    <CeShell
      title={`DEBUG-文案 · 第${level}关故事回顾`}
      onSave={save}
      errors={errors}
      specErrors={specErrors}
      warnings={warnings}
    >
      <div className="ce-sec">
        <div className="ce-sec-title">
          页面（{draft.pages.length} / 建议 {want} 页）
          <button className="btn" onClick={resetPages} disabled={nrows === 0}>
            按建议重新切页
          </button>
          <button
            className="btn"
            onClick={() =>
              upd((d) => {
                const last = d.pages[d.pages.length - 1];
                const start = last ? last.rows[last.rows.length - 1] + 1 : 0;
                d.pages.push(blankPage(level, start < nrows ? [start] : [], ''));
              })
            }
          >
            ＋加一页
          </button>
        </div>
        <div className="ce-note">
          本关 {nrows} 个时间段。规格：页数 = int(时间段数 × 0.5 + 0.5) 且小于时间段数；各页覆盖的时间行必须连续、
          不重叠、合起来铺满整关；每页字数为该页覆盖卡正文总字数的 10~20%。
          文章用第三方旁白口吻，只夹少量最重要的对话（引语气泡）。
        </div>
      </div>

      {draft.pages.map((p, pi) => {
        const base = cardsTextLen(p.cards);
        const words = p.segments.reduce((n, s) => n + textLen(s.text), 0);
        const lo = Math.round(base * SHARE[0]);
        const hi = Math.round(base * SHARE[1]);
        const ok = base === 0 || (words >= lo && words <= hi);
        return (
          <div className="ce-sec" key={pi}>
            <div className="ce-sec-title">
              第 {pi + 1} 页
              <input
                className="ce-input"
                style={{ width: 260 }}
                placeholder="本页小标题"
                value={p.title}
                onChange={(e) => upd((d) => void (d.pages[pi].title = e.target.value))}
              />
              <span className="ce-spacer" />
              <button
                className="ce-mini-btn danger"
                onClick={() => {
                  if (window.confirm(`删除第 ${pi + 1} 页？`)) upd((d) => void d.pages.splice(pi, 1));
                }}
              >
                删除本页
              </button>
            </div>

            <div className="ce-row">
              <span className="ce-row-label">覆盖时段</span>
              <select
                className="ce-select"
                value={p.rows[0] ?? 0}
                onChange={(e) => setRows(pi, Number(e.target.value), p.rows.length || 1)}
              >
                {t?.rows.map((r, i) => (
                  <option key={i} value={i}>
                    从 第{i + 1}行 · {r}
                  </option>
                ))}
              </select>
              <select
                className="ce-select"
                value={p.rows.length || 1}
                onChange={(e) => setRows(pi, p.rows[0] ?? 0, Number(e.target.value))}
              >
                {Array.from({ length: nrows }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    共 {n} 行
                  </option>
                ))}
              </select>
              <span className="ce-note">
                自动覆盖 {p.cards.length} 张卡（{base} 字）
              </span>
            </div>

            <div className="ce-row">
              <span className="ce-row-label">覆盖卡</span>
              {p.cards.map((cid) => (
                <span className="ce-place-chip" key={cid}>
                  {cardDef(cid)?.title ?? cid}
                  <button
                    className="ce-mini-btn danger"
                    title="不纳入本页（预览图与字数分母都会跟着变）"
                    onClick={() => upd((d) => void (d.pages[pi].cards = d.pages[pi].cards.filter((x) => x !== cid)))}
                  >
                    <Icon name="close" size={10} />
                  </button>
                </span>
              ))}
              <button
                className="ce-mini-btn"
                onClick={() =>
                  openCardPicker('把哪张卡也纳入本页？', level, (cid) =>
                    upd((d) => void (d.pages[pi].cards.includes(cid) || d.pages[pi].cards.push(cid))),
                  )
                }
              >
                ＋加卡
              </button>
              <button
                className="ce-mini-btn"
                title="按当前时间行区间重算覆盖卡"
                onClick={() => upd((d) => void (d.pages[pi].cards = cardsOfRows(level, d.pages[pi].rows)))}
              >
                重算
              </button>
            </div>

            <div className={`ce-recap-count${ok ? '' : ' bad'}`}>
              本页正文 <b>{words}</b> 字　目标 <b>{lo}~{hi}</b> 字（覆盖卡 {base} 字的 10~20%）
            </div>

            {p.segments.map((sg, si) => (
              <div className="ce-seg" key={si}>
                <div className="ce-seg-head">
                  <span className="ce-seg-idx">{si + 1}.</span>
                  <span className="ce-row-label">{sg.kind === 'quote' ? '引语气泡' : '旁白'}</span>
                  {sg.kind === 'quote' ? (
                    <EntryPickButton
                      value={sg.entry || null}
                      types={['person']}
                      placeholder="选择说这句话的人"
                      title="这条引语是谁说的"
                      onPick={(id) =>
                        upd((d) => {
                          const s2 = d.pages[pi].segments[si];
                          if (s2.kind === 'quote') s2.entry = id;
                        })
                      }
                    />
                  ) : null}
                  <span className="ce-seg-tools">
                    <span className="ce-note">{textLen(sg.text)} 字</span>
                    <button className="ce-mini-btn" disabled={si === 0} onClick={() => moveSeg(pi, si, -1)}>
                      ↑
                    </button>
                    <button
                      className="ce-mini-btn"
                      disabled={si === p.segments.length - 1}
                      onClick={() => moveSeg(pi, si, 1)}
                    >
                      ↓
                    </button>
                    <button
                      className="ce-mini-btn danger"
                      onClick={() => upd((d) => void d.pages[pi].segments.splice(si, 1))}
                    >
                      删除
                    </button>
                  </span>
                </div>
                <textarea
                  className="ce-textarea"
                  rows={Math.max(2, Math.ceil(sg.text.length / 48))}
                  placeholder={sg.kind === 'quote' ? '这一段最该被记住的一句话' : '第三方旁白口吻的回顾正文'}
                  value={sg.text}
                  onChange={(e) => upd((d) => void (d.pages[pi].segments[si].text = e.target.value))}
                />
                {sg.kind === 'quote' && sg.entry ? (
                  <div className="ce-preview">「{entryName(sg.entry)}」的气泡</div>
                ) : null}
              </div>
            ))}
            <div className="ce-add-line">
              <button className="ce-mini-btn" onClick={() => addSeg(pi, 'narration')}>
                ＋旁白
              </button>
              <button className="ce-mini-btn" onClick={() => addSeg(pi, 'quote')}>
                ＋引语气泡
              </button>
            </div>
          </div>
        );
      })}

      {draft.pages.length === 0 ? (
        <div className="ce-note">本关还没有故事回顾。点上面的「按建议重新切页」生成 {want} 页骨架，再逐页写文章。</div>
      ) : null}
    </CeShell>
  );
}
