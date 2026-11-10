// 时间轴三列布局：左=待归位残页（已补完在前）｜中=时间轴表格｜右=关卡出口面板
// 行=时段、列=情节/人物；列头人物未收集时只显示剪影与「？？？」
// 归位规则：一整行/列的全部设计卡都补完且放对才锁定（带扫光）；相邻格相对位置正确显示绿色连接线
// 窄屏（<1280）右栏默认折叠成竖条，可答题时竖条上带闪烁红点；此时展开为浮层，不挤压中间表格
// 顶部关卡带可切进历史关卡的**只读回顾**（ui.reviewLevel）：不可放置、行名全揭示、卡片走浮层
import { useEffect, useState, type CSSProperties } from 'react';
import { t as tr } from '../i18n';
import {
  assetUrl,
  cardDef,
  cardsOfLevel,
  correctCell,
  data,
  entryName2id,
  gateAfterLevel,
  plainText,
  timelineOf,
} from '../game/data';
import { activeCoach } from '../game/coach';
import { useLayout } from '../game/layout';
import {
  cardAtCell,
  gateChecklist,
  isEasy,
  openRecap,
  placeCard,
  placeSelected,
  recapAvailable,
  revealRowName,
  reviewLevel,
  selectCard,
  selectChip,
  timelineAllLocked,
} from '../game/logic';
import { playCue } from '../game/sfx';
import { getUi, setUi, useFxActive, useGame, useUi } from '../game/store';
import type { CardDef } from '../game/types';
import Avatar from './Avatar';
import CardChat from './CardChat';
import { FORM_LABEL, SlotRow } from './CardList';
import { CopyEditButton } from './copyedit/common';
import GatePanel from './GatePanel';
import Icon from './Icon';
import LevelBar from './LevelBar';
import VeiledTitle from './VeiledTitle';

/** 「阅读」跳转：玩当前关时切到情节卡页签；只读回顾历史关时就地开浮层（左侧列表只列当前关，切过去会对不上） */
function readCard(cardId: string): void {
  if (getUi().reviewLevel != null) {
    setUi({ timelineSel: null, reviewCard: cardId });
    return;
  }
  setUi({ timelineSel: null });
  selectCard(cardId);
}

/** 当前拖拽的卡 id，在 dragstart 里同步写入。
 *  落点校验只能靠它，不能靠 React 状态：原生拖拽是浏览器的模态循环，
 *  部分浏览器（Firefox / Safari / 老内核国产浏览器）在拖拽期间不保证组件已按新状态重渲染，
 *  一旦 onDragOver 没挂上、没能 preventDefault，整页都会显示红色禁止圆圈。 */
let dragCardId: string | null = null;

/** 写入拖拽数据：老内核只认 'Text'，且 setData 本身可能抛错（抛出会中断 dragstart 后续逻辑） */
function setDragData(dt: DataTransfer, cardId: string): void {
  try {
    dt.setData('text/plain', cardId);
  } catch {
    try {
      dt.setData('Text', cardId);
    } catch {
      // 数据写不进去也不影响：落点一律以 dragCardId 为准
    }
  }
  try {
    dt.effectAllowed = 'move';
  } catch {
    // 老内核对 effectAllowed 赋值可能抛错，忽略即可
  }
}

/** 取拖拽中的卡 id：dragover 期间浏览器会屏蔽 getData，所以以模块变量为主、读取为兜底 */
function dragIdOf(e: React.DragEvent): string | null {
  if (dragCardId) return dragCardId;
  try {
    return e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('Text') || null;
  } catch {
    return null;
  }
}

/** 接受落点：必须 preventDefault 才能 drop，dropEffect 决定鼠标图标 */
function acceptDrag(e: React.DragEvent): void {
  e.preventDefault();
  try {
    e.dataTransfer.dropEffect = 'move';
  } catch {
    // 同上，老内核可能不允许赋值
  }
}

