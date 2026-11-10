// 结局：整幅插画 + 左侧渐变压字；全屏点击推进；通关仪式感结算（非冷冰冰的数据表）
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { Seal } from '../components/Avatar';
import { CopyEditButton } from '../components/copyedit/common';
import Icon, { Stars } from '../components/Icon';
import { assetUrl, data, levelChapterLabel } from '../game/data';
import { advanceEnding, openFullStory, restartToTitle } from '../game/logic';
import { playCue } from '../game/sfx';
import { useGame } from '../game/store';

function fmtDuration(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return m > 0 ? t('ending.minSec', { m, s: r }) : t('ending.sec', { s: r });
}

export default function Ending() {
  const s = useGame();
  const ed = data.frame.ending;
  const done = s.endingIdx >= ed.segments.length - 1;
  const elapsed = (s.stats.finishedAt ?? Date.now()) - s.stats.startedAt;
  const [settleOpen, setSettleOpen] = useState(false);
  const settleRef = useRef(false);
  const settleAutoDoneRef = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const openSettle = (cue: 'open' | 'achievement') => {
    if (settleRef.current) return;
    settleRef.current = true;
    setSettleOpen(true);
    playCue(cue);
  };
  const closeSettle = () => {
    settleAutoDoneRef.current = true; // 关过后不再自动弹出
    settleRef.current = false;
    setSettleOpen(false);
    playCue('close');
  };

  const advance = () => {
    if (settleOpen) return;
    if (done) {
      openSettle('open');
      return;
    }
    advanceEnding();
  };

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [s.endingIdx]);

  useEffect(() => {
    if (!done || settleOpen || settleAutoDoneRef.current) return;
    const timer = setTimeout(() => {
      settleAutoDoneRef.current = true;
      openSettle('achievement');
    }, 1400);
    return () => clearTimeout(timer);
  }, [done, settleOpen]);

  useEffect(() => {
    if (!settleOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [settleOpen]);

  // 空格 / 回车推进（与关卡过场一致）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      if (settleOpen) return;
      if (e.target !== document.body) return;
      if (document.querySelector('.modal, .ce-modal, .settle-ceremony')) return;
      e.preventDefault();
      advance();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const starTotal = data.gates.reduce((n, g) => n + (s.gates[String(g.after)]?.stars ?? 0), 0);
  // 各关满星数按过关时记录（简单 3 / 困难 5 / 迟切困难 4）；旧档缺省 3
  const starMax = data.gates.reduce((n, g) => n + (s.gates[String(g.after)]?.maxStars ?? 3), 0);

  return (
    <div className="ending" onClick={advance}>
      <img
        className="ending-bg"
        src={assetUrl(data.assets.endingImage)}
        alt=""
        onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
      />
      <div className="ending-scrim" aria-hidden="true" />

      <div className="ending-plate">
        <div className="ending-kicker">{t('ending.kicker')}</div>
        <h1 className="ending-title">{ed.title}</h1>
        <i className="ending-rule" aria-hidden="true" />
        <div className="ending-body scroll-y" ref={bodyRef}>
          {ed.segments.slice(0, s.endingIdx + 1).map((seg, i) =>
            seg.kind === 'narration' ? (
              <p className="ending-seg narration" key={i}>
                {seg.text}
              </p>
            ) : (
              <div className="ending-seg dialogue" key={i}>
                <span className="ending-speaker">
                  <Seal name={seg.speaker} color="#c4b89a" size={32} />
                  <span>{seg.speaker}</span>
                </span>
                <span className="ending-bubble">{seg.text}</span>
              </div>
            ),
          )}
          {done ? <p className="ending-credit">{ed.credit}</p> : null}
        </div>
        <div className="ending-foot" onClick={(e) => e.stopPropagation()}>
          <CopyEditButton conf={{ kind: 'frame', target: 'ending' }} />
          {done ? (
            <>
              <button className="ending-btn" type="button" onClick={() => openSettle('open')}>
                {t('ending.settle')}
              </button>
              <button className="ending-btn" type="button" onClick={openFullStory}>
                {t('ending.fullStory')}
              </button>
              <button className="ending-btn is-primary" type="button" onClick={restartToTitle}>
                {t('ending.cover')}
              </button>
            </>
          ) : (
            <span className="ending-hint">{t('ending.click')}</span>
          )}
        </div>
      </div>

      {settleOpen ? (
        <div
          className="settle-ceremony"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settle-heading"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="settle-veil" aria-hidden="true" />
          <div className="settle-stage">
            <div className="settle-seal" aria-hidden="true">
              {t('ending.seal')}
            </div>
            <p className="settle-kicker">{t('ending.walked')}</p>
            <h2 className="settle-heading" id="settle-heading">
              {data.meta.title}
            </h2>
            {data.meta.subtitle ? <p className="settle-subtitle">{data.meta.subtitle}</p> : null}

            <div className="settle-path" aria-label={t('ending.starsAria', { n: starTotal, max: starMax })}>
              {data.gates.map((g, i) => {
                const gr = s.gates[String(g.after)];
                const stars = gr?.stars ?? 0;
                const max = gr?.maxStars ?? 3;
                return (
                  <div className="settle-step" key={g.after} style={{ animationDelay: `${0.35 + i * 0.18}s` }}>
                    {i > 0 ? <i className="settle-step-join" aria-hidden="true" /> : null}
                    <div className="settle-step-card">
                      <span className="settle-step-label">{levelChapterLabel(g.after)}</span>
                      <span className="settle-step-stars">
                        <Stars n={stars} max={max} size={18} zeroSlots />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="settle-epigraph">{t('ending.elapsed', { time: fmtDuration(elapsed) })}</p>
            {ed.credit ? <p className="settle-thanks">{ed.credit}</p> : null}
            <button
              className="settle-close"
              type="button"
              aria-label={t('common.close')}
              title={t('common.close')}
              onClick={closeSettle}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
