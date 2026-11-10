// DEBUG-文案 编辑器共用件：入口按钮 / 弹窗壳 / 换图控件 / 词条与卡选择器 / 正文标记预览 / 各类小工具
// 设计原则：所有「选词条/选卡」一律用带头像与名字的选择器（复用 SlotPicker），文案作者全程不接触 id
import { useRef, useState, type ReactNode } from 'react';
import {
  assetPrefix,
  backCopyedit,
  closeCopyedit,
  copyeditAvailable,
  copyeditCanBack,
  openCopyedit,
  setCeDirty,
  uploadAudio,
  uploadImage,
} from '../../game/copyedit';
import {
  assetUrl,
  cardMentionsEntry,
  cardsOfLevel,
  data,
  directorMode,
  entryDef,
  TYPE_LABEL,
  TYPE_ORDER,
} from '../../game/data';
import { pushToast, setUi, useUi, type CopyeditConf, type PickerGroup } from '../../game/store';
import type { CardDef, EntryType, GameData } from '../../game/types';
import Avatar from '../Avatar';
import Icon from '../Icon';

export const entryName = (id: string | null | undefined): string => (id ? (entryDef(id)?.name ?? id) : '');

// ---------- 入口按钮 ----------

/** 各界面底部的 [DEBUG-文案] 按钮：后端不在线 / 离线版一律不渲染。
 *  同一处并列多个入口时用 label 区分（如时间轴底部的「时间轴」与「故事回顾」）。 */
export function CopyEditButton({
  conf,
  className,
  label,
}: {
  conf: CopyeditConf;
  className?: string;
  label?: string;
}) {
  if (!copyeditAvailable()) return null;
  const btn = (
    <button
      className="btn btn-debug"
      data-copyedit={conf.kind}
      title="修改这部分内容（保存后写回 final_game.json，立即生效）"
      onClick={() => openCopyedit(conf)}
    >
      {label ? `DEBUG-${label}` : 'DEBUG-文案'}
    </button>
  );
  return className ? <div className={className}>{btn}</div> : btn;
}

// ---------- 草稿状态 ----------

