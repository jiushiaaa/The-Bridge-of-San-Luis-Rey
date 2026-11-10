// 客户端 UI 音效单例：uisfx 用 Web Audio 合成，不拉外部音频，离线单文件也能播
import { createUISFX, type CueName, type PlayingSFX, type UISFXPlayer } from 'uisfx';

/** 主音色：zen 整体是耳语正弦波，扛不起点击这类高频动作；studio 同属纸刊/剪辑气质，三角波+敲击，听得见 */
const PACK = 'studio' as const;
/** 开合与翻页单独一轨。studio 的 open/close 是上滑呼音+敲击，soft 也带 9 个半音的滑音（266→448Hz），
 *  弹层一开一关就「呜哇」一声。zen 的滑音只有 2 个半音、噪声为零、频谱质心低三分之一，
 *  又是唯一带 paper/brush/wood 质地的包（官方定位 reading/writing），与过场翻页同源。 */
const LAYER_PACK = 'zen' as const;
const LAYER_CUES = new Set<CueName>(['open', 'close', 'expand', 'collapse', 'swipe']);
/** 主音量上限；cue defaultVolume 只有 0.07～0.26，不盖掉就会几乎听不见 */
const VOLUME = 1;
/** 单次播放音量，覆盖 cue 自带的偏低 defaultVolume */
const PLAY_VOLUME = 1;
/** uisfx 把 volume 钳在 0～1；额外这一级约 +3dB */
const BOOST = 1.2;
const PREF_KEY = 'baima:sound';

let player: UISFXPlayer | null = null;
let menuPlayer: UISFXPlayer | null = null;
let ownedContext: AudioContext | null = null;
let gestureUnlocked = false;
let skipLayer = false;
const loops = new Set<PlayingSFX>();

/** 自管 AudioContext：把接到 destination 的增益改接到 boost，突破库的 1.0 钳位 */
function createBoostedContext(): AudioContext {
  const ctx = new AudioContext();
  const boost = ctx.createGain();
  boost.gain.value = BOOST;
  boost.connect(ctx.destination);
  const createGain = ctx.createGain.bind(ctx);
  ctx.createGain = () => {
    const node = createGain();
    const connect = node.connect.bind(node) as GainNode['connect'];
    node.connect = ((dest: AudioNode, ...rest: number[]) =>
      connect(dest === ctx.destination ? boost : dest, ...rest)) as GainNode['connect'];
    return node;
  };
  return ctx;
}

export function getSfx(): UISFXPlayer | null {
  if (typeof window === 'undefined') return null;
  if (!player) {
    ownedContext = createBoostedContext();
    player = createUISFX({
      pack: PACK,
      volume: VOLUME,
      context: ownedContext,
      preferences: { key: PREF_KEY },
    });
    // 包与主音量以代码为准，避免 localStorage 旧值卡住；开关仍走偏好持久化
    player.setPack(PACK);
    player.setVolume(VOLUME);
  }
  return player;
}

/** 开合层：不写偏好，避免把主包改成 zen */
function getLayerSfx(): UISFXPlayer | null {
  const main = getSfx();
  if (!main || !ownedContext) return null;
  if (!menuPlayer) {
    menuPlayer = createUISFX({
      pack: LAYER_PACK,
      volume: VOLUME,
      enabled: main.isEnabled(),
      context: ownedContext,
    });
    menuPlayer.setPack(LAYER_PACK);
    menuPlayer.setVolume(VOLUME);
  }
  return menuPlayer;
}

function playOn(ui: UISFXPlayer | null, cue: CueName, options?: { volume?: number }): PlayingSFX | null {
  if (!ui) return null;
  try {
    return ui.play(cue, { ...options, volume: options?.volume ?? PLAY_VOLUME });
  } catch {
    return null;
  }
}

/** 手势后解锁 Web Audio / BGM；首屏绝不自动播 */
export function installSfxUnlock(): void {
  if (typeof window === 'undefined') return;
  const unlock = () => {
    const ui = getSfx();
    if (!ui) return;
    gestureUnlocked = true;
    void ui.unlock();
    void import('./bgm').then((m) => m.unlockBgmGesture());
  };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
}

