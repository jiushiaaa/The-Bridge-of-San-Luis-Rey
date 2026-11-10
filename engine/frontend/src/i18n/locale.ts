// 语言检测 / 切换 / 持久化。叙事 JSON 的热替换由 data.ts 订阅。
import { useSyncExternalStore } from 'react';

export const LOCALES = ['zh-CN', 'de', 'en', 'es', 'fr', 'ja', 'ko', 'hi', 'zh-TW'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABEL: Record<Locale, string> = {
  'zh-CN': '简体中文',
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  ja: '日本語',
  ko: '한국어',
  hi: 'हिन्दी',
  'zh-TW': '繁體中文',
};

let storageKey = 'xdd_locale';
let available: readonly Locale[] = LOCALES;

const HTML_LANG: Record<Locale, string> = {
  'zh-CN': 'zh-CN',
  de: 'de',
  en: 'en',
  es: 'es',
  fr: 'fr',
  ja: 'ja',
  ko: 'ko',
  hi: 'hi',
  'zh-TW': 'zh-TW',
};

function isLocale(v: string | null | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

function enabled(v: string | null | undefined): v is Locale {
  return isLocale(v) && available.includes(v);
}

function fromNavigator(): Locale | null {
  if (typeof navigator === 'undefined') return null;
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const raw of langs) {
    const tag = (raw || '').toLowerCase();
    if ((tag.startsWith('zh-tw') || tag.startsWith('zh-hant') || tag === 'zh-hk' || tag === 'zh-mo') && enabled('zh-TW')) return 'zh-TW';
    if (tag.startsWith('zh') && enabled('zh-CN')) return 'zh-CN';
    for (const id of ['de', 'ja', 'ko', 'hi', 'es', 'fr', 'en'] as const) {
      if (tag.startsWith(id) && enabled(id)) return id;
    }
  }
  return null;
}

function detectLocale(): Locale {
  if (typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (enabled(q)) return q;
    try {
      const stored = localStorage.getItem(storageKey);
      if (enabled(stored)) return stored;
    } catch {
      /* private mode */
    }
    return fromNavigator() ?? 'zh-CN';
  }
  return 'zh-CN';
}

let current: Locale = detectLocale();
const listeners = new Set<(loc: Locale) => void>();

/** Called by the selected book before its first narrative parse. Keep upstream
 * nine-language support, but expose only this book's ready language packs. */
export function configureLocales(locales: readonly Locale[], key: string): void {
  available = locales;
  storageKey = key;
  current = detectLocale();
  applyHtmlLang(current);
}

export function getLocale(): Locale {
  return current;
}

/** 拉丁文界面：词条单列、标题下行、打字机更快。印地语排版同此，但不改字距 */
export function isLatinLocale(loc: Locale = current): boolean {
  return loc === 'de' || loc === 'en' || loc === 'es' || loc === 'fr';
}

/** 标题需独占第二行、词条单列（拉丁文 + 印地语） */
export function isWideLocale(loc: Locale = current): boolean {
  return isLatinLocale(loc) || loc === 'hi';
}

export function htmlLang(loc: Locale = current): string {
  return HTML_LANG[loc];
}

export function applyHtmlLang(loc: Locale = current): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = HTML_LANG[loc];
  document.documentElement.setAttribute('data-locale', loc);
}

export function subscribeLocale(fn: (loc: Locale) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** 切换语言：写 localStorage、改 html lang、通知订阅者（data.ts 换叙事包、UI 重渲染） */
export function setLocale(next: Locale): void {
  if (!available.includes(next) || next === current) return;
  current = next;
  try {
    localStorage.setItem(storageKey, next);
  } catch {
    /* ignore */
  }
  applyHtmlLang(next);
  listeners.forEach((fn) => fn(next));
}

applyHtmlLang(current);

/** 组件内订阅语言，切换时整树随 App 的 useLocale 重渲染 */
export function useLocale(): Locale {
  return useSyncExternalStore(
    (cb) => subscribeLocale(() => cb()),
    getLocale,
    getLocale,
  );
}
