// 卡详情：聊天软件式消息流 + 填空区 + 验证/提示（气泡一律居左）
// 已归位锁定的卡在主内容底部追加「上一节 / 下一节 / 同时段其他卡」的跳转条（见 README_game §4.1）
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t as tr } from '../i18n';
import {
  assetUrl,
  cardDef,
  cardsOfLevel,
  correctCell,
  data,
  entryDef,
  entryName2id,
  familiarMaxOf,
  FORM_META,
  GAME_ID,
  slotTintClass,
  SLOT_TINT_COLORS,
  slotTintIndex,
  timelineOf,
} from '../game/data';
import {
  cardFillable,
  clearHintPeek,
  gotoTimeline,
  HINT_COST,
  hintCard,
  isEasy,
  markRead,
  selectCard,
  setSlotDraft,
  verifyCard,
} from '../game/logic';
import { playCue } from '../game/sfx';
import { getState, getUi, setUi, useFxActive, useGame, useUi } from '../game/store';
import { blankAnswers, type BlankDef, type CardDef, type CardSeg } from '../game/types';
import Avatar, { Seal } from './Avatar';
import { CopyEditButton } from './copyedit/common';
import FormIcon from './FormIcon';
import Icon from './Icon';
import RichText from './RichText';
import VeiledTitle from './VeiledTitle';

/** 一条对话/独白：头像（统一 54px）在左、名字在头像下方；右侧为对话框。
 *  头像统一尺寸便于与对话框对齐（含无名/占位角色）。 */
function MsgRow({ seg, card }: { seg: CardSeg; card: CardDef }) {
  const s = useGame();
  const { highlightSlot } = useUi();
  const cs = s.cards[card.id];
  const mono = seg.kind === 'monologue';
  const bubble = (
    <div className={`bubble${mono ? ' mono' : ''}`}>
      <RichText text={seg.text} cardId={card.id} />
    </div>
  );

  const AV = 48;
  let col: ReactNode = null;
  if (seg.kind === 'dialogue' && 'speakerEntry' in seg) {
    col = (
      <span className="speaker-col">
        <Avatar entryId={seg.speakerEntry} size={AV} />
        <span className="speaker-name known">{entryDef(seg.speakerEntry)?.name}</span>
      </span>
    );
  } else if (seg.kind === 'dialogue' && 'speaker' in seg) {
    // 用首字做名字的配角：淡色印章
    col = (
      <span className="speaker-col">
        <Seal name={seg.speaker} color="" size={AV} soft />
        <span className="speaker-name minor">{seg.speaker}</span>
      </span>
    );
  } else if ((seg.kind === 'dialogue' || seg.kind === 'monologue') && 'slot' in seg) {
    const slot = seg.slot;
    const blank = card.blanks.find((b) => b.slot === slot);
    const locked = blank ? !!cs?.slotLocked[slot] : false;
    const entryId = blank ? (locked ? (cs?.slotDraft[slot] ?? blankAnswers(blank)[0]) : cs?.slotDraft[slot]) : undefined;
    const hl = highlightSlot === slot ? ' slot-hl' : '';
    if (entryId) {
      col = (
        <span className={`speaker-col${hl}`} data-slot={slot}>
          <Avatar entryId={entryId} size={AV} />
          <span className={`speaker-name${locked ? ' known' : ''}`}>{entryDef(entryId)?.name}</span>
        </span>
      );
    } else {
      const tint = slotTintClass(slot);
      const tintIdx = slotTintIndex(slot);
      const tintColor = tintIdx >= 0 ? SLOT_TINT_COLORS[tintIdx] : undefined;
      col = (
        <span className={`speaker-col${hl}${tint ? ` ${tint}` : ''}`} data-slot={slot}>
          <Avatar
            src={data.assets.mysteryAvatar}
            name="？"
            color={tintColor ?? '#2c2a26'}
            size={AV}
            tintClass={tint || undefined}
          />
          <span className={`speaker-name${tint ? ` ${tint}` : ''}`}>{slot}</span>
        </span>
      );
    }
  }

  return (
    <div className="msg msg-row">
      {col}
      {bubble}
    </div>
  );
}

