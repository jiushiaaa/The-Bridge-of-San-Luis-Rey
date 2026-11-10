// 页签栏「菜单」弹层：音量 / BGM / 语言 / 玩法说明 / 回标题 / DEBUG-进度
import { LOCALE_LABEL, getLocale, setLocale, t } from '../i18n';
import { offlineBuild } from '../debug';
import { data, GAME_ID, GAME_LOCALES } from '../game/data';
import { hasBgm } from '../game/bgm';
import { backToTitle } from '../game/logic';
import { playCue, sfxSkipLayer } from '../game/sfx';
import { setUi, useUi } from '../game/store';
import BgmPlayer from './BgmPlayer';
import Icon from './Icon';
import SoundToggle from './SoundToggle';
import { useDialogFocus } from './useDialogFocus';

export default function GameMenu() {
  const { menuOpen, showTitle } = useUi();
  const menuDialog = useDialogFocus(menuOpen && showTitle && GAME_ID === 'slr');
  if (!menuOpen) return null;
  const loc = getLocale();

  const close = () => setUi({ menuOpen: false });

  return (
    <div className={`overlay${showTitle && GAME_ID === 'slr' ? ' slr-cover-overlay' : ''}`} onClick={close}>
      <div
        className="modal game-menu"
        ref={menuDialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-menu-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="game-menu-head">
          <div className="game-menu-heading">
            <span className="game-menu-kicker">{t('common.settings')}</span>
            <span className="game-menu-title" id="game-menu-title">
              {t('common.menu')}
            </span>
          </div>
          <button className="game-menu-close" type="button" aria-label={t('menu.closeMenu')} onClick={close}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="game-menu-body">
          <div className="game-menu-section">
            <SoundToggle variant="row" />
          </div>
          {hasBgm() ? (
            <div className="game-menu-section">
              <BgmPlayer />
            </div>
          ) : null}
          <div className="game-menu-section">
            <div className="game-menu-row game-menu-lang" role="group" aria-label={t('lang.label')}>
              <Icon name="book" size={16} />
              <span className="game-menu-row-label">{t('lang.label')}</span>
            </div>
            <div className="game-menu-langs">
              {GAME_LOCALES.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`game-menu-lang-btn${id === loc ? ' is-on' : ''}`}
                  aria-pressed={id === loc}
                  onClick={() => {
                    sfxSkipLayer();
                    setLocale(id);
                    playCue('toggle-on');
                  }}
                >
                  {LOCALE_LABEL[id]}
                </button>
              ))}
            </div>
          </div>
          <div className="game-menu-section">
            <button
              className="game-menu-row"
              type="button"
              onClick={() => {
                sfxSkipLayer();
                setUi({ menuOpen: false, guideOpen: true });
                playCue('open');
              }}
            >
              <Icon name="book" size={16} />
              <span className="game-menu-row-label">{t('menu.guide')}</span>
              <Icon name="chevron" size={14} className="game-menu-chevron" />
            </button>
            {!showTitle ? (
              <button
                className="game-menu-row"
                type="button"
                onClick={() => {
                  sfxSkipLayer();
                  setUi({ menuOpen: false });
                  backToTitle();
                }}
              >
                <Icon name="home" size={16} />
                <span className="game-menu-row-label">{t('menu.backTitle')}</span>
                <Icon name="chevron" size={14} className="game-menu-chevron" />
              </button>
            ) : null}
          </div>
          {!offlineBuild ? (
            <div className="game-menu-section">
              <button
                className="game-menu-row is-debug"
                type="button"
                onClick={() => {
                  sfxSkipLayer();
                  setUi({ menuOpen: false, debugOpen: true });
                  playCue('open');
                }}
              >
                <Icon name="archive" size={16} />
                <span className="game-menu-row-label">{t('menu.debug')}</span>
                <Icon name="chevron" size={14} className="game-menu-chevron" />
              </button>
            </div>
          ) : null}
          {showTitle && GAME_ID === 'slr' && data.meta.adaptedFrom ? <p className="slr-cover-credit">{data.meta.adaptedFrom}</p> : null}
        </div>
      </div>
    </div>
  );
}
