// 背景音乐：与 UI 音效分轨。播放模型（doc/14-bgm-pipeline.md · doc/09 §1）：
//   歌单按关：进入某一关 → 清空歌单，只放本关开篇曲（stage=关号且无 unlockCard）并起播；
//   本关的卡曲随情节卡验证完成逐首解锁 → 入单并立刻切过去播，播放器亮起「新曲」光效；
//   往期已解锁的曲目在菜单里仍可点播 / 勾选（勾选 = 临时加入本关歌单，换关即清）。
//   封面页固定播封面曲；结局页播结局曲。
// 模式 shuffle（默认：为歌单生成一份随机序列，播完一轮再重新随机）/ loop（按表中顺序逐首循环）/ one（单曲循环）。
import { useSyncExternalStore } from 'react';
import { t } from '../i18n';
import { assetUrl, data, GAME_ID } from './data';
import { getState, pushToast, subscribeGame } from './store';
import type { BgmTrackDef, GameState } from './types';

const VOLUME = 0.48;
const FADE_MS = 1100;
const NEW_FLASH_MS = 8000; // 新曲光效时长
const PREF_KEY = `baima:bgm:${GAME_ID}`;

export type BgmMode = 'loop' | 'shuffle' | 'one';
export const BGM_MODES: BgmMode[] = ['loop', 'shuffle', 'one'];
export type BgmStage = 'title' | 'ending' | number;

export interface BgmSnap {
  mode: BgmMode;
  trackId: string | null;
  playing: boolean;
  /** 玩家在播放器上按了暂停（区别于音量关掉 / 尚未手势） */
  paused: boolean;
  enabled: boolean;
  /** 刚解锁、正在光效提示的曲目 */
  newTrackId: string | null;
  /** 玩家从本关歌单里取消勾选的曲目 */
  excluded: string[];
  /** 玩家临时勾进本关歌单的往期曲目 */
  pinned: string[];
  /** 当前所处阶段：封面 / 结局 / 关号（歌单以它为基） */
  stage: BgmStage;
}

/** 播放进度（独立于 BgmSnap 订阅，避免 timeupdate 带着整个播放器重渲染） */
export interface BgmProgress {
  time: number;
  duration: number;
}

type Pref = { mode: BgmMode };

let audio: HTMLAudioElement | null = null;
let fadeTimer: number | null = null;
let finishFade: (() => void) | null = null;
let mode: BgmMode = 'shuffle';
let excluded: string[] = [];
let pinned: string[] = [];
let trackId: string | null = null;
let playing = false;
let paused = false;
let enabled = true;
let gestureReady = false;
let stageKey = ''; // title | ending | game
let curLevel = 1;
let wantPlay = false;
let newTrackId: string | null = null;
let newTimer: number | null = null;
let applySeq = 0;
let shuffleOrder: string[] = []; // 本轮随机序列（覆盖整份歌单）

const listeners = new Set<() => void>();

function curStage(): BgmStage {
  if (stageKey === 'title') return 'title';
  if (stageKey === 'ending') return 'ending';
  return curLevel;
}

function makeSnap(): BgmSnap {
  return { mode, trackId, playing, paused, enabled, newTrackId, excluded, pinned, stage: curStage() };
}

let snapCache: BgmSnap = makeSnap();

function emit(): void {
  snapCache = makeSnap();
  listeners.forEach((l) => l());
}

function getSnap(): BgmSnap {
  return snapCache;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useBgm(): BgmSnap {
  return useSyncExternalStore(subscribe, getSnap, getSnap);
}

const progListeners = new Set<() => void>();
let progress: BgmProgress = { time: 0, duration: 0 };

function emitProgress(time: number, duration: number): void {
  progress = { time, duration: Number.isFinite(duration) ? duration : 0 };
  progListeners.forEach((l) => l());
}

function subscribeProgress(l: () => void): () => void {
  progListeners.add(l);
  return () => progListeners.delete(l);
}

export function useBgmProgress(): BgmProgress {
  return useSyncExternalStore(subscribeProgress, () => progress, () => progress);
}

export function bgmTracks(): BgmTrackDef[] {
  return data.assets.bgm ?? [];
}

export function hasBgm(): boolean {
  return bgmTracks().length > 0;
}

/** 当前阶段（封面 / 结局 / 关号），菜单按它分组 */
export function bgmStage(): BgmStage {
  return curStage();
}

function isMode(v: unknown): v is BgmMode {
  return v === 'loop' || v === 'shuffle' || v === 'one';
}

function loadPref(): void {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as Partial<Pref>;
    if (isMode(p?.mode)) mode = p.mode;
  } catch {
    /* ignore */
  }
}

