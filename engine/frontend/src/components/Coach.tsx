// 新手引导：聚光蒙版 / 通关目标弹窗 / 搜寻对比展示
import { t } from '../i18n';
import { useLayoutEffect, useState } from 'react';
import {
  activeCoach,
  coachStep,
  dismissCoach,
  type CoachId,
  type CoachSide,
} from '../game/coach';
import { useGame, useUi } from '../game/store';
import Icon from './Icon';

const PAD = 6;
const GAP = 12;
const BUBBLE_W = 300;

interface Hole {
  top: number;
  left: number;
  width: number;
  height: number;
}

function readHole(id: CoachId): Hole | null {
  const step = coachStep(id);
  const sel = step?.selector?.() ?? `[data-coach-anchor="${id}"]`;
  if (!sel) return null;
  const el = document.querySelector(sel) as HTMLElement | null;
  if (!el) return null;
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return {
    top: Math.max(0, r.top - PAD),
    left: Math.max(0, r.left - PAD),
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  };
}

function placeBubble(id: CoachId, hole: Hole): { top: number; left: number; side: CoachSide } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const stepPrefer = coachStep(id)?.prefer ?? 'below';
  const inBottomTabs =
    typeof document !== 'undefined' &&
    !!document.querySelector(`.tabs-bottom .tab[data-tab]`) &&
    hole.top + hole.height > vh * 0.7;
  const prefer: CoachSide = inBottomTabs ? 'above' : stepPrefer;
  const estH = 88;

  if (hole.height > 240 && (prefer === 'below' || prefer === 'above')) {
    const left = Math.min(Math.max(8, hole.left + 16), vw - BUBBLE_W - 8);
    const top = Math.min(Math.max(8, hole.top + 12), vh - estH - 8);
    return { top, left, side: 'below' };
  }

  const room = {
    above: hole.top,
    below: vh - (hole.top + hole.height),
    left: hole.left,
    right: vw - (hole.left + hole.width),
  };
  const order: CoachSide[] = [prefer, 'below', 'above', 'left', 'right'].filter(
    (s, i, a) => a.indexOf(s) === i,
  ) as CoachSide[];
  let side = prefer;
  for (const s of order) {
    if (room[s] >= estH + GAP) {
      side = s;
      break;
    }
  }
  let top = 0;
  let left = 0;
  if (side === 'below') {
    top = hole.top + hole.height + GAP;
    left = hole.left + hole.width / 2 - BUBBLE_W / 2;
  } else if (side === 'above') {
    top = hole.top - GAP - estH;
    left = hole.left + hole.width / 2 - BUBBLE_W / 2;
  } else if (side === 'left') {
    top = hole.top + hole.height / 2 - estH / 2;
    left = hole.left - GAP - BUBBLE_W;
  } else {
    top = hole.top + hole.height / 2 - estH / 2;
    left = hole.left + hole.width + GAP;
  }
  left = Math.min(Math.max(8, left), vw - BUBBLE_W - 8);
  top = Math.min(Math.max(8, top), vh - estH - 8);
  return { top, left, side };
}

function SearchDemo({ best }: { best?: boolean }) {
  return (
    <span
      className="btn entry-search coach-demo-btn"
      data-search-best={best ? '1' : undefined}
      aria-hidden="true"
    >
      <span className="search-ico">
        <Icon name="search" size={13} />
      </span>
      {best ? t('coach.searchBest') : t('coach.searchNormal')}
    </span>
  );
}

