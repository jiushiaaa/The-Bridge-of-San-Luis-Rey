// 居中弹窗候选面板：填卡 / 档案 / 闸门共用的候选选择器
// 纯人物组 -> 三列竖排大图卡片（一屏至少 3×4）；
// 全词条组（地名/物品/混合）-> 三列紧凑卡（人物在前且带头像，其余无图）；
// 剧情组（layout:'timeline'）-> 与时间轴主界面同构的表格（图 + 名字）；
// 其余（情节标题等）-> 单列竖排
import { t } from '../i18n';
import { assetUrl, cardDef, correctCell, data, entryDef, entryName2id, familiarMaxOf, timelineOf } from '../game/data';
import { getUi, setUi, useGame, useUi, type PickerGroup, type PickerItem } from '../game/store';
import Avatar from './Avatar';
import { FamDots } from './EntryPanel';
import FormIcon from './FormIcon';
import Icon from './Icon';

/** 关卡出口「剧情」组：按时间轴行列排成表格，每格「图 + 名字」可点选 */
function TimelinePickGrid({
  items,
  onPick,
}: {
  items: PickerItem[];
  onPick: (key: string) => void;
}) {
  const s = useGame();
  const tl = timelineOf(s.level);
  const byCell = new Map<string, PickerItem>();
  for (const it of items) {
    if (!it.cardId) continue;
    const c = cardDef(it.cardId);
    if (!c) continue;
    const { row, col } = correctCell(c);
    byCell.set(row + ':' + col, it);
  }
  const pick = (key: string) => {
    onPick(key);
    if (getUi().picker) setUi({ picker: null });
  };
  return (
    <div className="picker-tl-board">
    <table className="picker-tl-grid">
      <thead>
        <tr>
          <th className="picker-tl-corner" />
          {tl.cols.map((col, ci) => (
            <th className="picker-tl-col" key={col}>
              {ci === 0 ? (
                <span className="tl-col-person">
                  <Avatar src={data.assets.sceneIcon} name={t('common.sceneShort')} color="#8a2f2a" size={64} />
                  <span>{t('common.scene')}</span>
                </span>
              ) : (
                (() => {
                  const eid = entryName2id(col);
                  const known = !!eid && !!s.entries[eid]?.collected;
                  return (
                    <span className="tl-col-person">
                      {known ? (
                        <Avatar entryId={eid} size={64} />
                      ) : (
                        <Avatar src={data.assets.mysteryAvatar} name="？" color="#2c2a26" size={64} />
                      )}
                      <span>{known ? col : t('common.unknown')}</span>
                    </span>
                  );
                })()
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tl.rows.map((rowName, ri) => (
          <tr key={rowName}>
            <th className="picker-tl-row">{rowName}</th>
            {tl.cols.map((_, ci) => {
              const it = byCell.get(ri + ':' + ci);
              const cg = it?.cardId ? cardDef(it.cardId)?.cg : undefined;
              return (
                <td className={`picker-tl-cell${it ? ' filled' : ''}`} key={ci}>
                  {it ? (
                    <button className="picker-tl-card" data-pick={it.key} onClick={() => pick(it.key)}>
                      {cg ? (
                        <img
                          className="picker-tl-img"
                          src={assetUrl(cg)}
                          alt=""
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="picker-tl-img placeholder" />
                      )}
                      <span className="picker-tl-name">{it.name}</span>
                    </button>
                  ) : null}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

/** 组形态：纯人物 / 纯地点（词条库同款背景图卡）/ 全词条（可混合）/ 无词条（标题等） */
function groupKind(g: PickerGroup): 'persons' | 'places' | 'entries' | 'plain' {
  if (g.items.length === 0) return 'plain';
  if (!g.items.every((it) => it.entryId)) return 'plain';
  if (g.items.every((it) => entryDef(it.entryId!)?.type === 'person')) return 'persons';
  // 地点/物品/概念等非人物且有图者，统一用背景图卡片（大图 + 底部半透明黑名字与解释）
  if (g.items.every((it) => { const d = entryDef(it.entryId!); return !!d && d.type !== 'person' && !!d.image; })) return 'places';
  return 'entries';
}

/** 与词条库一致：按本关最大熟悉度从高到低；混合组人物排前；keepOrder 组尊重传入顺序 */
function sortItems(g: PickerGroup, lv: number, kind: 'persons' | 'places' | 'entries' | 'plain'): PickerItem[] {
  if (g.keepOrder) return g.items;
  const max = (it: PickerItem) => (it.entryId ? familiarMaxOf(it.entryId, lv) : -1);
  const isPerson = (it: PickerItem) => it.entryId && entryDef(it.entryId)?.type === 'person';
  return [...g.items].sort((a, b) => {
    if (kind === 'entries' && isPerson(a) !== isPerson(b)) return isPerson(a) ? -1 : 1;
    return max(b) - max(a);
  });
}

export default function SlotPicker() {
  const { picker } = useUi();
  const s = useGame();
  if (!picker) return null;
  const close = () => setUi({ picker: null });
  return (
    <div className={`picker-layer${picker.wide ? ' is-wide' : ''}`} onClick={close}>
      <div
        className={`picker-modal${picker.wide ? ' wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="picker-modal-head">
          <div className="picker-modal-heading">
            <span className="picker-modal-kicker">候选</span>
            <span className="picker-modal-title" id="picker-modal-title">
              {picker.title}
            </span>
          </div>
          <button className="picker-modal-close" type="button" aria-label={t('common.close')} onClick={close}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="picker-modal-body scroll-y">
          {picker.groups.map((g, gi) => {
            const kind = groupKind(g);
            const items = sortItems(g, s.level, kind);
            return (
              <div className={`picker-group${g.layout === 'timeline' ? ' is-timeline' : ''}`} key={g.label || gi}>
                {g.label ? <div className="picker-group-label">{g.label}</div> : null}
                {items.length === 0 ? (
                  <div className="entry-empty">暂无候选</div>
                ) : g.layout === 'timeline' ? (
                  <TimelinePickGrid items={items} onPick={picker.onPick} />
                ) : picker.entryLayout === 'cards5' && g.items.every((it) => it.entryId) ? (
                  <div className="picker-grid5">
                    {items.map((it) => (
                      <button
                        key={it.key}
                        className="picker-card5"
                        data-pick={it.key}
                        onClick={() => {
                          picker.onPick(it.key);
                          if (getUi().picker === picker) setUi({ picker: null });
                        }}
                      >
                        <span className="picker-card5-img">
                          <Avatar entryId={it.entryId!} fill size={72} />
                        </span>
                        <span className="picker-card5-name">{it.name}</span>
                      </button>
                    ))}
                  </div>
                ) : kind === 'places' ? (
                  <div className="picker-grid-place">
                    {items.map((it) => {
                      const def = entryDef(it.entryId!);
                      const hasBg = !!def?.image;
                      return (
                        <button
                          key={it.key}
                          className={`entry-card picker-place${hasBg ? ' has-bg' : ''}`}
                          data-pick={it.key}
                          onClick={() => {
                            picker.onPick(it.key);
                            if (getUi().picker === picker) setUi({ picker: null });
                          }}
                        >
                          {hasBg ? (
                            <img
                              className="entry-bg-img"
                              src={assetUrl(def!.image!)}
                              alt=""
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : null}
                          {/* 地点卡内容包一层 .entry-card-inner，与 ::before 4:3 占位重叠在同格里 */}
                          <span className="entry-card-inner">
                            <span className="entry-card-top place-top">
                              <span className="entry-name">{it.name}</span>
                              {it.entryId ? <FamDots id={it.entryId} /> : null}
                            </span>
                            <span className="entry-desc">{it.desc ?? def?.desc}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : kind === 'persons' ? (
                  <div className="picker-grid">
                    {items.map((it) => (
                      <button
                        key={it.key}
                        className="picker-card"
                        data-pick={it.key}
                        onClick={() => {
                          picker.onPick(it.key);
                          if (getUi().picker === picker) setUi({ picker: null });
                        }}
                      >
                        {it.entryId ? <Avatar entryId={it.entryId} fill /> : null}
                        <span className="picker-card-name">{it.name}</span>
                        {it.fam && it.entryId ? <FamDots id={it.entryId} /> : null}
                        {it.desc ? <span className="picker-desc">{it.desc}</span> : null}
                      </button>
                    ))}
                  </div>
                ) : kind === 'entries' ? (
                  <div className="picker-grid3">
                    {items.map((it) => {
                      const def = it.entryId ? entryDef(it.entryId) : undefined;
                      // 非人物且有图（概念/物品）：左图(108px)右文卡；人物维持原样
                      const figCard = def && def.type !== 'person' && !!def.image;
                      return (
                        <button
                          key={it.key}
                          className={`picker-mini${figCard ? ' picker-mini-fig' : ''}`}
                          data-pick={it.key}
                          onClick={() => {
                            picker.onPick(it.key);
                            if (getUi().picker === picker) setUi({ picker: null });
                          }}
                        >
                          {figCard ? (
                            <img className="picker-mini-img" src={assetUrl(def!.image!)} alt="" />
                          ) : it.entryId && def?.type === 'person' ? (
                            <Avatar entryId={it.entryId} size={40} />
                          ) : null}
                          <span className="picker-mini-mid">
                            <span className="picker-mini-name">{it.name}</span>
                            {!figCard && it.fam && it.entryId ? <FamDots id={it.entryId} /> : null}
                            {it.desc ? <span className="picker-desc">{it.desc}</span> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="picker-list">
                    {items.map((it) => (
                      <button
                        key={it.key}
                        className="picker-row"
                        data-pick={it.key}
                        onClick={() => {
                          picker.onPick(it.key);
                          if (getUi().picker === picker) setUi({ picker: null });
                        }}
                      >
                        <span className={`picker-row-main${it.indent ? ' indent' : ''}`}>
                          {it.form ? <FormIcon form={it.form} /> : null}
                          <span>{it.name}</span>
                        </span>
                        {it.fam && it.entryId ? <FamDots id={it.entryId} /> : null}
                        {it.desc ? <span className="picker-desc">{it.desc}</span> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
