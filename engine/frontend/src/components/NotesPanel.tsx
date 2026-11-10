// 故事页：已进入各卷的开场 + 过关后的回顾 + 通关后的结局（目录按页列出，正文即图文长廊）
import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { allLevels, data, levelChapterTitle, recapOf } from '../game/data';
import { levelCleared } from '../game/logic';
import { playCue } from '../game/sfx';
import { setUi, useGame, useUi } from '../game/store';
import { useLayout } from '../game/layout';
import { FrameSegView } from '../screens/Opening';
import { CopyEditButton } from './copyedit/common';
import { RecapGallery, RecapSegList, recapPageImages } from './StoryRecap';

type StorySel =
  | { lv: number; kind: 'intro' }
  | { lv: number; kind: 'recap'; page: number }
  | { kind: 'ending' };

/** 目录条目；locked=尚未解锁（目录里灰显不可点，翻页与选中都跳过它） */
type StoryPiece = StorySel & { label: string; locked: boolean };

/** 「第一卷 · 弃家求道」→ { vol: 第一卷, name: 弃家求道 }；无分隔符则整段作 name */
function splitChapter(title: string): { vol: string; name: string } {
  const i = title.indexOf('·');
  if (i < 0) return { vol: '', name: title };
  return { vol: title.slice(0, i).trim(), name: title.slice(i + 1).trim() };
}

function samePiece(a: StorySel, b: StorySel): boolean {
  if (a.kind === 'ending' || b.kind === 'ending') return a.kind === 'ending' && b.kind === 'ending';
  if (a.lv !== b.lv || a.kind !== b.kind) return false;
  return a.kind === 'intro' || a.page === (b as { page: number }).page;
}

/**
 * 全部卷的全部条目（目录默认全部展开，包括还没到的卷与未过关的回顾子章节）：
 * 开场在进入该卷后解锁；回顾各页在该卷过关后解锁；结局在通关后解锁。
 */
function catalogOf(
  levels: number[],
  opened: (lv: number) => boolean,
  cleared: (lv: number) => boolean,
  finished: boolean,
): StoryPiece[] {
  const out: StoryPiece[] = [];
  for (const lv of levels) {
    out.push({ lv, kind: 'intro', label: t('notes.intro'), locked: !opened(lv) });
    (recapOf(lv)?.pages ?? []).forEach((p, page) => {
      out.push({
        lv,
        kind: 'recap',
        page,
        label: p.title || t('notes.recapN', { n: page + 1 }),
        locked: !cleared(lv),
      });
    });
  }
  out.push({ kind: 'ending', label: data.frame.ending.title || t('notes.ending'), locked: !finished });
  return out;
}