function savePref(): void {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({ mode } satisfies Pref));
  } catch {
    /* ignore */
  }
}

loadPref();
snapCache = makeSnap();

function ensureAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.preload = 'auto';
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', () => emitProgress(audio!.currentTime, audio!.duration));
    audio.addEventListener('loadedmetadata', () => emitProgress(audio!.currentTime, audio!.duration));
  }
  return audio;
}

function clearFade(): void {
  if (fadeTimer != null) {
    window.clearInterval(fadeTimer);
    fadeTimer = null;
  }
  const finish = finishFade;
  finishFade = null;
  finish?.();
}

/** Normalizes measured track levels without modifying the source recording. */
function trackVolume(def: BgmTrackDef | undefined): number {
  const gain = def?.gainDb;
  return Math.max(0, Math.min(1, VOLUME * Math.pow(10, (typeof gain === 'number' && Number.isFinite(gain) ? gain : 0) / 20)));
}

function fadeIn(el: HTMLAudioElement, def: BgmTrackDef): void {
  clearFade();
  const target = trackVolume(def);
  const duration = Math.max(0, Math.min(5000, def.fadeInMs ?? 0));
  if (!duration) { el.volume = target; return; }
  el.volume = 0;
  const started = performance.now();
  fadeTimer = window.setInterval(() => {
    const p = Math.min(1, (performance.now() - started) / duration);
    el.volume = target * p;
    if (p >= 1) clearFade();
  }, 40);
}

export function bgmTrackById(id: string | null | undefined): BgmTrackDef | undefined {
  if (!id) return undefined;
  return bgmTracks().find((t) => t.id === id);
}

/** 已解锁曲目（跨关累计，菜单里可点播）：封面始终；开篇曲随到达该关解锁；卡曲须该卡验证完成（出 CG）；结局曲通关后解锁 */
export function unlockedBgmIds(s: GameState = getState()): Set<string> {
  const ids = new Set<string>();
  if (!s) return ids;
  for (const tr of bgmTracks()) {
    if (tr.stage === 'title') {
      ids.add(tr.id);
      continue;
    }
    if (tr.stage === 'ending') {
      if (s.stats.finishedAt || s.screen === 'ending') ids.add(tr.id);
      continue;
    }
    if (typeof tr.stage !== 'number') continue;
    if (tr.unlockCard) {
      if (s.cards[tr.unlockCard]?.done) ids.add(tr.id);
    } else if (s.level >= tr.stage) {
      ids.add(tr.id);
    }
  }
  return ids;
}

export function unlockedBgmTracks(s?: GameState): BgmTrackDef[] {
  const u = unlockedBgmIds(s);
  return bgmTracks().filter((t) => u.has(t.id));
}

/** 本阶段的曲目（stage === 当前关 / 封面 / 结局），表中顺序 */
export function stageBgmTracks(stage: BgmStage = curStage()): BgmTrackDef[] {
  return bgmTracks().filter((t) => t.stage === stage);
}

/** 本关开篇曲：stage=关号且无 unlockCard */
export function introTrackOf(stage: BgmStage): BgmTrackDef | undefined {
  return bgmTracks().find((t) => t.stage === stage && !t.unlockCard);
}

/** 当前歌单：本阶段已解锁曲 + 玩家临时勾进的往期曲 − 玩家取消勾选的（表中顺序） */
export function bgmPlaylistIds(s?: GameState): string[] {
  const unlocked = unlockedBgmIds(s);
  const stage = curStage();
  const base = bgmTracks()
    .filter((t) => t.stage === stage && unlocked.has(t.id))
    .map((t) => t.id);
  const pins = bgmTracks()
    .filter((t) => t.stage !== stage && pinned.includes(t.id) && unlocked.has(t.id))
    .map((t) => t.id);
  const ex = new Set(excluded);
  return [...base, ...pins].filter((id) => !ex.has(id));
}

