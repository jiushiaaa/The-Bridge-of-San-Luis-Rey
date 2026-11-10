// 封面：整幅题图 + Three.js 大气特效（水波 / 阳光），题名压在画面上
import { LOCALE_LABEL, setLocale, t, useLocale } from '../i18n';
import { useEffect, useState } from 'react';
import CoverAtmosphere from '../components/CoverAtmosphere';
import Icon from '../components/Icon';
import { useDialogFocus } from '../components/useDialogFocus';
import { assetUrl, data, GAME_ID, GAME_LOCALES } from '../game/data';
import { continueGame, newGame } from '../game/logic';
import { hasSave } from '../game/save';
import { playCue, sfxSkipLayer } from '../game/sfx';
import { setUi } from '../game/store';
import BridgeTitle from './BridgeTitle';

export default function Title() {
  return GAME_ID === 'slr' ? <BridgeTitle /> : <ClassicTitle />;
}

function ClassicTitle() {
  const resume = hasSave();
  const loc = useLocale();
  const [fxReady, setFxReady] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const languageDialog = useDialogFocus(langOpen && GAME_ID === 'slr');
  const src = assetUrl(data.assets.titleImage);

  useEffect(() => {
    if (!langOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      setLangOpen(false);
      playCue('close');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [langOpen]);

  const closeLang = () => {
    setLangOpen(false);
    playCue('close');
  };

  return (
    <div className={`cover${GAME_ID === 'slr' ? ' slr-cover' : ''}`}>
      <img
        className={`cover-bg${fxReady ? ' is-fx-ready' : ''}`}
        src={src}
        alt=""
        onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
      />
      <CoverAtmosphere src={src} onReady={() => setFxReady(true)} />
      <div className="cover-scrim" aria-hidden="true" />
      <button
        className="cover-menu"
        type="button"
        aria-label={t('common.menu')}
        title={t('common.menu')}
        onClick={() => setUi({ menuOpen: true })}
      >
        <Icon name="menu" size={14} />
        {t('common.menu')}
      </button>
      <div className="cover-plate">
        <i className="cover-rule" aria-hidden="true" />
        <h1>{data.meta.title}</h1>
        {data.meta.subtitle || data.meta.adaptedFrom ? (
          <p className="cover-sub">
            {data.meta.subtitle}
            {data.meta.adaptedFrom ? <span className="cover-credit">{data.meta.adaptedFrom}</span> : null}
          </p>
        ) : null}
        {data.meta.tagline ? <p className="cover-tagline">{data.meta.tagline}</p> : null}
        <div className="cover-btns">
          {resume ? (
            <button className="cover-btn is-primary" type="button" onClick={continueGame}>
              {t('title.continue')}
            </button>
          ) : null}
          <button className={`cover-btn${resume ? '' : ' is-primary'}`} type="button" onClick={newGame}>
            {t('title.newGame')}
          </button>
        </div>
      </div>
      <button
        className="cover-lang"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={langOpen}
        aria-label={t('lang.label')}
        onClick={() => {
          sfxSkipLayer();
          setLangOpen(true);
          playCue('open');
        }}
      >
        <Icon name="globe" size={14} />
        {LOCALE_LABEL[loc]}
      </button>
      {langOpen ? (
        <div className="overlay" onClick={closeLang}>
          <div
            className="modal game-menu cover-lang-modal"
            ref={languageDialog}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cover-lang-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="game-menu-head">
              <span className="game-menu-title" id="cover-lang-title">
                {t('lang.label')}
              </span>
              <button className="game-menu-close" type="button" aria-label={t('common.close')} onClick={closeLang}>
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="game-menu-langs cover-lang-pills">
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
                    setLangOpen(false);
                  }}
                >
                  {LOCALE_LABEL[id]}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
