// 页签栏右端：体力 / 星级（难度 + 星数）。点体力弹说明；点星级弹「星级与难度」面板：切换难度（介绍两者差异）+ 本关错误 / 休整 / 扣星明细。
import { useState, type ReactNode } from 'react';
import { t } from '../i18n';
import Icon, { Stars } from './Icon';
import { data, levelChapterTitle } from '../game/data';
import {
  hardSwitchLate,
  HARD_LATE_PROGRESS,
  MAX_STARS_EASY,
  MAX_STARS_HARD,
  rest,
  setDifficulty,
  STAR_STEP,
  starBreakdown,
} from '../game/logic';
import { playCue } from '../game/sfx';
import { useGame } from '../game/store';
import type { Difficulty } from '../game/types';

type HelpKind = 'stamina' | 'stars';

const DIFFS: Difficulty[] = ['easy', 'hard'];
/** 两张难度卡各列几条差异（文案键 difficulty.{d}L{i}） */
const DIFF_LINES: Record<Difficulty, number> = { easy: 4, hard: 2 };

/** 「第一卷 · 暗流」→「暗流」；没有分隔符就用整段 */
function chapterName(lv: number): string {
  const title = levelChapterTitle(lv);
  const i = title.indexOf('·');
  return i < 0 ? title : title.slice(i + 1).trim();
}

/** 时间轴「放对单格」用的那枚绿勾（样式同 .tl-ok-pip），嵌在困难难度的说明里 */
function OkPip() {
  return (
    <span className="diff-okpip" aria-hidden="true">
      <Icon name="check" size={9} />
    </span>
  );
}

/** 词条库「最佳搜寻」用的那枚红圈放大镜（复用 .entry-search[data-search-best] .search-ico 的样式与动画） */
function SearchIco() {
  return (
    <span className="entry-search diff-searchico" data-search-best="1" aria-hidden="true">
      <span className="search-ico">
        <Icon name="search" size={11} />
      </span>
    </span>
  );
}

/** 说明文字里的 {check} / {search} / {canfill} / {hint} 占位替换成对应图标或同款控件；与紧跟其后的标点粘在一起，免得换行后标点落到行首 */
function withIcons(text: string) {
  const parts = text.split(/(\{check\}|\{search\}|\{canfill\}|\{hint\})/);
  if (parts.length === 1) return text;
  const out: ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p === '{check}' || p === '{search}' || p === '{canfill}' || p === '{hint}') {
      const next = parts[i + 1] ?? '';
      const lead = next.match(/^[，,。．.；;、]?/)?.[0] ?? '';
      const node =
        p === '{check}' ? (
          <OkPip />
        ) : p === '{search}' ? (
          <SearchIco />
        ) : p === '{hint}' ? (
          // 情节卡底部「⚡提示」按钮的缩小版（同 .btn.blank-hint 外观）
          <span className="btn blank-hint diff-hintbtn" aria-hidden="true">
            <Icon name="bolt" size={10} /> {t('card.hintBtn')}
          </span>
        ) : (
          // 与情节卡列表的「可填写」状态章同一副样子（颜色 / 字体 / 扫光下划线）
          <span className="status-seal can-fill diff-canfill">{t('card.canFill')}</span>
        );
      out.push(
        <span key={i} className="diff-nowrap">
          {node}
          {lead}
        </span>,
      );
      parts[i + 1] = next.slice(lead.length);
    } else if (p) {
      out.push(<span key={i}>{p}</span>);
    }
  }
  return <>{out}</>;
}

/** 3 格方块表示距下一次扣星的进度（count % 3），已用的格子红色脉动 */
function StepMeter({ count, label }: { count: number; label: string }) {
  const filled = count % STAR_STEP;
  return (
    <span className="diff-meter" role="img" aria-label={`${label} ${filled}/${STAR_STEP}`}>
      {Array.from({ length: STAR_STEP }, (_, i) => (
        <i key={i} className={`diff-meter-cell${i < filled ? ' is-on' : ''}`} />
      ))}
    </span>
  );
}

