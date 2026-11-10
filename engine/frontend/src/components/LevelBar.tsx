// 关卡带（时间轴右栏顶部）：已通关的关可点进只读回顾，当前关高亮，未开启的关只露锁形
// 每格只给「第N关」+ 小字「N 段情节」——名字与星级都不露：名字会剧透走向，
// 段数不会，却正好回答了「这部作品还有多长」。
// **恒为一行**：右栏很窄，关卡多了不换行也不出滚动条，改成左右翻页——
// 一行里能塞几格由实测宽度算出来，关卡数增加时不用改代码。
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { allLevels, cardsOfLevel } from '../game/data';
import { levelCleared, reviewLevel } from '../game/logic';
import { useGame, useUi } from '../game/store';

// 下面三个常量必须与 styles.css 的 .lv-bar-track / .lv-chip / .lv-page 对齐
const GAP = 3;
const CHIP_W = 62; // 每格**固定**宽度：不随本页格数拉伸，页不满时靠居中而不是撑开
const ARROW = 14; // 翻页按钮宽度
const PER_PAGE = 3; // 一页最多放几关（放不下时按实测宽度降级）

export default function LevelBar() {
  const s = useGame();
  const { reviewLevel: rv } = useUi();
  const levels = allLevels();
  const barRef = useRef<HTMLDivElement>(null);
  const [perPage, setPerPage] = useState(levels.length);
  const [page, setPage] = useState(0);

  // 一页固定放 PER_PAGE 关；只有窄到连这么多都摆不下时才按实测宽度降级
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const fits = (avail: number) => Math.max(1, Math.floor((avail + GAP) / (CHIP_W + GAP)));
      const want = Math.min(PER_PAGE, levels.length);
      // 全部塞得下就不出翻页按钮；否则要先扣掉左右两个按钮的位置再算
      setPerPage(fits(w) >= levels.length ? levels.length : Math.min(want, fits(w - 2 * (ARROW + GAP))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [levels.length]);

  const shown = rv ?? s.level;
  const shownIdx = levels.indexOf(shown);
  const maxPage = Math.max(0, Math.ceil(levels.length / perPage) - 1);

  // 当前（或正在回顾的）关卡换了页，就自动翻到它所在那一页
  useEffect(() => {
    if (shownIdx >= 0 && perPage > 0) setPage(Math.min(maxPage, Math.floor(shownIdx / perPage)));
  }, [shownIdx, perPage, maxPage]);

  if (levels.length <= 1) return null;
  const paged = levels.length > perPage;
  const cur = Math.min(page, maxPage);
  const visible = paged ? levels.slice(cur * perPage, cur * perPage + perPage) : levels;

  return (
    <div className="lv-bar" data-levelbar ref={barRef}>
      {paged ? (
        <button
          className="lv-page"
          disabled={cur === 0}
          title={t('levelBar.prev')}
          onClick={() => setPage((v) => Math.max(0, v - 1))}
        >
          ‹
        </button>
      ) : null}
      <div className="lv-bar-track">
        {visible.map((lv) => {
          const cleared = levelCleared(lv, s);
          const current = lv === s.level;
          const active = lv === shown;
          const clickable = cleared || (current && rv != null);
          const title = current
            ? rv == null
              ? t('levelBar.playing')
              : t('levelBar.backPlay')
            : cleared
              ? t('levelBar.review')
              : t('levelBar.locked');
          return (
            <button
              key={lv}
              className={`lv-chip${active ? ' active' : ''}${current ? ' current' : ''}${cleared || current ? '' : ' locked'}`}
              data-level={lv}
              disabled={!clickable}
              title={title}
              onClick={() => reviewLevel(current ? null : lv)}
            >
              <span className="lv-chip-no">{t('levelBar.chip', { n: lv })}</span>
              <span className="lv-chip-n">{t('levelBar.segs', { n: cardsOfLevel(lv).length })}</span>
            </button>
          );
        })}
      </div>
      {paged ? (
        <button
          className="lv-page"
          disabled={cur >= maxPage}
          title={t('levelBar.next')}
          onClick={() => setPage((v) => Math.min(maxPage, v + 1))}
        >
          ›
        </button>
      ) : null}
    </div>
  );
}