/** 拖拽起手：记录拖拽卡并复用点选高亮（全表箭头 + 金色可放格）；收手时清理 */
function startDrag(e: React.DragEvent, cardId: string): void {
  dragCardId = cardId;
  setDragData(e.dataTransfer, cardId);
  // 高亮推迟一拍：在 dragstart 里同步改 DOM 会被 Firefox/Safari 当成拖拽源变动而取消拖拽，
  // 也会把半透明的 dragging 样式拍进拖影里
  setTimeout(() => {
    if (dragCardId === cardId) setUi({ tlDrag: cardId, timelineSel: cardId });
  }, 0);
  playCue('drag-start');
}

function endDrag(): void {
  dragCardId = null;
  const ui = getUi();
  if (ui.tlDrag || ui.timelineSel) setUi({ tlDrag: null, timelineSel: null });
}

/** 左列待归位项：默认展开；整卡可拖（「阅读」除外） */
function PoolItem({ card }: { card: CardDef }) {
  const s = useGame();
  const { timelineSel, tlDrag } = useUi();
  const phone = useLayout() === 'phone';
  const cs = s.cards[card.id]!;
  const sel = timelineSel === card.id;
  return (
    <div
      className={`tl-pool-item${sel ? ' selected' : ''}${cs.done ? ' done' : ''}${tlDrag === card.id ? ' dragging' : ''}`}
      data-chip={card.id}
      draggable={!phone}
      onDragStart={
        phone
          ? undefined
          : (e) => {
              if ((e.target as HTMLElement).closest('.tl-pool-read')) {
                e.preventDefault();
                return;
              }
              startDrag(e, card.id);
            }
      }
      onDragEnd={phone ? undefined : endDrag}
      onClick={() => selectChip(card.id)}
    >
      <div className="tl-pool-main">
        <span className={`form-tag form-${card.form}`}>{FORM_LABEL[card.form]}</span>
        {/* 未补完：与情节卡列表同款的模糊标题（正文摘录在下方 detail 里） */}
        {cs.done ? (
          <span className="tl-pool-text">{card.title}</span>
        ) : (
          <VeiledTitle className="tl-pool-text" text={card.title} />
        )}
        <button
          className="tl-pool-read"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            readCard(card.id);
          }}
        >
          {tr('timeline.read')}
        </button>
      </div>
      <div className="tl-pool-detail">
        <div className="tl-pool-preview">{plainText(card.segments[0]?.text ?? '')}</div>
        {card.blanks.length > 0 ? <SlotRow card={card} size={24} /> : null}
      </div>
    </div>
  );
}

