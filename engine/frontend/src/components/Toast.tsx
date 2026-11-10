// 底部居中 toast：每次触发用递增 key 重新播放动画
import { useUi } from '../game/store';

export default function Toast() {
  const { toasts } = useUi();
  if (toasts.length === 0) return null;
  return (
    <div className="toast-box">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
