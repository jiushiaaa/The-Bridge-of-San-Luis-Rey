// 页签栏右端（体力左侧）的迷你播放器：黑胶封面按钮（播放中旋转、底边音符左右跳动、悬停显示暂停）
// + 曲名（6 个中文字宽，放不下时缓慢走马灯）与其下的细进度条 + 设置齿轮（弹出音乐菜单）。
// 新解锁曲目时整块闪烁并带「新曲」角标（bgm.newTrackId），点开菜单 / 点播 / 播放暂停即停止闪烁。
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { t } from '../i18n';
import { ackNewBgm, bgmTrackById, hasBgm, toggleBgm, useBgm, useBgmProgress } from '../game/bgm';
import { playCue, sfxSkipLayer } from '../game/sfx';
import BgmMenu, { BGM_MODE_ICON, BgmDisc, bgmCover, bgmModeLabel } from './BgmMenu';
import Icon from './Icon';

const MARQUEE_SPEED = 16; // px/s，缓慢

/** 放不下就走马灯：文字复制一份接在后面，间隔取容器宽的 1/3（留空不超过一半），整体匀速左移一段后无缝接上 */
function Marquee({ text, className }: { text: string; className?: string }) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [mq, setMq] = useState<{ shift: number; gap: number; dur: number } | null>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const el = textRef.current;
    if (!box || !el) return;
    const measure = () => {
      const bw = box.clientWidth;
      const tw = el.getBoundingClientRect().width;
      if (bw <= 0 || tw <= bw + 1) {
        setMq(null);
        return;
      }
      const gap = Math.max(12, Math.round(bw / 3));
      const shift = tw + gap;
      setMq({ shift, gap, dur: Math.max(5, shift / MARQUEE_SPEED) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [text]);

  const style = mq
    ? ({ '--mq-shift': `${mq.shift}px`, '--mq-gap': `${mq.gap}px`, '--mq-dur': `${mq.dur}s` } as CSSProperties)
    : undefined;
  return (
    <span ref={boxRef} className={`bgm-marquee${mq ? ' is-on' : ''}${className ? ` ${className}` : ''}`} style={style}>
      <span className="bgm-marquee-track">
        <span ref={textRef} className="bgm-marquee-text">
          {text}
        </span>
        {mq ? (
          <span className="bgm-marquee-text" aria-hidden="true">
            {text}
          </span>
        ) : null}
      </span>
    </span>
  );
}

/** 曲名下的细进度条（只订阅进度，不带着整个播放器重渲染） */
function ProgressBar() {
  const { time, duration } = useBgmProgress();
  const pct = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;
  return (
    <span className="bgm-mini-prog" aria-hidden="true">
      <span className="bgm-mini-prog-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

export default function BgmMiniPlayer() {
  const snap = useBgm();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 点外面 / Esc 收起弹出菜单
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!hasBgm()) return null;

  const current = bgmTrackById(snap.trackId);
  const isNew = !!snap.newTrackId;

  const toggleMenu = () => {
    sfxSkipLayer();
    const next = !open;
    setOpen(next);
    playCue(next ? 'expand' : 'collapse');
    if (next) ackNewBgm();
  };

  const title = current ? current.title : t('bgm.idle');
  const stateLabel = snap.playing ? t('bgm.pause') : t('bgm.play');

  return (
    <div
      ref={rootRef}
      className={`bgm-mini${snap.playing ? ' is-playing' : ''}${isNew ? ' is-new' : ''}${open ? ' is-open' : ''}`}
      data-coach-anchor="bgm"
    >
      <button
        type="button"
        className="bgm-mini-disc"
        aria-label={stateLabel}
        title={`${stateLabel} · ${title}`}
        data-bgm-toggle
        onClick={() => {
          toggleBgm();
          ackNewBgm();
        }}
      >
        <BgmDisc src={current ? bgmCover(current) : undefined} spinning={snap.playing} size={30} />
        {/* 播放中：悬停浮出暂停；停止：常显播放键 */}
        <span className="bgm-mini-glyph">
          <Icon name={snap.playing ? 'pause' : 'play'} size={12} />
        </span>
        {snap.playing ? <Icon name="music" size={9} className="bgm-mini-swing" /> : null}
      </button>
      <button
        type="button"
        className="bgm-mini-now"
        title={`${t('bgm.label')} · ${title} · ${bgmModeLabel(snap.mode)}`}
        aria-label={`${t('bgm.label')}: ${title}`}
        aria-expanded={open}
        data-bgm-now
        onClick={toggleMenu}
      >
        <span className="bgm-mini-line">
          <Marquee text={title} className="bgm-mini-title" />
          {isNew ? <span className="bgm-new-tag">{t('bgm.new')}</span> : null}
        </span>
        <ProgressBar />
      </button>
      <button
        type="button"
        className="bgm-mini-btn bgm-mini-gear"
        aria-label={t('bgm.settings')}
        title={`${t('bgm.settings')} · ${bgmModeLabel(snap.mode)}`}
        aria-expanded={open}
        data-bgm-gear
        onClick={toggleMenu}
      >
        <Icon name="settings" size={14} />
        <Icon name={BGM_MODE_ICON[snap.mode]} size={9} className="bgm-mini-mode" />
      </button>
      {open ? (
        <div className="bgm-pop" role="dialog" aria-label={t('bgm.settings')}>
          <div className="bgm-pop-head">
            <button
              type="button"
              className={`bgm-pop-toggle${snap.playing ? ' is-on' : ''}`}
              aria-label={stateLabel}
              title={stateLabel}
              onClick={() => toggleBgm()}
            >
              <Icon name={snap.playing ? 'pause' : 'play'} size={13} />
            </button>
            <span className="bgm-pop-title">{t('bgm.label')}</span>
            <span className="bgm-pop-sub">{title}</span>
          </div>
          <BgmMenu />
        </div>
      ) : null}
    </div>
  );
}
