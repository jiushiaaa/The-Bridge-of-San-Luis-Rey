import type { Locale } from './locale';
import { getLocale } from './locale';
import de from './ui/de.json';
import en from './ui/en.json';
import es from './ui/es.json';
import fr from './ui/fr.json';
import hi from './ui/hi.json';
import ja from './ui/ja.json';
import ko from './ui/ko.json';
import zhCN from './ui/zh-CN.json';
import zhTW from './ui/zh-TW.json';

type Dict = Record<string, unknown>;

const TABLES: Record<Locale, Dict> = {
  'zh-CN': zhCN as Dict,
  de: de as Dict,
  en: en as Dict,
  es: es as Dict,
  fr: fr as Dict,
  ja: ja as Dict,
  ko: ko as Dict,
  hi: hi as Dict,
  'zh-TW': zhTW as Dict,
};

function lookup(table: Dict, key: string): string | undefined {
  const parts = key.split('.');
  let cur: unknown = table;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Dict)[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

/** `t('toast.entryIn', { name })`：花括号插值；缺键回退简体，再缺则回退 key 本身 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const loc = getLocale();
  let s = lookup(TABLES[loc], key) ?? lookup(TABLES['zh-CN'], key) ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
        s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}
