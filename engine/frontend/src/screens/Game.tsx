// 游戏主界面：顶栏 + 中区（四页签）+ 情节卡页右区词条库 + 各类弹层
// 窄屏（<1100）且在情节卡页：页签栏右端出现「词条库」按钮，点开为贴右缘的抽屉浮层
// 竖版（phone）：顶栏 HUD + 底栏四页签；情节卡/档案主从全屏；词条库底部抽屉
import { t } from '../i18n';
import { useEffect } from 'react';
import { cardsOfLevel, data, gateAfterLevel, levelChapterLabel, maxLevel } from '../game/data';
import { activeCoach } from '../game/coach';
import { pushMobileLayer, useLayout } from '../game/layout';
import { analyzeState, cardFillable, closeMobilePane, gateChecklist, isEasy, setTab } from '../game/logic';
import { setUi, useGame, useUi } from '../game/store';
import type { TabId } from '../game/types';
import Archive from '../components/Archive';
import BgmMiniPlayer from '../components/BgmMiniPlayer';
import CardChat from '../components/CardChat';
import CardList from '../components/CardList';
import Coach from '../components/Coach';
import DebugPanel from '../components/DebugPanel';
import HintModal from '../components/HintModal';
import NotesPanel from '../components/NotesPanel';
import RightPanel, { useSearchCount } from '../components/RightPanel';
import Timeline from '../components/Timeline';
import VitalsBar from '../components/VitalsBar';
import Icon, { Stars } from '../components/Icon';
import { debugEnabled } from '../debug';
import LevelIntro from './LevelIntro';