/** 换关 / 进结局：清空歌单的临时状态（勾选与取消勾选），回到「只有本阶段曲」 */
function resetPlaylist(): void {
  excluded = [];
  pinned = [];
  shuffleOrder = [];
}

function titleTrackId(): string | null {
  return introTrackOf('title')?.id ?? stageBgmTracks('title')[0]?.id ?? null;
}

/** 进入本阶段时的起播曲：本关开篇曲 → 歌单第一首 → 任意已解锁曲 */
function entryTrackId(): string | null {
  const list = bgmPlaylistIds();
  const intro = introTrackOf(curStage());
  if (intro && list.includes(intro.id)) return intro.id;
  return list[0] ?? unlockedBgmTracks()[0]?.id ?? null;
}

function nextInPlaylist(): string | null {
  const ids = bgmPlaylistIds();
  if (!ids.length) return null;
  const i = ids.indexOf(trackId ?? '');
  if (i < 0) return ids[0];
  return ids[(i + 1) % ids.length];
}

/** 以 first 为首、其余打乱，生成覆盖整份歌单的随机序列 */
function reshuffle(first?: string | null): void {
  const ids = bgmPlaylistIds();
  const rest = ids.filter((id) => id !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  shuffleOrder = first && ids.includes(first) ? [first, ...rest] : rest;
}

function shuffleOrderStale(): boolean {
  const ids = bgmPlaylistIds();
  if (shuffleOrder.length !== ids.length) return true;
  const set = new Set(ids);
  return shuffleOrder.some((id) => !set.has(id));
}

/** 随机模式的下一首：顺着本轮序列走；一轮播完重新随机（尽量不让新一轮首曲与刚播完的相同） */
function nextShuffle(): string | null {
  const ids = bgmPlaylistIds();
  if (!ids.length) return null;
  if (shuffleOrderStale()) reshuffle(trackId);
  const i = shuffleOrder.indexOf(trackId ?? '');
  if (i >= 0 && i < shuffleOrder.length - 1) return shuffleOrder[i + 1];
  reshuffle();
  if (shuffleOrder.length > 1 && shuffleOrder[0] === trackId) {
    const last = shuffleOrder.length - 1;
    [shuffleOrder[0], shuffleOrder[last]] = [shuffleOrder[last], shuffleOrder[0]];
  }
  return shuffleOrder[0] ?? null;
}

function nextTrackId(): string | null {
  if (mode === 'one') return trackId ?? nextInPlaylist();
  if (mode === 'shuffle') return nextShuffle();
  return nextInPlaylist();
}

function shouldLoop(): boolean {
  if (stageKey === 'title') return true;
  if (mode === 'one') return true;
  return bgmPlaylistIds().length <= 1;
}

/** 此刻应当播的曲：封面页固定封面曲；否则续播当前曲（仍在歌单），不然从本关开篇曲起播 */
function resolveDesiredId(): string | null {
  if (stageKey === 'title') return titleTrackId() ?? entryTrackId();
  if (trackId && bgmPlaylistIds().includes(trackId)) return trackId;
  return entryTrackId();
}

function canPlayNow(): boolean {
  return enabled && wantPlay && !paused && gestureReady;
}

async function applyTrack(nextId: string | null, { soft }: { soft?: boolean } = {}): Promise<void> {
  const seq = ++applySeq;
  if (!nextId) {
    await fadeOutAndPause();
    if (seq !== applySeq) return;
    trackId = null;
    playing = false;
    emitProgress(0, 0);
    emit();
    return;
  }
  const def = bgmTrackById(nextId);
  if (!def) return;

  const el = ensureAudio();
  const same = trackId === nextId && !!el.src && !el.ended;
  if (same) {
    el.loop = shouldLoop();
    if (canPlayNow()) {
      // A quick re-enable/reselection cancels the pending fade-out. Otherwise
      // its timer can pause the newly requested playback a second later.
      if (finishFade) {
        clearFade();
        el.volume = trackVolume(def);
      }
      if (el.paused) {
        try {
          if (def.fadeInMs) el.volume = 0;
          await el.play();
          if (seq !== applySeq) return;
          fadeIn(el, def);
          playing = true;
        } catch {
          playing = false;
        }
      }
    } else if (!el.paused) {
      clearFade();
      el.pause();
      playing = false;
    }
    emit();
    return;
  }

  if (soft && !el.paused) {
    await fadeOutAndPause();
    if (seq !== applySeq) return;
  } else {
    clearFade();
    el.pause();
  }

  trackId = nextId;
  el.loop = shouldLoop();
  el.src = assetUrl(def.file);
  el.volume = trackVolume(def);
  playing = false;
  emitProgress(0, 0);
  emit();

  if (!canPlayNow()) return;
  try {
    if (def.fadeInMs) el.volume = 0;
    await el.play();
    if (seq !== applySeq) return;
    fadeIn(el, def);
    playing = true;
  } catch {
    playing = false;
  }
  emit();
}

function fadeOutAndPause(): Promise<void> {
  return new Promise((resolve) => {
    const el = audio;
    if (!el || el.paused) {
      clearFade();
      resolve();
      return;
    }
    clearFade();
    finishFade = resolve;
    const start = el.volume;
    const t0 = performance.now();
    fadeTimer = window.setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / FADE_MS);
      el.volume = Math.max(0, start * (1 - p));
      if (p >= 1) {
        clearFade();
        el.pause();
        el.volume = trackVolume(bgmTrackById(trackId));
        playing = false;
        emit();
        resolve();
      }
    }, 40);
  });
}

