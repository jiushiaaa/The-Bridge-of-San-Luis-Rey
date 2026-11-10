// 常驻提示弹层：按优先级列出当前可做的事；有跳转的整行可点
import { t } from '../i18n';
import Icon from './Icon';
import { currentHints } from '../game/logic';
import { sfxSkipLayer } from '../game/sfx';
import { setUi, useUi } from '../game/store';

export default function HintModal() {
  const { hintOpen } = useUi();
  if (!hintOpen) return null;
  const close = () => setUi({ hintOpen: false });
  const hints = currentHints();
  return (
    <div className="overlay" onClick={close}>
      <div
        className="modal hint-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hint-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hint-modal-head">
          <div className="hint-modal-heading">
            <span className="hint-modal-kicker">{t('hint.title')}</span>
            <span className="hint-modal-title" id="hint-modal-title">
              {t('hint.next')}
            </span>
          </div>
          <button className="hint-modal-close" type="button" aria-label={t('common.close')} onClick={close}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <p className="hint-modal-lead">{t('hint.lead')}</p>
        <div className="hint-modal-body scroll-y">
          {hints.map((h, i) =>
            h.act ? (
              <button
                type="button"
                className="hint-row is-link"
                key={i}
                onClick={() => {
                  h.act!();
                  sfxSkipLayer();
                  close();
                }}
              >
                <span className="hint-row-no">{i + 1}</span>
                <span className="hint-row-text">{h.text}</span>
                <span className="hint-row-go">{t('common.go')}</span>
              </button>
            ) : (
              <div className="hint-row" key={i}>
                <span className="hint-row-no">{i + 1}</span>
                <span className="hint-row-text">{h.text}</span>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