/** 人名悬停/抽屉打开时高亮正文；地名无正文占位，只点亮按钮 */
function setPersonHighlight(slot: string | null, kind: BlankDef['kind']): void {
  setUi({ highlightSlot: kind === 'person' ? slot : null });
}

function BlankButton({ card, blank }: { card: CardDef; blank: BlankDef }) {
  const s = useGame();
  const ui = useUi();
  const cs = s.cards[card.id]!;
  const locked = !!cs.slotLocked[blank.slot];
  // 「⚡提示」：peek = 尚未收集的答案临时亮出（震动、不可点）；flash = 刚被替玩家填对（闪一下）
  // peekId 为空串 = 困难难度下的地名：只震动、不亮答案
  const peekId = ui.hintPeek?.cardId === card.id ? ui.hintPeek.slots[blank.slot] : undefined;
  const peeking = peekId !== undefined;
  const hf = ui.hintFlash;
  const flash = !!hf && hf.cardId === card.id && hf.slots.includes(blank.slot) && Date.now() - hf.at < 2000;
  const draft = peekId || cs.slotDraft[blank.slot];
  const sheetOpen = ui.blankSheet?.cardId === card.id && ui.blankSheet?.slot === blank.slot;

  const toggleSheet = () => {
    if (sheetOpen) {
      setUi({ blankSheet: null, highlightSlot: null });
      return;
    }
    setUi({
      blankSheet: { cardId: card.id, slot: blank.slot },
      highlightSlot: blank.kind === 'person' ? blank.slot : null,
    });
  };

  // 左侧方形图标：已选→所选词条头像/地点图；未选→默认 NPC 头像（人名，按槽位染色）或图针（地名）
  const iconEid = locked ? (draft ?? blankAnswers(blank)[0]) : draft;
  const personTint = !iconEid && blank.kind === 'person' ? slotTintClass(blank.slot) : '';
  const personTintIdx = personTint ? slotTintIndex(blank.slot) : -1;
  const icon = iconEid ? (
    <Avatar entryId={iconEid} fill />
  ) : blank.kind === 'place' ? (
    <span className="blank-btn-pin">
      <Icon name="pin" size={16} />
    </span>
  ) : (
    <Avatar
      src={data.assets.mysteryAvatar}
      name="？"
      color={personTintIdx >= 0 ? SLOT_TINT_COLORS[personTintIdx] : '#2c2a26'}
      fill
      tintClass={personTint || undefined}
    />
  );

  if (locked) {
    return (
      <button className="blank-btn locked" data-slot={blank.slot} disabled>
        <span className="blank-btn-icon">{icon}</span>
        <span className="blank-btn-text">
          {blank.slot}＝{entryDef(iconEid!)?.name} <Icon name="check" size={12} />
        </span>
      </button>
    );
  }
  return (
    <button
      className={`blank-btn${draft ? ' filled' : ''}${sheetOpen ? ' sheet-open' : ''}${ui.highlightSlot === blank.slot ? ' slot-hl' : ''}${peeking ? ' hint-peek' : ''}${flash ? ' hint-flash' : ''}`}
      data-slot={blank.slot}
      data-hint-peek={peeking ? '' : undefined}
      disabled={cs.done || peeking}
      onClick={toggleSheet}
      onMouseEnter={() => setPersonHighlight(blank.slot, blank.kind)}
      onMouseLeave={() => {
        const u = getUi();
        // 抽屉仍开着本 slot 时保持高亮
        if (u.blankSheet?.cardId === card.id && u.blankSheet.slot === blank.slot) return;
        if (u.highlightSlot === blank.slot) setPersonHighlight(null, blank.kind);
      }}
    >
      <span className="blank-btn-icon">{icon}</span>
      <span className="blank-btn-text">
        {draft ? entryDef(draft)?.name : `${blank.kind === 'place' ? tr('card.pickPlace') : blank.slot} ▾`}
      </span>
    </button>
  );
}

/** 抽屉里该类已收集候选的数量（人物 / 地点） */
function sheetCandidateCount(blank: BlankDef, s = getState()): number {
  return Object.entries(data.entries).filter(([id, def]) => def.type === blank.kind && s.entries[id]?.collected).length;
}

