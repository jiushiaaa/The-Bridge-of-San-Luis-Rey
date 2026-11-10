// 关卡过场：整幅插画不被遮挡，一次只留一句，文字逐字上墨
// 旧版是全屏居中一块白面板、点一下往下堆一行，读到最后插画只剩边角；卷名还会在横幅、
// 面板首行各出现一次。这里改成：首段（卷名）单独做题名幕，正文单句压在画面上，点一下推进，
// 打字未完时点击＝立刻显全。
import { useEffect, useRef, useState } from 'react';
import { isLatinLocale, t, useLocale } from '../i18n';
import { assetUrl, data, introPageCount, isChapterTitle, levelQuestion, plainText } from '../game/data';
import { advanceIntro } from '../game/logic';
import { useGame } from '../game/store';
import type { FrameSeg } from '../game/types';
import { CopyEditButton } from '../components/copyedit/common';

/** 逐字上墨的速度（毫秒/字）；西语字母信息密度低，按中文的 3 倍速 */
const TYPE_MS_CJK = 15;
const TYPE_MS_LATIN = 5;

function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = (): void => setReduce(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduce;
}

/** 首段是不是卷名（「第一卷 · 弃家求道」这种）。不是的话就不另做题名幕，照常当正文排 */
function titleSegOf(segs: FrameSeg[]): string | null {
  const first = segs[0];
  if (!first || first.kind !== 'narration') return null;
  const text = plainText(first.text);
  return isChapterTitle(text) ? text : null;
}

export default function LevelIntro({ level, replaying }: { level: number; replaying: boolean }) {
  const s = useGame();
  const loc = useLocale();
  const reduce = useReducedMotion();
  const segs = data.frame.levelIntro[String(level)] || [];
  const title = titleSegOf(segs);
  // 末尾多一屏「问句幕」：本卷之问单独亮出来（README_game §4.5），页数由 introPageCount 统一算
  const question = levelQuestion(level);
  const pages = introPageCount(level);
  const idx = Math.min(s.introIdx, Math.max(pages - 1, 0));
  const onTitle = !!title && idx === 0;
  const onQuestion = !!question && idx === segs.length;
  const seg: FrameSeg | undefined = onTitle || onQuestion ? undefined : segs[idx];
  const bg = assetUrl(data.assets.levelIntroImages?.[String(level)] || data.assets.titleImage);

  const [typed, setTyped] = useState(0);
  const typing = !!seg && !reduce;
  const full = !typing || typed >= seg!.text.length;

  useEffect(() => {
    if (!typing || !seg) return;
    setTyped(0);
    const id = window.setInterval(() => {
      setTyped((v) => {
        if (v >= seg.text.length) {
          window.clearInterval(id);
          return v;
        }
        return v + 1;
      });
    }, isLatinLocale(loc) || loc === 'hi' ? TYPE_MS_LATIN : TYPE_MS_CJK);
    return () => window.clearInterval(id);
  }, [typing, seg, loc]);

  const advance = (): void => {
    if (typing && !full) {
      setTyped(seg!.text.length);
      return;
    }
    advanceIntro();
  };
  // advance 会随 typed 变，键盘监听每次渲染重挂，拿到的始终是最新的那一份
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      // 有输入焦点或弹层（DEBUG-文案 编辑器）时不抢按键
      if (e.target !== document.body) return;
      if (document.querySelector('.modal, .ce-modal')) return;
      e.preventDefault();
      advanceRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const last = idx >= pages - 1;
  const shown = typing ? seg!.text.slice(0, typed) : (seg?.text ?? '');
  const btnLabel = onTitle ? t('intro.open') : last ? (replaying ? t('intro.back') : t('intro.enter')) : t('intro.continue');

  return (
    <div className={`lv-intro${reduce ? ' is-reduced' : ''}`} onClick={advance}>
      {/* 竖屏才显示：同一张图放大模糊铺满整屏，给上方那条清晰画带兜底。
          竖屏放不下整幅插画，画带以外若留纯黑会像半截截图 */}
      <img
        className="lv-intro-haze"
        src={bg}
        alt=""
        aria-hidden="true"
        onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
      />
      <img
        className="lv-intro-bg"
        src={bg}
        alt=""
        onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
      />
      <div className="lv-intro-scrim" aria-hidden="true" />

      {onTitle ? (
        <div className="lv-intro-title">
          <i className="lv-intro-rule" aria-hidden="true" />
          <h2>{title}</h2>
          <i className="lv-intro-rule" aria-hidden="true" />
        </div>
      ) : onQuestion ? (
        <div className="lv-intro-title lv-intro-question" data-intro-question>
          <i className="lv-intro-rule" aria-hidden="true" />
          <span className="lv-intro-kicker">{t('intro.questionKicker', { n: level })}</span>
          <h2>{question}</h2>
          <i className="lv-intro-rule" aria-hidden="true" />
        </div>
      ) : (
        <p className="lv-intro-line" key={idx}>
          {seg?.kind === 'dialogue' ? <span className="lv-intro-speaker">{seg.speaker}</span> : null}
          {shown}
          {!full ? <i className="lv-intro-nib" aria-hidden="true" /> : null}
        </p>
      )}

      <div className="lv-intro-dots" aria-hidden="true">
        {Array.from({ length: pages }, (_, i) => (
          <i key={i} className={`lv-intro-dot${i === idx ? ' on' : ''}${i < idx ? ' past' : ''}`} />
        ))}
      </div>

      <div className="lv-intro-foot" onClick={(e) => e.stopPropagation()}>
        <CopyEditButton conf={{ kind: 'frame', target: 'intro', level }} />
        <button className="lv-intro-btn" type="button" onClick={advance}>
          {btnLabel}
          <i className="lv-intro-caret" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