function StaminaHelp({ onClose }: { onClose: () => void }) {
  const lines = [
    t('vitals.helpSearch', { n: data.meta.stamina.searchCost }),
    t('vitals.helpComplete', { n: data.meta.stamina.completeReward }),
    t('vitals.helpLevel', { n: data.meta.stamina.perLevel }),
    t('vitals.helpRest', { n: data.meta.stamina.restGain }),
  ];
  return (
    <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
      <div className="modal-head">
        <span className="modal-title">{t('vitals.stamina')}</span>
      </div>
      <div className="modal-body">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <div className="modal-foot">
        <button className="btn btn-primary" type="button" onClick={onClose}>
          {t('common.gotIt')}
        </button>
      </div>
    </div>
  );
}

/** 星级与难度面板：上=本关星数与扣星明细；下=两张难度卡（当前高亮，点另一张切换；迟切困难先确认） */
function StarsPanel({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const sb = starBreakdown(s);
  const late = hardSwitchLate(s);
  const [confirmHard, setConfirmHard] = useState(false);

  const pick = (d: Difficulty) => {
    if (d === s.difficulty) return;
    if (d === 'hard' && late) {
      setConfirmHard(true);
      playCue('open');
      return;
    }
    setDifficulty(d);
  };

  return (
    <div className="modal modal-sm diff-modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-head">
        <span className="modal-title">{t('vitals.panelTitle')}</span>
        <button className="modal-x" type="button" aria-label={t('common.close')} onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="modal-body diff-body">
        {/* 本关星级（在上）：第 N 关 · 卷名，星数大图（亮星带光效），错误 / 休整两行扣星明细 */}
        <div className={`diff-stars-hero${s.difficulty === 'hard' ? ' is-hard' : ''}`}>
          <span className="diff-hero-kicker">{t('vitals.levelStars', { n: s.level, name: chapterName(s.level) })}</span>
          <span className="diff-hero-stars" aria-label={t('vitals.starsOf', { n: sb.stars, max: sb.max })}>
            <Stars n={sb.stars} max={sb.max} size={28} zeroSlots />
          </span>
        </div>
        <ul className="diff-ledger">
          {/* 行式：[emoji] 错误 □□□ 次 …… −x */}
          <li className={sb.errDed > 0 ? 'is-ded' : ''}>
            <span className="diff-ledger-emoji" aria-hidden="true">
              ❌
            </span>
            <span className="diff-ledger-k">
              {t('vitals.errors')}
              <StepMeter count={sb.errors} label={t('vitals.errorsRow', { n: sb.errors })} />
              {t('vitals.times')}
            </span>
            <span className="diff-ledger-v">{sb.errDed > 0 ? `−${sb.errDed}` : '—'}</span>
          </li>
          <li className={sb.restDed > 0 ? 'is-ded' : ''}>
            <span className="diff-ledger-emoji" aria-hidden="true">
              ☕️
            </span>
            <span className="diff-ledger-k">
              {t('vitals.rests')}
              <StepMeter count={sb.rests} label={t('vitals.restsRow', { n: sb.rests })} />
              {t('vitals.times')}
            </span>
            <span className="diff-ledger-v">{sb.restDed > 0 ? `−${sb.restDed}` : '—'}</span>
          </li>
        </ul>
        {s.difficulty === 'hard' && s.stats.perLevel[String(s.level)]?.hardLate ? (
          <p className="diff-note">{t('vitals.lateNote')}</p>
        ) : null}

        {/* 难度选择（在下） */}
        <div className="diff-sec-title">{t('vitals.difficulty')}</div>
        <div className="diff-cards" role="radiogroup" aria-label={t('vitals.difficulty')}>
          {DIFFS.map((d) => {
            const on = s.difficulty === d;
            const max = d === 'easy' ? MAX_STARS_EASY : MAX_STARS_HARD;
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={on}
                className={`diff-card diff-${d}${on ? ' is-on' : ''}`}
                data-diff={d}
                onClick={() => pick(d)}
              >
                <span className="diff-card-head">
                  <span className="diff-card-name">{t(`difficulty.${d}`)}</span>
                  <span className="diff-card-sub">
                    {t(`difficulty.${d}Sub`)}
                    <span className={`diff-card-stars${d === 'hard' ? ' is-hard' : ''}`}>
                      <Stars n={max} max={max} size={11} />
                    </span>
                  </span>
                </span>
                <ul className="diff-card-list">
                  {Array.from({ length: DIFF_LINES[d] }, (_, i) => (
                    <li key={i}>{withIcons(t(`difficulty.${d}L${i + 1}`))}</li>
                  ))}
                </ul>
                {on ? <span className="diff-card-badge">{t('vitals.current')}</span> : null}
              </button>
            );
          })}
        </div>

        {confirmHard ? (
          <div className="diff-confirm" role="alertdialog" aria-live="polite">
            <p>{t('vitals.confirmHard', { pct: Math.round(HARD_LATE_PROGRESS * 100) })}</p>
            <div className="diff-confirm-btns">
              <button className="btn" type="button" onClick={() => setConfirmHard(false)}>
                {t('vitals.confirmNo')}
              </button>
              <button
                className="btn btn-cinnabar"
                type="button"
                onClick={() => {
                  setConfirmHard(false);
                  setDifficulty('hard');
                }}
              >
                {t('vitals.confirmYes')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function VitalsBar() {
  const s = useGame();
  const [help, setHelp] = useState<HelpKind | null>(null);
  const close = () => {
    setHelp(null);
    playCue('close');
  };
  const sb = starBreakdown(s);
  const hard = s.difficulty === 'hard';

  return (
    <>
      <div className="tabs-vitals" data-coach-anchor="vitals">
        <div className="vital-stamina-wrap">
          {s.stamina <= 0 ? (
            <div className="stamina-rest-pop" role="status">
              <span>{t('vitals.low')}</span>
              <button
                type="button"
                className="btn btn-cinnabar stamina-rest-btn"
                onClick={rest}
              >
                {t('vitals.restBtn', { n: data.meta.stamina.restGain })}
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className={`vital-panel stamina${s.stamina <= 0 ? ' is-empty' : ''}`}
            aria-label={t('vitals.staminaAria', { n: s.stamina })}
            onClick={() => {
              setHelp('stamina');
              playCue('open');
            }}
          >
            <span className="stat-item">
              <span className="stat-label">{t('vitals.stamina')}</span>
              <b className="stat-value">
                <Icon name="bolt" size={13} />
                {s.stamina}
              </b>
            </span>
          </button>
        </div>
        {/* 星级：上行难度名、下行星数（困难五星间距更紧） */}
        <button
          type="button"
          className={`vital-panel vital-grade${hard ? ' is-hard' : ''}${sb.stars <= 0 ? ' is-floor' : ''}`}
          aria-label={t('vitals.gradeAria', { diff: t(`difficulty.${s.difficulty}`), stars: sb.stars, max: sb.max })}
          data-vital-grade
          onClick={() => {
            setHelp('stars');
            playCue('open');
          }}
        >
          <span className="stat-item">
            <span className="stat-label">{t(`difficulty.${s.difficulty}`)}</span>
            <span className="vital-stars" data-stars={sb.stars} data-max={sb.max} aria-hidden>
              <Stars n={sb.stars} max={sb.max} size={12} zeroSlots />
            </span>
          </span>
        </button>
      </div>
      {help ? (
        <div className="overlay" onClick={close}>
          {help === 'stamina' ? <StaminaHelp onClose={close} /> : <StarsPanel onClose={close} />}
        </div>
      ) : null}
    </>
  );
}
