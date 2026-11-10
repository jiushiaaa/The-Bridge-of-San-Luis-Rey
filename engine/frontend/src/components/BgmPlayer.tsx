// 「菜单」弹层内就地展开的背景音乐行（封面页没有页签栏播放器，这里是唯一入口；游戏中与迷你播放器共用同一份菜单）
import { t } from '../i18n';
import { useState } from 'react';
import { ackNewBgm, bgmTracks, hasBgm, toggleBgm, useBgm } from '../game/bgm';
import { playCue, sfxSkipLayer } from '../game/sfx';
import BgmMenu, { bgmModeLabel } from './BgmMenu';
import Icon from './Icon';

export default function BgmPlayer() {
  const snap = useBgm();
  const [open, setOpen] = useState(false);
  if (!hasBgm()) return null;

  const current = bgmTracks().find((tr) => tr.id === snap.trackId);

  return (
    <div className={`bgm-block${open ? ' is-open' : ''}`}>
      <div className="game-menu-row bgm-block-row">
        <button
          type="button"
          className="bgm-block-toggle"
          aria-label={snap.playing ? t('bgm.pause') : t('bgm.play')}
          onClick={() => {
            toggleBgm();
            ackNewBgm();
          }}
        >
          <Icon name={snap.playing ? 'pause' : 'play'} size={16} />
        </button>
        <button
          className="bgm-block-main"
          type="button"
          aria-expanded={open}
          onClick={() => {
            sfxSkipLayer();
            setOpen((v) => !v);
            playCue(open ? 'collapse' : 'expand');
            ackNewBgm();
          }}
        >
          <span className="game-menu-row-stack">
            <span className="game-menu-row-label">{t('bgm.label')}</span>
            <span className="game-menu-row-sub">
              {current ? current.title : t('bgm.idle')}
              {' · '}
              {bgmModeLabel(snap.mode)}
            </span>
          </span>
          <Icon name="chevron" size={14} className={`game-menu-chevron${open ? ' is-open' : ''}`} />
        </button>
      </div>

      {open ? (
        <div className="bgm-drawer">
          <BgmMenu />
        </div>
      ) : null}
    </div>
  );
}
