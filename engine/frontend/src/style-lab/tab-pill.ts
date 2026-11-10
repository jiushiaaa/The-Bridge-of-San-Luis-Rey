/** 页签滑动色块：跟着当前选中项平移。生产默认开启；实验室仅 v6；对照 v5 关掉。 */

const PILL = 'gsl-tab-pill';
const READY = 'is-ready';
const HAS = 'has-pill';
let started = false;

function gameWantsPill(): boolean {
  return document.documentElement.getAttribute('data-gsl') !== 'v5';
}

function labWantsPill(): boolean {
  const lab = document.querySelector('.style-lab');
  return !!lab && lab.getAttribute('data-variant') === 'v6';
}

function syncNav(nav: HTMLElement): void {
  const active = nav.querySelector('.tab.active, .sl-tab.is-active') as HTMLElement | null;
  if (!active) return;
  let pill = nav.querySelector(`.${PILL}`) as HTMLElement | null;
  if (!pill) {
    pill = document.createElement('span');
    pill.className = PILL;
    pill.setAttribute('aria-hidden', 'true');
    nav.insertBefore(pill, nav.firstChild);
  }
  nav.classList.add(HAS);
  const nr = nav.getBoundingClientRect();
  const ar = active.getBoundingClientRect();
  pill.style.width = `${ar.width}px`;
  pill.style.height = `${ar.height}px`;
  pill.style.transform = `translate(${ar.left - nr.left}px, ${ar.top - nr.top}px)`;
  requestAnimationFrame(() => pill?.classList.add(READY));
}

function tick(): void {
  if (gameWantsPill()) {
    document.querySelectorAll<HTMLElement>('.tabs').forEach(syncNav);
  } else {
    document.querySelectorAll('.tabs.has-pill, .tabs .gsl-tab-pill').forEach((el) => {
      if (el.classList.contains(PILL)) el.remove();
      else el.classList.remove(HAS);
    });
  }
  if (labWantsPill()) {
    document.querySelectorAll<HTMLElement>('.sl-tabs').forEach(syncNav);
  } else {
    document.querySelectorAll('.sl-tabs').forEach((nav) => {
      nav.querySelectorAll(`.${PILL}`).forEach((el) => el.remove());
      nav.classList.remove(HAS);
    });
  }
}

export function startTabPill(): void {
  if (started) return;
  started = true;
  let raf = 0;
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      tick();
    });
  };

  tick();
  window.addEventListener('resize', schedule);
  const mo = new MutationObserver(schedule);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-gsl'] });
  mo.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'data-variant'],
  });
}