export default function Coach() {
  const s = useGame();
  const ui = useUi();
  const id = activeCoach(s);
  const step = id ? coachStep(id) : undefined;
  const [hole, setHole] = useState<Hole | null>(null);
  const [bubble, setBubble] = useState<{ top: number; left: number; side: CoachSide } | null>(null);

  useLayoutEffect(() => {
    if (!id || !step || step.kind !== 'spot') {
      setHole(null);
      setBubble(null);
      return;
    }
    const tick = () => {
      const h = readHole(id);
      setHole(h);
      setBubble(h ? placeBubble(id, h) : null);
    };
    tick();
    const raf = requestAnimationFrame(tick);
    // 情节卡正文逐段展开时，词条 chip 会晚于状态出现——轮询直到量到镂空
    const iv = window.setInterval(tick, 200);
    window.addEventListener('resize', tick);
    window.addEventListener('scroll', tick, true);
    const sel = step.selector?.() ?? `[data-coach-anchor="${id}"]`;
    const el = sel ? document.querySelector(sel) : null;
    const ro = el ? new ResizeObserver(tick) : null;
    if (el && ro) ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(iv);
      window.removeEventListener('resize', tick);
      window.removeEventListener('scroll', tick, true);
      ro?.disconnect();
    };
  }, [
    id,
    step?.kind,
    s.tab,
    s.selectedCardId,
    s.stamina,
    s.level,
    ui.blankSheet,
    ui.entryDrawer,
    ui.coachFocus,
    ui.coachReady,
  ]);

  if (!id || !step) return null;

  if (step.kind === 'modal') {
    return (
      <div className="coach-root coach-modal-root" data-coach-root data-coach={id}>
        <div className="coach-scrim coach-scrim-full" />
        <div className="coach-modal" role="dialog" aria-modal="true" aria-labelledby="coach-goal-title">
          {step.titleText?.() || step.titleKey ? (
            <div className="coach-modal-title" id="coach-goal-title">
              {step.titleText?.() || t(step.titleKey!)}
            </div>
          ) : null}
          <p className="coach-modal-lead">{t(step.textKey)}</p>
          {step.lineKeys?.map((line, i) => (
            <p key={i} className="coach-modal-line">
              {t(line)}
            </p>
          ))}
          <button className="btn btn-primary coach-modal-ok" type="button" onClick={() => dismissCoach(id)}>
            {t(step.okKey ?? 'coach.gotIt')}
          </button>
        </div>
      </div>
    );
  }

  if (step.kind === 'demo') {
    return (
      <div className="coach-root coach-modal-root" data-coach-root data-coach={id}>
        <div className="coach-scrim coach-scrim-full" />
        <div className="coach-modal coach-demo" role="dialog" aria-modal="true">
          {step.titleKey ? <div className="coach-modal-title">{t(step.titleKey)}</div> : null}
          <p className="coach-modal-lead">{t(step.textKey)}</p>
          <div className="coach-demo-rows">
            <div className="coach-demo-row">
              <SearchDemo best />
              <span>{t('coach.searchBestHint')}</span>
            </div>
            <div className="coach-demo-row">
              <SearchDemo />
              <span>{t('coach.searchNormalHint')}</span>
            </div>
          </div>
          <button className="btn btn-primary coach-modal-ok" type="button" onClick={() => dismissCoach(id)}>
            {t(step.okKey ?? 'coach.gotIt')}
          </button>
        </div>
      </div>
    );
  }

  if (!hole || !bubble) return null;

  const { top, left, width, height } = hole;
  const lock = !!step.lockTarget;
  const panels = [
    { key: 't', style: { top: 0, left: 0, right: 0, height: top } },
    { key: 'b', style: { top: top + height, left: 0, right: 0, bottom: 0 } },
    { key: 'l', style: { top, left: 0, width: left, height } },
    { key: 'r', style: { top, left: left + width, right: 0, height } },
  ] as const;

  return (
    <div className="coach-root" data-coach-root aria-live="polite">
      {panels.map((p) => (
        <div key={p.key} className="coach-scrim" style={p.style} />
      ))}
      {/* 介绍类步骤：镂空上也挡点击，只许点「下一步/知道了」 */}
      {lock ? <div className="coach-hole-block" style={{ top, left, width, height }} /> : null}
      <div className="coach-ring" style={{ top, left, width, height }} aria-hidden="true" />
      <div
        className={`coach coach-${bubble.side}`}
        data-coach={id}
        role="note"
        style={{ top: bubble.top, left: bubble.left, width: BUBBLE_W }}
      >
        <span className="coach-text">{t(step.textKey)}</span>
        <button className="coach-ok" type="button" onClick={() => dismissCoach(id)}>
          {t(step.okKey ?? 'coach.gotIt')}
        </button>
      </div>
    </div>
  );
}
