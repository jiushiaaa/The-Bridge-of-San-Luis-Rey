// DEBUG-内容 · 背景音乐：assets.bgm 的全部曲目（封面 / 每关开篇曲 + 卡曲 / 结局），
// 每条可改曲名、所属阶段、绑定的情节卡、Suno prompt / tags / 设计备注，试听并更换 mp3，复制 prompt。
// 顶部按 doc/14 的公式自检：每关曲数 ≥ max(round(正文字数 / 1500), 2)、恰 1 首开篇曲、卡曲按 row 铺开。
// 刻意不提供「重新生成」：生成一律走命令行 tools/gen_bgm.py（多线程、留备选 clip），这里只负责设计与换文件。
import { assetPrefix, saveGameData } from '../../game/copyedit';
import { allLevels, cardsOfLevel, data } from '../../game/data';
import type { BgmTrackDef, CardDef } from '../../game/types';
import { AudioField, CeShell, useDraft } from './common';

const CHARS_PER_TRACK = 1500; // 与 tools/validate_data.py BGM_CHARS_PER_TRACK、tools/bgm_plan.py 一致
const MIN_PER_LEVEL = 2;

const TAG_RE = /\{\{e_[a-z0-9_]+\|([^}]*)\}\}/g;

/** 正文字数口径 = validate_data.card_text_len：标签按显示名计，[[NPCn]] 按字面计 */
function cardChars(c: CardDef): number {
  return c.segments.reduce((n, s) => n + s.text.replace(TAG_RE, (_, name: string) => name).length, 0);
}

function requiredTracks(chars: number): number {
  return Math.max(Math.round(chars / CHARS_PER_TRACK), MIN_PER_LEVEL);
}

type Stage = BgmTrackDef['stage'];

const stageLabel = (st: Stage): string => (st === 'title' ? '封面' : st === 'ending' ? '结局' : `第${st}关`);

