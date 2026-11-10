// 档案页签：左词条列表（按人物/地点/物品/概念分组）+ 右档案卡
import { useEffect } from 'react';
import { t } from '../i18n';
import { assetUrl, data, entryDef, familiarMaxOf, TYPE_LABEL, TYPE_ORDER } from '../game/data';
import {
  analyzeEntry,
  analyzeState,
  arcHintKey,
  checkArchivePage,
  clearHintPeek,
  HINT_COST,
  hintArchivePage,
  setArchiveDraft,
  setArchiveFocus,
} from '../game/logic';
import { useLayout } from '../game/layout';
import { setUi, useFxActive, useGame, useUi } from '../game/store';
import type { EntryType } from '../game/types';
import Avatar, { Seal } from './Avatar';
import { CopyEditButton } from './copyedit/common';
import Icon, { TypeIcon } from './Icon';

/** 组内排序：可分析 > 其余，再按本关熟悉度上限降序 */
function sortArchiveIds(ids: string[], s: ReturnType<typeof useGame>): string[] {
  return [...ids].sort((a, b) => {
    const aa = analyzeState(a, s) === 'active' ? 1 : 0;
    const bb = analyzeState(b, s) === 'active' ? 1 : 0;
    if (aa !== bb) return bb - aa;
    return familiarMaxOf(b, s.level) - familiarMaxOf(a, s.level);
  });
}

function ArchiveListItem({
  id,
  focus,
}: {
  id: string;
  focus: string;
}) {
  const s = useGame();
  const aState = analyzeState(id, s);
  // 三态徽标：可分析（金色）→ 可填写 → 已分析
  const fillable = !!s.entries[id]?.pagesUnlocked.some((i) => !s.entries[id]!.pagesDone.includes(i));
  const allDone =
    aState === 'done' &&
    data.entries[id].archive!.every((p, i) => p.level > s.level || !!s.entries[id]?.pagesDone.includes(i));
  return (
    <button
      className={`arc-item${id === focus ? ' active' : ''}${aState === 'active' ? ' can-analyze' : ''}`}
      data-arc={id}
      onClick={() => setArchiveFocus(id)}
    >
      <Avatar entryId={id} size={28} round={false} />
      <span>{data.entries[id].name}</span>
      {aState === 'active' ? (
        <span className="arc-badge gold">{t('archive.canAnalyze')}</span>
      ) : fillable ? (
        <span className="arc-badge fill">{t('archive.canFill')}</span>
      ) : allDone ? (
        <span className="arc-badge ok">{t('archive.analyzed')}</span>
      ) : null}
    </button>
  );
}

