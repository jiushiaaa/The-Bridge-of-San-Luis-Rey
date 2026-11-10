// 窄屏 / 竖版自适应断点：侧栏压缩、关卡出口折叠、词条库抽屉、phone 壳层
// 断点值在 styles.css / theme-portrait.css 的 @media 里也有一份，改动必须同步
// 见 doc/09-ui-conventions.md
import { useEffect, useSyncExternalStore } from 'react';

export const BP_MID = 1280;
export const BP_NARROW = 1100;
/** 宽度低于此值一律走竖版壳层 */
export const BP_PHONE = 768;
/** 竖屏且宽度低于此值也走竖版（平板竖持） */
export const BP_PHONE_PORTRAIT = 960;
/** 横持且高度低于此值时提示竖持 */
export const BP_LANDSCAPE_HINT = 500;

/** wide：全展开｜mid：关卡出口默认折叠｜narrow：再把词条库收进页签栏｜phone：竖版壳层 */
export type Layout = 'wide' | 'mid' | 'narrow' | 'phone';

const midQuery = `(max-width: ${BP_MID - 1}px)`;
const narrowQuery = `(max-width: ${BP_NARROW - 1}px)`;
const phoneQuery = `(max-width: ${BP_PHONE - 1}px), (orientation: portrait) and (max-width: ${BP_PHONE_PORTRAIT - 1}px)`;
const landscapeHintQuery = `(orientation: landscape) and (max-height: ${BP_LANDSCAPE_HINT - 1}px)`;

function applyAttr(layout: Layout): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.layout = layout;
}

function read(): Layout {
  if (typeof window === 'undefined' || !window.matchMedia) return 'wide';
  if (window.matchMedia(phoneQuery).matches) return 'phone';
  if (window.matchMedia(narrowQuery).matches) return 'narrow';
  if (window.matchMedia(midQuery).matches) return 'mid';
  return 'wide';
}

function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mls = [
    window.matchMedia(phoneQuery),
    window.matchMedia(narrowQuery),
    window.matchMedia(midQuery),
  ];
  const onChange = (): void => {
    applyAttr(read());
    cb();
  };
  mls.forEach((ml) => ml.addEventListener('change', onChange));
  return () => mls.forEach((ml) => ml.removeEventListener('change', onChange));
}

if (typeof document !== 'undefined') applyAttr(read());

export function isPhone(): boolean {
  return read() === 'phone';
}

/** 打开竖版详情 / 抽屉时压一条历史，硬件返回可关层 */
export function pushMobileLayer(): void {
  if (typeof history === 'undefined' || !isPhone()) return;
  try {
    history.pushState({ gameLayer: 1 }, '');
  } catch {
    // ignore
  }
}

export function useLayout(): Layout {
  return useSyncExternalStore(subscribe, read, () => 'wide' as Layout);
}

function readHint(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(landscapeHintQuery).matches;
}

function subscribeHint(cb: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const ml = window.matchMedia(landscapeHintQuery);
  ml.addEventListener('change', cb);
  return () => ml.removeEventListener('change', cb);
}

export function useLandscapeHint(): boolean {
  return useSyncExternalStore(subscribeHint, readHint, () => false);
}

/** 把当前 layout 同步到 html[data-layout]，竖版 CSS 靠这个钩子 */
export function useSyncLayoutAttr(): Layout {
  const layout = useLayout();
  useEffect(() => {
    applyAttr(layout);
  }, [layout]);
  return layout;
}
