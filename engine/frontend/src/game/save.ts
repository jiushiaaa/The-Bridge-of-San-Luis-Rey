// localStorage 存档读写：键按游戏分（xdd_save_v1 / bad_save_v1），校验 storyId 与 version
import { data } from './data';
import type { GameState } from './types';

const KEY = `${data.meta.id}_save_v1`;

export function saveGame(s: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // 存储不可用时静默失败（不影响游玩）
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (s.storyId !== data.meta.id || s.version !== data.meta.version) return null;
    if (!s.cards || !s.entries || !s.stats || !s.flags) return null;
    s.rowHints ??= {}; // 旧存档兼容：时间行提示字段后加
    s.typeHints ??= {}; // 旧存档兼容：词条分类总数提示字段后加
    s.flags.coachSeen ??= {}; // 旧存档兼容：新手引导标记后加（老玩家会补看一轮气泡）
    s.difficulty ??= 'easy'; // 旧存档兼容：难度字段后加，默认简单
    for (const pl of Object.values(s.stats.perLevel ?? {})) pl.rests ??= 0; // 旧存档兼容：休整改为按关计
    return s;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return loadGame() !== null;
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 同上
  }
}