export default function Archive() {
  const s = useGame();
  const phone = useLayout() === 'phone';
  const { mobilePane } = useUi();
  // 有档案且已收集的词条，按 TYPE_ORDER 分组
  const withArchive = Object.keys(data.entries).filter(
    (id) => data.entries[id].archive?.length && s.entries[id]?.collected,
  );
  const groups = TYPE_ORDER.map((t: EntryType) => ({
    type: t,
    ids: sortArchiveIds(
      withArchive.filter((id) => data.entries[id].type === t),
      s,
    ),
  })).filter((g) => g.ids.length > 0);
  const flatIds = groups.flatMap((g) => g.ids);
  const focus = s.archiveFocus && flatIds.includes(s.archiveFocus) ? s.archiveFocus : flatIds[0];
  const def = focus ? entryDef(focus) : undefined;
  const e = focus ? s.entries[focus] : undefined;

  // 「⚡提示」的答案预览：换词条 / 离开档案页 / 窗口失焦或切标签页时立刻还原（与情节卡同规则）
  useEffect(() => {
    const off = () => clearHintPeek();
    const onVis = () => {
      if (document.visibilityState !== 'visible') clearHintPeek();
    };
    window.addEventListener('blur', off);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('blur', off);
      document.removeEventListener('visibilitychange', onVis);
      clearHintPeek();
    };
  }, [focus]);

  if (!focus || !def || !e) {
    return (
      <div className="chat-empty">
        {t('archive.empty')}
        <CopyEditButton conf={{ kind: 'archive', entryId: Object.keys(data.entries)[0] }} className="ce-arc-foot" />
      </div>
    );
  }

  const heroImg = def.avatar ?? def.image;
  const placeImg = def.type === 'place' ? def.image ?? def.avatar : undefined;
  const washImg =
    def.type !== 'place' && heroImg ? (
      <img
        className="arc-wash"
        src={assetUrl(heroImg)}
        alt=""
        aria-hidden="true"
        onError={(ev) => ((ev.target as HTMLImageElement).style.display = 'none')}
      />
    ) : null;
  const firstLocked = def.archive!.findIndex((p, i) => p.level === s.level && !e.pagesUnlocked.includes(i));

  const heroMeta = (
    <>
      <div className="arc-title-row">
        <span className="arc-name">{def.name}</span>
        <span className="arc-type">
          <TypeIcon type={def.type} /> {TYPE_LABEL[def.type]}
        </span>
      </div>
      <div className="arc-desc">{def.desc}</div>
    </>
  );

  const heroCard = (
    <div className="arc-hero-col">
      <div className="arc-hero-frame">
        <Seal name={def.name} color="#3d4f6f" size={120} />
        {heroImg ? (
          <img
            className="arc-hero-img"
            src={assetUrl(heroImg)}
            alt={def.name}
            onError={(ev) => ((ev.target as HTMLImageElement).style.display = 'none')}
          />
        ) : null}
      </div>
      {heroMeta}
    </div>
  );

  const pageList = (
    <div className="arc-main">
      {def.archive!.map((p, i) => {
        const unlocked = e.pagesUnlocked.includes(i);
        return (
          <div className="arc-page-sec" key={i} data-arc-tab={i}>
            <div className={`arc-page-head${unlocked ? '' : ' locked'}`}>
              {unlocked ? (
                t('archive.pageHead', { n: p.level, title: p.title })
              ) : (
                <>
                  {t('archive.pageLocked', { n: p.level })} <Icon name="lock" size={12} />
                </>
              )}
            </div>
            {unlocked ? (
              <ArchivePage focus={focus} pageIdx={i} />
            ) : p.level === s.level ? (
              <LockedPageCard entryId={focus} pageIdx={i} primary={i === firstLocked} />
            ) : null}
          </div>
        );
      })}
      <CopyEditButton conf={{ kind: 'archive', entryId: focus }} className="ce-arc-foot" />
    </div>
  );

  return (
    <div className={`arc-wrap is-${def.type}${phone && mobilePane === 'detail' ? ' is-detail' : ''}`}>
      <div className="arc-list scroll-y">
        <div className="arc-list-kicker">{t('archive.toc')}</div>
        {groups.map((g) => (
          <div key={g.type} className="arc-group">
            <div className="arc-group-title">
              <TypeIcon type={g.type} /> {TYPE_LABEL[g.type]}
              <span className="arc-group-count">{g.ids.length}</span>
            </div>
            {g.ids.map((id) => (
              <ArchiveListItem key={id} id={id} focus={focus} />
            ))}
          </div>
        ))}
      </div>
      <div className={`arc-detail scroll-y is-${def.type}`}>
        {def.type === 'person' ? (
          <>
            {washImg}
            <div className="arc-dossier">
              <div className="arc-dossier-tab">
                <span className="arc-dossier-kicker">{t('archive.personFile')}</span>
                <span className="arc-dossier-tab-name">{def.name}</span>
              </div>
              <div className="arc-dossier-body">
                {heroCard}
                {pageList}
              </div>
            </div>
          </>
        ) : placeImg ? (
          <div className="arc-place-stage">
            <img
              className="arc-place-bg"
              src={assetUrl(placeImg)}
              alt=""
              onError={(ev) => ((ev.target as HTMLImageElement).style.display = 'none')}
            />
            <div className="arc-place-panel">
              {heroMeta}
              {pageList}
            </div>
          </div>
        ) : (
          <>
            {washImg}
            {/* 物品 / 概念：左中大面积写正文（档头文字 + 档案页），右侧一张大图 */}
            <div className="arc-flat">
              <div className="arc-flat-main">
                <div className="arc-flat-head">{heroMeta}</div>
                {pageList}
              </div>
              <div className="arc-flat-art">
                <div className="arc-hero-frame">
                  <Seal name={def.name} color="#3d4f6f" size={120} />
                  {heroImg ? (
                    <img
                      className="arc-hero-img"
                      src={assetUrl(heroImg)}
                      alt={def.name}
                      onError={(ev) => ((ev.target as HTMLImageElement).style.display = 'none')}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** 未解锁页的锁定卡：内部隐形渲染解锁后的字段结构（幽灵排版），高度与解锁后完全一致；
 *  居中叠加熟悉度圆点 + 大分析按钮（满格可点，点击后原地读条）。
 *  同关有多个未解锁页时只有 primary（最靠前的一页）挂分析按钮——分析一次只解开一页。 */
function LockedPageCard({ entryId, pageIdx, primary }: { entryId: string; pageIdx: number; primary: boolean }) {
  const s = useGame();
  const ui = useUi();
  const def = entryDef(entryId)!;
  const e = s.entries[entryId]!;
  const page = def.archive![pageIdx];
  const max = familiarMaxOf(entryId, s.level);
  const fam = Math.min(e.familiarity, max);
  const ready = primary && analyzeState(entryId, s) === 'active';
  const busy = primary && ui.analyzing === entryId;
  return (
    <div className="arc-page arc-page-locked">
      <div className="arc-lock-ghost" aria-hidden="true">
        {page.fields.map((f, fi) => (
          <div className="arc-field" key={fi}>
            <span className="arc-label">{f.label}</span>
            <span className="arc-text">
              {f.blank ? (
                <span className="blank-btn">
                  <span className="blank-btn-text">{t('archive.pending')}</span>
                </span>
              ) : (
                f.text
              )}
            </span>
          </div>
        ))}
        {page.fields.some((f) => f.blank) ? (
          <div className="arc-check-row">
            <span className="btn btn-primary">{t('archive.check')}</span>
          </div>
        ) : null}
      </div>
      <div className="arc-lock-overlay">
        <div className="arc-lock-glyph">
          <Icon name={ready ? 'search' : 'lock'} size={30} />
        </div>
        <div className="arc-lock-sub">
          {!primary
            ? t('archive.needPrev')
            : ready
              ? t('archive.ready', { name: def.name })
              : t('archive.needFam', { name: def.name })}
        </div>
        <div className="arc-lock-fam">
          <span className="arc-lock-dots" title={t('archive.fam', { n: fam, max })}>
            {Array.from({ length: max }, (_, i) => (
              <span key={i} className={`arc-lock-dot${i < fam ? ' on' : ''}`} />
            ))}
          </span>
          <span className="arc-lock-count">
            {t('archive.fam', { n: fam, max })}
          </span>
        </div>
        {busy ? (
          <div className="arc-lock-btn analyzing" aria-busy="true">
            <span className="arc-lock-btn-fill" />
            <span className="arc-lock-btn-label">{t('archive.analyzing')}</span>
          </div>
        ) : (
          <button
            className={`arc-lock-btn${ready ? ' ready' : ''}`}
            disabled={!ready}
            {...(ready ? { 'data-analyze': entryId } : {})}
            onClick={() => analyzeEntry(entryId)}
          >
            {t('archive.analyze')}
          </button>
        )}
      </div>
    </div>
  );
}

function ArchivePage({ focus, pageIdx }: { focus: string; pageIdx: number }) {
  const s = useGame();
  const def = entryDef(focus)!;
  const e = s.entries[focus]!;
  const page = def.archive![pageIdx];
  const pageDone = e.pagesDone.includes(pageIdx);
  const shake = useFxActive(`shake:arc:${focus}:${pageIdx}`);
  const sealPulse = useFxActive(`seal:${focus}:${pageIdx}`);
  const hasBlank = page.fields.some((f) => f.blank);
  // 「⚡提示」：peek = 未收集的答案临时亮出（震动、不可点）；flash = 刚被替填（闪一下）。作用域键见 arcHintKey
  const ui = useUi();
  const hintKey = arcHintKey(focus, pageIdx);
  const peekMap = ui.hintPeek?.cardId === hintKey ? ui.hintPeek.slots : null;
  const peeking = !!peekMap;
  const hf = ui.hintFlash;
  const flashSet = hf && hf.cardId === hintKey && Date.now() - hf.at < 2000 ? new Set(hf.slots) : null;

  const openBlankPicker = (fieldIdx: number, pool: string) => {
    const items = Object.entries(data.entries)
      .filter(([id, d]) => d.type === pool && s.entries[id]?.collected)
      .map(([id, d]) => ({
        key: id,
        name: d.name,
        desc: d.desc,
        entryId: id,
        fam: pool === 'person', // 概念/物品候选不显示熟悉度（改为左图右文）
      }));
    setUi({
      picker: {
        title: t('archive.fillTitle'),
        groups: [{ label: '', items }],
        onPick: (key) => setArchiveDraft(focus, pageIdx, fieldIdx, key),
        wide: pool !== 'person', // 非人物候选：加宽弹窗
      },
    });
  };

  return (
    <div className={`arc-page${shake ? ' shake' : ''}${sealPulse ? ' glow' : ''}`}>
      {pageDone ? (
        <div className="done-stamp" aria-label={t('archive.doneStamp')}>
          <Icon name="check" size={26} />
        </div>
      ) : null}
      {page.fields.map((f, fi) => {
        if (!f.blank) {
          return (
            <div className="arc-field" key={fi}>
              <span className="arc-label">{f.label}</span>
              <span className="arc-text">{f.text}</span>
            </div>
          );
        }
        const st = e.pageFields[pageIdx + ':' + fi];
        // peekId 为空串 = 困难难度下的地名：只震动、不亮答案
        const peekId = peekMap ? peekMap[String(fi)] : undefined;
        const isPeek = peekId !== undefined;
        const isFlash = !!flashSet?.has(String(fi));
        const pickedId = st?.locked ? f.blank.answer : peekId || st?.draft;
        const pickedIcon = pickedId ? (
          <span className="blank-btn-icon">
            <Avatar entryId={pickedId} fill />
          </span>
        ) : null;
        return (
          <div className="arc-field" key={fi}>
            <span className="arc-label">{f.label}</span>
            <span className="arc-text">
              {st?.locked ? (
                <button className="blank-btn locked" disabled>
                  {pickedIcon}
                  <span className="blank-btn-text">
                    {entryDef(f.blank.answer)?.name} <Icon name="check" size={12} />
                  </span>
                </button>
              ) : (
                <button
                  className={`blank-btn${pickedId ? ' filled' : ''}${isPeek ? ' hint-peek' : ''}${isFlash ? ' hint-flash' : ''}`}
                  data-arc-blank={fi}
                  data-hint-peek={isPeek ? '' : undefined}
                  disabled={isPeek}
                  onClick={() => openBlankPicker(fi, f.blank!.pool)}
                >
                  {pickedIcon}
                  <span className="blank-btn-text">
                    {pickedId ? entryDef(pickedId)?.name : t('archive.pending')}
                  </span>
                </button>
              )}
            </span>
          </div>
        );
      })}
      {hasBlank && !pageDone ? (
        <div className="arc-check-row">
          {/* ⚡提示（−1 体力）：规则同情节卡；震动预览中按钮改写「尚未收集」、不可核对 */}
          <button
            className={`btn blank-hint${peeking ? ' is-peek' : ''}`}
            data-arc-hint
            disabled={peeking}
            title={t('card.hintTip', { n: HINT_COST })}
            onClick={() => hintArchivePage(focus, pageIdx)}
          >
            {peeking ? (
              t('card.hintPeek')
            ) : (
              <>
                <Icon name="bolt" size={12} /> {t('card.hintBtn')}
              </>
            )}
          </button>
          <button
            className="btn btn-primary"
            data-arc-check
            disabled={peeking}
            onClick={() => checkArchivePage(focus, pageIdx)}
          >
            {t('archive.check')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