export default function Game() {
  const s = useGame();
  const ui = useUi();
  const layout = useLayout();
  const phone = layout === 'phone';
  const onCards = s.tab === 'cards';
  const entryCollapsed = layout === 'narrow' || phone;
  const showEntryRail = onCards && !entryCollapsed;
  const showEntryDrawerBtn = onCards && entryCollapsed;
  const searchCount = useSearchCount();
  const tabs: { id: TabId; icon?: 'scroll' | 'archive' | 'clock' | 'book'; label: string; title?: string }[] = [
    { id: 'notes', icon: 'book', label: t('tabs.notes') },
    { id: 'cards', icon: 'scroll', label: t('tabs.cards') },
    { id: 'archive', icon: 'archive', label: t('tabs.archive') },
    { id: 'timeline', icon: 'clock', label: t('tabs.timeline') },
  ];

  // 离开情节卡时收起词条库抽屉（其它页签无右栏）
  useEffect(() => {
    if (!onCards && ui.entryDrawer) setUi({ entryDrawer: false });
  }, [onCards, ui.entryDrawer]);

  // 竖版引导：需要词条库 / 列表 / 对话时自动切到对应层
  useEffect(() => {
    if (!phone) return;
    const id = activeCoach(s);
    if (id === 'entryCard' || id === 'search') {
      if (!ui.entryDrawer) setUi({ entryDrawer: true });
    } else if (id === 'newCard' && ui.mobilePane === 'detail') {
      setUi({ mobilePane: 'list' });
    } else if ((id === 'chip' || id === 'blank') && ui.mobilePane !== 'detail' && s.selectedCardId) {
      setUi({ mobilePane: 'detail' });
    }
  }, [phone, s, ui.entryDrawer, ui.mobilePane, ui.coachReady, ui.coachFocus]);

  // 页签角标：可被完全填对的待补全卡数 / 待归位数 / 档案 =「可分析」词条数 +「已分析未填完（可填写）」词条数
  const cards = cardsOfLevel(s.level);
  // 「可被完全填写正确」：该卡所需的 NPC 名与地名，每个空位至少有一个正确答案词条已被玩家收集
  // 困难难度不透露「哪些卡已能填对」，角标改计全部待补全卡
  const undoneCards = cards.filter((c) => {
    const cs = s.cards[c.id];
    if (!cs?.unlocked || cs.done) return false;
    return !isEasy(s) || cardFillable(c, s);
  }).length;
  const toPlace = cards.filter((c) => s.cards[c.id]?.done && !s.cards[c.id]?.pos?.locked).length;
  // 关卡出口可答题（进度 ≥70%）且尚未过关：时间轴角标 +1
  const gateTodo = gateAfterLevel(s.level) && gateChecklist(s.level, s).ok && !s.gates[String(s.level)]?.passed ? 1 : 0;
  const arcTodo = Object.keys(data.entries).filter((id) => {
    const e = s.entries[id];
    if (!e?.collected || !data.entries[id].archive?.length) return false;
    if (analyzeState(id, s) === 'active') return true;
    return e.pagesUnlocked.some((i) => !e.pagesDone.includes(i));
  }).length;
  const badges: Record<TabId, number> = { notes: 0, cards: undoneCards, timeline: toPlace + gateTodo, archive: arcTodo };
  const chapter = levelChapterLabel(s.level);
  const showDetailBack = phone && ui.mobilePane === 'detail' && (s.tab === 'cards' || s.tab === 'archive');
  // 返回按钮指名道姓写清回到哪儿：只写「返回」在全屏详情里看不出退到哪一层
  const backLabel = s.tab === 'archive' ? t('phone.backArchive') : t('phone.backCards');

  const tabButtons = tabs.map((tab) => (
    <button
      key={tab.id}
      className={`tab${tab.id === 'notes' ? ' tab-chapter' : ''}${s.tab === tab.id ? ' active' : ''}`}
      data-tab={tab.id}
      title={tab.title}
      onClick={() => setTab(tab.id)}
    >
      {tab.icon ? <Icon name={tab.icon} size={phone ? 18 : 14} /> : null}
      {tab.id === 'notes' && !phone ? (
        <span className="tab-stack">
          <span className="tab-label">{tab.label}</span>
          <span className="tab-sub">{chapter}</span>
        </span>
      ) : (
        tab.label
      )}
      {badges[tab.id] > 0 ? <span className="badge">{badges[tab.id]}</span> : null}
    </button>
  ));

  const tools = (
    <div className="tabs-tools">
      <button
        className="tool-btn"
        type="button"
        aria-label={t('common.hint')}
        title={t('common.hint')}
        onClick={() => setUi({ hintOpen: true })}
      >
        <Icon name="bulb" size={16} />
      </button>
      <button
        className="tool-btn"
        type="button"
        aria-label={t('common.menu')}
        title={t('common.menu')}
        onClick={() => setUi({ menuOpen: true })}
      >
        <Icon name="menu" size={16} />
      </button>
    </div>
  );

  const entryBtn = showEntryDrawerBtn ? (
    <button
      className={`tab tab-entry${ui.entryDrawer ? ' active' : ''}`}
      data-entry-drawer
      title={t('game.openEntries')}
      onClick={() => {
        const next = !ui.entryDrawer;
        if (next) pushMobileLayer();
        setUi({ entryDrawer: next });
      }}
    >
      <Icon name="book" size={14} /> {phone ? null : t('game.entries')}
      {searchCount > 0 ? <span className="badge">{searchCount}</span> : null}
    </button>
  ) : null;

  // 关卡过场（levelIntro）覆盖层；重看时末钮改为「返回」
  // 卷名由过场自己的题名幕呈现，不再另扫一道横幅（原来卷名会重复三次：横幅、正文首行、题名）
  if (s.introLevel != null) {
    return <LevelIntro level={s.introLevel} replaying={!!s.flags.introSeen[String(s.introLevel)]} />;
  }

  return (
    <div className="app">
      {phone ? (
        <header className="phone-hud">
          {showDetailBack ? (
            <button
              className="phone-back"
              type="button"
              aria-label={backLabel}
              onClick={() => closeMobilePane()}
            >
              <Icon name="chevron" size={16} />
              {backLabel}
            </button>
          ) : (
            <span className="tabs-brand" title={data.meta.title}>
              {data.meta.title}
            </span>
          )}
          <div className="tabs-end">
            {s.tab === 'notes' ? (
              <button
                className={`tool-btn${ui.notesToc ? ' active' : ''}`}
                type="button"
                aria-label={t('notes.toc')}
                aria-expanded={ui.notesToc}
                title={t('notes.toc')}
                onClick={() => {
                  const next = !ui.notesToc;
                  if (next) pushMobileLayer();
                  setUi({ notesToc: next });
                }}
              >
                <Icon name="book" size={16} />
              </button>
            ) : null}
            {entryBtn}
            <BgmMiniPlayer />
            <VitalsBar />
            {tools}
          </div>
        </header>
      ) : null}
      <div className="main">
        <div className="pane pane-center">
          {!phone ? (
            <div className="tabs">
              <span className="tabs-brand" title={data.meta.title}>
                {data.meta.title}
              </span>
              {tabButtons}
              <div className="tabs-end">
                {entryBtn}
                <BgmMiniPlayer />
                <VitalsBar />
                {tools}
              </div>
            </div>
          ) : null}
          <div className="tab-panel" key={s.tab}>
            {s.tab === 'notes' ? (
              <div className="pane-body notes-page">
                <NotesPanel />
              </div>
            ) : s.tab === 'cards' ? (
              <div className={`cards-stage${phone && ui.mobilePane === 'detail' ? ' is-detail' : ''}`}>
                <CardList />
                <CardChat />
              </div>
            ) : s.tab === 'timeline' ? (
              <Timeline />
            ) : (
              <Archive />
            )}
          </div>
        </div>
        {showEntryRail ? <RightPanel /> : null}
        {showEntryDrawerBtn && ui.entryDrawer ? (
          <>
            <div className="drawer-mask" onClick={() => setUi({ entryDrawer: false })} />
            <RightPanel drawer />
          </>
        ) : null}
      </div>
      {phone ? (
        <nav className="tabs tabs-bottom" aria-label={t('phone.nav')}>
          {tabButtons}
        </nav>
      ) : null}

      {/* 弹层与覆盖物（菜单/玩法说明/DEBUG-进度已挂 App 根层，封面也能开） */}
      <Coach />
      <HintModal />
      {ui.gateFx ? (
        <div className="gate-fx" role="dialog" aria-modal="true" aria-labelledby="gate-fx-heading">
          <div className="gate-fx-veil" aria-hidden="true" />
          <div className="gate-fx-stage">
            <div className="gate-fx-seal" aria-hidden="true">
              {t('gate.cleared')}
            </div>
            <p className="gate-fx-kicker">{t('game.gateFxKicker')}</p>
            <h2 className="gate-fx-heading" id="gate-fx-heading">
              {levelChapterLabel(ui.gateFx.gate)}
            </h2>
            <div className="gate-fx-stars" aria-label={t('game.starsGot', { n: ui.gateFx.stars })}>
              <Stars n={ui.gateFx.stars} max={ui.gateFx.max} size={28} zeroSlots />
            </div>
            <p className="gate-fx-epigraph">
              {ui.gateFx.gate >= maxLevel ? t('game.toEnding') : t('game.nextVol')}
            </p>
          </div>
        </div>
      ) : null}
      {debugEnabled ? <DebugPanel /> : null}
    </div>
  );
}
