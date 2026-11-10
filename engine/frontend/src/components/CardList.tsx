// 情节卡列表：待补全 > 已补完 > 已归位；前两类按最后调整时间从近到远；已归位按时间轴坐标
// 卡片三行：形态字标 + 标题行（补完前模糊真名，补完后真名 + 状态章）+ 内容摘录两行 + 槽位行（填空头像）/ 归位坐标行
import { t } from '../i18n';
import { cardsOfLevel, entryDef, plainText } from '../game/data';
import { cardFillable, gotoTimeline, isEasy, selectCard } from '../game/logic';
import { useGame } from '../game/store';
import type { CardDef } from '../game/types';
import { blankAnswers } from '../game/types';
import Avatar from './Avatar';
import Icon from './Icon';
import VeiledTitle from './VeiledTitle';

export const FORM_LABEL: Record<CardDef['form'], string> = {
  get scene() {
    return t('form.scene');
  },
  get dialogue() {
    return t('form.dialogue');
  },
  get monologue() {
    return t('form.monologue');
  },
};

const CHIP_RE = /\{\{(e_[a-z0-9_]+)\|/g;

/** 本卡正文里的词条 id（{{e_x|名}}） */
function chipEntryIds(card: CardDef): string[] {
  const ids = new Set<string>();
  for (const seg of card.segments) {
    CHIP_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CHIP_RE.exec(seg.text))) ids.add(m[1]);
  }
  return [...ids];
}

/** 空位当前展示的词条：已锁定取玩家所选（数组答案缺省取首个），未锁定取草稿 */
function slotEntry(card: CardDef, slot: string, locked: boolean, draft: string | undefined): string | undefined {
  if (locked) {
    const b = card.blanks.find((x) => x.slot === slot)!;
    return draft && blankAnswers(b).includes(draft) ? draft : blankAnswers(b)[0];
  }
  return draft;
}

/** 填空槽位行：人名=圆头像槽（锁定=金环 / 草稿=半透明 / 未填=虚线空圈），
 *  地名=显示全名的小胶囊（同三态）；personOnly 只出人名槽（窄容器里省地名胶囊的宽度） */
export function SlotRow({ card, size = 28, personOnly = false }: { card: CardDef; size?: number; personOnly?: boolean }) {
  const s = useGame();
  const cs = s.cards[card.id]!;
  const blanks = personOnly ? card.blanks.filter((b) => b.kind === 'person') : card.blanks;
  if (blanks.length === 0) return null;
  return (
    <span className="card-slots">
      {blanks.map((b) => {
        const locked = !!cs.slotLocked[b.slot];
        const eid = slotEntry(card, b.slot, locked, cs.slotDraft[b.slot]);
        if (b.kind === 'place') {
          const name = eid ? entryDef(eid)?.name : undefined;
          return (
            <span
              key={b.slot}
              className={`card-slot-place${eid ? (locked ? ' locked' : ' draft') : ' empty'}`}
              title={eid ? (locked ? t('card.checked') : t('card.draft')) : t('card.pendingPlace')}
            >
              <Icon name="pin" size={12} />
              {name ?? t('card.place')}
            </span>
          );
        }
        if (eid) {
          return (
            <span key={b.slot} className={`card-slot${locked ? ' locked' : ' draft'}`} title={locked ? t('card.checked') : t('card.draft')}>
              <Avatar entryId={eid} size={size} />
            </span>
          );
        }
        return (
          <span key={b.slot} className="card-slot empty" title={t('card.pendingSlot', { slot: b.slot })}>
            ？
          </span>
        );
      })}
    </span>
  );
}

export default function CardList() {
  const s = useGame();
  const unlocked = cardsOfLevel(s.level).filter((c) => s.cards[c.id]?.unlocked);
  // 待补全：按获得时间从近到远
  const todo = unlocked
    .filter((c) => !s.cards[c.id]?.done)
    .sort((a, b) => (s.cards[b.id]?.unlockedAt ?? 0) - (s.cards[a.id]?.unlockedAt ?? 0));
  // 已补完：按补完时间从近到远
  const done = unlocked
    .filter((c) => s.cards[c.id]?.done && !s.cards[c.id]?.pos?.locked)
    .sort((a, b) => (s.cards[b.id]?.doneAt ?? 0) - (s.cards[a.id]?.doneAt ?? 0));
  // 已归位：按时间轴坐标（先时段行，再列：情节列在前、人物列随后）
  const placed = unlocked
    .filter((c) => s.cards[c.id]?.pos?.locked)
    .sort((a, b) => {
      const pa = s.cards[a.id]!.pos!;
      const pb = s.cards[b.id]!.pos!;
      return pa.row - pb.row || pa.col - pb.col;
    });
  const sorted: CardDef[] = [...todo, ...done, ...placed];
  return (
    <div className="card-list">
      <div className="pane-body scroll-y" style={{ padding: 0 }}>
        {sorted.length === 0 ? (
          <div className="entry-empty">
            {t('card.empty1')}
            <br />
            {t('card.empty2')}
          </div>
        ) : (
          sorted.map((c) => {
            const cs = s.cards[c.id];
            const isPlaced = !!cs?.pos?.locked;
            const isDone = !!cs?.done;
            // 未补完的卡分两态：所需 NPC 名 / 地名都已收集 →「可填写」；否则「待补全」（困难难度只显示「待补全」）
            const fillable = !isDone && isEasy(s) && cardFillable(c, s);
            // 本卡仍有未在此卡收集过的词条 chip（可点击 +熟悉度）时，标题后显示小红点
            const hasClickableEntry = chipEntryIds(c).some((id) => !s.entries[id]?.famCards?.includes(c.id));
            return (
              <button
                key={c.id}
                className={`card-item${s.selectedCardId === c.id ? ' active' : ''}${isDone ? ' done' : ''}`}
                data-card-item={c.id}
                onClick={() => selectCard(c.id)}
              >
                <span className="card-item-main">
                  <span className="card-item-head">
                    <span className={`form-tag form-${c.form}`}>{FORM_LABEL[c.form]}</span>
                    {isPlaced ? (
                      <span className="card-check">
                        <Icon name="check" size={14} />
                      </span>
                    ) : null}
                    {isDone ? (
                      <span className="card-item-title">{c.title}</span>
                    ) : (
                      <VeiledTitle className="card-item-title" text={c.title} />
                    )}
                    {hasClickableEntry ? (
                      <span className="card-item-newdot" title={t('card.chipLeft')} />
                    ) : null}
                    {!isDone ? (
                      <span className={`status-seal${fillable ? ' can-fill' : ''}`}>
                        {fillable ? t('card.canFill') : t('card.todo')}
                      </span>
                    ) : !isPlaced ? (
                      <span
                        className="status-sort"
                        role="button"
                        title={t('card.gotoTl')}
                        onClick={(e) => {
                          e.stopPropagation();
                          gotoTimeline(c.id);
                        }}
                      >
                        {t('card.sort')}
                      </span>
                    ) : null}
                  </span>
                  <span className="card-desc">{plainText(c.segments[0]?.text ?? '')}</span>
                  {!isPlaced ? <SlotRow card={c} /> : null}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
