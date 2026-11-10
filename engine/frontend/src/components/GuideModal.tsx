// 玩法说明：多页翻页弹层（仅顶栏手动打开）
import { useState } from 'react';
import { t } from '../i18n';
import { playCue } from '../game/sfx';
import { setUi, useUi } from '../game/store';

const PAGE_KEYS = [
  { title: 'guide.p1title', lines: ['guide.p1l1', 'guide.p1l2', 'guide.p1l3'] },
  { title: 'guide.p2title', lines: ['guide.p2l1', 'guide.p2l2', 'guide.p2l3', 'guide.p2l4'] },
  { title: 'guide.p3title', lines: ['guide.p3l1', 'guide.p3l2', 'guide.p3l3', 'guide.p3l4', 'guide.p3l5'] },
  { title: 'guide.p4title', lines: ['guide.p4l1', 'guide.p4l2', 'guide.p4l3', 'guide.p4l4', 'guide.p4l5', 'guide.p4l6'] },
] as const;

export default function GuideModal() {
  const { guideOpen } = useUi();
  const [page, setPage] = useState(0);
  if (!guideOpen) return null;

  const close = () => {
    setPage(0);
    setUi({ guideOpen: false });
  };

  const p = PAGE_KEYS[page];
  return (
    <div className="overlay" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{t('guide.head', { title: t(p.title) })}</span>
          <button className="btn" onClick={close}>
            {t('common.close')}
          </button>
        </div>
        <div className="modal-body scroll-y">
          {p.lines.map((line) => (
            <p key={line} style={{ marginBottom: 8 }}>
              {t(line)}
            </p>
          ))}
          <p style={{ textAlign: 'center', color: 'var(--ink-60)', fontSize: 12 }}>
            {page + 1} / {PAGE_KEYS.length}
          </p>
        </div>
        <div className="modal-foot">
          <button
            className="btn"
            disabled={page === 0}
            onClick={() => {
              setPage(page - 1);
              playCue('back');
            }}
          >
            {t('common.prev')}
          </button>
          {page < PAGE_KEYS.length - 1 ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                setPage(page + 1);
                playCue('forward');
              }}
            >
              {t('common.next')}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={close}>
              {t('common.close')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
