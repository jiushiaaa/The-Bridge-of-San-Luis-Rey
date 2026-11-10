// 横持且高度过矮时提示竖持，不另做第三套布局
import { t } from '../i18n';
import { useEffect } from 'react';
import { useLandscapeHint } from '../game/layout';

export default function RotateHint() {
  const show = useLandscapeHint();
  useEffect(() => {
    if (show) document.documentElement.dataset.rotateHint = '1';
    else delete document.documentElement.dataset.rotateHint;
    return () => {
      delete document.documentElement.dataset.rotateHint;
    };
  }, [show]);
  if (!show) return null;
  return (
    <div className="rotate-hint" role="status">
      {t('phone.rotate')}
    </div>
  );
}
