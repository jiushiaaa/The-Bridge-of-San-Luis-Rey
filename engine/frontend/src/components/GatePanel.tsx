// 关卡出口面板（内嵌于时间轴右栏）：卷名（与「故事」页同源）+ 本卷之问 -> 大按钮（内嵌进度条，随时可展开/收起题目）-> 完形填空 -> 过关
// 题面是「本卷谜题清单」（README_game §4.5）：进度不足时也能展开看题，revealAt='gate' 的题只显示「？？？」，
// 且不渲染答案栏、不能填、不能提交，也不给任何「可以答了」的提示；≥70% 后答案栏才出现。
import { useLayoutEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import {
  cardDef,
  data,
  entryDef,
  familiarMaxOf,
  gateAfterLevel,
  levelChapterTitle,
  levelQuestion,
  TYPE_LABEL,
  TYPE_ORDER,
} from '../game/data';
import { autoFillGate, checkGate, gateCandidates, gateChecklist, setGateDraft } from '../game/logic';
import { playCue } from '../game/sfx';
import { setUi, useFxActive, useGame, type PickerGroup } from '../game/store';
import Avatar from './Avatar';
import { CopyEditButton } from './copyedit/common';
import Icon from './Icon';

/** 全作各关熟悉度上限之和（候选排序的次级键） */
function totalFamiliarMax(id: string): number {
  return Object.keys(data.timelines).reduce((n, lv) => n + familiarMaxOf(id, Number(lv)), 0);
}

function scrollCtaToTop(el: HTMLElement | null) {
  const scroller = el?.closest('.tl-right');
  if (!el || !(scroller instanceof HTMLElement)) return;
  const top = scroller.scrollTop + el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

export default function GatePanel() {
  const s = useGame();
  // 题目默认折叠；进度不足时也能展开看题面，只是没有答案栏与提交按钮
  const [expanded, setExpanded] = useState(false);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const pinCta = useRef(false);
  // 时间轴发生新锁定时，进度条与归位计数联动闪光
  const progFlash = useFxActive('gateprog', 1300);
  const gate = gateAfterLevel(s.level);

  useLayoutEffect(() => {
    if (!pinCta.current) return;
    pinCta.current = false;
    const el = ctaRef.current;
    requestAnimationFrame(() => scrollCtaToTop(el));
  }, [expanded]);

  if (!gate) return null;

  const after = gate.after;
  const chk = gateChecklist(s.level, s);
  const pct = Math.floor(chk.progress * 100);
  const gs = s.gates[String(after)];
  const showQs = expanded || !!gs?.passed;
  // ≥70%（或已过关）才有答案栏与提交
  const canAnswer = chk.ok || !!gs?.passed;
  const question = levelQuestion(s.level);
  // 关名与「故事」页一致：取过场首段卷名（「第一卷 · 弃家求道」）
  const chapter = levelChapterTitle(after);
  const pctOf = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 100);

  const openPicker = (idx: number) => {
    const { entries, titles } = gateCandidates(after, s);
    // 按分类分组，组内按「本关熟悉度上限 → 总熟悉度上限」降序
    const byType = new Map<string, [string, (typeof entries)[number][1]][]>();
    for (const [id, def] of entries) {
      const arr = byType.get(def.type) ?? [];
      arr.push([id, def]);
      byType.set(def.type, arr);
    }
    const entryGroups: PickerGroup[] = TYPE_ORDER.filter((t) => byType.has(t)).map((t) => ({
      label: TYPE_LABEL[t],
      keepOrder: true,
      items: [...byType.get(t)!]
        .sort(([ia], [ib]) => familiarMaxOf(ib, s.level) - familiarMaxOf(ia, s.level) || totalFamiliarMax(ib) - totalFamiliarMax(ia))
        .map(([id, def]) => ({ key: 'entry:' + id, name: def.name, entryId: id })),
    }));
    // 剧情：按时间轴表格位置排布（SlotPicker 的 layout:'timeline' 渲染图+名字表格）
    const groups: PickerGroup[] = [
      ...entryGroups,
      {
        label: t('gate.plot'),
        keepOrder: true,
        layout: 'timeline',
        items: titles.map((c) => ({
          key: 'title:' + c.id,
          name: c.title,
          cardId: c.id,
          form: c.form,
        })),
      },
    ];
    setUi({ picker: { title: t('gate.pickTitle'), groups, wide: true, entryLayout: 'cards5', onPick: (key) => setGateDraft(after, idx, key) } });
  };

  const draftText = (key: string | null): string => {
    if (!key) return '';
    if (key.startsWith('entry:')) return entryDef(key.slice(6))?.name ?? '';
    if (key.startsWith('title:')) return cardDef(key.slice(6))?.title ?? '';
    return '';
  };

  // 已选答案的方形图标（同情节卡底边栏按钮）：词条→头像/词条图；剧情标题→该卡 CG 缩略
  const draftIcon = (key: string | null) => {
    if (!key) return null;
    if (key.startsWith('entry:')) return <Avatar entryId={key.slice(6)} fill />;
    if (key.startsWith('title:')) {
      const c = cardDef(key.slice(6));
      return <Avatar src={c?.cg} name={c?.title ?? '？'} color="#8a2f2a" fill />;
    }
    return null;
  };

  return (
    <div className="gate-panel" data-gate-panel data-coach-anchor="timelineGate">
      <div className="gate-panel-head">
        <div className="gate-panel-sub" data-gate-chapter>
          {chapter}
        </div>
      </div>
      {question ? (
        <p className="gate-panel-intro" data-gate-question>
          {question}
        </p>
      ) : null}
      <button
        ref={ctaRef}
        className={`gate-cta${progFlash ? ' flash' : ''}${gs?.passed ? ' passed' : ''}${showQs ? ' is-open' : ''}`}
        data-gate-expand
        disabled={!!gs?.passed}
        title={chk.ok ? undefined : t('gate.need70')}
        onClick={() => {
          const next = !expanded;
          setExpanded(next);
          pinCta.current = next;
          playCue(next ? 'expand' : 'collapse');
        }}
      >
        <span className="gate-cta-text">
          {gs?.passed ? (
            <>
              {t('gate.cleared')} <Icon name="check" size={14} />
            </>
          ) : (
            <>
              {chk.ok && !expanded ? <span className="gate-cta-reddot" /> : null}
              {expanded ? t('gate.collapseQs') : t('gate.toNext')}
            </>
          )}
        </span>
        <span className="gate-cta-bar">
          <span className="gate-cta-fill" style={{ width: pct + '%' }} />
          <span className={`gate-cta-dot${pct >= 70 ? ' on' : ''}`} style={{ left: '70%' }} />
          <span className={`gate-cta-dot end${pct >= 100 ? ' on' : ''}`} />
        </span>
        {!gs?.passed && !chk.ok ? (
          <span className="gate-callout at70">
            <span className="gate-callout-line" />
            <span className="gate-callout-label">{t('gate.low')}</span>
          </span>
        ) : !gs?.passed && chk.progress >= 1 ? (
          <span className="gate-callout at100">
            <span className="gate-callout-line" />
            <span className="gate-callout-label">{t('gate.autoOk')}</span>
          </span>
        ) : null}
        <span className={`gate-stats${progFlash ? ' flash' : ''}`}>
          <span className={`gate-bk${chk.locked === chk.cardsTotal ? ' full' : ''}`}>
            <span className="gate-bk-track">
              <span className="gate-bk-fill" style={{ width: pctOf(chk.locked, chk.cardsTotal) + '%' }} />
              <span className="gate-bk-num">
                {t('gate.tlProg', { a: chk.locked, b: chk.cardsTotal })}
              </span>
            </span>
          </span>
          <span className={`gate-bk${chk.pagesDone === chk.pagesTotal ? ' full' : ''}`}>
            <span className="gate-bk-track">
              <span className="gate-bk-fill" style={{ width: pctOf(chk.pagesDone, chk.pagesTotal) + '%' }} />
              <span className="gate-bk-num">
                {t('gate.arcProg', { a: chk.pagesDone, b: chk.pagesTotal })}
              </span>
            </span>
          </span>
        </span>
      </button>
      {showQs ? (
        <div className={`gate-sheet${canAnswer ? '' : ' is-locked'}`}>
          <div className="gate-sheet-kicker">{t('gate.cloze')}</div>
          <div className="gate-panel-qs">
            {gate.blanks.map((b, i) => {
              const st = gs?.blanks[i];
              // 开局可见（start）的题面直接给；其余在能答之前只露「？？？」，防剧透
              const hidden = !canAnswer && b.revealAt !== 'start';
              return (
                <div className={`gate-q${hidden ? ' is-hidden' : ''}`} key={i}>
                  <span className="gate-q-no">{i + 1}</span>
                  <div className="gate-q-body">
                    <span className="gate-prompt">{hidden ? t('gate.hiddenPrompt') : `${b.prompt}＿＿＿＿。`}</span>
                    {/* 进度不足：只看题面，不出答案栏、不能填、不能提交 */}
                    {!canAnswer ? null : st?.locked ? (
                      <button className="blank-btn locked gate-answer" disabled>
                        <span className="blank-btn-icon">{draftIcon(st.draft)}</span>
                        <span className="blank-btn-text">
                          {draftText(st.draft)} <Icon name="check" size={12} />
                        </span>
                      </button>
                    ) : st?.draft ? (
                      <button className="blank-btn filled gate-answer" data-gate-blank={i} onClick={() => openPicker(i)}>
                        <span className="blank-btn-icon">{draftIcon(st.draft)}</span>
                        <span className="blank-btn-text">{draftText(st.draft)}</span>
                      </button>
                    ) : (
                      <button className="blank-btn gate-answer" data-gate-blank={i} onClick={() => openPicker(i)}>
                        <span className="blank-btn-text">{t('gate.pick')}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {canAnswer ? (
            <div className="gate-panel-foot">
              {chk.progress >= 1 && !gs?.passed ? (
                <button className="btn" data-gate-autofill onClick={() => autoFillGate(after)}>
                  {t('gate.autoFill')}
                </button>
              ) : null}
              <button className="btn btn-primary" data-gate-check onClick={() => checkGate(after)}>
                {t('gate.submit')}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <CopyEditButton conf={{ kind: 'gate', after }} className="ce-gate-foot" />
    </div>
  );
}
