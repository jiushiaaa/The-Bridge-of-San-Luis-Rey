import { t } from '../i18n';

/** 未补完卡名：显示原标题但高斯模糊到无法辨认，避免用「？？？」占位 */
export default function VeiledTitle({ text, className }: { text: string; className?: string }) {
  // 由标题文本哈希出稳定的相位与周期，让同屏各卡名的迷雾节奏彼此错开
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  const delay = -((h % 56) / 10); // 0 ~ -5.5s，负延迟让动画从周期中段开始
  const duration = 4.6 + ((h >> 8) % 26) / 10; // 4.6 ~ 7.1s
  return (
    <span className={className ? `${className} is-veiled` : 'is-veiled'} aria-label={t('card.veiled')}>
      <span
        className="title-veiled"
        aria-hidden="true"
        style={{ animationDelay: `${delay}s`, animationDuration: `${duration}s` }}
      >
        {text}
      </span>
    </span>
  );
}
