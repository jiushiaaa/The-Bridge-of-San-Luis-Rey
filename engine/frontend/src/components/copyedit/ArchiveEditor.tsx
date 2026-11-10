// DEBUG-文案 · 档案编辑器：某词条的各关档案页（标题 / 字段 / 留白答案）+ 词条图片
// 自动化：留白的候选池 pool 按所选答案的词条分类自动推导（不用填）；字段文本/填空一键切换；
//         页与字段增删排序；答案改动保存后玩家相应留白自动重置作答。
import { ceDirty, saveGameData, setCeDirty } from '../../game/copyedit';
import { data, entryDef, maxLevel, TYPE_LABEL } from '../../game/data';
import { setUi } from '../../game/store';
import type { ArchivePage, EntryTier } from '../../game/types';
import { CeShell, defaultEntryImagePath, EntryPickButton, ImageField, useDraft } from './common';
import Icon from '../Icon';

interface ArcDraft {
  pages: ArchivePage[];
}

/** 重要度分层的档案规格（README_game §4.2，与 tools/validate_data.py 的 TIER_SPEC 一致） */
const TIER_SPEC: Record<EntryTier, { pages: [number, number]; fields: [number, number]; blanks: number }> = {
  core: { pages: [2, 4], fields: [5, 6], blanks: 2 },
  major: { pages: [1, 2], fields: [4, 5], blanks: 1 },
  minor: { pages: [0, 1], fields: [3, 4], blanks: 0 },
};
const BLANK_SHARE_MAX = 0.12;
const BLANK_COUNT_MAX = 5;
const BLANK_UNIQUE_MIN = 0.6;

/** 全作留白答案分布：用草稿页替换掉本词条现有的档案后重新统计（编辑时实时反馈） */
function blankDistribution(entryId: string, draftPages: ArchivePage[]): { counts: Map<string, number>; total: number } {
  const counts = new Map<string, number>();
  let total = 0;
  const bump = (id?: string) => {
    if (!id) return;
    counts.set(id, (counts.get(id) ?? 0) + 1);
    total++;
  };
  for (const [id, e] of Object.entries(data.entries)) {
    const pages = id === entryId ? draftPages : (e.archive ?? []);
    for (const p of pages) for (const f of p.fields) bump(f.blank?.answer);
  }
  return { counts, total };
}

