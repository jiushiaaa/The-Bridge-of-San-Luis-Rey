// DEBUG-文案 · 关卡闸门编辑器：标题 / 开场语 / 完形填空题目与答案
// 自动化：答案二选一（词条 / 剧情卡标题），用选择器挑选，存储字段 answerEntry/answerTitle 自动生成；
//         问题文本后引擎会自动追加「＿＿＿＿。」，作者无需自己画横线。
// 注意：闸门不是可有可无的面板——引擎的总关数取自 gates.after，删掉末关闸门等于删掉一关。
import { backCopyedit, saveGameData, setCeDirty } from '../../game/copyedit';
import { cardDef, data, gateAfterLevel, levelChapterTitle, maxLevel } from '../../game/data';
import type { GateReveal } from '../../game/types';
import { CeShell, EntryPickButton, openCardPicker, useDraft } from './common';

interface GateBlankDraft {
  prompt: string;
  kind: 'entry' | 'title';
  answer: string | null;
  revealAt: GateReveal;
}

interface GateDraft {
  question: string;
  intro: string;
  blanks: GateBlankDraft[];
}

/** 与 tools/validate_data.py 同一套：本卷之问不许对玩家说话、不许出现玩法词汇 */
const SECOND_PERSON = ['你', '您', '玩家'];
const BANNED_WORDS = ['残页', '页序', '拼回', '拼齐', '归位', '词条', '时间轴', '完形填空', '活计', '关卡', '存档', '补回名字', '本关'];
const QUESTION_MAX = 30;