export default function BgmEditor() {
  const [draft, upd] = useDraft<{ tracks: BgmTrackDef[] }>(() => ({
    tracks: structuredClone(data.assets.bgm ?? []),
  }));
  const levels = allLevels();
  const cardById = new Map(data.cards.map((c) => [c.id, c]));
  const stages: Stage[] = ['title', ...levels, 'ending'];

  // ---- 自检（与 validate_data.check_bgm 同规则）----
  const errors: string[] = [];
  const specErrors: string[] = [];
  const warnings: string[] = [];
  const seenId = new Set<string>();
  const seenFile = new Set<string>();
  for (const tr of draft.tracks) {
    if (!tr.id.trim()) errors.push('有曲目 id 为空');
    else if (seenId.has(tr.id)) errors.push(`曲目 id 重复：${tr.id}`);
    seenId.add(tr.id);
    if (!tr.file.trim()) errors.push(`曲目 ${tr.id || '?'} 文件路径为空`);
    else if (seenFile.has(tr.file)) errors.push(`曲目 ${tr.id} 文件路径与他曲重复：${tr.file}`);
    seenFile.add(tr.file);
    if (!tr.title.trim()) errors.push(`曲目 ${tr.id} 缺曲名`);
    if (tr.unlockCard) {
      const c = cardById.get(tr.unlockCard);
      if (!c) errors.push(`曲目 ${tr.id} 绑定的卡不存在：${tr.unlockCard}`);
      else if (c.level !== tr.stage) errors.push(`曲目 ${tr.id} 绑定的卡《${c.title}》属第${c.level}关，但曲目在${stageLabel(tr.stage)}`);
    }
    if (!(tr.prompt ?? '').trim()) specErrors.push(`曲目 ${tr.id} 缺 prompt（生成真源，也是「复制prompt」的内容）`);
  }
  if (!draft.tracks.some((tr) => tr.stage === 'title')) warnings.push('缺封面曲（stage=title）');
  if (!draft.tracks.some((tr) => tr.stage === 'ending')) warnings.push('缺结局曲（stage=ending）');

  const stat = levels.map((lv) => {
    const cards = cardsOfLevel(lv);
    const chars = cards.reduce((n, c) => n + cardChars(c), 0);
    const tracks = draft.tracks.filter((tr) => tr.stage === lv);
    const intro = tracks.filter((tr) => !tr.unlockCard).length;
    const need = requiredTracks(chars);
    if (intro !== 1) errors.push(`第${lv}关开篇曲（无绑定卡）须恰 1 首，现有 ${intro}`);
    if (tracks.length < need) specErrors.push(`第${lv}关 ${tracks.length} 首，正文 ${chars} 字应有 ≥${need} 首（含开篇曲）`);
    const rows = new Map<number, number>();
    for (const tr of tracks) {
      const c = tr.unlockCard ? cardById.get(tr.unlockCard) : undefined;
      if (c) rows.set(c.row, (rows.get(c.row) ?? 0) + 1);
    }
    for (const [r, n] of rows) if (n > 1) warnings.push(`第${lv}关有 ${n} 首卡曲同绑时间轴第${r}行（应按行铺开）`);
    return { lv, chars, need, have: tracks.length, intro, rows: data.timelines[String(lv)]?.rows.length ?? 0 };
  });

  const save = () =>
    saveGameData((g) => {
      g.assets.bgm = draft.tracks.map((tr) => {
        const out: BgmTrackDef = { id: tr.id.trim(), file: tr.file.trim(), title: tr.title.trim(), stage: tr.stage };
        if (tr.unlockCard) out.unlockCard = tr.unlockCard;
        if ((tr.prompt ?? '').trim()) out.prompt = tr.prompt!.trim();
        if ((tr.tags ?? '').trim()) out.tags = tr.tags!.trim();
        if ((tr.note ?? '').trim()) out.note = tr.note!.trim();
        return out;
      });
    });

  const addTrack = (stage: Stage) => {
    const base = stage === 'title' ? 'title' : stage === 'ending' ? 'ending' : `l${stage}-new`;
    let id = base;
    let n = 2;
    while (draft.tracks.some((tr) => tr.id === id)) id = `${base}-${n++}`;
    upd((d) => {
      d.tracks.push({ id, file: `${assetPrefix()}/audio/${id}.mp3`, title: '', stage, prompt: '', tags: '' });
    });
  };

  const setField = (idx: number, fn: (tr: BgmTrackDef) => void) => upd((d) => fn(d.tracks[idx]));

  return (
    <CeShell title="DEBUG-内容 · 背景音乐（assets.bgm）" onSave={save} errors={errors} specErrors={specErrors} warnings={warnings}>
      <div className="ce-sec">
        <div className="ce-sec-title">曲数自检（每关 = max(round(正文字数 / {CHARS_PER_TRACK}), {MIN_PER_LEVEL})，含开篇曲）</div>
        <div className="ce-bgm-stats">
          {stat.map((x) => (
            <span key={x.lv} className={`ce-bgm-stat${x.have >= x.need && x.intro === 1 ? ' ok' : ' bad'}`}>
              第{x.lv}关 {x.chars} 字 → 应有 {x.need} / 现有 {x.have}（开篇 {x.intro}，时间轴 {x.rows} 行）
            </span>
          ))}
        </div>
        <div className="ce-note">
          生成：<code>python tools/gen_bgm.py {data.meta.id} --clean</code>（全量并发）或 <code>--only &lt;id&gt; --force</code>（单曲重做）；
          备选 clip 在 <code>DEBUG/bgm_alt/</code>。设计规范与 prompt 模板见 doc/14-bgm-pipeline.md。
        </div>
      </div>

      {stages.map((st) => {
        const idxs = draft.tracks.map((tr, i) => (tr.stage === st ? i : -1)).filter((i) => i >= 0);
        const lvCards = typeof st === 'number' ? cardsOfLevel(st).slice().sort((a, b) => a.row - b.row || a.col.localeCompare(b.col)) : [];
        return (
          <div className="ce-sec" key={String(st)}>
            <div className="ce-sec-title">
              {stageLabel(st)}
              <span className="ce-note" style={{ marginLeft: 8 }}>
                {idxs.length} 首
              </span>
              <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => addTrack(st)}>
                新增曲目
              </button>
            </div>
            {idxs.map((i) => {
              const tr = draft.tracks[i];
              const card = tr.unlockCard ? cardById.get(tr.unlockCard) : undefined;
              return (
                <div className="ce-bgm-track" key={i}>
                  <div className="ce-row">
                    <span className="ce-row-label">id</span>
                    <input
                      className="ce-input"
                      style={{ width: 130 }}
                      value={tr.id}
                      onChange={(e) => setField(i, (t) => void (t.id = e.target.value))}
                    />
                    <span className="ce-row-label">曲名</span>
                    <input
                      className="ce-input"
                      style={{ width: 150 }}
                      value={tr.title}
                      placeholder="≤6 字为佳（迷你播放器 6em）"
                      onChange={(e) => setField(i, (t) => void (t.title = e.target.value))}
                    />
                    <span className="ce-row-label">阶段</span>
                    <select
                      className="ce-input"
                      value={String(tr.stage)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setField(i, (t) => {
                          t.stage = v === 'title' || v === 'ending' ? v : Number(v);
                          delete t.unlockCard;
                        });
                      }}
                    >
                      {stages.map((s) => (
                        <option key={String(s)} value={String(s)}>
                          {stageLabel(s)}
                        </option>
                      ))}
                    </select>
                    {typeof tr.stage === 'number' ? (
                      <>
                        <span className="ce-row-label">绑定</span>
                        <select
                          className="ce-input"
                          style={{ maxWidth: 260 }}
                          value={tr.unlockCard ?? ''}
                          onChange={(e) =>
                            setField(i, (t) => {
                              if (e.target.value) t.unlockCard = e.target.value;
                              else delete t.unlockCard;
                            })
                          }
                        >
                          <option value="">开篇曲（进关即播）</option>
                          {lvCards.map((c) => (
                            <option key={c.id} value={c.id}>
                              row {c.row} · {c.col} · {c.title}（{c.form}）
                            </option>
                          ))}
                        </select>
                      </>
                    ) : null}
                    <button
                      className="btn"
                      style={{ marginLeft: 'auto' }}
                      onClick={() => {
                        if (window.confirm(`删除曲目 ${tr.id}？（mp3 文件不会被删除）`)) upd((d) => void d.tracks.splice(i, 1));
                      }}
                    >
                      删除
                    </button>
                  </div>
                  <div className="ce-row">
                    <span className="ce-row-label">文件</span>
                    <input
                      className="ce-input"
                      style={{ flex: 1 }}
                      value={tr.file}
                      onChange={(e) => setField(i, (t) => void (t.file = e.target.value))}
                    />
                    <span className="ce-row-label">tags</span>
                    <input
                      className="ce-input"
                      style={{ flex: 1.4 }}
                      value={tr.tags ?? ''}
                      placeholder="instrumental, bansuri, cello, cinematic, no vocals"
                      onChange={(e) => setField(i, (t) => void (t.tags = e.target.value))}
                    />
                  </div>
                  <div className="ce-row">
                    <span className="ce-row-label">备注</span>
                    <input
                      className="ce-input"
                      style={{ flex: 1 }}
                      value={tr.note ?? ''}
                      placeholder="设计意图：动机 / 人物乐器 / BPM / 对应情节"
                      onChange={(e) => setField(i, (t) => void (t.note = e.target.value))}
                    />
                  </div>
                  <textarea
                    className="ce-input ce-prompt"
                    rows={3}
                    value={tr.prompt ?? ''}
                    placeholder="英文 Suno 描述：Pure instrumental, no vocals. <BPM>, <主奏 / 伴奏乐器>, <全作动机如何出现>, <情绪弧>. 2-3 minutes."
                    onChange={(e) => setField(i, (t) => void (t.prompt = e.target.value))}
                  />
                  <AudioField path={tr.file} trackId={tr.id} prompt={tr.prompt ?? ''} />
                  {card ? (
                    <div className="ce-note">
                      解锁时机：《{card.title}》验证完成（第{card.level}关 · 第{card.row}行 · {card.col} 列）
                    </div>
                  ) : typeof tr.stage === 'number' ? (
                    <div className="ce-note">开篇曲：进入第{tr.stage}关时清空歌单、只放此曲并起播</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}
    </CeShell>
  );
}
