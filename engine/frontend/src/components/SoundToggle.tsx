// 持久化音效开关：开/关写入 uisfx 偏好（localStorage baima:sound）
import { t } from '../i18n';
import { useState } from 'react';
import { isSfxEnabled, setSfxEnabled } from '../game/sfx';
import Icon from './Icon';

export default function SoundToggle({
  className,
  variant = 'button',
}: {
  className?: string;
  variant?: 'button' | 'row';
}) {
  const [on, setOn] = useState(() => isSfxEnabled());
  const toggle = () => {
    const next = !on;
    setSfxEnabled(next);
    setOn(next);
  };
  const label = on ? t('sound.mute') : t('sound.unmute');

  if (variant === 'row') {
    return (
      <button
        type="button"
        className={['sfx-toggle', 'game-menu-row', className].filter(Boolean).join(' ')}
        aria-pressed={on}
        aria-label={label}
        title={label}
        onClick={toggle}
      >
        <Icon name={on ? 'volume' : 'volumeOff'} size={16} />
        <span className="game-menu-row-label">{t('sound.volume')}</span>
        <span className="game-menu-switch-text">{on ? t('sound.on') : t('sound.off')}</span>
        <span className={on ? 'game-menu-switch is-on' : 'game-menu-switch'} aria-hidden="true">
          <span className="game-menu-switch-knob" />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={['sfx-toggle', className ?? 'btn'].filter(Boolean).join(' ')}
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={toggle}
    >
      <Icon name={on ? 'volume' : 'volumeOff'} size={14} />
      {t('sound.volume')}
    </button>
  );
}