export default function GateEditor({ after }: { after: number }) {
  const gate = gateAfterLevel(after)!;
  const [draft, upd] = useDraft<GateDraft>(() => ({
    question: gate.question ?? '',
    intro: gate.intro,
    blanks: gate.blanks.map((b) => ({
      prompt: b.prompt,
      kind: b.answerEntry ? 'entry' : 'title',
      answer: b.answerEntry ?? b.answerTitle ?? null,
      revealAt: b.revealAt === 'start' ? 'start' : 'gate',
    })),
  }));

  const errors: string[] = [];
  const specErrors: string[] = [];
  draft.blanks.forEach((b, i) => {
    if (!b.prompt.trim()) errors.push(`第 ${i + 1} 题的问题文本不能为空`);
    if (!b.answer) errors.push(`第 ${i + 1} 题还没有选择答案`);
    if (b.kind === 'entry' && b.answer && !data.entries[b.answer]) errors.push(`第 ${i + 1} 题的词条答案已不存在`);
    if (b.kind === 'title' && b.answer && !cardDef(b.answer)) errors.push(`第 ${i + 1} 题的剧情卡答案已不存在`);
  });
  if (draft.blanks.length === 0) errors.push('至少要有一道题');
  if (draft.blanks.length < 5 || draft.blanks.length > 6) {
    specErrors.push(`共 ${draft.blanks.length} 题，规范是 5~6 题（README_game §4.5）`);
  }
  // 本卷之问（README_game §4.5）
  const q = draft.question.trim();
  if (!q) specErrors.push('缺「本卷之问」：每卷要用一句问句说清这一卷要弄清楚的事');
  else {
    if (!/[？?]$/.test(q)) specErrors.push('本卷之问要以「？」结尾');
    if (q.length > QUESTION_MAX) specErrors.push(`本卷之问 ${q.length} 字，规范 ≤${QUESTION_MAX} 字`);
    for (const w of SECOND_PERSON) if (q.includes(w)) specErrors.push(`本卷之问不能对玩家说话（含「${w}」）`);
    for (const w of BANNED_WORDS) if (q.includes(w)) specErrors.push(`本卷之问不能出现玩法词汇「${w}」`);
  }
  // 开局可见的题 ≥3 道，且题面不得含本卷待猜词条的真名
  const startCount = draft.blanks.filter((b) => b.revealAt === 'start').length;
  if (startCount < 3) specErrors.push(`开局可见的题只有 ${startCount} 道，规范 ≥3 道（其余在 70% 前显示「？？？」）`);
  const answerNames = new Set<string>();
  for (const c of data.cards) {
    if (c.level !== after) continue;
    for (const bl of c.blanks) {
      for (const a of Array.isArray(bl.answer) ? bl.answer : [bl.answer]) {
        const nm = data.entries[a]?.name;
        if (nm) answerNames.add(nm);
      }
    }
  }
  draft.blanks.forEach((b, i) => {
    if (b.revealAt !== 'start') return;
    for (const nm of answerNames) {
      if (nm && b.prompt.includes(nm)) specErrors.push(`第 ${i + 1} 题开局可见，题面却写出了本关待猜的「${nm}」——改写或改为「开闸后可见」`);
    }
  });

  /** 删掉整扇闸门 = 少一关（maxLevel 取自 gates.after），只允许删末关的，并要求二次确认 */
  const removeGate = () => {
    if (after !== maxLevel) {
      window.alert('只能删除最后一关的闸门：删中间的会让关卡链断掉，玩家过不去。');
      return;
    }
    if (!window.confirm(`删除第${after}关的闸门？引擎按 gates.after 推导总关数，删掉后本作会变成 ${after - 1} 关。`)) return;
    void saveGameData((g) => {
      g.gates = g.gates.filter((x) => x.after !== after);
    }).then((ok) => {
      if (ok) {
        setCeDirty(false);
        backCopyedit();
      }
    });
  };

  const save = () =>
    saveGameData((g) => {
      const gt = g.gates.find((x) => x.after === after);
      if (!gt) return;
      gt.question = draft.question.trim();
      gt.intro = draft.intro;
      gt.blanks = draft.blanks.map((b) => ({
        prompt: b.prompt,
        ...(b.kind === 'entry' ? { answerEntry: b.answer! } : { answerTitle: b.answer! }),
        revealAt: b.revealAt,
      }));
    });

  const moveBlank = (i: number, dir: -1 | 1) =>
    upd((d) => {
      const j = i + dir;
      [d.blanks[i], d.blanks[j]] = [d.blanks[j], d.blanks[i]];
    });

  return (
    <CeShell title={`DEBUG-文案 · 第${after}关闸门答题`} onSave={save} errors={errors} specErrors={specErrors}>
      <div className="ce-sec">
        <div className="ce-sec-title">
          面板文案
          <span className="ce-spacer" />
          <button className="ce-mini-btn danger" onClick={removeGate}>
            删除整扇闸门
          </button>
        </div>
        <div className="ce-row">
          <span className="ce-row-label">关名</span>
          <span className="ce-static">{levelChapterTitle(after)}</span>
          <span className="ce-note">与「故事」页同源：取本关过场首段的卷名（「第N卷 · 名字」），要改去「过场」编辑器改首段</span>
        </div>
        <div className="ce-row">
          <span className="ce-row-label">本卷之问</span>
          <input
            className="ce-input"
            style={{ flex: 1 }}
            placeholder="一句问句，如：两个一起长大的朋友，为什么走上了两条路？"
            value={draft.question}
            onChange={(e) => upd((d) => void (d.question = e.target.value))}
          />
        </div>
        <div className="ce-note">
          过场末屏、出口面板头部、目标弹窗标题、顶栏提示首条都显示这一句。写法：简单直白、以「？」结尾、≤{QUESTION_MAX} 字、不用「你」、不出现玩法词汇。
        </div>
        <div className="ce-row">
          <span className="ce-row-label">旧开场语</span>
          <textarea
            className="ce-textarea"
            style={{ flex: 1 }}
            rows={2}
            value={draft.intro}
            onChange={(e) => upd((d) => void (d.intro = e.target.value))}
          />
          <span className="ce-note">界面已不显示（没有本卷之问时才回退用它），留着只为兼容</span>
        </div>
      </div>

      <div className="ce-sec">
        <div className="ce-sec-title">
          题目（{draft.blanks.length} 道）
          <button
            className="btn"
            onClick={() => upd((d) => void d.blanks.push({ prompt: '', kind: 'entry', answer: null, revealAt: 'gate' }))}
          >
            ＋添加一题
          </button>
          <span className="ce-note">
            问题末尾引擎自动补「＿＿＿＿。」，不用自己写横线。题面从进关起就列在面板里：「开局可见」的直接显示（≥3 道，不得泄底），「开闸后可见」的 70% 前显示「？？？」
          </span>
        </div>
        {draft.blanks.map((b, i) => (
          <div className="ce-seg" key={i}>
            <div className="ce-seg-head">
              <span className="ce-seg-idx">{i + 1}.</span>
              <select
                className="ce-select"
                value={b.kind}
                onChange={(e) =>
                  upd((d) => {
                    d.blanks[i].kind = e.target.value as 'entry' | 'title';
                    d.blanks[i].answer = null; // 换答案类型后重选
                  })
                }
              >
                <option value="entry">答案＝词条</option>
                <option value="title">答案＝剧情卡标题</option>
              </select>
              <select
                className="ce-select"
                value={b.revealAt}
                title="题面何时可见"
                onChange={(e) => upd((d) => void (d.blanks[i].revealAt = e.target.value as GateReveal))}
              >
                <option value="start">开局可见</option>
                <option value="gate">开闸后可见（？？？）</option>
              </select>
              {b.kind === 'entry' ? (
                <EntryPickButton
                  value={b.answer}
                  types={null}
                  placeholder="选择词条答案"
                  title={`第 ${i + 1} 题：选择词条答案`}
                  onPick={(id) => upd((d) => void (d.blanks[i].answer = id))}
                />
              ) : (
                <button
                  className={`blank-btn ce-pick${b.answer ? ' filled' : ''}`}
                  onClick={() =>
                    openCardPicker(`第 ${i + 1} 题：选择剧情卡答案（第${after}关）`, after, (cid) =>
                      upd((d) => void (d.blanks[i].answer = cid)),
                    )
                  }
                >
                  <span className="blank-btn-text">
                    {b.answer ? `《${cardDef(b.answer)?.title ?? '？'}》` : '选择剧情卡答案 ▾'}
                  </span>
                </button>
              )}
              <span className="ce-seg-tools">
                <button className="ce-mini-btn" disabled={i === 0} onClick={() => moveBlank(i, -1)}>
                  ↑
                </button>
                <button className="ce-mini-btn" disabled={i === draft.blanks.length - 1} onClick={() => moveBlank(i, 1)}>
                  ↓
                </button>
                <button
                  className="ce-mini-btn danger"
                  onClick={() => {
                    if (window.confirm(`删除第 ${i + 1} 题？`)) upd((d) => void d.blanks.splice(i, 1));
                  }}
                >
                  删除
                </button>
              </span>
            </div>
            <textarea
              className="ce-textarea"
              rows={2}
              placeholder="问题文本（如：深夜里……是在等他的父亲——一位德高望重的〔 〕开口放行。）"
              value={b.prompt}
              onChange={(e) => upd((d) => void (d.blanks[i].prompt = e.target.value))}
            />
            <div className="ce-preview">
              {b.prompt || '（问题文本）'}＿＿＿＿。
            </div>
          </div>
        ))}
        <div className="ce-note">
          题目改动保存后，玩家在该闸门的作答会自动重置（已过关状态与得分保留）。
        </div>
      </div>
    </CeShell>
  );
}