function Chip({ card }: { card: CardDef }) {
  const s = useGame();
  const { timelineSel, tlDrag, reviewLevel: rv } = useUi();
  const phone = useLayout() === 'phone';
  const cs = s.cards[card.id]!;
  const locked = !!cs.pos?.locked;
  const sel = timelineSel === card.id;
  // 已锁定或回顾模式或竖版不可拖；竖版用点选放置
  const draggable = !phone && !locked && rv == null;
  const glow = useFxActive('chip:' + card.id);
  const orbiting = useFxActive('tlok:' + card.id, 1400);
  const cls = locked ? ' locked' : cs.done ? ` form-${card.form}` : ' undone';
  // 补完后以该卡 16:9 CG 铺满整格作底色（未补完不显示，避免剧透，与情节卡页同规则）
  const hasCg = cs.done && !!card.cg;
  const cc = correctCell(card);
  // 「单格放对」勾标 + 金环只在简单难度显示；困难难度要等行/列/连片锁定才知道对不对
  const correct =
    isEasy(s) && !!cs.pos && !locked && tlDrag !== card.id && cs.pos.row === cc.row && cs.pos.col === cc.col;
  // 点选任意格中卡（含已锁定）都展开同款信息面板：头像+阅读 一行，形态字标+预览正文
  const expanded = sel;
  const readBtn = (
    <span
      className="tl-pool-read"
      role="button"
      title={tr('timeline.jumpCard')}
      onClick={(e) => {
        e.stopPropagation();
        readCard(card.id);
      }}
    >
      {tr('timeline.read')}
    </span>
  );
  return (
    <>
    <div
      className={`tl-chip${cls}${sel ? ' selected' : ''}${expanded ? ' expanded' : ''}${glow ? ' glow' : ''}${hasCg ? ' has-cg' : ''}${tlDrag === card.id ? ' dragging' : ''}${draggable ? ' can-drag' : ''}${correct ? ' is-correct' : ''}`}
      data-chip={card.id}
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={
        draggable
          ? (e) => {
              if ((e.target as HTMLElement).closest('.tl-pool-read')) {
                e.preventDefault();
                return;
              }
              startDrag(e, card.id);
            }
          : undefined
      }
      // 落到本格（含拖到卡片上换位）由外层 td 统一接：拖拽事件会冒泡上去，
      // 少一处依赖状态的判断，就少一处「明明能放却显示禁止」的可能
      onDragEnd={endDrag}
      onClick={(e) => {
        // 阻止冒泡到格子：点 chip 是「选中」，点格子空白才是「放置」
        e.stopPropagation();
        selectChip(card.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectChip(card.id);
        }
      }}
    >
      {hasCg ? (
        <img
          className="tl-chip-cg"
          src={assetUrl(card.cg!)}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
      {expanded ? (
        <span className="chip-info">
          {/* 格子仅约 100px 宽：只出人名头像（省去地名胶囊的宽度），与「阅读」同占一行
              （头像放不下靠遮罩渐隐，不被按钮压住），形态字标嵌在预览正文开头 */}
          <span className="chip-info-head">
            <span className="chip-info-slots">
              <SlotRow card={card} size={18} personOnly />
            </span>
            {readBtn}
          </span>
          <span className="chip-info-preview">
            <span className={`form-tag form-${card.form}`}>{FORM_LABEL[card.form]}</span>
            {plainText(card.segments[0]?.text ?? '')}
          </span>
        </span>
      ) : locked || cs.done ? (
        <span className="chip-title">
          {locked ? (
            <span className="card-check">
              <Icon name="check" size={12} />
            </span>
          ) : null}
          <span className="chip-title-text">{card.title}</span>
        </span>
      ) : (
        // 未补完：模糊标题 + 预览正文（与左列待归位项同款），填满格子而不是底部一行摘录
        <>
          <span className="chip-title">
            <VeiledTitle className="chip-title-text" text={card.title} />
          </span>
          <span className="chip-preview">{plainText(card.segments[0]?.text ?? '')}</span>
        </>
      )}
    </div>
    {correct ? (
      <span className="tl-ok" aria-hidden="true">
        <span className="tl-ok-pip">
          <Icon name="check" size={10} />
        </span>
      </span>
    ) : null}
    {orbiting && correct ? (
      <span className="tl-orbit" aria-hidden="true">
        <i className="tl-comet" />
        <i className="tl-comet tl-comet-b" />
      </span>
    ) : null}
    </>
  );
}

/** 单个格子：扫光特效（整行/整列归位时）+ 相邻正确连接线 + 可放置时的下箭头引导 + 拖拽落点 */
function TlCell({
  ri,
  ci,
  droppable,
  clickable,
  settled,
  linkR,
  linkD,
  canDrop,
  onPlace,
  onDropCard,
  children,
}: {
  ri: number;
  ci: number;
  droppable: boolean;
  clickable: boolean;
  /** 所在行或列已整体归位、本格仍空 = 确定不含内容（灰显） */
  settled: boolean;
  linkR: boolean;
  linkD: boolean;
  /** 这张卡能否落进本格（空格，或格中卡未锁定可交换）。传函数而非布尔值：
   *  拖拽期间只有「拖的是哪张卡」在变，事件里现取现判，不依赖重渲染 */
  canDrop: (cardId: string) => boolean;
  onPlace: () => void;
  onDropCard: (cardId: string) => void;
  children?: React.ReactNode;
}) {
  const sweepR = useFxActive(`tlrow:${ri}`, 1300);
  const sweepC = useFxActive(`tlcol:${ci}`, 1300);
  const [over, setOver] = useState(false);
  /** 拖拽事件里现算落点：能接就返回卡 id */
  const accept = (e: React.DragEvent): string | null => {
    const id = dragIdOf(e);
    return id && canDrop(id) ? id : null;
  };
  return (
    <td
      className={`tl-cell${settled ? ' settled' : ''}${droppable ? ' droptarget' : ''}${over ? ' dragover' : ''}`}
      data-cell={`${ri}:${ci}`}
      onClick={() => {
        if (clickable) onPlace();
      }}
      onDragEnter={(e) => {
        if (!accept(e)) return;
        acceptDrag(e);
        if (!over) setOver(true);
      }}
      onDragOver={(e) => {
        if (!accept(e)) return;
        acceptDrag(e); // 必须 preventDefault 才允许 drop，否则鼠标是红色禁止圆圈
        if (!over) setOver(true);
      }}
      onDragLeave={() => {
        if (over) setOver(false);
      }}
      onDrop={(e) => {
        const id = accept(e);
        if (!id) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        // 先收尾再放置：放置会让来源卡从待归位区消失，源节点一旦卸载就可能收不到 dragend
        endDrag();
        onDropCard(id);
      }}
    >
      {children}
      {droppable && !settled ? (
        <span className="tl-drop-hint" aria-hidden="true">
          <Icon name="arrowDown" size={20} />
        </span>
      ) : null}
      {linkR ? <i className="tl-link h" /> : null}
      {linkD ? <i className="tl-link v" /> : null}
      {sweepR ? <i className="tl-sweep" style={{ '--i': ci } as CSSProperties} /> : null}
      {sweepC ? <i className="tl-sweep" style={{ '--i': ri } as CSSProperties} /> : null}
    </td>
  );
}

export default function Timeline() {
  const s = useGame();
  const { timelineSel, reviewLevel: rv, reviewCard } = useUi();
  const layout = useLayout();
  // 只读回顾历史关卡时，整块时间轴改用被回顾的那一关渲染（卡片状态本就跨关保留，无需快照）
  const review = rv != null;
  const lv = rv ?? s.level;
  const t = timelineOf(lv);
  const cards = cardsOfLevel(lv);
  // 关卡出口：宽屏默认展开占一列，窄屏默认折叠成竖条、展开时浮在表格上方（避免二次挤压中区）
  const gateFloating = layout !== 'wide';
  const [gateOpen, setGateOpen] = useState(!gateFloating);
  useEffect(() => {
    setGateOpen(layout === 'wide');
  }, [layout]);
  const coachId = activeCoach(s);
  useEffect(() => {
    if (layout === 'phone' && coachId === 'timelineGate') setGateOpen(true);
  }, [layout, coachId]);
  // 兜底收尾：拖到页面外松手、或拖拽源随放置一起卸载时，源上的 dragend 可能不会触发，
  // 不清掉的话高亮会一直挂着
  useEffect(() => {
    const reset = (): void => {
      if (dragCardId) endDrag();
    };
    // 从桌面拖文件/图片进来时也要先清掉残留，免得被当成卡片放进格子（捕获阶段先于卡片自己的 dragstart）
    const onAnyDragStart = (ev: DragEvent): void => {
      const t = ev.target;
      if (!(t instanceof Element) || !t.closest('[data-chip]')) reset();
    };
    window.addEventListener('dragstart', onAnyDragStart, true);
    window.addEventListener('dragend', reset);
    window.addEventListener('drop', reset);
    return () => {
      window.removeEventListener('dragstart', onAnyDragStart, true);
      window.removeEventListener('dragend', reset);
      window.removeEventListener('drop', reset);
    };
  }, []);
  const gate = review ? undefined : gateAfterLevel(lv);
  const gateReady = !!gate && gateChecklist(lv, s).ok && !s.gates[String(gate.after)]?.passed;
  // 待归位：已解锁但尚未放上时间轴的残页；已补完的排在前面（便于优先归位），其余按获得时间
  const pool = review
    ? []
    : cards
        .filter((c) => {
          const cs = s.cards[c.id];
          return cs?.unlocked && !cs.pos;
        })
        .sort((a, b) => {
          const da = s.cards[a.id]!.done ? 0 : 1;
          const db = s.cards[b.id]!.done ? 0 : 1;
          if (da !== db) return da - db;
          const ta = (da === 0 ? s.cards[a.id]!.doneAt : s.cards[a.id]!.unlockedAt) ?? 0;
          const tb = (db === 0 ? s.cards[b.id]!.doneAt : s.cards[b.id]!.unlockedAt) ?? 0;
          return tb - ta;
        });

  const cellDef = (r: number, ci: number): CardDef | undefined => {
    const id = cardAtCell(s, lv, r, ci);
    return id ? cardDef(id) : undefined;
  };

  // 行/列完成度（分子 = 已归位锁定的设计卡数）——把「凑齐一行/一列即锁定」的规则可视化
  const rowStats = t.rows.map((_, ri) => {
    const rc = cards.filter((c) => correctCell(c).row === ri);
    return { done: rc.filter((c) => s.cards[c.id]?.pos?.locked).length, total: rc.length };
  });
  const colStats = t.cols.map((_, ci) => {
    const cc = cards.filter((c) => correctCell(c).col === ci);
    return { done: cc.filter((c) => s.cards[c.id]?.pos?.locked).length, total: cc.length };
  });
  // 整行/整列归位（行头时间名、列头人名转金）后，该行列的卡都已定位：其中仍空的格子确定不会再有卡
  const rowFull = rowStats.map((st) => st.total > 0 && st.done === st.total);
  const colFull = colStats.map((st) => st.total > 0 && st.done === st.total);
  const rowHinted = s.rowHints?.[String(lv)] ?? [];
  const selCard = timelineSel ? cardDef(timelineSel) : undefined;
  // 已锁定的卡可被点选（露出「阅读」），但不能作为放置来源；回顾模式一律不可放置
  const selMovable = !review && !!selCard && !s.cards[selCard.id]?.pos?.locked;
  const recapOk = recapAvailable(lv, s);
  // 左栏「待归位」只在**本关全部卡都归位锁定**后才收起。
  // 情节列先满只是解锁了「回顾本关故事」，角色列的卡还在等着放——这时收掉左栏会把玩家卡死
  // （剩下的卡再也放不上去，闸门进度也永远够不到 70%）。
  const allPlaced = !review && timelineAllLocked(lv, s);
  // 最后一张卡归位的那一下：左栏退场动画 + 右栏关卡出口高亮，把视线引到本卷之问上
  const allDoneFx = useFxActive('tlall', 2600);
  const leftLeaving = allPlaced && allDoneFx;
  const showLeft = !review && (!allPlaced || leftLeaving);
  /** 相邻两格（dr,dc 方向）相对位置正确：正确格坐标差与当前格差一致；
   *  残页（未补完）不参与相对关系（不显示绿线）；双方均已锁定则不再提示 */
  const linkOk = (a: CardDef | undefined, b: CardDef | undefined, dr: number, dc: number): boolean => {
    if (!a || !b) return false;
    if (!s.cards[a.id]?.done || !s.cards[b.id]?.done) return false;
    if (s.cards[a.id]?.pos?.locked && s.cards[b.id]?.pos?.locked) return false;
    const ac = correctCell(a);
    const bc = correctCell(b);
    return bc.row - ac.row === dr && bc.col - ac.col === dc;
  };

  return (
    <div
      className={`tl-layout${allPlaced ? ' tl-layout-recap' : ''}${allDoneFx && !review ? ' tl-layout-alldone' : ''}`}
      data-tl-all-placed={allPlaced ? 'true' : undefined}
    >
      {/* 左列：待归位残页；本关全部卡归位锁定后（带退场动画）、以及只读回顾历史关时隐去 */}
      {!showLeft ? null : (
        <div className={`tl-left scroll-y${leftLeaving ? ' leaving' : ''}`} data-coach-anchor="timelinePlace">
          <div className="tl-pool-title">{tr('timeline.poolTitle', { n: pool.length })}</div>
          <div className="tl-pool-items">
            {pool.length === 0 ? (
              <span className="tl-pool-empty">
                {cards.every((c) => !s.cards[c.id]?.unlocked)
                  ? tr('timeline.poolEmpty')
                  : tr('timeline.poolDone')}
              </span>
            ) : (
              pool.map((c) => <PoolItem card={c} key={c.id} />)
            )}
          </div>
        </div>
      )}

      {/* 中列：时间脊 + 人物轨道（表格只负责对齐，外观不再像格子表） */}
      <div className="tl-center scroll-y">
        <div className="tl-board-wrap">
        <div className="tl-board">
        <table className="tl-grid">
          <thead>
            <tr>
              <th className="tl-corner">
                <span className="tl-corner-kicker">{tr('timeline.time')}</span>
              </th>
              {t.cols.map((col, ci) => {
                const full = colFull[ci];
                return (
                  <th className={`col-head${full ? ' full' : ''}`} key={col}>
                    {ci === 0 ? (
                      <span className="tl-col-person tl-col-scene" title={tr('common.scene')}>
                        <Avatar src={data.assets.sceneIcon} name={tr('common.sceneShort')} color="#8a2f2a" size={52} />
                        <span>{tr('common.scene')}</span>
                      </span>
                    ) : (
                      (() => {
                        const eid = entryName2id(col);
                        const known = !!eid && !!s.entries[eid]?.collected;
                        return (
                          <span className="tl-col-person">
                            {known ? (
                              <Avatar entryId={eid} size={52} />
                            ) : (
                              <Avatar src={data.assets.mysteryAvatar} name="？" color="#2c2a26" size={52} />
                            )}
                            <span>{known ? col : tr('common.unknown')}</span>
                          </span>
                        );
                      })()
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((rowName, ri) => {
              // 时间点名默认隐藏防剧透：整行归位自动揭示，或花 1 体力点「提示」提前揭示
              // 回顾已通关的旧关卡时无需再防剧透，一律揭示
              const revealed = review || rowFull[ri] || rowHinted.includes(ri);
              return (
              <tr key={rowName}>
                <th
                  className={`row-head${rowFull[ri] ? ' full' : ''}${ri === 0 ? ' is-first' : ''}${ri === t.rows.length - 1 ? ' is-last' : ''}`}
                >
                  <i className="tl-node" aria-hidden="true" />
                  {revealed ? (
                    <span className="tl-row-label">{rowName}</span>
                  ) : (
                    <span className="row-head-veiled">
                      <span>{tr('timeline.timeN', { n: ri + 1 })}</span>
                      <button
                        className="row-hint-btn"
                        title={tr('timeline.revealRow')}
                        onClick={() => revealRowName(ri)}
                      >
                        {tr('timeline.hintBolt')} <Icon name="bolt" size={10} />
                      </button>
                    </span>
                  )}
                </th>
                {t.cols.map((_, ci) => {
                  const occ = cellDef(ri, ci);
                  const droppable = selMovable && timelineSel !== occ?.id;
                  // 拖拽落点校验：空格可落；有卡时对方未锁定即可交换；不能落回自己头上
                  const occLocked = !!occ && !!s.cards[occ.id]?.pos?.locked;
                  const canDrop = (id: string): boolean => !review && !occLocked && id !== occ?.id;
                  return (
                    <TlCell
                      key={ci}
                      ri={ri}
                      ci={ci}
                      droppable={droppable}
                      clickable={selMovable}
                      settled={!occ && (rowFull[ri] || colFull[ci])}
                      linkR={linkOk(occ, cellDef(ri, ci + 1), 0, 1)}
                      linkD={linkOk(occ, cellDef(ri + 1, ci), 1, 0)}
                      canDrop={canDrop}
                      onPlace={() => placeSelected(ri, ci)}
                      onDropCard={(id) => placeCard(id, ri, ci)}
                    >
                      {occ ? <Chip card={occ} /> : null}
                    </TlCell>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        </div>
        {selCard && selMovable ? (
          <div className="tl-hint">{tr('timeline.dropHint')}</div>
        ) : review ? (
          <div className="tl-hint">{tr('timeline.reviewHint', { n: lv, cur: s.level })}</div>
        ) : null}
        {/* 情节列整列归位（或本关已通关）后解锁：多页图文回顾本关故事 */}
        {recapOk ? (
          <button className="tl-recap-btn" data-recap={lv} onClick={() => openRecap(lv)}>
            <Icon name="book" size={14} /> {tr('timeline.reviewStory')}
          </button>
        ) : null}
        <div className="tl-foot-tools">
          <CopyEditButton conf={{ kind: 'timeline', level: lv }} label="时间轴" />
          <CopyEditButton conf={{ kind: 'recap', level: lv }} label="故事回顾" />
        </div>
      </div>

      {/* 回顾模式：在时间轴上就地重读某张卡（只读浮层，不切页签） */}
      {review && reviewCard ? (
        <div className="overlay" onClick={() => setUi({ reviewCard: null })}>
          <div className="modal tl-review-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">{tr('timeline.reviewTitle', { n: lv })}</span>
              <button className="btn" onClick={() => setUi({ reviewCard: null })}>
                {tr('common.close')}
              </button>
            </div>
            <CardChat cardId={reviewCard} onGo={(id) => setUi({ reviewCard: id })} />
          </div>
        </div>
      ) : null}

      {/* 右列：关卡带 + 关卡出口（可折叠；窄屏折叠为竖条，展开时浮在表格之上）。
          回顾历史关卡时关卡出口收起，但右栏本身**必须留着**——关卡带就在它顶上，
          玩家要靠它点回当前关。 */}
      {!gateOpen || gateFloating ? (
        <button
          className={`tl-gate-tab${gateOpen ? ' on' : ''}`}
          data-gate-toggle
          title={gateOpen ? tr('timeline.collapse') : gateReady ? tr('timeline.expandReady') : tr('timeline.expand')}
          aria-expanded={gateOpen}
          onClick={() => {
            const next = !gateOpen;
            setGateOpen(next);
            playCue(next ? 'expand' : 'collapse');
          }}
        >
          {gateReady ? <span className="gate-cta-reddot" /> : null}
          <span className="tl-gate-tab-label">{review ? tr('timeline.levelTab') : tr('timeline.gateTab')}</span>
        </button>
      ) : null}
      {gateOpen ? (
        <div className={`tl-right scroll-y${gateFloating ? ' floating' : ''}`}>
          <button className="tl-gate-collapse" onClick={() => {
            setGateOpen(false);
            playCue('collapse');
          }} title={tr('timeline.collapse')}>
            {tr('timeline.collapseBtn')}
          </button>
          <LevelBar />
          {review ? (
            // 关卡带会分页，当前关未必在这一页上——这里给一个恒定在场的一键返回，别让人翻页找路
            <div className="tl-right-review">
              <p>{tr('timeline.reviewing', { n: lv })}</p>
              <button className="btn btn-primary" data-exit-review onClick={() => reviewLevel(null)}>
                {tr('timeline.backLevel', { n: s.level })}
              </button>
            </div>
          ) : gate ? (
            <GatePanel />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
