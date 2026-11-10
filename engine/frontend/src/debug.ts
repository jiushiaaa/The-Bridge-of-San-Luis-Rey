// 调试钩子：?debug=1 开启面板；?seed=N 种子化随机数；window.__game 供自动化测试驱动
import { allCoachSeen } from './game/coach';
import { data, levelQuestion } from './game/data';
import { debugPreEnding, newGame } from './game/logic';
import { getState, seedRandom, setState, setUi } from './game/store';
import type { GameState } from './game/types';

const q = new URLSearchParams(location.search);

const seed = q.get('seed');
if (seed) seedRandom(Number(seed) || 1);

export const debugEnabled = q.get('debug') === '1';

// 离线单文件版（构建时注入 __GAME_ID，或以 file:// 打开）：不提供顶栏 DEBUG-进度 入口
export const offlineBuild =
  Boolean((window as unknown as { __GAME_ID?: string }).__GAME_ID) || location.protocol === 'file:';

// 自动化测试驱动接口：与真实游玩同一套状态模型
// setState 包装一层克隆：外部直接改 getState() 引用后也能触发重渲染
(window as unknown as { __game: unknown }).__game = {
  getState,
  setState: (s: unknown) => setState(structuredClone(s) as GameState),
  getData: () => data,
  newGame: () => {
    newGame();
    setUi({ showTitle: false });
  },
  grantAll: () => {
    debugPreEnding();
    setUi({ showTitle: false });
  },
  // 用例默认按「老玩家」起步：新手引导气泡全部标记已看，免得挤动待测控件的位置
  allCoachSeen,
  // 本卷之问（目标弹窗标题 / 过场末屏 / 出口面板头部共用，用例拿它来比文案）
  levelQuestion,
};