export default function NotesPanel() {
  const s = useGame();
  const { recapLevel, storyJumpFirst, notesToc } = useUi();
  const phone = useLayout() === 'phone';
  const finished = !!s.stats.finishedAt || s.screen === 'ending';
  const levels = allLevels();
  // 目录列全部条目；翻页 / 选中只在已解锁的 catalog 里走
  const toc = catalogOf(
    levels,
    (lv) => lv <= s.level || finished,
    (lv) => levelCleared(lv, s) || finished,
    finished,
  );
  const catalog = toc.filter((p) => !p.locked);
  const [sel, setSel] = useState<StorySel>({ lv: s.level, kind: 'intro' });

  useEffect(() => {
    if (storyJumpFirst && catalog.length > 0) {
      setSel(catalog[0]);
      setUi({ storyJumpFirst: false });
      return;
    }
    setSel((cur) => {
      const ok = catalog.some((p) => samePiece(p, cur));
      if (ok) return cur;
      return { lv: Math.min(cur.kind === 'ending' ? s.level : cur.lv, s.level), kind: 'intro' };
    });
  }, [s.level, catalog.length, storyJumpFirst, finished]);

  const pick = (next: StorySel) => {
    setSel(next);
    playCue('select');
    if (phone && notesToc) setUi({ notesToc: false });
  };

  const idx = Math.max(0, catalog.findIndex((p) => samePiece(p, sel)));
  const piece = catalog[idx] ?? catalog[0];
  if (!piece) return null;

  const chapter = piece.kind === 'ending' ? data.frame.ending.title : levelChapterTitle(piece.lv);
  const { vol, name } = splitChapter(chapter);
  const intro = piece.kind !== 'ending' ? data.frame.levelIntro[String(piece.lv)] || [] : [];
  const storySegs = intro.slice(1);
  const recapPages = piece.kind === 'recap' ? recapOf(piece.lv)?.pages ?? [] : [];
  const recapPage = piece.kind === 'recap' ? recapPages[piece.page] : undefined;
  const introImage =
    piece.kind === 'ending'
      ? data.assets.endingImage || data.assets.titleImage
      : data.assets.levelIntroImages?.[String(piece.lv)] || data.assets.titleImage;
  const introImages = introImage ? [introImage] : [];
  const recapImages = recapPage ? recapPageImages(recapPage, (id) => !!s.cards[id]?.done) : introImages;
  const ed = data.frame.ending;

  const go = (i: number) => {
    const next = catalog[i];
    if (!next) return;
    setSel(next);
  };

  return (
    <div className={`notes-layout${phone && notesToc ? ' toc-open' : ''}`}>
      {phone && notesToc ? (
        <div className="drawer-mask" onClick={() => setUi({ notesToc: false })} />
      ) : null}
      <nav className="story-toc scroll-y" aria-label={t('notes.tocAria')}>
        <div className="story-toc-kicker">{t('notes.toc')}</div>
        {levels.map((lv) => {
          const title = levelChapterTitle(lv);
          const parts = splitChapter(title);
          const items = toc.filter((p) => p.kind !== 'ending' && p.lv === lv);
          const volLocked = items.every((p) => p.locked);
          return (
            <div className={`story-toc-vol${volLocked ? ' is-locked' : ''}`} key={lv}>
              <div className="story-toc-vol-title">
                <span className="story-toc-vol-kicker">{parts.vol || t('common.vol', { n: lv })}</span>
                {parts.name ? <span className="story-toc-vol-name">{parts.name}</span> : null}
              </div>
              {items.map((p) => (
                <button
                  type="button"
                  key={p.kind === 'intro' ? 'intro' : `recap:${p.kind === 'recap' ? p.page : 0}`}
                  className={`story-toc-item${p.kind === 'intro' ? ' is-intro' : ''}${p.locked ? ' is-locked' : samePiece(p, piece) ? ' is-on' : ''}`}
                  disabled={p.locked}
                  aria-disabled={p.locked || undefined}
                  title={p.locked ? t('notes.locked') : undefined}
                  onClick={() => {
                    if (!p.locked) pick(p);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          );
        })}
        <div className={`story-toc-vol${finished ? '' : ' is-locked'}`}>
          <div className="story-toc-vol-title">
            <span className="story-toc-vol-kicker">{t('notes.ending')}</span>
            {ed.title ? <span className="story-toc-vol-name">{ed.title}</span> : null}
          </div>
          <button
            type="button"
            className={`story-toc-item${finished ? (piece.kind === 'ending' ? ' is-on' : '') : ' is-locked'}`}
            disabled={!finished}
            aria-disabled={!finished || undefined}
            title={finished ? undefined : t('notes.locked')}
            onClick={() => {
              if (finished) pick({ kind: 'ending' });
            }}
          >
            {ed.title || t('notes.coda')}
          </button>
        </div>
      </nav>

      <section className="notes-story story-gallery">
        <div className="story-spread">
          {piece.kind === 'intro' ? (
            <RecapGallery
              kicker={vol || t('common.vol', { n: piece.lv })}
              title={t('notes.introTitle', { name: name || chapter })}
              images={introImages}
              imageKey={`intro:${piece.lv}`}
              pager={
                catalog.length > 1
                  ? {
                      idx,
                      count: catalog.length,
                      onChange: go,
                      showDots: false,
                      showPageNo: false,
                    }
                  : undefined
              }
              tools={<CopyEditButton conf={{ kind: 'frame', target: 'intro', level: piece.lv }} />}
              enableKeys={recapLevel == null && catalog.length > 1}
            >
              {storySegs.length === 0 ? (
                <div className="entry-empty">{t('notes.noIntro')}</div>
              ) : (
                storySegs.map((seg, i) => <FrameSegView key={i} seg={seg} />)
              )}
            </RecapGallery>
          ) : piece.kind === 'ending' ? (
            <RecapGallery
              kicker={t('notes.ending')}
              title={ed.title}
              images={introImages}
              imageKey="ending"
              pager={
                catalog.length > 1
                  ? {
                      idx,
                      count: catalog.length,
                      onChange: go,
                      showDots: false,
                      showPageNo: false,
                    }
                  : undefined
              }
              tools={<CopyEditButton conf={{ kind: 'frame', target: 'ending' }} />}
              enableKeys={recapLevel == null && catalog.length > 1}
            >
              {ed.segments.map((seg, i) => (
                <FrameSegView key={i} seg={seg} />
              ))}
              {ed.credit ? <p className="ending-credit-inline">{ed.credit}</p> : null}
            </RecapGallery>
          ) : recapPage ? (
            <RecapGallery
              kicker={vol || t('common.vol', { n: piece.lv })}
              title={recapPage.title}
              images={recapImages}
              imageKey={`recap:${piece.lv}:${piece.page}`}
              pager={{
                idx,
                count: catalog.length,
                onChange: go,
                showDots: false,
                showPageNo: false,
              }}
              tools={<CopyEditButton conf={{ kind: 'recap', level: piece.lv }} label="故事回顾" />}
              enableKeys={recapLevel == null}
            >
              <RecapSegList page={recapPage} />
            </RecapGallery>
          ) : (
            <div className="entry-empty">{t('notes.noRecap')}</div>
          )}
        </div>
      </section>
    </div>
  );
}
