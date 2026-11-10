// DEBUG-文案 · 框架故事编辑器：关卷过场（levelIntro）与结局（标题/段落/落款）
import { saveGameData } from '../../game/copyedit';
import { data } from '../../game/data';
import type { CopyeditConf } from '../../game/store';
import type { FrameSeg } from '../../game/types';
import { CeShell, useDraft } from './common';

interface SegDraft {
  kind: 'narration' | 'dialogue';
  speaker: string;
  text: string;
}

interface FrameDraft {
  title: string;
  credit: string;
  segs: SegDraft[];
}

const toDraft = (s: FrameSeg): SegDraft =>
  s.kind === 'narration' ? { kind: 'narration', speaker: '', text: s.text } : { kind: 'dialogue', speaker: s.speaker, text: s.text };

const fromDraft = (s: SegDraft): FrameSeg =>
  s.kind === 'narration' ? { kind: 'narration', text: s.text } : { kind: 'dialogue', speaker: s.speaker.trim(), text: s.text };

export default function FrameEditor({ conf }: { conf: Extract<CopyeditConf, { kind: 'frame' }> }) {
  const isEnding = conf.target === 'ending';
  const [draft, upd] = useDraft<FrameDraft>(() =>
    isEnding
      ? {
          title: data.frame.ending.title,
          credit: data.frame.ending.credit,
          segs: data.frame.ending.segments.map(toDraft),
        }
      : {
          title: '',
          credit: '',
          segs: (data.frame.levelIntro[String(conf.target === 'intro' ? conf.level : 0)] ?? []).map(toDraft),
        },
  );

  // 故事框只讲故事（README_game §4.7）：旁白不得称呼玩家，全段不得出现玩法词汇
  const BANNED_WORDS = ['残页', '页序', '拼回', '拼齐', '归位', '词条', '时间轴', '完形填空', '活计', '关卡', '存档', '本关'];
  const BANNED_SPEAKERS = ['拾遗', '修复员', '老编辑', '老馆员', '老商人', '守屋'];

  const errors: string[] = [];
  const specErrors: string[] = [];
  if (draft.segs.length === 0) errors.push('至少要有一段文字');
  draft.segs.forEach((sg, i) => {
    if (sg.kind === 'dialogue' && !sg.speaker.trim()) errors.push(`第 ${i + 1} 段发言人的名字不能为空`);
    if (sg.kind === 'narration' && /[你您]|玩家/.test(sg.text))
      specErrors.push(`第 ${i + 1} 段旁白出现了对玩家的称呼（你/您/玩家）：故事框只讲故事`);
    const hit = BANNED_WORDS.filter((w) => sg.text.includes(w));
    if (hit.length) specErrors.push(`第 ${i + 1} 段出现玩法词汇「${hit.join('、')}」：操作说明只放「玩法说明」`);
    if (sg.kind === 'dialogue' && BANNED_SPEAKERS.some((w) => sg.speaker.includes(w)))
      specErrors.push(`第 ${i + 1} 段的发言人是框架叙述者/玩家身份，只能是故事里的人物`);
  });
  if (isEnding && !draft.title.trim()) errors.push('结局标题不能为空');
  if (!isEnding && draft.segs.length < 5) specErrors.push('每卷过场至少 5 段');
  if (isEnding && draft.segs.length < 8) specErrors.push('结局至少 8 段（事实 / 代价 / 主题 / 余响）');

  const save = () =>
    saveGameData((g) => {
      if (isEnding) {
        g.frame.ending.title = draft.title.trim();
        g.frame.ending.credit = draft.credit;
        g.frame.ending.segments = draft.segs.map(fromDraft);
      } else if (conf.target === 'intro') {
        g.frame.levelIntro[String(conf.level)] = draft.segs.map(fromDraft);
      }
    });

  const moveSeg = (i: number, dir: -1 | 1) =>
    upd((d) => {
      const j = i + dir;
      [d.segs[i], d.segs[j]] = [d.segs[j], d.segs[i]];
    });

  return (
    <CeShell
      title={isEnding ? 'DEBUG-文案 · 结局' : `DEBUG-文案 · 第${conf.target === 'intro' ? conf.level : ''}卷过场`}
      onSave={save}
      errors={errors}
      specErrors={specErrors}
    >
      {isEnding ? (
        <div className="ce-sec">
          <div className="ce-sec-title">结局文案</div>
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
            <span className="ce-row-label">落款</span>
            <textarea
              className="ce-textarea"
              style={{ flex: 1 }}
              rows={1}
              value={draft.credit}
              onChange={(e) => upd((d) => void (d.credit = e.target.value))}
            />
          </div>
        </div>
      ) : null}
      <div className="ce-sec">
        <div className="ce-sec-title">
          段落（{draft.segs.length}）
          <span className="ce-note">「发言」渲染为首字印章 + 气泡（发言人是纯文本名，不连词条）</span>
        </div>
        {draft.segs.map((sg, i) => (
          <div key={i}>
            <div className="ce-seg">
              <div className="ce-seg-head">
                <span className="ce-seg-idx">{i + 1}.</span>
                <select
                  className="ce-select"
                  value={sg.kind}
                  onChange={(e) => upd((d) => void (d.segs[i].kind = e.target.value as SegDraft['kind']))}
                >
                  <option value="narration">旁白</option>
                  <option value="dialogue">发言</option>
                </select>
                {sg.kind === 'dialogue' ? (
                  <input
                    className="ce-input"
                    style={{ width: 140 }}
                    placeholder="发言人（如：守屋老人）"
                    value={sg.speaker}
                    onChange={(e) => upd((d) => void (d.segs[i].speaker = e.target.value))}
                  />
                ) : null}
                <span className="ce-seg-tools">
                  <button className="ce-mini-btn" disabled={i === 0} onClick={() => moveSeg(i, -1)}>
                    ↑
                  </button>
                  <button className="ce-mini-btn" disabled={i === draft.segs.length - 1} onClick={() => moveSeg(i, 1)}>
                    ↓
                  </button>
                  <button
                    className="ce-mini-btn danger"
                    onClick={() => {
                      if (window.confirm(`删除第 ${i + 1} 段？`)) upd((d) => void d.segs.splice(i, 1));
                    }}
                  >
                    删除
                  </button>
                </span>
              </div>
              <textarea
                className="ce-textarea"
                rows={Math.max(2, Math.ceil(sg.text.length / 42))}
                value={sg.text}
                onChange={(e) => upd((d) => void (d.segs[i].text = e.target.value))}
              />
            </div>
            <div className="ce-add-line">
              <button
                className="ce-mini-btn"
                onClick={() => upd((d) => void d.segs.splice(i + 1, 0, { kind: 'narration', speaker: '', text: '' }))}
              >
                ＋在此处插入一段
              </button>
            </div>
          </div>
        ))}
        {draft.segs.length === 0 ? (
          <div className="ce-add-line">
            <button
              className="ce-mini-btn"
              onClick={() => upd((d) => void d.segs.push({ kind: 'narration', speaker: '', text: '' }))}
            >
              ＋添加第一段
            </button>
          </div>
        ) : null}
      </div>
    </CeShell>
  );
}