export default function ArchiveEditor({ entryId }: { entryId: string }) {
  const def = entryDef(entryId)!;
  const isPerson = def.type === 'person';
  const [draft, upd] = useDraft<ArcDraft>(() => ({ pages: structuredClone(def.archive ?? []) }));

  const switchTo = (id: string) => {
    if (id === entryId) return;
    if (ceDirty() && !window.confirm('当前词条的档案有未保存修改，切换会丢弃，继续？')) return;
    setCeDirty(false);
    setUi({ copyedit: { kind: 'archive', entryId: id } });
  };

  const errors: string[] = [];
  const specErrors: string[] = [];
  const tier = def.tier ?? 'major';
  const spec = TIER_SPEC[tier];
  draft.pages.forEach((p, pi) => {
    if (!p.title.trim()) errors.push(`第 ${pi + 1} 页的页标题不能为空`);
    p.fields.forEach((f, fi) => {
      if (!f.label.trim()) errors.push(`第 ${pi + 1} 页第 ${fi + 1} 个字段的标签不能为空`);
      if (f.blank && !f.blank.answer) errors.push(`第 ${pi + 1} 页字段「${f.label}」的留白还没有选择答案`);
      if (f.blank?.answer && !data.entries[f.blank.answer])
        errors.push(`第 ${pi + 1} 页字段「${f.label}」的留白答案已不存在`);
      const t = (f.text ?? '').trim();
      if (!f.blank && t.length > 0 && t.length < 8)
        specErrors.push(`第 ${pi + 1} 页「${f.label}」只有 ${t.length} 字：档案字段正文不得少于 8 字（禁止标签式）`);
    });
    if (p.fields.length === 0) errors.push(`第 ${pi + 1} 页没有任何字段`);
    if (p.fields.length < spec.fields[0] || p.fields.length > spec.fields[1]) {
      specErrors.push(
        `第 ${pi + 1} 页有 ${p.fields.length} 个字段，${tier} 规格是 ${spec.fields[0]}~${spec.fields[1]} 个`,
      );
    }
    const nb = p.fields.filter((f) => f.blank).length;
    if (nb < spec.blanks) specErrors.push(`第 ${pi + 1} 页只有 ${nb} 处留白，${tier} 规格是 ≥${spec.blanks} 处`);
    const ans = p.fields.map((f) => f.blank?.answer).filter(Boolean);
    if (new Set(ans).size !== ans.length) specErrors.push(`第 ${pi + 1} 页有多处留白指向同一个词条（同页不得重答案）`);
  });
  if (draft.pages.length < spec.pages[0] || draft.pages.length > spec.pages[1]) {
    specErrors.push(`共 ${draft.pages.length} 页，${tier} 规格是 ${spec.pages[0]}~${spec.pages[1]} 页`);
  }
  const labels = draft.pages.flatMap((p) => p.fields.filter((f) => f.blank).map((f) => f.label.trim()));
  for (const l of new Set(labels)) {
    if (l && labels.filter((x) => x === l).length > 1) specErrors.push(`留白标签「${l}」在多页重复（同词条跨页不得重复）`);
  }
  // 全作留白答案分布（README_game §4.3）：把本词条的改动算进去后重新统计
  const dist = blankDistribution(entryId, draft.pages);
  for (const [id, n] of dist.counts) {
    if (n > BLANK_COUNT_MAX || n / dist.total > BLANK_SHARE_MAX) {
      specErrors.push(
        `全作留白里「${entryDef(id)?.name ?? id}」被问了 ${n} 次（${Math.round((n / dist.total) * 100)}%），上限 ${BLANK_COUNT_MAX} 次且 ≤${BLANK_SHARE_MAX * 100}%`,
      );
    }
  }
  if (dist.total > 0 && dist.counts.size / dist.total < BLANK_UNIQUE_MIN) {
    specErrors.push(
      `全作留白答案去重率 ${Math.round((dist.counts.size / dist.total) * 100)}%（${dist.counts.size}/${dist.total}），下限 60%`,
    );
  }

  const save = () =>
    saveGameData((g) => {
      const e = g.entries[entryId];
      if (!e) return;
      const pages = structuredClone(draft.pages);
      for (const p of pages) {
        p.title = p.title.trim();
        for (const f of p.fields) {
          if (f.blank) f.blank.pool = g.entries[f.blank.answer]?.type ?? f.blank.pool; // pool 自动推导
        }
      }
      if (pages.length > 0) e.archive = pages;
      else delete e.archive;
    });

  const movePage = (pi: number, dir: -1 | 1) =>
    upd((d) => {
      const j = pi + dir;
      [d.pages[pi], d.pages[j]] = [d.pages[j], d.pages[pi]];
    });

  const moveField = (pi: number, fi: number, dir: -1 | 1) =>
    upd((d) => {
      const arr = d.pages[pi].fields;
      const j = fi + dir;
      [arr[fi], arr[j]] = [arr[j], arr[fi]];
    });

  return (
    <CeShell title={`DEBUG-文案 · 档案「${def.name}」`} onSave={save} errors={errors} specErrors={specErrors}>
      <div className="ce-row">
        <span className="ce-row-label">编辑哪个词条</span>
        <select className="ce-select" value={entryId} onChange={(e) => switchTo(e.target.value)}>
          {Object.entries(data.entries).map(([id, d]) => (
            <option key={id} value={id}>
              {TYPE_LABEL[d.type]} · {d.name}
              {d.archive?.length ? `（${d.archive.length} 页档案）` : '（暂无档案）'}
            </option>
          ))}
        </select>
        <ImageField
          label={isPerson ? '词条头像（档案大图）' : '词条图片（档案大图）'}
          path={isPerson ? def.avatar : def.image}
          defaultPath={defaultEntryImagePath(entryId, isPerson ? 'avatar' : 'image')}
          onPath={(p) =>
            void saveGameData((g) => {
              const e = g.entries[entryId];
              if (!e) return;
              if (isPerson) e.avatar = p;
              else e.image = p;
            })
          }
        />
      </div>
      <div className="ce-sec">
        <div className="ce-sec-title">
          档案页（{draft.pages.length}）
          <button
            className="btn"
            onClick={() =>
              upd((d) =>
                void d.pages.push({
                  level: Math.min(maxLevel, (d.pages[d.pages.length - 1]?.level ?? 0) + 1),
                  title: '',
                  fields: [{ label: '', text: '' }],
                }),
              )
            }
          >
            ＋添加档案页
          </button>
          <span className="ce-note">
            每页属于一关；分析一次解开一页；留白答案改动后玩家该空会自动重置作答。
            本词条 tier＝{tier}，规格：{spec.pages[0]}~{spec.pages[1]} 页 / 每页 {spec.fields[0]}~{spec.fields[1]} 字段 /
            每页 ≥{spec.blanks} 处留白。全作留白共 {dist.total} 处，去重 {dist.counts.size} 个词条（
            {dist.total > 0 ? Math.round((dist.counts.size / dist.total) * 100) : 0}%，下限 60%）。
          </span>
        </div>
        {draft.pages.map((p, pi) => (
          <div className="ce-arc-page" key={pi}>
            <div className="ce-seg-head">
              <span className="ce-row-label">第</span>
              <select
                className="ce-select"
                value={p.level}
                onChange={(e) => upd((d) => void (d.pages[pi].level = Number(e.target.value)))}
              >
                {Array.from({ length: maxLevel }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
              <span className="ce-row-label">关 · 页标题</span>
              <input
                className="ce-input"
                style={{ width: 220 }}
                value={p.title}
                onChange={(e) => upd((d) => void (d.pages[pi].title = e.target.value))}
              />
              <span className="ce-seg-tools">
                <button className="ce-mini-btn" disabled={pi === 0} onClick={() => movePage(pi, -1)}>
                  ↑
                </button>
                <button className="ce-mini-btn" disabled={pi === draft.pages.length - 1} onClick={() => movePage(pi, 1)}>
                  ↓
                </button>
                <button
                  className="ce-mini-btn danger"
                  onClick={() => {
                    if (window.confirm(`删除「第${p.level}关 · ${p.title || '未命名'}」这一页？`))
                      upd((d) => void d.pages.splice(pi, 1));
                  }}
                >
                  删除此页
                </button>
              </span>
            </div>
            {p.fields.map((f, fi) => (
              <div className="ce-field-row" key={fi}>
                <input
                  className="ce-input"
                  placeholder="字段标签（如：身份）"
                  value={f.label}
                  onChange={(e) => upd((d) => void (d.pages[pi].fields[fi].label = e.target.value))}
                />
                <select
                  className="ce-select"
                  value={f.blank ? 'blank' : 'text'}
                  onChange={(e) =>
                    upd((d) => {
                      const fd = d.pages[pi].fields[fi];
                      if (e.target.value === 'text') {
                        delete fd.blank;
                        fd.text ??= '';
                      } else {
                        delete fd.text;
                        fd.blank ??= { answer: '', pool: 'person' };
                      }
                    })
                  }
                >
                  <option value="text">文本</option>
                  <option value="blank">留白</option>
                </select>
                {f.blank ? (
                  <span>
                    <EntryPickButton
                      value={f.blank.answer || null}
                      types={null}
                      placeholder="选择留白答案"
                      title={`字段「${f.label || '（未命名）'}」的留白答案`}
                      onPick={(id) =>
                        upd((d) => {
                          const fd = d.pages[pi].fields[fi];
                          fd.blank = { answer: id, pool: entryDef(id)?.type ?? 'person' };
                        })
                      }
                    />
                    {f.blank.answer ? (
                      <span className="ce-pool-badge">
                        候选池自动＝{TYPE_LABEL[entryDef(f.blank.answer)?.type ?? f.blank.pool]}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <textarea
                    className="ce-textarea"
                    rows={Math.max(1, Math.ceil((f.text ?? '').length / 30))}
                    value={f.text ?? ''}
                    onChange={(e) => upd((d) => void (d.pages[pi].fields[fi].text = e.target.value))}
                  />
                )}
                <span className="ce-seg-tools">
                  <button className="ce-mini-btn" disabled={fi === 0} onClick={() => moveField(pi, fi, -1)}>
                    ↑
                  </button>
                  <button
                    className="ce-mini-btn"
                    disabled={fi === p.fields.length - 1}
                    onClick={() => moveField(pi, fi, 1)}
                  >
                    ↓
                  </button>
                  <button
                    className="ce-mini-btn danger"
                    onClick={() => upd((d) => void d.pages[pi].fields.splice(fi, 1))}
                  >
                    <Icon name="close" size={10} />
                  </button>
                </span>
              </div>
            ))}
            <button
              className="ce-mini-btn"
              onClick={() => upd((d) => void d.pages[pi].fields.push({ label: '', text: '' }))}
            >
              ＋添加字段
            </button>
          </div>
        ))}
      </div>
    </CeShell>
  );
}