/** 候选多到一行放不下（人物 > 8 / 地点 > 5）时抽屉加高，多行竖滚 */
function sheetManyCandidates(blank: BlankDef): boolean {
  return sheetCandidateCount(blank) > (blank.kind === 'person' ? 8 : 5);
}

/** 底部抽屉内的候选网格（复用 SlotPicker 人物/地点卡样式）；少时一行、多时自动换行（CSS flex-wrap） */
function BlankSheetBody({ card, blank }: { card: CardDef; blank: BlankDef }) {
  const s = useGame();
  const items = Object.entries(data.entries)
    .filter(([id, def]) => def.type === blank.kind && s.entries[id]?.collected)
    .map(([id, def]) => ({ id, name: def.name, desc: def.desc, image: def.image }))
    .sort((a, b) => familiarMaxOf(b.id, s.level) - familiarMaxOf(a.id, s.level));
  const pick = (id: string) => {
    setSlotDraft(card.id, blank.slot, id);
    setUi({ blankSheet: null, highlightSlot: null });
  };
  if (items.length === 0) return <div className="entry-empty">{tr('card.noCandidates')}</div>;
  if (blank.kind === 'person') {
    return (
      <div className="picker-grid blank-sheet-grid blank-sheet-persons">
        {items.map((it) => (
          <button
            key={it.id}
            className="picker-card blank-sheet-card blank-sheet-person"
            data-pick={it.id}
            onClick={() => pick(it.id)}
          >
            <span className="blank-sheet-avatar">
              <Avatar entryId={it.id} fill />
            </span>
            <span className="picker-card-name">{it.name}</span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="picker-grid-place blank-sheet-grid blank-sheet-places">
      {items.map((it) => {
        const hasBg = !!it.image;
        return (
          <button
            key={it.id}
            className={`entry-card picker-place blank-sheet-card blank-sheet-place${hasBg ? ' has-bg' : ''}`}
            data-pick={it.id}
            onClick={() => pick(it.id)}
          >
            {hasBg ? (
              <img
                className="entry-bg-img"
                src={assetUrl(it.image!)}
                alt=""
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : null}
            <span className="entry-card-inner">
              <span className="entry-name">{it.name}</span>
              {it.desc ? <span className="entry-desc">{it.desc}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * 跳转条的一项：**用目标卡的 16:9 CG 作缩略底图**，压深色渐变 + 白字标题，
 * 左上角小角标写关系（上一节 / 下一节 / 所属角色列）。
 * 未补完的卡不露 CG（与时间轴格子、情节卡页同一套防剧透规则），改成虚框「？？？」且不可点。
 */
function NavItem({
  card,
  role,
  onGo,
}: {
  card: CardDef;
  role: 'prev' | 'next' | 'row';
  onGo: (id: string) => void;
}) {
  const s = useGame();
  const done = !!s.cards[card.id]?.done;
  const tl = timelineOf(card.level);
  const ci = correctCell(card).col;
  const colName = ci === 0 ? tr('common.scene') : tl.cols[ci];
  const eid = ci === 0 ? undefined : entryName2id(colName);
  const known = !!eid && !!s.entries[eid]?.collected;
  const who = ci === 0 ? tr('common.scene') : known ? colName : tr('common.unknown');
  const dir = role === 'prev' ? tr('card.navPrev') : role === 'next' ? tr('card.navNext') : tr('card.navSame');
  const tag = role === 'row' ? who : dir;
  return (
    <button
      className={`chat-nav-item ${role}${done ? '' : ' veiled'}`}
      data-nav={card.id}
      disabled={!done}
      title={done ? tr('card.navTitle', { dir, who, title: card.title }) : tr('card.navLocked', { dir })}
      onClick={() => onGo(card.id)}
    >
      {done && card.cg ? (
        <img
          className="chat-nav-cg"
          src={assetUrl(card.cg)}
          alt=""
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : null}
      {/* 方向箭头贴在图的左/右边缘，用渐变融进底色，不额外占一格 */}
      {role === 'prev' ? (
        <span className="chat-nav-edge left" aria-hidden>
          ‹
        </span>
      ) : null}
      {role === 'next' ? (
        <span className="chat-nav-edge right" aria-hidden>
          ›
        </span>
      ) : null}
      <span className="chat-nav-tag">
        {role === 'row' ? (
          ci === 0 ? (
            <Avatar src={data.assets.sceneIcon} name={tr('common.sceneShort')} color="#8a2f2a" size={14} />
          ) : known ? (
            <Avatar entryId={eid} size={14} />
          ) : (
            <Avatar src={data.assets.mysteryAvatar} name="？" color="#2c2a26" size={14} />
          )
        ) : null}
        <span className="chat-nav-tag-text">{tag}</span>
      </span>
      <span className="chat-nav-text">
        {done ? card.title : <VeiledTitle text={card.title} />}
      </span>
    </button>
  );
}

/** 已归位卡片底部的跳转条：单行、居中——上一节 / 下一节 + 同一时段的其他卡 */
function CardNav({ card, onGo }: { card: CardDef; onGo: (id: string) => void }) {
  const { row, col } = correctCell(card);
  const siblings = cardsOfLevel(card.level);
  const at = (r: number, c: number): CardDef | undefined =>
    siblings.find((x) => {
      const cc = correctCell(x);
      return cc.row === r && cc.col === c;
    });
  const prev = at(row - 1, col);
  const next = at(row + 1, col);
  const sameRow = siblings
    .filter((x) => {
      const cc = correctCell(x);
      return cc.row === row && cc.col !== col;
    })
    .sort((a, b) => correctCell(a).col - correctCell(b).col);
  if (!prev && !next && sameRow.length === 0) return null;
  return (
    <div className="chat-nav scroll-x">
      {prev ? <NavItem card={prev} role="prev" onGo={onGo} /> : null}
      {next ? <NavItem card={next} role="next" onGo={onGo} /> : null}
      {/* 「顺着这条线往下读」与「看同一时刻别人在做什么」是两种去处，中间要分开 */}
      {(prev || next) && sameRow.length > 0 ? <span className="chat-nav-sep" /> : null}
      {sameRow.map((c) => (
        <NavItem key={c.id} card={c} role="row" onGo={onGo} />
      ))}
    </div>
  );
}

/**
 * 情节卡详情。默认读 `selectedCardId`（情节卡页签）；
 * 传入 cardId / onGo 时作为独立浮层复用（时间轴回顾模式在原地看历史关卡的卡）。
 */
export default function CardChat({ cardId: forcedId, onGo }: { cardId?: string; onGo?: (id: string) => void } = {}) {
  const s = useGame();
  const shownId = forcedId ?? s.selectedCardId;
  const card = shownId ? cardDef(shownId) : undefined;
  const cs = card ? s.cards[card.id] : undefined;
  const go = onGo ?? selectCard;
  const total = card?.segments.length ?? 0;
  const cardId = card?.id ?? null;

  // 渐进呈现：逐条追加显示。首次显示间隔 STEP_MS；再次切换到已读卡时按 1/4 速度重放（复用同一逐条逻辑）
  // （不自动滚动：用户不碰滚动条时停留在顶部）
  const [shown, setShown] = useState(0);
  const STEP_MS = 250;
  const stepMsRef = useRef(STEP_MS); // 当前逐条间隔（首次 STEP_MS / 重放 STEP_MS/4）

  // 解锁成功 / 手动重放动画：'idle' 常态 / 'cover' CG 铺满淡入并停留 / 'reveal' CG 淡出、正文逐行重现
  const [cgAnim, setCgAnim] = useState<'idle' | 'cover' | 'reveal'>('idle');
  const prevDoneRef = useRef(false);
  const cgTimers = useRef<number[]>([]);
  const clearCgTimers = () => {
    cgTimers.current.forEach((t) => clearTimeout(t));
    cgTimers.current = [];
  };
  // 播放全过程：CG 透明度恢复 100 铺满（500ms 淡入）→ 停留 2000ms → 淡出（900ms）并逐行重现正文
  const playCg = (fast = false) => {
    if (fast) playCue('play');
    clearCgTimers();
    setShown(0);
    setCgAnim('cover');
    const HOLD = 2500; // 500ms 淡入 + 2000ms 停留
    cgTimers.current.push(
      window.setTimeout(() => {
        // 自动解锁重放=首次速度；手动【图像】重放=2 倍速（间隔减半）
        stepMsRef.current = fast ? STEP_MS / 2 : STEP_MS;
        setShown(0);
        setCgAnim('reveal'); // CG 淡出到标准背景，正文自 0 逐行重现
      }, HOLD),
    );
    cgTimers.current.push(window.setTimeout(() => setCgAnim('idle'), HOLD + 900));
  };

  useEffect(() => {
    if (!cardId) return;
    const st = getState().cards[cardId];
    const wasRead = !!st?.read;
    const n = cardDef(cardId)?.segments.length ?? 0;
    // 首次显示：初始 2 条 + 每条 STEP_MS；再次切换到已读卡：从 0 逐条重放，间隔为首次的 1/4
    stepMsRef.current = wasRead ? STEP_MS / 4 : STEP_MS;
    setShown(wasRead ? 0 : Math.min(2, n));
    markRead(cardId);
    // 切卡时同步「已补完」基线并清理动画，避免打开旧卡误触发/残留
    prevDoneRef.current = !!st?.done;
    clearCgTimers();
    setCgAnim('idle');
  }, [cardId]);

  // 卸载时清理计时器
  useEffect(() => () => clearCgTimers(), []);

  // 验证通过（done: false → true）且该卡有 CG 时，自动播放解锁动画
  useEffect(() => {
    if (!cardId || !card) return;
    const done = !!cs?.done;
    if (done && !prevDoneRef.current && card.cg) {
      prevDoneRef.current = true;
      playCg();
    } else {
      prevDoneRef.current = done;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cs?.done, cardId]);

  useEffect(() => {
    if (cgAnim === 'cover') return; // CG 铺满停留期间冻结正文推进
    if (shown >= total) return;
    const t = setTimeout(() => setShown((v) => Math.min(v + 1, total)), stepMsRef.current);
    return () => clearTimeout(t);
  }, [shown, total, cgAnim]);

  const shake = useFxActive('shake:' + (cardId ?? ''));
  const glow = useFxActive('glow:' + (cardId ?? ''));
  const ui = useUi();
  const sheetBlank =
    cardId && ui.blankSheet?.cardId === cardId
      ? card?.blanks.find((b) => b.slot === ui.blankSheet!.slot)
      : undefined;

  // 悬停/拉开抽屉时，把正文里对应人名滚进可视区
  useEffect(() => {
    if (!ui.highlightSlot) return;
    const el = document.querySelector(`.chat-body [data-slot="${CSS.escape(ui.highlightSlot)}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [ui.highlightSlot, ui.blankSheet]);

  // 「⚡提示」的答案预览：切卡 / 离开本页（卸载）/ 窗口失焦或切标签页时立刻还原
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
  }, [cardId]);
  const peeking = !!cardId && ui.hintPeek?.cardId === cardId;

  if (!card || !cs?.unlocked) {
    return <div className="chat-empty">{tr('card.pickOne')}</div>;
  }

  const placed = !!cs.pos?.locked;
  // 未补完时与列表状态章同一套两态：可填写（所需人名 / 地名齐了）/ 待补全（困难难度只显示「待补全」）
  const fillable = !cs.done && isEasy(s) && cardFillable(card, s);
  const statusText = placed
    ? tr('card.placed')
    : cs.done
      ? tr('card.done')
      : fillable
        ? tr('card.canFill')
        : tr('card.todo');
  const statusCls = placed ? ' placed' : cs.done ? ' done' : fillable ? ' can-fill' : '';
  const cgOn = !!(cs.done && card.cg); // 已补完且有 CG：作为主区背景常驻
  const sortable = cs.done && !placed; // 已补完未归位：顶栏给「待排序」入口（与列表状态章同功能）

  return (
    <div className={`chat-wrap${GAME_ID === 'slr' ? ' slr-card' : ''}${cgOn ? ' has-cg' : ''}${cgOn && card.cgDark ? ' cg-dark' : ''}`}>
      {cgOn ? (
        <div className="chat-cg-bg">
          <img
            className="chat-cg-img"
            src={assetUrl(card.cg!)}
            alt=""
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      ) : null}
      <div className="chat-head">
        <span className={`form-tag form-${card.form} chat-form-tag`}>
          <FormIcon form={card.form} size={14} /> {FORM_META[card.form].label}
        </span>
        {cs.done ? (
          <span className="chat-title">{card.title}</span>
        ) : (
          <VeiledTitle className="chat-title" text={card.title} />
        )}
        {sortable ? (
          <button className="status-sort" onClick={() => gotoTimeline(card.id)} title={tr('card.gotoTl')}>
            {tr('card.sort')}
          </button>
        ) : null}
        {cs.done && card.cg ? (
          <button className="cg-replay-btn" onClick={() => playCg(true)} title={tr('card.replayCg')}>
            <Icon name="image" size={12} /> {tr('card.image')}
          </button>
        ) : sortable ? null : (
          <span className={`status-seal${statusCls}`}>{statusText}</span>
        )}
      </div>
      <div className="chat-body scroll-y">
        {card.segments.slice(0, shown).map((seg, i) => {
          if (seg.kind === 'narration') {
            return (
              <div className="msg msg-narr" key={i}>
                <RichText text={seg.text} cardId={card.id} />
              </div>
            );
          }
          return <MsgRow key={i} seg={seg} card={card} />;
        })}
        {placed ? <CardNav card={card} onGo={go} /> : null}
        <CopyEditButton conf={{ kind: 'card', cardId: card.id }} className="ce-chat-foot" />
      </div>
      {!cs.done ? (
        <div
          className={`blank-area${sheetBlank ? ' sheet-open' : ''}${shake ? ' shake' : ''}${glow ? ' glow' : ''}`}
          data-coach-anchor="blank"
        >
          {sheetBlank ? (
            <div className="blank-sheet">
              <div className="blank-sheet-head">
                <span className="blank-sheet-title">
                  {tr('card.pickSlot', {
                    slot: sheetBlank.slot,
                    kind: sheetBlank.kind === 'person' ? tr('card.pickKindPerson') : tr('card.pickKindPlace'),
                  })}
                </span>
                <button
                  className="btn"
                  type="button"
                  onClick={() => setUi({ blankSheet: null, highlightSlot: null })}
                >
                  {tr('card.collapseSheet')}
                </button>
              </div>
              <div className={`blank-sheet-body scroll-y${sheetManyCandidates(sheetBlank) ? ' is-many' : ''}`}>
                <BlankSheetBody card={card} blank={sheetBlank} />
              </div>
            </div>
          ) : null}
          <div className="blank-bar">
            {card.blanks.map((b) => (
              <BlankButton key={b.slot} card={card} blank={b} />
            ))}
            <div className="blank-actions">
              {/* ⚡提示（−1 体力）：替玩家填对能填的空位；填不了的空位亮出答案震动 3s，期间按钮改写「尚未收集」 */}
              <button
                className={`btn blank-hint${peeking ? ' is-peek' : ''}`}
                data-hint-btn
                disabled={peeking}
                title={tr('card.hintTip', { n: HINT_COST })}
                onClick={() => hintCard(card.id)}
              >
                {peeking ? (
                  tr('card.hintPeek')
                ) : (
                  <>
                    <Icon name="bolt" size={12} /> {tr('card.hintBtn', { n: HINT_COST })}
                  </>
                )}
              </button>
              <button
                className="btn btn-primary blank-verify"
                disabled={peeking}
                onClick={() => verifyCard(card.id)}
              >
                {tr('card.verify')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {card.cg && cgAnim !== 'idle' ? (
        <div
          className={`cg-cover${cgAnim === 'reveal' ? ' out' : ' in'}`}
          style={{ backgroundImage: `url(${assetUrl(card.cg)})` }}
        />
      ) : null}
    </div>
  );
}
