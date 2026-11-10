import { useEffect, useRef, useState } from 'react';
import CoverAtmosphere from '../components/CoverAtmosphere';
import Icon from '../components/Icon';
import { useDialogFocus } from '../components/useDialogFocus';
import { assetUrl, data, GAME_LOCALES } from '../game/data';
import { useLayout } from '../game/layout';
import { continueGame, newGame } from '../game/logic';
import { hasSave } from '../game/save';
import { playCue, sfxSkipLayer } from '../game/sfx';
import { setUi, useUi } from '../game/store';
import { LOCALE_LABEL, setLocale, t, useLocale } from '../i18n';

const homeAsset = (name: string) => assetUrl(`slr-assets/home/${name}`);

/** The cover is independent artwork; all game actions still use the inherited engine. */
export default function BridgeTitle() {
  const locale = useLocale();
  const phone = useLayout() === 'phone';
  const { menuOpen, guideOpen } = useUi();
  const resume = hasSave();
  const [dialog, setDialog] = useState<'language' | 'restart' | null>(null);
  const [wordmarkFailed, setWordmarkFailed] = useState(false);
  const controls = useRef<HTMLDivElement>(null);
  const dialogRef = useDialogFocus(dialog !== null);
  const english = locale === 'en';
  const background = homeAsset(phone ? 'cover-portrait.png' : 'cover-landscape.png');

  useEffect(() => setWordmarkFailed(false), [locale]);
  useEffect(() => {
    if (controls.current) controls.current.inert = !!dialog || menuOpen || guideOpen;
  }, [dialog, menuOpen, guideOpen]);
  useEffect(() => {
    if (!dialog) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      setDialog(null);
      playCue('close');
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [dialog]);

  const closeDialog = () => {
    setDialog(null);
    playCue('close');
  };
  const openDialog = (next: 'language' | 'restart') => {
    sfxSkipLayer();
    setDialog(next);
    playCue('open');
  };
  const begin = () => {
    if (resume) openDialog('restart');
    else newGame();
  };

  return (
    <main className={`cover slr-cover${english ? ' is-english' : ''}`} aria-label={data.meta.title}>
      <img className="cover-bg" src={background} alt="" loading="eager" draggable={false} />
      {!phone ? <CoverAtmosphere src={background} variant="bridge" /> : null}
      <div className="cover-scrim" aria-hidden="true" />

      <div className="bridge-cover-controls" ref={controls}>
        <div className="bridge-heading">
          <h1 className={wordmarkFailed ? 'bridge-title-fallback' : 'bridge-wordmark'}>
            {wordmarkFailed ? data.meta.title : (
              <>
                <span className="bridge-sr-only">{data.meta.title}</span>
                <span className={`bridge-wordmark-crop${english ? ' is-en' : ''}`} aria-hidden="true">
                  <img
                    key={locale}
                    src={homeAsset(english ? 'wordmark-en.png' : 'wordmark-zh.png')}
                    alt=""
                    draggable={false}
                    onError={() => setWordmarkFailed(true)}
                  />
                </span>
              </>
            )}
          </h1>
          {!english ? <p className="bridge-original-title" lang="en">THE BRIDGE OF SAN LUIS REY</p> : null}
        </div>

        <div className="bridge-entry">
          <p className="bridge-subtitle">{data.meta.subtitle}</p>
          <div className={`bridge-actions${resume ? '' : ' is-first-visit'}`}>
            <button className="bridge-action is-primary" type="button" onClick={resume ? continueGame : begin}>
              <span className="bridge-flourish" aria-hidden="true"><img src={homeAsset('menu-flourish.png')} alt="" /></span>
              <span>{resume ? t('title.continue') : t('title.newGame')}</span>
              <span className="bridge-flourish is-right" aria-hidden="true"><img src={homeAsset('menu-flourish.png')} alt="" /></span>
            </button>
            {resume ? <button className="bridge-action is-secondary" type="button" onClick={begin}>{t('title.newGame')}</button> : null}
          </div>
        </div>

        <button
          className="cover-menu"
          type="button"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={() => { sfxSkipLayer(); setUi({ menuOpen: true }); playCue('open'); }}
        >
          <Icon name="menu" size={23} />{t('common.menu')}
        </button>
        <button
          className="cover-lang"
          type="button"
          aria-label={t('lang.label')}
          aria-haspopup="dialog"
          aria-expanded={dialog === 'language'}
          onClick={() => openDialog('language')}
        >
          <span lang="zh-CN" className={!english ? 'is-current' : ''}>简体中文</span>
          <span className="bridge-lang-divider" aria-hidden="true">/</span>
          <span lang="en" className={english ? 'is-current' : ''}>English</span>
        </button>
      </div>

      {dialog ? (
        <div className="overlay slr-cover-overlay" onClick={closeDialog}>
          <div
            className={`modal bridge-dialog${dialog === 'language' ? ' cover-lang-modal' : ''}`}
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bridge-dialog-title"
            aria-describedby={dialog === 'restart' ? 'bridge-restart-description' : undefined}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="game-menu-head">
              <h2 className="game-menu-title" id="bridge-dialog-title">{dialog === 'language' ? t('lang.label') : t('cover.restartTitle')}</h2>
              <button className="game-menu-close" type="button" aria-label={t('common.close')} onClick={closeDialog}><Icon name="close" size={20} /></button>
            </div>
            {dialog === 'language' ? (
              <div className="game-menu-langs bridge-language-options">
                {GAME_LOCALES.map((id) => (
                  <button
                    key={id}
                    className={`game-menu-lang-btn${locale === id ? ' is-on' : ''}`}
                    type="button"
                    lang={id}
                    aria-pressed={locale === id}
                    onClick={() => { sfxSkipLayer(); setLocale(id); setDialog(null); playCue('toggle-on'); }}
                  >
                    <span>{LOCALE_LABEL[id]}</span>
                    {locale === id ? <Icon name="check" size={17} /> : null}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <p className="bridge-dialog-copy" id="bridge-restart-description">{t('cover.restartBody')}</p>
                <div className="bridge-dialog-actions">
                  <button className="btn" type="button" onClick={closeDialog}>{t('cover.keepProgress')}</button>
                  <button className="btn btn-primary" type="button" onClick={() => { setDialog(null); newGame(); }}>{t('cover.restartAction')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