export function playCue(cue: CueName, options?: { volume?: number }): PlayingSFX | null {
  if (!gestureUnlocked) return null;
  if (LAYER_CUES.has(cue)) return playOn(getLayerSfx(), cue, options);
  return playOn(getSfx(), cue, options);
}

export function startLoop(cue: 'processing' | 'loading'): PlayingSFX | null {
  const handle = playCue(cue);
  if (handle) loops.add(handle);
  return handle;
}

export function stopLoop(handle: PlayingSFX | null | undefined): void {
  if (!handle) return;
  handle.stop();
  loops.delete(handle);
}

export function stopAllSfx(): void {
  for (const handle of loops) handle.stop();
  loops.clear();
  getSfx()?.stopAll();
  menuPlayer?.stopAll();
}

export function isSfxEnabled(): boolean {
  return getSfx()?.isEnabled() ?? true;
}

export function setSfxEnabled(on: boolean): void {
  const ui = getSfx();
  if (!ui) return;
  if (on) {
    ui.setEnabled(true);
    getLayerSfx()?.setEnabled(true);
    void import('./bgm').then((m) => m.setBgmEnabled(true));
    playCue('toggle-on');
  } else {
    playCue('toggle-off');
    stopAllSfx();
    ui.setEnabled(false);
    menuPlayer?.setEnabled(false);
    void import('./bgm').then((m) => m.setBgmEnabled(false));
  }
}

/** 下一次 setUi 的弹层开/关音跳过（提交选择、切页签连带收起时避免叠音） */
export function sfxSkipLayer(): void {
  skipLayer = true;
}

/** 选中候选项并即将关掉弹层/抽屉：只播 select */
export function sfxCommitSelect(): void {
  skipLayer = true;
  playCue('select');
}

/** 弹层类 UI 开合（Esc / 遮罩 / 按钮共用 setUi，集中在这里认 cue） */
export function sfxOnUiChange(
  prev: {
    picker: unknown;
    blankSheet: unknown;
    hintOpen: boolean;
    guideOpen: boolean;
    menuOpen: boolean;
    debugOpen: boolean;
    recapLevel: number | null;
    reviewLevel: number | null;
    reviewCard: string | null;
    entryDrawer: boolean;
    notesToc?: boolean;
  },
  next: {
    picker: unknown;
    blankSheet: unknown;
    hintOpen: boolean;
    guideOpen: boolean;
    menuOpen: boolean;
    debugOpen: boolean;
    recapLevel: number | null;
    reviewLevel: number | null;
    reviewCard: string | null;
    entryDrawer: boolean;
    notesToc?: boolean;
  },
): void {
  if (skipLayer) {
    skipLayer = false;
    return;
  }
  const edge = (was: boolean, now: boolean, on: CueName, off: CueName) => {
    if (!was && now) playCue(on);
    else if (was && !now) playCue(off);
  };
  edge(!!prev.picker, !!next.picker, 'open', 'close');
  edge(!!prev.blankSheet, !!next.blankSheet, 'expand', 'collapse');
  edge(prev.hintOpen, next.hintOpen, 'open', 'close');
  edge(prev.guideOpen, next.guideOpen, 'open', 'close');
  edge(prev.menuOpen, next.menuOpen, 'expand', 'collapse');
  edge(prev.debugOpen, next.debugOpen, 'open', 'close');
  edge(prev.recapLevel != null, next.recapLevel != null, 'open', 'close');
  if (prev.reviewLevel !== next.reviewLevel) {
    if (prev.reviewLevel != null && next.reviewLevel != null) {
      playOn(getLayerSfx(), 'select');
    } else if (next.reviewLevel != null) playCue('open');
    else playCue('close');
  }
  edge(!!prev.reviewCard, !!next.reviewCard, 'open', 'close');
  edge(prev.entryDrawer, next.entryDrawer, 'open', 'close');
  edge(!!prev.notesToc, !!next.notesToc, 'open', 'close');
}