/** 编辑器草稿：深拷贝更新 + 自动标脏 */
export function useDraft<T>(init: () => T): [T, (fn: (d: T) => void) => void] {
  const [draft, setDraft] = useState<T>(init);
  const upd = (fn: (d: T) => void) => {
    setDraft((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    setCeDirty(true);
  };
  return [draft, upd];
}

// ---------- 弹窗壳 ----------

export function CeShell({
  title,
  children,
  onSave,
  saveDisabled,
  errors,
  specErrors,
  warnings,
}: {
  title: string;
  children: ReactNode;
  onSave: () => Promise<boolean>;
  saveDisabled?: boolean;
  /** 完整性错误（引用不存在、id 冲突……）：任何模式都显示并禁用保存 */
  errors?: string[];
  /** 设计规范错误（字数、分层、分布……）：wip 期禁用保存；作品标 final 后降级为建议 */
  specErrors?: string[];
  /** 软警告：显示但可保存 */
  warnings?: string[];
}) {
  const ui = useUi();
  const [saving, setSaving] = useState(false);
  const close = () => closeCopyedit();
  const canBack = copyeditCanBack();
  const doSave = async () => {
    setSaving(true);
    const ok = await onSave();
    setSaving(false);
    if (ok) setCeDirty(false);
  };
  const v = ui.ceValidation;
  // 使用者与时机（README_game §9）：作品标 final 后使用者是内容总监，规范只提示不拦
  const director = directorMode();
  const hardErrors = [...(errors ?? []), ...(director ? [] : (specErrors ?? []))];
  const softWarnings = [...(director ? (specErrors ?? []) : []), ...(warnings ?? [])];
  const blocked = hardErrors.length > 0;
  return (
    <div className="overlay" onClick={close}>
      <div className="modal ce-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          {canBack ? (
            <button className="btn" type="button" onClick={backCopyedit}>
              返回
            </button>
          ) : null}
          <span className="modal-title">{title}</span>
          {director ? (
            <span className="ce-director" title="作品已标记完工（meta.status = final）：字数、分层等设计规范只作建议，不阻断保存">
              内容总监模式 · 规范仅提示
            </span>
          ) : null}
        </div>
        <div className="modal-body scroll-y">{children}</div>
        {blocked || softWarnings.length > 0 ? (
          <div className="ce-issues scroll-y">
            {hardErrors.map((e, i) => (
              <div className="ce-issue err" key={'e' + i}>
                <Icon name="close" size={12} /> {e}
              </div>
            ))}
            {softWarnings.map((w, i) => (
              <div className="ce-issue warn" key={'w' + i}>
                <Icon name="warning" size={12} /> {w}
              </div>
            ))}
          </div>
        ) : null}
        <div className="modal-foot ce-foot">
          {v ? (
            <div className={`ce-validate ${v.state}`}>
              {v.state === 'running' ? (
                '质检运行中…'
              ) : v.state === 'ok' ? (
                <>
                  质检通过 <Icon name="check" size={12} />
                </>
              ) : v.state === 'unavailable' ? (
                `质检不可用：${v.output}`
              ) : (
                <details>
                  <summary>质检发现问题（点开看输出）</summary>
                  <pre className="ce-validate-out">{v.output}</pre>
                </details>
              )}
            </div>
          ) : (
            <div className="ce-validate idle">保存后写回 final_game.json（自动备份 + 自动质检）</div>
          )}
          <span className="ce-spacer" />
          <button className="btn" onClick={close}>
            关闭
          </button>
          <button
            className="btn btn-primary"
            disabled={saving || saveDisabled || blocked}
            title={blocked ? '请先解决上方标红的问题' : undefined}
            onClick={doSave}
          >
            {saving ? '保存中…' : '保存并生效'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- 换图控件 ----------

/**
 * 图片缩略 + 「更换图片」上传（上传即写盘并全界面刷新，无需保存；无现有图时用 defaultPath 并回填字段）
 * + 生图 prompt 编辑与「复制 prompt」（把原文拷到剪贴板，自行出图；不调用生图 API）。
 *
 * prompt 一律填**原文**（不带画风后缀）。改动跟随编辑器的「保存并生效」写进 final_game.json。
 */
export function ImageField({
  label,
  path,
  defaultPath,
  onPath,
  onUploaded,
  wide,
  prompt,
  onPrompt,
  promptHint,
  refs,
}: {
  label: string;
  path?: string;
  defaultPath: string;
  onPath?: (p: string) => void;
  onUploaded?: (f: File) => void;
  wide?: boolean; // 16:9 预览（情节卡 CG）
  /** 传入即启用 prompt 编辑与复制（undefined = 该图不需要 prompt，如程序绘制的 favicon） */
  prompt?: string;
  onPrompt?: (v: string) => void;
  promptHint?: string;
  /** 情节卡 CG 的出场人物词条 id，复制时附在备注里便于对照 */
  refs?: string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const cur = path ?? '';
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const target = cur || defaultPath;
    setBusy(true);
    const ok = await uploadImage(target, f);
    setBusy(false);
    if (ok) {
      if (!cur && onPath) onPath(target);
      onUploaded?.(f);
    }
  };
  const copyPrompt = async () => {
    const text = prompt?.trim() ?? '';
    if (!text) {
      pushToast('先写 prompt 再复制');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      pushToast('已复制 prompt');
    } catch {
      pushToast('复制失败，请手动选中 prompt 复制');
    }
  };
  return (
    <div className={`ce-img-field${wide ? ' wide' : ''}${prompt !== undefined ? ' with-prompt' : ''}`}>
      <span className="ce-img-box">
        {cur ? (
          <img key={assetUrl(cur)} src={assetUrl(cur)} alt="" onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0')} />
        ) : (
          <span className="ce-img-none">无图</span>
        )}
      </span>
      <span className="ce-img-meta">
        <span className="ce-img-label">{label}</span>
        <span className="ce-img-btns">
          <button className="btn" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? '上传中…' : '更换图片'}
          </button>
          {prompt !== undefined ? (
            <button
              className="btn btn-primary"
              disabled={busy || !prompt.trim()}
              title="把下面的 prompt 原文复制到剪贴板，自行出图后用「更换图片」换上"
              onClick={() => void copyPrompt()}
            >
              复制prompt
            </button>
          ) : null}
        </span>
        {prompt !== undefined ? (
          <>
            <textarea
              className="ce-input ce-prompt"
              rows={wide ? 4 : 3}
              value={prompt}
              placeholder="英文生图 prompt（只写画面本身，画风后缀由引擎自动拼）"
              onChange={(e) => onPrompt?.(e.target.value)}
            />
            <span className="ce-note">
              {promptHint ?? '只写画面原文，不要带 “Japanese anime style / no watermark” 等画风后缀'}
              {refs && refs.length > 0 ? `　出场人物：${refs.map(entryName).join('、')}` : ''}
            </span>
          </>
        ) : null}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ---------- 换音频控件（BGM）----------

/**
 * 试听 `<audio controls>` + 「更换音频」（上传 mp3 即写盘并强刷；正在播这一曲时立即重载）
 * + 「复制prompt」（把 Suno 描述原文拷到剪贴板，自行生成后换上）。
 * 刻意**不提供**「重新生成」：生成走命令行 tools/gen_bgm.py（见 doc/14），DEBUG 只负责复制 prompt 与换文件。
 * prompt / tags 的改动跟随编辑器的「保存并生效」写进 final_game.json。
 */
export function AudioField({
  path,
  trackId,
  prompt,
  onUploaded,
}: {
  path: string;
  trackId: string;
  prompt: string;
  onUploaded?: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    const ok = await uploadAudio(path, f, trackId);
    setBusy(false);
    if (ok) onUploaded?.(f);
  };
  const copyPrompt = async () => {
    const text = prompt.trim();
    if (!text) {
      pushToast('先写 prompt 再复制');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      pushToast('已复制音乐 prompt');
    } catch {
      pushToast('复制失败，请手动选中 prompt 复制');
    }
  };
  return (
    <div className="ce-audio-field">
      <audio key={assetUrl(path)} className="ce-audio" controls preload="none" src={assetUrl(path)} />
      <span className="ce-img-btns">
        <button className="btn" disabled={busy} title={`覆盖 ${path}`} onClick={() => inputRef.current?.click()}>
          {busy ? '上传中…' : '更换音频'}
        </button>
        <button
          className="btn btn-primary"
          disabled={busy || !prompt.trim()}
          title="把 prompt 原文复制到剪贴板，自行生成（或 python tools/gen_bgm.py <game> --only <id> --force）后用「更换音频」换上"
          onClick={() => void copyPrompt()}
        >
          复制prompt
        </button>
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="audio/mpeg,.mp3"
        style={{ display: 'none' }}
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** 词条的默认图片路径（新增图片时用；已有图片一律覆盖原路径） */
export function defaultEntryImagePath(id: string, kind: 'avatar' | 'image'): string {
  return `${assetPrefix()}/${kind === 'avatar' ? 'avatars' : 'images'}/${id}.jpg`;
}

export function defaultCgPath(cardId: string): string {
  return `${assetPrefix()}/cg/${cardId}.jpg`;
}

// ---------- 选择器（复用 SlotPicker，浮在编辑器之上） ----------

/** 全库词条选择器：按分类分组、显示头像/图片与简介；types=null 为全部分类 */
export function openEntryPicker(
  title: string,
  types: EntryType[] | null,
  onPick: (id: string) => void,
  exclude?: Set<string>,
): void {
  const groups: PickerGroup[] = TYPE_ORDER.filter((t) => !types || types.includes(t))
    .map((t) => ({
      label: TYPE_LABEL[t],
      keepOrder: true,
      items: Object.entries(data.entries)
        .filter(([id, d]) => d.type === t && !exclude?.has(id))
        .map(([id, d]) => ({ key: id, name: d.name, entryId: id, desc: t === 'person' ? undefined : d.desc })),
    }))
    .filter((g) => g.items.length > 0);
  setUi({ picker: { title, groups, onPick } });
}

/** 某关全部情节卡的选择器（按标题挑卡，不接触卡 id） */
export function openCardPicker(
  title: string,
  lv: number,
  onPick: (cardId: string) => void,
  note?: (c: CardDef) => string | undefined,
): void {
  setUi({
    picker: {
      title,
      groups: [
        {
          label: '',
          keepOrder: true,
          items: cardsOfLevel(lv).map((c) => ({ key: c.id, name: c.title, form: c.form, desc: note?.(c) })),
        },
      ],
      onPick,
    },
  });
}

/** 显示当前所选词条（头像+名字）的选择按钮 */
export function EntryPickButton({
  value,
  types,
  placeholder,
  title,
  onPick,
  exclude,
}: {
  value: string | null;
  types: EntryType[] | null;
  placeholder: string;
  title: string;
  onPick: (id: string) => void;
  exclude?: Set<string>;
}) {
  const def = value ? entryDef(value) : undefined;
  return (
    <button
      className={`blank-btn ce-pick${def ? ' filled' : ''}`}
      onClick={() => openEntryPicker(title, types, onPick, exclude)}
    >
      {def && value ? (
        <span className="blank-btn-icon">
          <Avatar entryId={value} fill />
        </span>
      ) : null}
      <span className="blank-btn-text">{def ? def.name : `${placeholder} ▾`}</span>
    </button>
  );
}

// ---------- 正文标记：预览与插入 ----------

const TOKEN_RE = /\{\{(e_[a-z0-9_]+)\|([^}]*)\}\}|\[\[(NPC\d)\]\]/g;

/** 句子实时预览：{{词条}} 渲染成 chip、[[NPCn]] 显示占位与当前答案名；不可点击、不影响游戏状态 */
export function CePreview({ text, slots }: { text: string; slots?: { slot: string; answer: string | null }[] }) {
  const parts: ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) {
      const def = entryDef(m[1]);
      if (def) {
        parts.push(
          <span key={k++} className={`entry-chip t-${def.type}`} title={`词条：${def.name}`}>
            {def.type === 'person' ? <Avatar entryId={m[1]} size={16} /> : null}
            {m[2]}
          </span>,
        );
      } else {
        parts.push(
          <span key={k++} className="ce-tok-bad" title="标记指向不存在的词条">
            {m[0]}
          </span>,
        );
      }
    } else {
      const slot = m[3];
      const b = slots?.find((p) => p.slot === slot);
      if (slots && !b) {
        parts.push(
          <span key={k++} className="ce-tok-bad" title="占位对应的人物空不存在">
            [[{slot}]]
          </span>,
        );
      } else {
        parts.push(
          <span key={k++} className="npc-unknown" title={b?.answer ? `答案：${entryName(b.answer)}` : '匿名人物占位'}>
            {slot}
            {b?.answer ? `（${entryName(b.answer)}）` : ''}
          </span>,
        );
      }
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <div className="ce-preview">{parts.length > 0 ? parts : <span className="ce-preview-empty">（空）</span>}</div>;
}

/** 在 textarea 光标处插入标记，返回新文本 */
export function insertToken(ta: HTMLTextAreaElement | null, text: string, token: string): string {
  if (!ta) return text + token;
  const a = ta.selectionStart ?? text.length;
  const b = ta.selectionEnd ?? a;
  return text.slice(0, a) + token + text.slice(b);
}

// ---------- 自动计算工具 ----------

/** 用草稿卡替换原卡后，词条在该关的熟悉度上限（与 data.familiarMaxOf 同规则，供编辑器实时反馈） */
export function famMaxWith(draftCard: CardDef, entryId: string, lv: number): number {
  let n = 0;
  for (const c of cardsOfLevel(lv)) {
    const cc = c.id === draftCard.id ? draftCard : c;
    if (cardMentionsEntry(cc, entryId) || cc.blanks.some((b) => b.answer === entryId)) n++;
  }
  return n;
}

/** 与 tools/cg_brightness.mjs 同规则：Rec.601 感知亮度均值 < 150 → 暗系（cgDark=true）；失败返回 null */
export async function measureDark(file: Blob): Promise<boolean | null> {
  try {
    const bmp = await createImageBitmap(file);
    const w = 80;
    const h = Math.max(1, Math.round((bmp.height / bmp.width) * w));
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    return sum / (px.length / 4) < 150;
  } catch {
    return null;
  }
}

const stripMarks = (t: string): string =>
  t.replace(/\{\{e_[a-z0-9_]+\|[^}]*\}\}/g, '').replace(/\[\[NPC\d\]\]/g, '');

/** 名字在各处「散文文本」中出现的位置（标记内的显示名不算——那部分保存时自动替换）。
 *  供改名后列出残留清单人工复查（散文不自动改写，避免误伤） */
export function findPlainNameUses(name: string): string[] {
  const out: string[] = [];
  if (!name) return out;
  for (const c of data.cards) {
    let n = 0;
    for (const seg of c.segments) {
      if (stripMarks(seg.text).includes(name)) n++;
      if (seg.kind === 'dialogue' && 'speaker' in seg && seg.speaker.includes(name)) n++;
    }
    if (c.title.includes(name)) n++;
    if (n > 0) out.push(`卡《${c.title}》×${n}`);
  }
  for (const g of data.gates) {
    let n = ((g.question ?? '').includes(name) ? 1 : 0) + (g.intro.includes(name) ? 1 : 0);
    for (const b of g.blanks) if (b.prompt.includes(name)) n++;
    if (n > 0) out.push(`第${g.after}关闸门×${n}`);
  }
  for (const def of Object.values(data.entries)) {
    for (const p of def.archive ?? []) {
      let n = p.title.includes(name) ? 1 : 0;
      for (const f of p.fields) if ((f.text ?? '').includes(name) || f.label.includes(name)) n++;
      if (n > 0) out.push(`档案「${def.name}·第${p.level}关」×${n}`);
    }
    if (def.desc.includes(name)) out.push(`词条「${def.name}」简介`);
  }
  for (const [lv, segs] of Object.entries(data.frame.levelIntro)) {
    const n = segs.filter((sg) => sg.text.includes(name) || (sg.kind === 'dialogue' && sg.speaker.includes(name))).length;
    if (n > 0) out.push(`第${lv}卷过场×${n}`);
  }
  const en = data.frame.ending.segments.filter((sg) => sg.text.includes(name)).length;
  if (en > 0) out.push(`结局×${en}`);
  return out;
}

/** 词条改名自动级联：时间轴列名、卡的列名、正文标记 {{id|旧名}} 的显示名（与旧名完全一致者；别称不动） */
export function renameEntryCascade(draft: GameData, id: string, oldName: string, newName: string): void {
  for (const t of Object.values(draft.timelines)) {
    t.cols = t.cols.map((c) => (c === oldName ? newName : c));
  }
  const markOld = `{{${id}|${oldName}}}`;
  const markNew = `{{${id}|${newName}}}`;
  for (const c of draft.cards) {
    if (c.col === oldName) c.col = newName;
    for (const seg of c.segments) seg.text = seg.text.split(markOld).join(markNew);
  }
}