function onEnded(): void {
  // loop 属性为真（单曲循环 / 封面页 / 歌单只剩一首）时不会触发 ended；到这里是自然切曲
  void applyTrack(nextTrackId(), { soft: false });
}

function refresh(): void {
  void applyTrack(resolveDesiredId(), { soft: true });
}

/** 场景变化：封面 / 游戏中（含换关）/ 结局。
 *  封面固定封面曲；进入某一关（含从封面进来、过关、DEBUG 跳关）→ 清空歌单只留本关曲并播开篇曲；结局播结局曲；其余情况续播 */
export function syncBgmStage(ctx: { showTitle: boolean; screen: GameState['screen']; level: number }): void {
  if (!hasBgm()) return;
  const prevKey = stageKey;
  const prevLevel = curLevel;
  let key = 'game';
  if (ctx.showTitle) key = 'title';
  else if (ctx.screen === 'ending') key = 'ending';
  stageKey = key;
  curLevel = ctx.level;
  wantPlay = true;
  if (key === 'title') {
    void applyTrack(titleTrackId() ?? entryTrackId(), { soft: true });
    return;
  }
  const stageChanged = prevKey !== key || (key === 'game' && prevLevel !== curLevel);
  if (stageChanged || !trackId) {
    resetPlaylist();
    const id = entryTrackId();
    if (mode === 'shuffle') reshuffle(id);
    // 拿到本关开篇曲 = 获得一首 BGM：与卡曲一样亮起光效
    if (stageChanged && id && introTrackOf(curStage())?.id === id) markNew(id);
    void applyTrack(id, { soft: true });
    return;
  }
  if (!playing) refresh();
}

function markNew(id: string): void {
  if (newTimer != null) window.clearTimeout(newTimer);
  newTrackId = id;
  newTimer = window.setTimeout(clearNew, NEW_FLASH_MS);
  emit();
}

export function setBgmMode(next: BgmMode): void {
  if (!hasBgm()) return;
  mode = next;
  savePref();
  if (mode === 'shuffle') reshuffle(trackId); // 新一轮从当前曲开始
  if (audio) audio.loop = shouldLoop();
  emit();
}

/** 勾选 / 取消勾选歌单里的曲目。本阶段曲：取消 = excluded；往期曲：勾选 = pinned（换关即清）。
 *  歌单至少保留一首；取消正在播的那首 → 立刻切到下一首 */
export function setBgmTrackSelected(id: string, on: boolean): void {
  if (!hasBgm()) return;
  const def = bgmTrackById(id);
  if (!def || !unlockedBgmIds().has(id)) return;
  const inList = bgmPlaylistIds();
  const isStageTrack = def.stage === curStage();
  if (on) {
    if (inList.includes(id)) return;
    if (isStageTrack) excluded = excluded.filter((x) => x !== id);
    else if (!pinned.includes(id)) pinned = [...pinned, id];
  } else {
    if (!inList.includes(id)) return;
    if (inList.length <= 1) return;
    if (isStageTrack) excluded = [...excluded, id];
    else pinned = pinned.filter((x) => x !== id);
  }
  if (audio) audio.loop = shouldLoop();
  emit();
  if (!on && trackId === id && stageKey !== 'title') {
    void applyTrack(nextTrackId(), { soft: true });
  }
}

