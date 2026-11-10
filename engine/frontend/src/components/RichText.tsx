// 富文本渲染：{{e_x|名}} -> 可点词条 chip；[[NPCn]] -> 占位章/草稿名/真名
import { t } from '../i18n';
import type { ReactNode } from 'react';
import { cardDef, data, entryDef, slotTintClass, SLOT_TINT_COLORS, slotTintIndex } from '../game/data';
import { clickEntry } from '../game/logic';
import { flyDotTo } from '../game/fly';
import { useFxActive, useGame, useUi } from '../game/store';
import { blankAnswers } from '../game/types';
import Avatar from './Avatar';
import Icon from './Icon';

const TOKEN_RE = /\{\{(e_[a-z0-9_]+)\|([^}]*)\}\}|\[\[(NPC\d)\]\]/g;

function EntryChip({ id, label, cardId }: { id: string; label: string; cardId?: string }) {
  const s = useGame();
  const def = entryDef(id);
  const est = s.entries[id];
  const doneHere = !!(cardId && est?.famCards.includes(cardId));
  const collecting = useFxActive(cardId ? `entry:${cardId}:${id}` : '', 780);
  const showAvatar = def?.type === 'person' && (est?.familiarity ?? 0) >= 1;
  const check = doneHere ? (
    <span className="chip-check" aria-hidden="true">
      <Icon name="check" size={12} />
    </span>
  ) : null;
  // 带头像的人物 chip 与正文人名空位 / 底部填空按钮同一副样子：左侧齐边正方形头像 + 右侧文字
  if (showAvatar) {
    return (
      <button
        type="button"
        className={`entry-chip has-ico t-${def?.type ?? 'concept'}${collecting ? ' collect-fx' : ''}`}
        title={doneHere ? t('entry.chipDone') : t('entry.chipCollect')}
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const got = clickEntry(id, cardId);
          if (got) flyDotTo(`[data-entry-id="${id}"]`, rect, '[data-tab="entries"], [data-entry-drawer]');
        }}
      >
        <span className="npc-ico chip-ico">
          <Avatar entryId={id} fill />
        </span>
        <span className="chip-text">
          {label}
          {check}
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`entry-chip t-${def?.type ?? 'concept'}${collecting ? ' collect-fx' : ''}`}
      title={doneHere ? t('entry.chipDone') : t('entry.chipCollect')}
      onClick={(e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const got = clickEntry(id, cardId);
        // 仅有新收集时：光点直线飞入右侧词条库对应卡片；卡片不可见时退而飞向「词条库」标题
        if (got) flyDotTo(`[data-entry-id="${id}"]`, rect, '[data-tab="entries"], [data-entry-drawer]');
      }}
    >
      {label}
      {check}
    </button>
  );
}

export default function RichText({ text, cardId }: { text: string; cardId?: string }) {
  const s = useGame();
  const { highlightSlot } = useUi();
  const parts: ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) {
      parts.push(<EntryChip key={k++} id={m[1]} label={m[2]} cardId={cardId} />);
    } else {
      const slot = m[3];
      let entryId: string | undefined;
      let locked = false;
      if (cardId) {
        const def = cardDef(cardId);
        const blank = def?.blanks.find((b) => b.slot === slot);
        if (blank) {
          const cs = s.cards[cardId];
          locked = !!cs?.slotLocked[slot];
          // 锁定显示玩家选中的词条（数组答案取所选项）；未锁定但已选草稿则显示草稿名
          entryId = locked ? (cs?.slotDraft[slot] ?? blankAnswers(blank)[0]) : cs?.slotDraft[slot];
        }
      }
      const hl = highlightSlot === slot ? ' slot-hl' : '';
      // 正文里的人名空位与底部 BlankButton 同款：左侧齐边方形图标 + 右侧文字（未填虚框 / 草稿实框 / 锁定金框）
      if (entryId) {
        parts.push(
          <span key={k++} className={`${locked ? 'npc-known' : 'npc-draft'}${hl}`} data-slot={slot}>
            <span className="npc-ico">
              <Avatar entryId={entryId} fill />
            </span>
            <span className="npc-label">{entryDef(entryId)?.name ?? slot}</span>
          </span>,
        );
      } else {
        const tint = slotTintClass(slot);
        const tintIdx = slotTintIndex(slot);
        parts.push(
          <span key={k++} className={`npc-unknown${hl}${tint ? ` ${tint}` : ''}`} data-slot={slot}>
            <span className="npc-ico">
              <Avatar
                src={data.assets.mysteryAvatar}
                name="？"
                color={tintIdx >= 0 ? SLOT_TINT_COLORS[tintIdx] : '#2c2a26'}
                fill
                tintClass={tint || undefined}
              />
            </span>
            <span className="npc-label">{slot}</span>
          </span>,
        );
      }
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
