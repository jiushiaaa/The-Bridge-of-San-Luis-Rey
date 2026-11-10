// 右区页签·词条库（四类词条均为双列卡：人物带头像，其余无图；地点卡用图作淡化背景；分析入口在档案界面）
// 熟悉度按关刷新：圆点与排序均取本关上限 familiarMaxOf
import { t } from '../i18n';
import { assetUrl, data, familiarMaxOf, TYPE_LABEL, TYPE_ORDER } from '../game/data';
import { bestSearchTarget, isEasy, revealTypeCount, searchEntry, searchRemaining, typeCollectCount } from '../game/logic';
import { useGame, useUi } from '../game/store';
import type { EntryType } from '../game/types';
import Avatar from './Avatar';
import { CopyEditButton } from './copyedit/common';
import Icon, { TypeIcon } from './Icon';

export function FamDots({ id }: { id: string }) {
  const s = useGame();
  const max = familiarMaxOf(id, s.level);
  if (max === 0) return null; // 本关不出场
  const fam = s.entries[id]?.familiarity ?? 0; // 词条状态惰性创建，未接触过时视作 0（选择器场景也不会崩）
  return (
    <span className="fam-dots" title={t('entry.fam', { n: fam, max })}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`fam-dot${i < fam ? ' on' : ''}`} />
      ))}
    </span>
  );
}

function SearchButton({ id, best }: { id: string; best?: boolean }) {
  const s = useGame();
  const remain = searchRemaining(id, s);
  // 搜寻耗尽后不再显示按钮（把空间还给简介文字）
  if (remain === 0) return null;
  // best：全局优先级最高的搜寻目标——放大镜带放射/环绕特效（一直点它即最佳路径）；
  // 体力不足按钮禁用时特效仍播放（导航语义不变）
  return (
    <button
      className="btn entry-search"
      data-search={id}
      data-search-best={best ? '1' : undefined}
      title={best ? t('entry.searchBest') : undefined}
      disabled={s.stamina < data.meta.stamina.searchCost}
      onClick={() => searchEntry(id)}
    >
      <span className="search-ico" aria-hidden="true">
        <Icon name="search" size={13} />
      </span>
      {t('entry.searchRemain', { n: remain })}
    </button>
  );
}

/** 分类计数「( n / max )」：总数默认藏为「?」，花 1 体力可揭示；收满时自动显示并撤掉提示按钮 */
function TypeCount({ type }: { type: EntryType }) {
  const s = useGame();
  const { n, max } = typeCollectCount(type, s);
  const full = n >= max;
  const revealed = full || (s.typeHints?.[String(s.level)] ?? []).includes(type);
  return (
    <>
      <span className="entry-group-count">
        <span className={`entry-count-num${full ? ' full' : ''}`}>
          ( {n} / {revealed ? max : '?'} )
        </span>
      </span>
      {revealed ? null : (
        <button
          className="row-hint-btn"
          title={t('entry.typeHint')}
          onClick={() => revealTypeCount(type)}
        >
          {t('common.hint')} <Icon name="bolt" size={10} />
        </button>
      )}
    </>
  );
}

export default function EntryPanel() {
  const s = useGame();
  // 显示模式：full 完整（含简介）/ compact 精简（无简介、小头像、地点卡不撑 4:3）
  const { entryView } = useUi();
  const compact = entryView === 'compact';
  const collected = Object.keys(data.entries).filter((id) => s.entries[id]?.collected);
  // 最佳搜寻目标只算一次（词条库有红点时必然存在唯一 best）；困难难度不标最佳搜寻红圈
  const bestId = isEasy(s) ? bestSearchTarget(s)?.entryId ?? null : null;

  if (collected.length === 0) {
    return (
      <>
        <div className="entry-empty">
          {t('entry.empty1')}
          <br />
          {t('entry.empty2')}
        </div>
        <CopyEditButton conf={{ kind: 'entries' }} className="ce-entry-foot" />
      </>
    );
  }
  return (
    <div className={`entry-panel view-${entryView}`} data-coach-anchor="search">
      {TYPE_ORDER.map((t: EntryType) => {
        // 组内按本关最大熟悉度从高到低排序（同值保持收集先后）
        const ids = collected
          .filter((id) => data.entries[id].type === t)
          .sort((a, b) => familiarMaxOf(b, s.level) - familiarMaxOf(a, s.level));
        if (ids.length === 0) return null;
        return (
          <div key={t}>
            <div className="entry-group-title">
              <TypeIcon type={t} /> {TYPE_LABEL[t]}
              <TypeCount type={t} />
            </div>
            <div className="entry-grid">
              {ids.map((id) => {
                const def = data.entries[id];
                // 地点卡：用其图片作淡化背景（只起氛围，文字仍清晰）
                const hasBg = t === 'place' && !!def.image;
                // 有搜寻按钮时，卡片放弃固定 4:3、改为按内容自适应高度，避免文字/按钮拥挤
                const hasSearch = searchRemaining(id, s) > 0;
                const top =
                  t === 'person' ? (
                    <div className="entry-card-top">
                      <Avatar entryId={id} size={compact ? 32 : 44} />
                      <div className="entry-card-id">
                        <span className="entry-name">{def.name}</span>
                        <FamDots id={id} />
                      </div>
                    </div>
                  ) : (
                    <div className="entry-card-top place-top">
                      <span className="entry-name">{def.name}</span>
                      <FamDots id={id} />
                    </div>
                  );
                const body = (
                  <>
                    {top}
                    {compact ? null : <div className="entry-desc">{def.desc}</div>}
                    <SearchButton id={id} best={id === bestId} />
                  </>
                );
                return (
                  <div
                    className={`entry-card${hasBg ? ' has-bg' : ''}${hasSearch ? ' has-search' : ''}`}
                    key={id}
                    data-entry-id={id}
                  >
                    <span className="entry-pin" aria-hidden="true" />
                    {hasBg ? (
                      <img
                        className="entry-bg-img"
                        src={assetUrl(def.image!)}
                        alt=""
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : null}
                    {/* 地点卡：内容包一层 .entry-card-inner，与 ::before 4:3 占位重叠在同格里（见 styles.css） */}
                    {hasBg ? <div className="entry-card-inner">{body}</div> : body}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <CopyEditButton conf={{ kind: 'entries' }} className="ce-entry-foot" />
    </div>
  );
}
