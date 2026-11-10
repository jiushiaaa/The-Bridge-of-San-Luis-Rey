// DEBUG-文案 · 词条库编辑器：新建/删除词条、分类与重要度、名字、简介、图片与生图 prompt
// 自动化：改名自动级联（时间轴列名、卡片列名、正文标记显示名），散文残留列出清单人工复查；
//         本关熟悉度上限只读展示（由正文与答案自动计算）；换图立即写盘生效；
//         删除前自动扫描全部引用点，有引用一律拦下并列出位置。
import { useState } from 'react';
import { saveGameData } from '../../game/copyedit';
import {
  allLevels,
  data,
  familiarMaxOf,
  TYPE_LABEL,
  TYPE_ORDER,
} from '../../game/data';
import { useGame } from '../../game/store';
import type { EntryTier, EntryType, GameData } from '../../game/types';
import {
  CeShell,
  defaultEntryImagePath,
  findPlainNameUses,
  ImageField,
  renameEntryCascade,
  useDraft,
} from './common';
import Icon, { TypeIcon } from '../Icon';

interface EntryDraft {
  name: string;
  desc: string;
  type: EntryType;
  tier: EntryTier;
  look: string;
  avatarPrompt: string;
  imagePrompt: string;
  isNew?: boolean;
}

interface EditorDraft {
  entries: Record<string, EntryDraft>;
  removed: string[];
  /** 关卡号 → 开局赠送词条 id 列表 */
  levelStart: Record<string, string[]>;
}

/** tier 规格（与 README_game §4.2 / validate_data.py 的 TIER_SPEC 一致），编辑时实时提示 */
const TIER_DESC: Record<EntryTier, [number, number]> = { core: [30, 60], major: [20, 40], minor: [12, 30] };
const TIER_LABEL: Record<EntryTier, string> = { core: 'core 重要', major: 'major 一般', minor: 'minor 低' };

/** 列出某词条在数据里的全部引用点（删除前的安全检查） */
function referencesOf(g: GameData, id: string): string[] {
  const name = g.entries[id]?.name ?? '';
  const out: string[] = [];
  for (const c of g.cards) {
    const n =
      c.segments.filter((s) => s.text.includes(`{{${id}|`)).length +
      c.blanks.filter((b) => (Array.isArray(b.answer) ? b.answer : [b.answer]).includes(id)).length +
      c.segments.filter((s) => 'speakerEntry' in s && s.speakerEntry === id).length +
      (c.cgChars ?? []).filter((x) => x === id).length;
    if (n > 0) out.push(`卡《${c.title}》×${n}`);
  }
  for (const [lv, t] of Object.entries(g.timelines)) {
    if (t.cols.includes(name)) out.push(`第${lv}关时间轴列头`);
  }
  for (const [lv, ids] of Object.entries(g.levelStartEntries)) {
    if (ids.includes(id)) out.push(`第${lv}关开局赠送`);
  }
  for (const [oid, e] of Object.entries(g.entries)) {
    for (const p of e.archive ?? []) {
      const n = p.fields.filter((f) => f.blank?.answer === id).length;
      if (n > 0) out.push(`档案「${e.name}·第${p.level}关」×${n}`);
    }
    if (oid === id && (e.archive ?? []).length > 0) out.push(`它自己有 ${e.archive!.length} 页档案`);
  }
  for (const gt of g.gates) {
    if (gt.blanks.some((b) => b.answerEntry === id)) out.push(`第${gt.after}关闸门题`);
  }
  for (const [lv, r] of Object.entries(g.recaps ?? {})) {
    const n = r.pages.reduce((k, p) => k + p.segments.filter((sg) => sg.kind === 'quote' && sg.entry === id).length, 0);
    if (n > 0) out.push(`第${lv}关故事回顾×${n}`);
  }
  return out;
}

