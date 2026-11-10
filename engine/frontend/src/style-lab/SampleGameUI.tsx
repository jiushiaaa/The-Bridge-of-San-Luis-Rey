import { useState } from 'react';
import Icon from './icons';
import { SAMPLE, type GameTab } from './fixtures/sample-states';

const FORM: Record<string, string> = { scene: '情节', dialogue: '对话', monologue: '独白' };

export default function SampleGameUI({ scene }: { scene: 'title' | 'game' | 'overlay' }) {
  const [tab, setTab] = useState<GameTab>('cards');
  const [toastOn, setToastOn] = useState(true);

  if (scene === 'title') return <TitleScreen />;

  return (
    <div className="sl-app">
      <header className="sl-topbar">
        <div className="sl-topbar-brand">
          <div className="sl-brand">{SAMPLE.title}</div>
          <span className="sl-level">第{SAMPLE.level}关</span>
        </div>
        <span className={`sl-stamina${SAMPLE.stamina <= 0 ? ' is-empty' : ''}`} aria-label={`体力 ${SAMPLE.stamina}`}>
          <span className="sl-stat-label">体力</span>
          <Icon name="bolt" />
          <b className="sl-stat-value">{SAMPLE.stamina}</b>
        </span>
        <ul className="sl-stats" aria-label="本局统计">
          <li>
            <span className="sl-stat-label">错</span>
            <b className="sl-stat-value">{SAMPLE.stats.errors}</b>
          </li>
          <li>
            <span className="sl-stat-label">提示</span>
            <b className="sl-stat-value">{SAMPLE.stats.hints}</b>
          </li>
          <li>
            <span className="sl-stat-label">休整</span>
            <b className="sl-stat-value">{SAMPLE.stats.rests}</b>
          </li>
        </ul>
        <span className="sl-spacer" />
        <div className="sl-topbar-actions">
          <button type="button" className="sl-btn" disabled>
            休整
          </button>
          <button type="button" className="sl-btn">
            提示
          </button>
          <button type="button" className="sl-btn">
            玩法说明
          </button>
        </div>
      </header>

      <div className="sl-proof" aria-label="进度摘要">
        <div className="sl-metric">
          <b>{SAMPLE.metrics.restored}</b>
          <span>已补完</span>
        </div>
        <div className="sl-metric">
          <b>{SAMPLE.metrics.placed}</b>
          <span>已归位</span>
        </div>
        <div className="sl-metric">
          <b>{SAMPLE.metrics.archives}</b>
          <span>档案页</span>
        </div>
        <div className="sl-metric sl-metric-social">
          <b>{SAMPLE.metrics.readers}</b>
          <span>读者拼完本卷</span>
        </div>
        <div className="sl-stars" aria-label="三星评价">
          <Icon name="star" />
          <Icon name="star" />
          <Icon name="star" />
        </div>
      </div>

      <div className="sl-main">
        <section className="sl-pane sl-center">
          <nav className="sl-tabs" aria-label="主界面页签">
            {(
              [
                ['notes', '故事', 'book'],
                ['cards', '情节卡', 'cards'],
                ['archive', '档案', 'archive'],
                ['timeline', '时间轴', 'clock'],
              ] as const
            ).map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                className={`sl-tab${tab === id ? ' is-active' : ''}`}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                <Icon name={icon} />
                {label}
                {id === 'cards' ? <span className="sl-badge">2</span> : null}
                {id === 'timeline' ? <span className="sl-badge">1</span> : null}
              </button>
            ))}
          </nav>

          <div className="sl-tab-panel" key={tab}>
            {tab === 'notes' ? <NotesPane /> : null}
            {tab === 'cards' ? <CardsPane /> : null}
            {tab === 'archive' ? <ArchivePane /> : null}
            {tab === 'timeline' ? <TimelinePane /> : null}
          </div>
        </section>

        {tab === 'cards' ? <EntriesRail /> : null}
      </div>

      {scene === 'overlay' ? <PickerModal /> : null}
      {toastOn ? (
        <div className="sl-toast-box">
          <div className="sl-toast" role="status">
            {SAMPLE.toast}
            <button type="button" className="sl-toast-x" aria-label="关闭提示" onClick={() => setToastOn(false)}>
              <Icon name="close" size={14} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TitleScreen() {
  return (
    <div className="sl-title">
      <div className="sl-title-blobs" aria-hidden="true" />
      <div className="sl-title-box">
        <p className="sl-kicker">情节卡解谜</p>
        <h1>{SAMPLE.title}</h1>
        <p className="sl-sub">{SAMPLE.subtitle}</p>
        <blockquote className="sl-pull">
          「规矩是写在空气里的。谁先开口，谁就先输。」
        </blockquote>
        <div className="sl-title-btns">
          <button type="button" className="sl-btn sl-btn-primary sl-btn-lg">
            继续游戏
          </button>
          <button type="button" className="sl-btn sl-btn-lg">
            新的开始
          </button>
        </div>
        <p className="sl-title-meta">
          上次读到第 {SAMPLE.level} 关 · <Icon name="bolt" size={12} /> 体力 {SAMPLE.stamina}
        </p>
      </div>
    </div>
  );
}

function NotesPane() {
  return (
    <article className="sl-notes">
      <header className="sl-notes-head">
        <span className="sl-kicker">第 {SAMPLE.level} 关</span>
        <h2>{SAMPLE.chapter}</h2>
        <p className="sl-byline">开场剧情 · 约 4 分钟</p>
      </header>
      <p className="sl-lead">
        土司家的夜晚比白天更规矩。灯火只允许亮到规定的高度，仓库的钥匙必须在规定的时辰交还，连谁可以先说话，都像写在空气里。
      </p>
      <p>
        书记官桑吉把这件事记进册子时，手停了一下。他看见塔娜站在北仓门口，手里没有灯。她不是来卸货的。仓房里有潮气，有旧麦子的味道，还有第三个人的呼吸——那个人不肯把名字说全。
      </p>
      <aside className="sl-callout sl-callout-warn">
        <Icon name="warning" />
        <div>
          <strong>待补全</strong>
          <p>本卷仍有 2 张残页未验证，时间轴有 1 张待排序。</p>
        </div>
      </aside>
      <div className="sl-notes-actions">
        <button type="button" className="sl-btn sl-btn-primary">
          重看开场
        </button>
        <button type="button" className="sl-btn">
          进入情节卡
        </button>
      </div>
      <div className="sl-empty">
        <p>本关暂无更多附注。</p>
        <span>空状态示例</span>
      </div>
    </article>
  );
}

function CardsPane() {
  return (
    <div className="sl-cards-layout">
      <aside className="sl-card-list" aria-label="情节卡列表">
        {SAMPLE.cards.map((c, ci) => (
          <button
            key={c.id}
            type="button"
            className={`sl-card-item${'active' in c && c.active ? ' is-active' : ''}${c.status === 'done' ? ' is-done' : ''}`}
          >
            <span className={`sl-form-tag is-${c.form}`}>{FORM[c.form]}</span>
            <span className="sl-card-main">
              <span className="sl-card-head">
                {c.status === 'done' ? <Icon name="check" size={14} /> : null}
                {c.status === 'done' || c.status === 'sort' ? (
                  <strong>{c.title}</strong>
                ) : (
                  <strong className="is-veiled" aria-label="未补全">
                    <span
                      className="title-veiled"
                      aria-hidden="true"
                      style={{
                        animationDelay: `${-((ci * 137) % 56) / 10}s`,
                        animationDuration: `${4.6 + ((ci * 61) % 26) / 10}s`,
                      }}
                    >
                      {c.title}
                    </span>
                  </strong>
                )}
                {c.status === 'todo' ? <span className="sl-status">待补全</span> : null}
                {c.status === 'sort' ? (
                  <span className="sl-status is-sort">待排序</span>
                ) : null}
              </span>
              <span className="sl-card-desc">{c.desc}</span>
              {c.slots.length ? (
                <span className="sl-slots">
                  {c.slots.map((s, i) => (
                    <span key={i} className={`sl-slot is-${s}`}>
                      {s === 'empty' ? '?' : s === 'draft' ? '草稿' : '锁'}
                    </span>
                  ))}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </aside>

      <div className="sl-chat">
        <div className="sl-chat-head">
          <span className={`sl-form-tag is-${SAMPLE.chat.form}`}>{FORM[SAMPLE.chat.form]}</span>
          <h3>{SAMPLE.chat.title}</h3>
          <button type="button" className="sl-status is-sort">
            待排序
          </button>
        </div>
        <div className="sl-chat-body">
          <p className="sl-narr">{SAMPLE.chat.narr}</p>
          {SAMPLE.chat.lines.map((ln) => (
            <div key={ln.name} className={`sl-msg is-${ln.who}`}>
              <span className={`sl-avatar is-${ln.who}`} aria-hidden="true">
                {ln.who === 'npc' ? <Icon name="user" size={18} /> : ln.name.slice(0, 1)}
              </span>
              <div>
                <div className="sl-speaker">{ln.name}</div>
                <div className="sl-bubble">{ln.text}</div>
              </div>
            </div>
          ))}
          <div className="sl-msg is-known">
            <span className="sl-avatar is-known" aria-hidden="true">
              塔
            </span>
            <div>
              <div className="sl-speaker">塔娜</div>
              <div className="sl-bubble is-mono">我反复告诉自己：这只是一件该做的事。</div>
            </div>
          </div>
          <p className="sl-narr">
            灯影里闪过
            <button type="button" className="sl-entry-chip">
              铜钥匙
            </button>
            的齿纹。他把空位指给她看：
            <button type="button" className="sl-blank is-empty">
              <span className="sl-blank-icon">
                <Icon name="user" size={14} />
              </span>
              <span>NPC1</span>
            </button>
            已经选定，
            <button type="button" className="sl-blank is-filled">
              <span className="sl-blank-icon">塔</span>
              <span>塔娜</span>
            </button>
            被锁住的是
            <button type="button" className="sl-blank is-locked" disabled>
              <span className="sl-blank-icon">
                <Icon name="pin" size={14} />
              </span>
              <span>
                北仓 = 北仓 <Icon name="check" size={12} />
              </span>
            </button>
            。
          </p>
          <div className="sl-chat-foot">
            <button type="button" className="sl-btn sl-btn-primary">
              验证此卡
            </button>
            <button type="button" className="sl-btn sl-btn-danger">
              错 2
            </button>
            <span className="sl-loading">
              <span className="sl-skeleton" />
              读取下一段…
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArchivePane() {
  return (
    <div className="sl-archive">
      {SAMPLE.archive.map((a) => (
        <article key={a.name} className={`sl-arc-card is-${a.state}`}>
          <div className="sl-arc-top">
            <span className="sl-avatar is-known">{a.name.slice(0, 1)}</span>
            <div>
              <h3>{a.name}</h3>
              <p>档案页 {a.pages}</p>
            </div>
            {a.state === 'locked' ? <span className="sl-status">未分析</span> : null}
            {a.state === 'open' ? <span className="sl-status is-sort">可填写</span> : null}
            {a.state === 'done' ? (
              <span className="sl-status is-ok">
                <Icon name="check" size={12} /> 完成
              </span>
            ) : null}
          </div>
          {a.state === 'open' ? (
            <p className="sl-arc-body">她记得钥匙的齿纹，却不肯承认自己进过仓房。</p>
          ) : a.state === 'locked' ? (
            <div className="sl-skeleton sl-skeleton-block" />
          ) : (
            <p className="sl-arc-body">北仓的门锁在规定时辰必须交还。</p>
          )}
          <button type="button" className="sl-btn" disabled={a.state === 'done'}>
            {a.state === 'locked' ? (
              <>
                分析（
                <Icon name="bolt" size={12} /> -1）
              </>
            ) : a.state === 'done' ? (
              '已完成'
            ) : (
              '补全空缺'
            )}
          </button>
        </article>
      ))}
    </div>
  );
}

function TimelinePane() {
  return (
    <div className="sl-tl">
      <div className="sl-tl-grid">
        {SAMPLE.timeline.map((cell) => (
          <button key={cell.title} type="button" className={`sl-tl-chip is-${cell.state} is-${cell.form}`}>
            {cell.state === 'locked' ? <Icon name="check" size={12} /> : null}
            <span>{cell.title}</span>
          </button>
        ))}
      </div>
      <p className="sl-hint">点格子空白处放入残页。已锁定的格不能再移动。</p>
      <button type="button" className="sl-btn sl-btn-primary sl-btn-block">
        回顾本关故事
      </button>
    </div>
  );
}

function EntriesRail() {
  return (
    <aside className="sl-pane sl-rail" aria-label="词条库">
      <div className="sl-rail-head">词条库</div>
      <div className="sl-entry-grid">
        {SAMPLE.entries.map((e) => (
          <article key={e.id} className={`sl-entry${e.kind === 'place' ? ' is-place' : ''}`}>
            <span className="sl-entry-pin" aria-hidden="true" />
            <div className="sl-entry-top">
              {e.kind === 'person' ? <span className="sl-avatar is-known">{e.name.slice(0, 1)}</span> : null}
              <strong>{e.name}</strong>
            </div>
            <p>{e.desc}</p>
            <div className="sl-fam" aria-label={`熟悉度 ${e.fam}`}>
              {[0, 1, 2].map((i) => (
                <i key={i} className={i < e.fam ? 'on' : ''} />
              ))}
            </div>
            {e.search ? (
              <button type="button" className="sl-btn sl-btn-search">
                {e.best ? <span className="sl-dot" /> : null}
                <Icon name="search" size={14} /> 搜寻
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </aside>
  );
}

function PickerModal() {
  return (
    <div className="sl-overlay" role="presentation">
      <div className="sl-modal" role="dialog" aria-labelledby="sl-picker-title" aria-modal="true">
        <header className="sl-modal-head">
          <h2 id="sl-picker-title">选择人名</h2>
          <button type="button" className="sl-btn sl-btn-ghost" aria-label="关闭">
            <Icon name="close" />
          </button>
        </header>
        <div className="sl-modal-body">
          <label className="sl-field">
            <span>筛选</span>
            <input className="sl-input" defaultValue="" placeholder="按熟悉度排序，无需输入" />
          </label>
          <div className="sl-picker-grid">
            {SAMPLE.picker.map((name, i) => (
              <button key={name} type="button" className={`sl-pick${i === 1 ? ' is-active' : ''}`}>
                <span className="sl-avatar is-known">{name.slice(0, 1)}</span>
                <span>{name}</span>
                <span className="sl-fam">
                  {[0, 1, 2].map((d) => (
                    <i key={d} className={d < 3 - i ? 'on' : ''} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
        <footer className="sl-modal-foot">
          <button type="button" className="sl-btn">
            取消
          </button>
          <button type="button" className="sl-btn sl-btn-primary">
            选定
          </button>
        </footer>
      </div>
    </div>
  );
}
