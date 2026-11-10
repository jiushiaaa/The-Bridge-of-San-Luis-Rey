// 【回顾本关故事】多页图文长廊（README_game §4.9 / doc/12-story-recap.md）
// 左＝综合预览图（本页覆盖到的情节 CG / 角色卡图，主图 + 自动切换）；右＝第三方旁白口吻的故事回顾文章
// 解锁：情节列整列归位（或该关已通关），入口在时间轴中列底部
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { assetUrl, cardDef, data, entryDef, recapOf } from '../game/data';
import { closeRecap } from '../game/logic';
import { playCue } from '../game/sfx';
import { useGame, useUi } from '../game/store';
import type { RecapPage } from '../game/types';
import Avatar from './Avatar';
import { CopyEditButton } from './copyedit/common';

const SWITCH_MS = 4500;

/** 本页可用的预览图：显式配置优先，否则取覆盖卡里**已补完**的 CG（未补完不露，防剧透） */
export function recapPageImages(page: RecapPage, done: (id: string) => boolean): string[] {
  if (page.images && page.images.length > 0) return page.images;
  const out: string[] = [];
  for (const id of page.cards) {
    const c = cardDef(id);
    if (c?.cg && done(id)) out.push(c.cg);
  }
  return out;
}

/** 回顾文章段：旁白 / 人物引语（故事页与图文长廊共用） */
export function RecapSegList({ page }: { page: RecapPage }) {
  return (
    <>
      {page.segments.map((seg, i) =>
        seg.kind === 'quote' ? (
          <div className="recap-quote" key={i}>
            <Avatar entryId={seg.entry} size={52} />
            <div className="recap-quote-body">
              <span className="recap-quote-who">{entryDef(seg.entry)?.name ?? seg.entry}</span>
              <div className="bubble mono">{seg.text}</div>
            </div>
          </div>
        ) : (
          <p className="recap-narr" key={i}>
            {seg.text}
          </p>
        ),
      )}
    </>
  );
}