export default function EntriesEditor() {
  const s = useGame();
  const [scope, setScope] = useState<'level' | 'all'>('level');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [draft, upd] = useDraft<EditorDraft>(() => ({
    entries: Object.fromEntries(
      Object.entries(data.entries).map(([id, e]) => [
        id,
        {
          name: e.name,
          desc: e.desc,
          type: e.type,
          tier: e.tier ?? 'major',
          look: e.look ?? '',
          avatarPrompt: e.avatarPrompt ?? '',
          imagePrompt: e.imagePrompt ?? '',
        },
      ]),
    ),
    removed: [],
    levelStart: Object.fromEntries(allLevels().map((lv) => [String(lv), [...(data.levelStartEntries[String(lv)] ?? [])]])),
  }));

  const inLevel = (id: string): boolean =>
    familiarMaxOf(id, s.level) > 0 || (draft.levelStart[String(s.level)] ?? []).includes(id);

  // 完整性：名字为空 / 名字重复（引擎按名字索引词条与时间轴列，必须唯一）
  const errors: string[] = [];
  const specErrors: string[] = [];
  const byName = new Map<string, string[]>();
  for (const [id, d] of Object.entries(draft.entries)) {
    if (draft.removed.includes(id)) continue;
    const n = d.name.trim();
    if (!n) errors.push(`「${data.entries[id]?.name ?? id}」的名字不能为空`);
    byName.set(n, [...(byName.get(n) ?? []), id]);
    const [lo, hi] = TIER_DESC[d.tier];
    const len = d.desc.trim().length;
    if (len < lo || len > hi) specErrors.push(`「${n || id}」简介 ${len} 字，${TIER_LABEL[d.tier]} 应为 ${lo}~${hi} 字`);
  }
  for (const [n, ids] of byName) {
    if (n && ids.length > 1) errors.push(`名字「${n}」被 ${ids.length} 个词条同时使用（必须唯一）`);
  }
  for (const [lv, ids] of Object.entries(draft.levelStart)) {
    for (const id of ids) {
      if (draft.removed.includes(id) || !draft.entries[id]) errors.push(`第${lv}关开局赠送里有已删除的词条 ${id}`);
    }
  }

  const addEntry = (type: EntryType) => {
    let n = 1;
    while (data.entries[`e_new${n}`] || draft.entries[`e_new${n}`]) n++;
    const id = `e_new${n}`;
    upd((d) => {
      d.entries[id] = {
        name: '',
        desc: '',
        type,
        tier: 'minor',
        look: '',
        avatarPrompt: '',
        imagePrompt: '',
        isNew: true,
      };
    });
    setScope('all');
    setOpen(id);
  };

  const removeEntry = (id: string) => {
    const refs = referencesOf(data, id);
    if (refs.length > 0) {
      window.alert(`「${data.entries[id]?.name ?? id}」还被引用着，不能删除：\n\n${refs.join('\n')}`);
      return;
    }
    if (!window.confirm(`删除词条「${draft.entries[id].name || id}」？`)) return;
    upd((d) => {
      if (d.entries[id]?.isNew) delete d.entries[id];
      else d.removed.push(id);
    });
  };

  const save = () =>
    saveGameData((g) => {
      for (const id of draft.removed) delete g.entries[id];
      for (const [id, d] of Object.entries(draft.entries)) {
        if (draft.removed.includes(id)) continue;
        const nn = d.name.trim();
        let e = g.entries[id];
        if (!e) {
          e = g.entries[id] = { name: nn, type: d.type, desc: '' };
        } else if (e.name !== nn) {
          renameEntryCascade(g, id, e.name, nn);
          e.name = nn;
        }
        e.type = d.type;
        e.tier = d.tier;
        e.desc = d.desc;
        if (d.look.trim()) e.look = d.look.trim();
        else delete e.look;
        if (d.avatarPrompt.trim()) e.avatarPrompt = d.avatarPrompt.trim();
        else delete e.avatarPrompt;
        if (d.imagePrompt.trim()) e.imagePrompt = d.imagePrompt.trim();
        else delete e.imagePrompt;
      }
      for (const [lv, ids] of Object.entries(draft.levelStart)) {
        g.levelStartEntries[lv] = ids.filter((x) => !!g.entries[x]);
      }
    });

  const visible = Object.keys(draft.entries).filter(
    (id) =>
      !draft.removed.includes(id) &&
      (scope === 'all' || inLevel(id) || draft.entries[id].isNew) &&
      (!q || (data.entries[id]?.name ?? '').includes(q) || draft.entries[id].name.includes(q) || id.includes(q)),
  );

  const startIds = draft.levelStart[String(s.level)] ?? [];

  return (
    <CeShell title="DEBUG-文案 · 词条库" onSave={save} errors={errors} specErrors={specErrors}>
      <div className="ce-row">
        <span className="ce-row-label">范围</span>
        <label>
          <input type="radio" name="ce-scope" checked={scope === 'level'} onChange={() => setScope('level')} /> 本关出场（第
          {s.level}关）
        </label>
        <label>
          <input type="radio" name="ce-scope" checked={scope === 'all'} onChange={() => setScope('all')} /> 全部词条
        </label>
        <input className="ce-input" placeholder="按名字或 id 搜索…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="ce-spacer" />
        {TYPE_ORDER.map((t) => (
          <button className="ce-mini-btn" key={t} onClick={() => addEntry(t)}>
            ＋新建{TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="ce-note" style={{ marginBottom: 12 }}>
        改名会自动同步时间轴列名、卡片归属列与正文里与旧名相同的显示名（别称不动）；散文里的旧名会列出清单供人工复查。
        换图立即写盘生效，无需点保存；prompt 与文字改动跟随「保存并生效」。点「复制prompt」把原文拷走自行出图。
      </div>

      {/* 开局赠送词条（本关） */}
      <div className="ce-sec">
        <div className="ce-sec-title">第{s.level}关开局赠送词条（levelStartEntries）</div>
        <div className="ce-row">
          {startIds.length === 0 ? <span className="ce-note">（本关不赠送任何词条）</span> : null}
          {startIds.map((id) => (
            <span className="ce-place-chip" key={id}>
              {draft.entries[id]?.name || id}
              <button
                className="ce-mini-btn danger"
                onClick={() =>
                  upd((d) => void (d.levelStart[String(s.level)] = d.levelStart[String(s.level)].filter((x) => x !== id)))
                }
              >
                <Icon name="close" size={10} />
              </button>
            </span>
          ))}
          <select
            className="ce-select"
            value=""
            onChange={(e) => {
              const id = e.target.value;
              if (id) upd((d) => void d.levelStart[String(s.level)].push(id));
            }}
          >
            <option value="">＋添加…</option>
            {Object.keys(draft.entries)
              .filter((id) => !startIds.includes(id) && !draft.removed.includes(id))
              .map((id) => (
                <option key={id} value={id}>
                  {TYPE_LABEL[draft.entries[id].type]} · {draft.entries[id].name || id}
                </option>
              ))}
          </select>
        </div>
      </div>

      {TYPE_ORDER.map((t: EntryType) => {
        const group = visible.filter((id) => draft.entries[id].type === t);
        if (group.length === 0) return null;
        return (
          <div className="ce-sec" key={t}>
            <div className="ce-sec-title">
              <TypeIcon type={t} /> {TYPE_LABEL[t]}（{group.length}）
            </div>
            {group.map((id) => (
              <EntryRow
                key={id}
                id={id}
                d={draft.entries[id]}
                upd={upd}
                level={s.level}
                open={open === id}
                onToggle={() => setOpen(open === id ? null : id)}
                onRemove={() => removeEntry(id)}
              />
            ))}
          </div>
        );
      })}
    </CeShell>
  );
}

function EntryRow({
  id,
  d,
  upd,
  level,
  open,
  onToggle,
  onRemove,
}: {
  id: string;
  d: EntryDraft;
  upd: (fn: (dr: EditorDraft) => void) => void;
  level: number;
  open: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const def = data.entries[id];
  const isPerson = d.type === 'person';
  const path = isPerson ? def?.avatar : def?.image;
  const renamed = !!def && d.name.trim() !== def.name && d.name.trim() !== '';
  const uses = renamed ? findPlainNameUses(def.name) : [];
  const max = familiarMaxOf(id, level);
  const set = (fn: (e: EntryDraft) => void) => upd((dr) => fn(dr.entries[id]));
  return (
    <div className="ce-entry-block">
      <div className="ce-entry-row">
        <ImageField
          label={isPerson ? '头像（1:1）' : '图片（1:1）'}
          path={path}
          defaultPath={defaultEntryImagePath(id, isPerson ? 'avatar' : 'image')}
          onPath={(p) =>
            // 原本无图的词条：上传后把新路径直接写回数据（独立于文字草稿，立即保存）
            void saveGameData((g) => {
              const e = g.entries[id];
              if (!e) return;
              if (isPerson) e.avatar = p;
              else e.image = p;
            })
          }
        />
        <div className="ce-entry-name-col">
          <input
            className="ce-input"
            value={d.name}
            placeholder="名字"
            onChange={(e) => set((x) => void (x.name = e.target.value))}
          />
          <div className="ce-row">
            <select className="ce-select" value={d.type} onChange={(e) => set((x) => void (x.type = e.target.value as EntryType))}>
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <select className="ce-select" value={d.tier} onChange={(e) => set((x) => void (x.tier = e.target.value as EntryTier))}>
              {(Object.keys(TIER_LABEL) as EntryTier[]).map((t) => (
                <option key={t} value={t}>
                  {TIER_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <span className="ce-fam-note">
            {id}　{max > 0 ? `本关熟悉度上限 ${max}（自动计算）` : '本关不出场'}
          </span>
          <div className="ce-row">
            <button className="ce-mini-btn" onClick={onToggle}>
              {open ? '收起生图 prompt' : '生图 prompt ▾'}
            </button>
            <button className="ce-mini-btn danger" onClick={onRemove}>
              删除词条
            </button>
          </div>
        </div>
        <textarea
          className="ce-textarea"
          rows={Math.max(2, Math.ceil(d.desc.length / 36))}
          value={d.desc}
          placeholder="简介"
          onChange={(e) => set((x) => void (x.desc = e.target.value))}
        />
      </div>
      {open ? (
        <div className="ce-entry-prompt">
          {isPerson ? (
            <>
              <ImageField
                label="头像 prompt"
                path={def?.avatar}
                defaultPath={defaultEntryImagePath(id, 'avatar')}
                prompt={d.avatarPrompt}
                onPrompt={(v) => set((x) => void (x.avatarPrompt = v))}
                onPath={(p) => void saveGameData((g) => void (g.entries[id] && (g.entries[id].avatar = p)))}
              />
              <div className="ce-row">
                <span className="ce-row-label">定妆照</span>
                <textarea
                  className="ce-textarea"
                  rows={2}
                  value={d.look}
                  placeholder="英文定妆设定：这段会拼进每张有该人物出场的情节卡 CG prompt，保证跨图形象一致"
                  onChange={(e) => set((x) => void (x.look = e.target.value))}
                />
              </div>
            </>
          ) : (
            <ImageField
              label="词条图 prompt"
              path={def?.image}
              defaultPath={defaultEntryImagePath(id, 'image')}
              prompt={d.imagePrompt}
              promptHint={
                d.type === 'concept'
                  ? '概念图画能象征该抽象概念的意象，不要画成图解，画面内不得有文字'
                  : d.type === 'place'
                    ? '画这个地点的标志性环境'
                    : '画这件物品的静物特写'
              }
              onPrompt={(v) => set((x) => void (x.imagePrompt = v))}
              onPath={(p) => void saveGameData((g) => void (g.entries[id] && (g.entries[id].image = p)))}
            />
          )}
        </div>
      ) : null}
      {renamed && uses.length > 0 ? (
        <div className="ce-name-uses">
          旧名「{def.name}」在散文中还有出现（保存不会自动改写这些，请人工确认）：{uses.join('；')}
        </div>
      ) : null}
    </div>
  );
}
