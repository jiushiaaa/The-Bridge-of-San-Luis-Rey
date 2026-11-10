// 应用根组件：界面路由 + 全局 Esc 关闭最上层弹层
import { useEffect } from 'react';
import CopyEditModal from './components/copyedit/CopyEditModal';
import DebugProgressModal from './components/DebugProgressModal';
import GameMenu from './components/GameMenu';
import GuideModal from './components/GuideModal';
import SlotPicker from './components/SlotPicker';
import StoryRecap from './components/StoryRecap';
import Toast from './components/Toast';
import { useLocale } from './i18n';
import { activeCoach, dismissCoach } from './game/coach';
import { backCopyedit } from './game/copyedit';
import { assetUrl, data } from './game/data';
import { getEnterShot } from './game/logic';
import { useSyncLayoutAttr } from './game/layout';
import { isSfxEnabled } from './game/sfx';
import { syncBgmStage } from './game/bgm';
import { getState, getUi, setUi, useFxActive, useGame, useUi } from './game/store';
import RotateHint from './components/RotateHint';
import Ending from './screens/Ending';
import Game from './screens/Game';
import Title from './screens/Title';

export default function App() {
  useLocale(); // 切语言时整树重渲染，t() 取到新表
  useSyncLayoutAttr();
  const s = useGame();
  const ui = useUi();
  const enterMask = useFxActive('enterMask', 2080);
  const enterShot = getEnterShot();

  // 章节 / 封面 / 结局切换时跟随默认 BGM（手选或随机模式由 bgm 模块自行保留）
  useEffect(() => {
    syncBgmStage({ showTitle: ui.showTitle, screen: s.screen, level: s.level });
  }, [ui.showTitle, s.screen, s.level]);

  // 启动时若音量已关，同步静音 BGM（偏好只存在 sfx 侧）
  useEffect(() => {
    void import('./game/bgm').then((m) => m.setBgmEnabled(isSfxEnabled()));
  }, []);

  // Esc 关闭最上层弹层
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const u = getUi();
      if (u.picker) setUi({ picker: null });
      else if (u.blankSheet) setUi({ blankSheet: null, highlightSlot: null });
      else if (u.copyedit) backCopyedit();
      else if (u.recapLevel != null) setUi({ recapLevel: null });
      else if (u.reviewCard) setUi({ reviewCard: null });
      else if (u.notesToc) setUi({ notesToc: false });
      else if (u.entryDrawer) setUi({ entryDrawer: false });
      else if (u.mobilePane === 'detail') setUi({ mobilePane: 'list' });
      else {
        const coach = activeCoach(getState());
        if (coach) dismissCoach(coach);
        else if (u.hintOpen) setUi({ hintOpen: false });
        else if (u.guideOpen) setUi({ guideOpen: false });
        else if (u.debugOpen) setUi({ debugOpen: false });
        else if (u.menuOpen) setUi({ menuOpen: false });
        else if (u.timelineSel) setUi({ timelineSel: null });
        else if (u.reviewLevel != null) setUi({ reviewLevel: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 硬件返回：先关竖版抽屉 / 详情
  useEffect(() => {
    const onPop = () => {
      const u = getUi();
      if (u.picker) setUi({ picker: null });
      else if (u.blankSheet) setUi({ blankSheet: null, highlightSlot: null });
      else if (u.notesToc) setUi({ notesToc: false });
      else if (u.entryDrawer) setUi({ entryDrawer: false });
      else if (u.mobilePane === 'detail') setUi({ mobilePane: 'list' });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  let screen = null;
  if (ui.showTitle) screen = <Title />;
  else if (s.screen === 'ending') screen = <Ending />;
  else screen = <Game />;

  return (
    <>
      {screen}
      {/* 回顾长廊、菜单、DEBUG-文案 编辑器与候选选择器挂在根层：封面/过场/结局也能用 */}
      <GameMenu />
      <GuideModal />
      <DebugProgressModal />
      <StoryRecap />
      <CopyEditModal />
      <SlotPicker />
      <Toast />
      <RotateHint />
      {enterMask ? (
        <div className="enter-mask" aria-hidden>
          {/* 接着过场插画定格的那一帧：同一张图、同一个缩放，开洞时才不会跳 */}
          <img
            className="enter-mask-bg"
            style={{ transform: `scale(${enterShot?.scale ?? 1})` }}
            src={enterShot?.src ?? assetUrl(data.assets.titleImage)}
            alt=""
            onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
          />
        </div>
      ) : null}
    </>
  );
}
