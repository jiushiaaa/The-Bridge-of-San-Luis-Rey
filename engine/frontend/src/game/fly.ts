/** 收集飞行光点：从来源矩形柔和地直线飞到目标元素，到达后目标泛起一圈蓝色脉冲。
 *  目标不存在或不在视口内（如词条卡滚出列表）时改用兜底目标。
 *  用 WAAPI 直接操作 DOM，不进 React 状态，避免高频渲染。 */
export function flyDotTo(targetSel: string, from: DOMRect, fallbackSel?: string): void {
  if (typeof document === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // 延迟一帧再解析目标：首次收集时，词条卡要等本次点击触发的 React 重渲染后才存在于 DOM
  requestAnimationFrame(() => {
    let to = document.querySelector(targetSel);
    if (to) {
      const r = to.getBoundingClientRect();
      if (r.bottom < 0 || r.right < 0 || r.top > window.innerHeight || r.left > window.innerWidth) to = null;
    }
    if (!to && fallbackSel) to = document.querySelector(fallbackSel);
    if (!to) return;
    const r = to.getBoundingClientRect();
    const x0 = from.left + from.width / 2;
    const y0 = from.top + from.height / 2;
    const x1 = r.left + r.width / 2;
    const y1 = r.top + r.height / 2;
    const el = document.createElement('div');
    el.className = 'fly-dot';
    document.body.appendChild(el);
    // 直线缓动滑行：起步柔、匀速飘、着陆轻收
    const anim = el.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) translate(-50%, -50%) scale(1)`, opacity: 0.95, offset: 0 },
        { transform: `translate(${x1}px, ${y1}px) translate(-50%, -50%) scale(0.5)`, opacity: 0.9, offset: 1 },
      ],
      { duration: 700, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    );
    anim.onfinish = () => {
      el.remove();
      to.classList.add('fly-arrive');
      setTimeout(() => to.classList.remove('fly-arrive'), 720);
    };
  });
}
