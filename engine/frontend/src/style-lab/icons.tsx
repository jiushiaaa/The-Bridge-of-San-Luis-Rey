type IconProps = { name: IconName; size?: number };

export type IconName =
  | 'book'
  | 'cards'
  | 'archive'
  | 'clock'
  | 'heart'
  | 'search'
  | 'close'
  | 'check'
  | 'star'
  | 'pin'
  | 'warning'
  | 'user'
  | 'tack'
  | 'bolt';

const PATHS: Record<IconName, string> = {
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5Zm2.5-1A1 1 0 0 0 6 5.5V20a1 1 0 0 1 1-1h12V4H6.5Z',
  cards:
    'M6 7h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm0 2v10h12V9H6Zm2-4h12a2 2 0 0 1 2 2v1H20V7a1 1 0 0 0-1-1H8V5Z',
  archive:
    'M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5V8H3V6.5ZM3 10h18v8.5A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5V10Zm6 3h6v2H9v-2Z',
  clock:
    'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm.75 2v4.19l2.78 1.67-.75 1.23L11.25 12V7h1.5Z',
  heart:
    'M12 20.5 10.55 19.2C6.4 15.36 3.5 12.78 3.5 9.5A4.5 4.5 0 0 1 8 5c1.54 0 3.04.78 4 2.01A4.98 4.98 0 0 1 16 5a4.5 4.5 0 0 1 4.5 4.5c0 3.28-2.9 5.86-7.05 9.72L12 20.5Z',
  search:
    'M11 4a7 7 0 1 1-4.38 12.48l-3.06 3.06-1.06-1.06 3.06-3.06A7 7 0 0 1 11 4Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
  close:
    'M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5Z',
  check: 'M9.2 16.2 5.4 12.4 4 13.8l5.2 5.2L20.2 8l-1.4-1.4L9.2 16.2Z',
  star: 'M12 3.6 14.5 9l6 .5-4.6 3.9 1.5 5.8L12 16.5 6.6 19.2 8.1 13.4 3.5 9.5 9.5 9 12 3.6Z',
  pin: 'M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Zm0-8.5A2.5 2.5 0 1 1 12 7a2.5 2.5 0 0 1 0 5.5Z',
  warning:
    'M12 3 2 21h20L12 3Zm0 4.8 6.3 11.2H5.7L12 7.8ZM11 11h2v4h-2v-4Zm0 5h2v2h-2v-2Z',
  user: 'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4 0-8 2-8 5v2h16v-2c0-3-4-5-8-5Z',
  tack: 'M16 3a2 2 0 0 1 0 4 1 1 0 0 0-1 1v3.76a2 2 0 0 0 1.11 1.79l1.78.9A2 2 0 0 1 19 16.24V17h-7v5h-1v-5H5v-.76a2 2 0 0 1 1.11-1.79l1.78-.9A2 2 0 0 0 9 11.76V8a1 1 0 0 0-1-1 2 2 0 0 1 0-4h8Z',
  bolt: 'M13 2 3 14h9l-1 8 10-12h-9l1-8Z',
};

export default function Icon({ name, size = 16 }: IconProps) {
  return (
    <svg
      className="sl-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path fill="currentColor" d={PATHS[name]} />
    </svg>
  );
}