/** 综合预览图：主图铺满 + 每 4.5s 交叉淡入切换，底部小图条可手点 */
export function PreviewPane({ images, title }: { images: string[]; title: string }) {
  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    setIdx(0);
    setAuto(true);
  }, [title]);
  useEffect(() => {
    if (!auto || images.length < 2) return;
    const timer = setTimeout(() => setIdx((v) => (v + 1) % images.length), SWITCH_MS);
    return () => clearTimeout(timer);
  }, [idx, auto, images.length]);
  const list = images.length > 0 ? images : [data.assets.titleImage];
  return (
    <div className="recap-pane">
      <div className="recap-stage">
        {list.map((src, i) => (
          <img
            key={src + i}
            className={`recap-shot${i === idx ? ' on' : ''}`}
            src={assetUrl(src)}
            alt=""
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ))}
      </div>
      {list.length > 1 ? (
        <div className="recap-thumbs scroll-x">
          {list.map((src, i) => (
            <button
              key={src + i}
              className={`recap-thumb${i === idx ? ' on' : ''}`}
              title={t('common.imageOf', { n: i + 1, total: list.length })}
              onClick={() => {
                setIdx(i);
                setAuto(false);
              }}
            >
              <img src={assetUrl(src)} alt="" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export type RecapPager = {
  idx: number;
  count: number;
  titles?: string[];
  onChange: (i: number) => void;
  lastAction?: { label: string; onClick: () => void };
  showDots?: boolean;
  showPageNo?: boolean;
};

/** 图文长廊内页：左图右文，可选翻页。覆盖层与故事页共用。 */
export function RecapGallery({
  kicker,
  title,
  images,
  imageKey,
  children,
  pager,
  tools,
  headEnd,
  enableKeys = false,
}: {
  kicker: string;
  title: string;
  images: string[];
  imageKey: string;
  children: ReactNode;
  pager?: RecapPager;
  tools?: ReactNode;
  headEnd?: ReactNode;
  enableKeys?: boolean;
}) {
  const idx = pager?.idx ?? 0;
  const count = pager?.count ?? 0;
  const last = count > 0 && idx >= count - 1;
  const showDots = pager?.showDots !== false;
  const showPageNo = pager?.showPageNo !== false;
  const turnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = turnRef.current?.querySelector('.recap-article-scroll');
    if (el instanceof HTMLElement) el.scrollTop = 0;
  }, [imageKey]);

  useEffect(() => {
    if (!enableKeys || !pager || count < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && idx < count - 1) {
        pager.onChange(idx + 1);
        playCue('forward');
      }
      if (e.key === 'ArrowLeft' && idx > 0) {
        pager.onChange(idx - 1);
        playCue('back');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enableKeys, idx, count, pager]);

  return (
    <>
      <div ref={turnRef} key={imageKey} className="recap-turn">
        <div className="recap-head">
          <span className="recap-lv">{kicker}</span>
          <span className="recap-title">{title}</span>
          {headEnd}
        </div>
        <div className="recap-body">
          <PreviewPane images={images} title={imageKey} />
          <div className="recap-article">
            <div className="recap-article-scroll scroll-y">{children}</div>
          </div>
        </div>
      </div>
      {pager || tools ? (
        <div className="recap-foot">
          {pager && count > 1 ? (
            <>
              <button
                className="btn"
                disabled={idx === 0}
                onClick={() => {
                  pager.onChange(idx - 1);
                  playCue('back');
                }}
              >
                {t('recap.prev')}
              </button>
              <span className="recap-pager">
                {showDots
                  ? Array.from({ length: count }, (_, i) => (
                      <button
                        key={i}
                        className={`recap-dot${i === idx ? ' on' : ''}`}
                        title={pager.titles?.[i]}
                        onClick={() => {
                          if (i === idx) return;
                          pager.onChange(i);
                          playCue(i > idx ? 'forward' : 'back');
                        }}
                      />
                    ))
                  : null}
                {showPageNo ? (
                  <span className="recap-pageno">
                    {t('common.pageOf', { n: idx + 1, total: count })}
                  </span>
                ) : null}
              </span>
              {last && pager.lastAction ? (
                <button className="btn btn-primary" onClick={pager.lastAction.onClick}>
                  {pager.lastAction.label}
                </button>
              ) : (
                <button
                  className="btn"
                  disabled={last}
                  onClick={() => {
                    pager.onChange(idx + 1);
                    playCue('forward');
                  }}
                >
                  {t('recap.next')}
                </button>
              )}
            </>
          ) : (
            <span className="recap-pager" />
          )}
          {tools}
        </div>
      ) : null}
    </>
  );
}

export default function StoryRecap() {
  const s = useGame();
  const { recapLevel } = useUi();
  const [page, setPage] = useState(0);
  const lv = recapLevel;
  useEffect(() => {
    setPage(0);
  }, [lv]);
  if (lv == null) return null;
  const pages = recapOf(lv)?.pages ?? [];
  if (pages.length === 0) return null;
  const idx = Math.min(page, pages.length - 1);
  const p = pages[idx];
  const imgs = recapPageImages(p, (id) => !!s.cards[id]?.done);

  return (
    <div className="overlay recap-overlay" onClick={closeRecap}>
      <div className="recap-modal" onClick={(e) => e.stopPropagation()}>
        <RecapGallery
          kicker={t('recap.kicker', { n: lv })}
          title={p.title}
          images={imgs}
          imageKey={`${lv}:${idx}`}
          pager={{
            idx,
            count: pages.length,
            titles: pages.map((x) => x.title),
            onChange: setPage,
            lastAction: { label: t('recap.close'), onClick: closeRecap },
          }}
          tools={<CopyEditButton conf={{ kind: 'recap', level: lv }} label="故事回顾" />}
          headEnd={
            <button className="btn" onClick={closeRecap}>
              {t('common.close')}
            </button>
          }
          enableKeys
        >
          <RecapSegList page={p} />
        </RecapGallery>
      </div>
    </div>
  );
}
