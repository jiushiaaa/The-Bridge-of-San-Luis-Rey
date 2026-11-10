// 情节卡形态图标（SVG，currentColor 跟随文字色）：情节=星形场景 / 对话=双气泡 / 独白=单气泡
import type { CardForm } from '../game/types';

interface Props {
  form: CardForm;
  size?: number;
}

export default function FormIcon({ form, size = 14 }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (form === 'scene') {
    // 情节（名场面）：星光场景
    return (
      <svg {...common}>
        <path d="M12 2.5l2.3 6 6.2 1.7-5 4 1.9 6.3-5.4-3.7-5.4 3.7 1.9-6.3-5-4 6.2-1.7z" />
      </svg>
    );
  }
  if (form === 'dialogue') {
    // 对话：双气泡
    return (
      <svg {...common}>
        <path d="M3 4h11a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H8l-4 3V5a1 1 0 0 1 1-1z" />
        <path d="M20 9h1a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2l-3 2.5V17" />
      </svg>
    );
  }
  // 独白：单气泡+思绪
  return (
    <svg {...common}>
      <path d="M4 3h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-5 4V4a1 1 0 0 1 1-1z" />
      <path d="M8 7.5h8M8 10.5h5" />
    </svg>
  );
}
