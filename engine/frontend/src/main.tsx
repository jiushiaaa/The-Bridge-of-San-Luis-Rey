// 入口：（非离线版）先从后端拉最新数据 -> 初始化存档 -> 挂载 React
import { createRoot } from 'react-dom/client';
import App from './App';
import { initCopyedit } from './game/copyedit';
import { assetUrl, data } from './game/data';
import { initialState } from './game/logic';
import { loadGame } from './game/save';
import { installSfxUnlock } from './game/sfx';
import { initState } from './game/store';
import './debug';
import './styles.css';
import './style-lab/fonts.css';
import './theme-editorial.css';
import './theme-portrait.css';
import { startTabPill } from './style-lab/tab-pill';

async function bootstrap(): Promise<void> {
  installSfxUnlock();
  // DEBUG-文案：后端在线时用磁盘上最新的 final_game.json 覆盖构建期内联数据
  // （离线版/后端未启动时静默跳过，1.5s 超时兜底，见 game/copyedit.ts）
  await initCopyedit();

  // 网页标题用作品正式名
  if (data.meta.title) document.title = data.meta.title;

  // 各作品专属 favicon（由情节列图标裁切，见 README_game §4.8）：运行时覆盖静态兜底图标
  if (data.assets.favicon) {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]') ?? document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = assetUrl(data.assets.favicon);
    if (!link.parentNode) document.head.appendChild(link);
  }

  initState(loadGame() ?? initialState());

  createRoot(document.getElementById('root')!).render(<App />);

  startTabPill();
}

void bootstrap();
