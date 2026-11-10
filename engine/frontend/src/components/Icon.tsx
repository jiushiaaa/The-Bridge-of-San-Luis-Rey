// 界面 SVG 图标：描线、currentColor，与 FormIcon 同一套 24 视口
import type { EntryType } from '../game/types';

export type IconName =
  | 'scroll'
  | 'archive'
  | 'clock'
  | 'book'
  | 'heart'
  | 'pin'
  | 'check'
  | 'lock'
  | 'search'
  | 'user'
  | 'bulb'
  | 'sword'
  | 'image'
  | 'play'
  | 'pause'
  | 'shuffle'
  | 'close'
  | 'warning'
  | 'star'
  | 'starEmpty'
  | 'tack'
  | 'bolt'
  | 'arrowDown'
  | 'volume'
  | 'volumeOff'
  | 'menu'
  | 'home'
  | 'chevron'
  | 'globe'
  | 'music'
  | 'settings'
  | 'repeat'
  | 'repeatOne'
  | 'grid'
  | 'list';

const TYPE_ICON: Record<EntryType, IconName> = {
  person: 'user',
  place: 'pin',
  item: 'sword',
  concept: 'bulb',
};

const PATHS: Record<IconName, string[]> = {
  scroll: [
    'M19 17V5a2 2 0 0 0-2-2H4',
    'M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 1 4 0v12a2 2 0 0 1-4 0',
  ],
  archive: [
    'M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5V8H3V6.5Z',
    'M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8',
    'M10 12h4',
  ],
  clock: [
    'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z',
    'M12 7v5l3 2',
  ],
  book: [
    'M4 19.5A2.5 2.5 0 0 1 6.5 17H20',
    'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z',
  ],
  heart: ['M12 20.5 10.55 19.2C6.4 15.36 3.5 12.78 3.5 9.5A4.5 4.5 0 0 1 8 5c1.54 0 3.04.78 4 2.01A4.98 4.98 0 0 1 16 5a4.5 4.5 0 0 1 4.5 4.5c0 3.28-2.9 5.86-7.05 9.72L12 20.5Z'],
  pin: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', 'M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'],
  check: ['M20 6 9 17l-5-5'],
  lock: [
    'M7 11V8a5 5 0 0 1 10 0v3',
    'M6.5 11h11A1.5 1.5 0 0 1 19 12.5v7A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5v-7A1.5 1.5 0 0 1 6.5 11Z',
  ],
  search: ['M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z', 'M20.5 20.5 16.2 16.2'],
  user: ['M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z', 'M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6'],
  bulb: [
    'M9 18h6',
    'M10 21h4',
    'M12 3a6 6 0 0 0-3.5 10.8c.6.5 1.1 1.2 1.3 2.2h4.4c.2-1 .7-1.7 1.3-2.2A6 6 0 0 0 12 3Z',
  ],
  sword: ['M14.5 17.5 3 6V3h3l11.5 11.5', 'M13 19l6-6', 'M16 16l4 4', 'M19 21l2-2'],
  image: ['M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z', 'M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z', 'M21 15l-5-5L5 21'],
  play: ['M8 5v14l11-7Z'],
  pause: ['M8 5v14', 'M16 5v14'],
  shuffle: ['M16 3h5v5', 'm4 20 17-17', 'M21 16v5h-5', 'm15 15 6 6', 'm4 4 5 5'],
  close: ['M18 6 6 18', 'M6 6l12 12'],
  warning: ['M12 3 2 21h20L12 3Z', 'M12 9v5', 'M12 17h.01'],
  star: ['M12 2.5 14.6 8.5 21 9.4 16.5 13.8 17.8 20.2 12 17.1 6.2 20.2 7.5 13.8 3 9.4 9.4 8.5 12 2.5Z'],
  starEmpty: ['M12 2.5 14.6 8.5 21 9.4 16.5 13.8 17.8 20.2 12 17.1 6.2 20.2 7.5 13.8 3 9.4 9.4 8.5 12 2.5Z'],
  tack: [
    'M12 17v5',
    'M8 7a1 1 0 0 1 1-1 2 2 0 1 0 0-4h6a2 2 0 1 0 0 4 1 1 0 0 1 1 1v3.76a2 2 0 0 0 1.11 1.79l1.78.9A2 2 0 0 1 19 16.24V17H5v-.76a2 2 0 0 1 1.11-1.79l1.78-.9A2 2 0 0 0 9 10.76Z',
  ],
  bolt: ['M13 2 3 14h9l-1 8 10-12h-9l1-8Z'],
  arrowDown: ['M12 4v13', 'm6 11 6 6 6-6'],
  volume: [
    'M11 5 6 9H2v6h4l5 4V5Z',
    'M15.54 8.46a5 5 0 0 1 0 7.07',
    'M19.07 4.93a10 10 0 0 1 0 14.14',
  ],
  volumeOff: ['M11 5 6 9H2v6h4l5 4V5Z', 'M22 9l-6 6', 'M16 9l6 6'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  home: ['M3 10.5 12 3l9 7.5', 'M5 10v10h5v-6h4v6h5V10'],
  chevron: ['M9 6l6 6-6 6'],
  globe: [
    'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z',
    'M3 12h18',
    'M12 3a14.5 14.5 0 0 0 0 18 14.5 14.5 0 0 0 0-18',
  ],
  music: ['M9 18V5l12-2v13', 'M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', 'M18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  settings: ['M20 7h-9', 'M14 17H5', 'M17 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', 'M7 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  repeat: ['m17 2 4 4-4 4', 'M3 11v-1a4 4 0 0 1 4-4h14', 'm7 22-4-4 4-4', 'M21 13v1a4 4 0 0 1-4 4H3'],
  repeatOne: ['m17 2 4 4-4 4', 'M3 11v-1a4 4 0 0 1 4-4h14', 'm7 22-4-4 4-4', 'M21 13v1a4 4 0 0 1-4 4H3', 'M11 10h1v4'],
  grid: ['M4 4h6.5v6.5H4Z', 'M13.5 4H20v6.5h-6.5Z', 'M4 13.5h6.5V20H4Z', 'M13.5 13.5H20V20h-6.5Z'],
  list: ['M9 6h12', 'M9 12h12', 'M9 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
};

export default function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  const filled = name === 'heart' || name === 'star' || name === 'bolt';
  return (
    <svg
      className={className ? `ui-icon ${className}` : 'ui-icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function TypeIcon({ type, size = 14 }: { type: EntryType; size?: number }) {
  return <Icon name={TYPE_ICON[type]} size={size} />;
}

export function Stars({
  n,
  max = 3,
  size = 14,
  showEmpty = true,
  zero = '—',
  zeroSlots = false,
}: {
  n: number;
  max?: number;
  size?: number;
  showEmpty?: boolean;
  zero?: string;
  zeroSlots?: boolean;
}) {
  if (n <= 0) {
    if (!zeroSlots) return <>{zero}</>;
    return (
      <span className="ui-stars">
        {Array.from({ length: max }, (_, i) => (
          <Icon key={i} name="starEmpty" size={size} />
        ))}
      </span>
    );
  }
  const total = showEmpty ? max : n;
  return (
    <span className="ui-stars">
      {Array.from({ length: total }, (_, i) => (
        <Icon key={i} name={i < n ? 'star' : 'starEmpty'} size={size} />
      ))}
    </span>
  );
}