/** 玩家点某一曲：立刻切过去播（保持当前模式），若不在歌单里则顺手勾上 */
export function playBgmTrack(id: string): void {
  if (!hasBgm() || !unlockedBgmIds().has(id)) return;
  paused = false;
  wantPlay = true;
  if (!bgmPlaylistIds().includes(id)) setBgmTrackSelected(id, true);
  if (mode === 'shuffle') reshuffle(id);
  if (newTrackId === id) clearNew();
  void applyTrack(id, { soft: true });
}

/** 播放器上的播放 / 暂停 */
export function toggleBgm(): void {
  if (!hasBgm()) return;
  if (playing) {
    paused = true;
    clearFade();
    audio?.pause();
    playing = false;
    emit();
    return;
  }
  paused = false;
  wantPlay = true;
  refresh();
  emit();
}

export function setBgmEnabled(on: boolean): void {
  enabled = on;
  if (!on) {
    void fadeOutAndPause();
  } else if (wantPlay) {
    refresh();
  }
  emit();
}

/** 与 SFX 共用首次手势；之后才能真正 play */
export function unlockBgmGesture(): void {
  if (gestureReady) return;
  gestureReady = true;
  if (wantPlay && enabled && !paused) refresh();
}

export function stopBgm(): void {
  wantPlay = false;
  void fadeOutAndPause();
  trackId = null;
  emit();
}

/** DEBUG 换过某曲的音频文件后：若正在播它，重新装载新文件（带版本号绕过缓存） */
export function reloadBgmFile(id: string): void {
  const def = bgmTrackById(id);
  if (!def || trackId !== id || !audio) return;
  const seq = ++applySeq;
  const el = audio;
  const wasPlaying = !el.paused;
  clearFade();
  el.pause();
  el.src = assetUrl(def.file);
  el.volume = trackVolume(def);
  el.loop = shouldLoop();
  playing = false;
  emitProgress(0, 0);
  emit();
  if (wasPlaying && canPlayNow()) {
    if (def.fadeInMs) el.volume = 0;
    void el
      .play()
      .then(() => {
        if (seq !== applySeq) return;
        fadeIn(el, def);
        playing = true;
        emit();
      })
      .catch(() => {
        playing = false;
        emit();
      });
  }
}

function clearNew(): void {
  if (newTimer != null) {
    window.clearTimeout(newTimer);
    newTimer = null;
  }
  if (newTrackId) {
    newTrackId = null;
    emit();
  }
}

/** 玩家打开播放器菜单等交互后即可停止光效 */
export function ackNewBgm(): void {
  clearNew();
}

/** 对照存档：新解锁的曲 toast；属于本关的 → 入单 + 切过去播 + 播放器光效 */
let seenUnlocks: Set<string> | null = null;

function watchUnlocks(): void {
  const s = getState();
  if (!s) return;
  const after = unlockedBgmIds(s);
  if (!seenUnlocks) {
    seenUnlocks = new Set(after);
    return;
  }
  const fresh = bgmTracks().filter((tr) => !seenUnlocks!.has(tr.id) && after.has(tr.id));
  seenUnlocks = new Set(after);
  if (!fresh.length) return;
  for (const tr of fresh) {
    pushToast(t('toast.bgmUnlock', { title: tr.title }));
  }
  // 只有本关的新曲才入单即播（回补往期卡解锁的曲只 toast，菜单里可手动点播）
  const mine = fresh.filter((tr) => tr.stage === curStage());
  if (!mine.length || stageKey === 'title') return;
  const mineIds = new Set(mine.map((tr) => tr.id));
  if (excluded.some((id) => mineIds.has(id))) excluded = excluded.filter((id) => !mineIds.has(id));
  const pick = mine[mine.length - 1];
  markNew(pick.id);
  if (mode === 'shuffle') reshuffle(pick.id);
  // 玩家手动暂停时只把当前曲换成新曲、不强行起播（applyTrack 内部按 canPlayNow 判定）
  void applyTrack(pick.id, { soft: true });
}

subscribeGame(watchUnlocks);
