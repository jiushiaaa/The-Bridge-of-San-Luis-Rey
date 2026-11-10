// 开场过场的四个候选方案原型（实验室专用，不进生产、不写存档）
// 四案共用同一套推进引擎，只在「版式 + 显影方式」上分岔：
//   a 影院字卡：整段淡入上浮，一次只留一句      b 对开书页：整页替换，翻页
//   c 竖排经卷：新列自右展开，读过的列留在纸上   d 残稿显影：逐字上墨，点一下显全
import { useEffect, useRef, useState } from 'react';
import { DIALOGUE_SAMPLE, VOLUMES, type IntroVariantId, type Seg } from './fixtures';

const CN_NUM = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
/** 页码用汉字数字（超过十就退回阿拉伯数字，过场不会有那么多段） */
function cn(n: number): string {
  if (n <= 10) return CN_NUM[n];
  if (n < 20) return '十' + CN_NUM[n - 10];
  return String(n);
}

function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduce;
}

export default function IntroProto({
  variant,
  volume,
  dialogue,
}: {
  variant: IntroVariantId;
  /** 第几卷（0 基） */
  volume: number;
  /** 用混合对白样本替换正文，检验对白段的排版 */
  dialogue: boolean;
}) {
  const vol = VOLUMES[volume];
  const segs: Seg[] = dialogue ? DIALOGUE_SAMPLE : vol.segs;
  const total = segs.length;
  const reduce = useReducedMotion();

  // step: -1 = 题名幕；0..total-1 = 正文段；total = 已进入本卷（实验室里显示重播）
  const [step, setStep] = useState(-1);
  const [typed, setTyped] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStep(-1);
    setTyped(0);
  }, [variant, volume, dialogue]);

  const cur = step >= 0 && step < total ? segs[step] : null;
  const typing = variant === 'd' && !reduce && !!cur;
  const full = !typing || typed >= (cur?.text.length ?? 0);

  // 逐字上墨：换段时从 0 开始推进
  useEffect(() => {
    if (!typing || !cur) return;
    setTyped(0);
    const id = window.setInterval(() => {
      setTyped((v) => {
        if (v >= cur.text.length) {
          window.clearInterval(id);
          return v;
        }
        return v + 1;
      });
    }, 16);
    return () => window.clearInterval(id);
  }, [typing, cur]);

  const advance = () => {
    if (typing && !full) {
      setTyped(cur!.text.length); // 打字中点一下 = 立刻显全，别逼人等
      return;
    }
    setStep((v) => Math.min(v + 1, total));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      if (document.activeElement?.closest('.sl-toolbar')) return;
      e.preventDefault();
      advance();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const done = step >= total;
  const last = step === total - 1;
  const atTitle = step < 0;
  const shownText = typing ? cur!.text.slice(0, typed) : (cur?.text ?? '');
  const btnLabel = atTitle ? '翻开本卷' : last ? '进入本卷' : '继续';

  const foot = (
    <div className="ip-foot">
      <span className="ip-progress" aria-hidden="true">
        {atTitle ? '' : `${cn(step + 1)} / ${cn(total)}`}
      </span>
      <button className="ip-btn" type="button" onClick={(e) => { e.stopPropagation(); advance(); }}>
        {btnLabel}
        <i className="ip-caret-down" aria-hidden="true" />
      </button>
    </div>
  );

  const dots = (
    <div className="ip-dots" aria-hidden="true">
      {segs.map((_, i) => (
        <i key={i} className={`ip-dot${i === step ? ' on' : ''}${i < step ? ' past' : ''}`} />
      ))}
    </div>
  );

  const speaker = cur?.kind === 'dialogue' ? <span className="ip-speaker">{cur.speaker}</span> : null;

  return (
    <div
      className={`intro-proto${reduce ? ' is-reduced' : ''}`}
      data-intro={variant}
      data-step={atTitle ? 'title' : done ? 'done' : 'body'}
      ref={rootRef}
      onClick={advance}
      role="button"
      tabIndex={0}
      aria-label="点击继续"
    >
      {/* ---- A 影院字卡 ---- */}
      {variant === 'a' ? (
        <>
          <img className="ip-bg" src={vol.image} alt="" />
          <div className="ip-vignette" aria-hidden="true" />
          {atTitle ? (
            <div className="ip-titlecard">
              <i className="ip-rule" />
              <h2>{vol.title}</h2>
              <i className="ip-rule" />
            </div>
          ) : done ? (
            <div className="ip-done">已进入本卷 · 点击重播</div>
          ) : (
            <p className="ip-line" key={step}>
              {speaker}
              {shownText}
            </p>
          )}
          {dots}
          {foot}
        </>
      ) : null}

      {/* ---- B 对开书页 ---- */}
      {variant === 'b' ? (
        <div className="ip-book">
          <div className="ip-page ip-left">
            <div className="ip-plate">
              <img src={vol.image} alt="" />
            </div>
            <span className="ip-plate-cap">{vol.title}</span>
          </div>
          <div className="ip-gutter" aria-hidden="true" />
          <div className="ip-page ip-right">
            {atTitle ? (
              <div className="ip-halftitle">
                <span className="ip-halftitle-kicker">悉达多</span>
                <h2>{vol.title}</h2>
                <i className="ip-rule" />
              </div>
            ) : done ? (
              <div className="ip-done">已进入本卷 · 点击重播</div>
            ) : (
              <p className="ip-para" key={step}>
                {speaker}
                {shownText}
              </p>
            )}
            <div className="ip-folio">{atTitle ? '扉' : `${cn(step + 1)} / ${cn(total)}`}</div>
          </div>
          {foot}
        </div>
      ) : null}

      {/* ---- C 竖排经卷 ---- */}
      {variant === 'c' ? (
        <>
          <img className="ip-bg" src={vol.image} alt="" />
          <div className="ip-vignette" aria-hidden="true" />
          <div className="ip-scroll">
            <div className="ip-cols">
              <div className="ip-coltitle">
                <span className="ip-seal">卷{cn(vol.level)}</span>
                <h2>{vol.title.replace(/^第.卷 · /, '')}</h2>
              </div>
              {segs.slice(0, step + 1).map((s, i) => (
                <p className={`ip-col${i === step ? ' on' : ''}`} key={i}>
                  {s.kind === 'dialogue' ? <span className="ip-speaker">{s.speaker}</span> : null}
                  {s.text}
                </p>
              ))}
            </div>
          </div>
          {foot}
        </>
      ) : null}

      {/* ---- D 残稿显影 ---- */}
      {variant === 'd' ? (
        <>
          <img className="ip-bg" src={vol.image} alt="" />
          <div className="ip-vignette" aria-hidden="true" />
          <div className="ip-sheet">
            <div className="ip-sheet-head">
              <span className="ip-stamp">残稿</span>
              <span className="ip-sheet-title">{vol.title}</span>
              <span className="ip-sheet-no">{atTitle ? '' : `${cn(step + 1)} / ${cn(total)}`}</span>
            </div>
            {atTitle ? (
              <div className="ip-sheet-open">
                <h2>{vol.title}</h2>
                <p>这一卷的残稿刚刚拾到手上，墨还没干。</p>
              </div>
            ) : done ? (
              <div className="ip-done">已进入本卷 · 点击重播</div>
            ) : (
              <p className="ip-ink" key={step}>
                {speaker}
                {shownText}
                {!full ? <i className="ip-nib" aria-hidden="true" /> : null}
              </p>
            )}
            <div className="ip-inkbar" aria-hidden="true">
              <i style={{ width: `${((step + 1) / total) * 100}%` }} />
            </div>
            {/* 按钮跟着纸走：纸只占中间一条，放到外面就会是深字压深图 */}
            {foot}
          </div>
        </>
      ) : null}
    </div>
  );
}
