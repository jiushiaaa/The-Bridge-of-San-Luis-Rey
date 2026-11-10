import { useEffect, useState } from 'react';
import { VARIANTS, type VariantId } from './fixtures/sample-states';

export type LabId = 'off' | VariantId;
const KEY = 'style-lab-variant';
const ALLOWED = new Set<string>(['off', ...VARIANTS.map((v) => v.id)]);

const CHIPS: { id: LabId; label: string; title: string }[] = [
  { id: 'off', label: '生产', title: '当前生产：冷纸刊（v6 已合并）' },
  ...VARIANTS.map((v) => ({
    id: v.id,
    label: v.short,
    title: v.styles,
  })),
];

function apply(id: LabId) {
  const html = document.documentElement;
  if (id === 'off') html.removeAttribute('data-gsl');
  else html.setAttribute('data-gsl', id);
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}

function readSaved(): LabId {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'v6') return 'off';
    if (v && ALLOWED.has(v)) return v as LabId;
    if (v === 'v1' || v === 'v2' || v === 'v3' || v === 'v4') return 'v5';
  } catch {
    /* ignore */
  }
  return 'off';
}

export default function GameStyleSwitcher() {
  const [id, setId] = useState<LabId>(readSaved);

  useEffect(() => {
    apply(id);
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      if (e.key === '0') setId('off');
      if (e.key === '5') setId('v5');
      if (e.key === '6') setId('v6');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const current = CHIPS.find((c) => c.id === id) ?? CHIPS[0];

  return (
    <div className="gsl-bar" role="region" aria-label="UI 风格切换">
      <strong className="gsl-label">切风格</strong>
      <div className="gsl-chips">
        {CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={id === c.id ? 'is-on' : ''}
            title={c.title}
            aria-pressed={id === c.id}
            onClick={() => setId(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <span className="gsl-hint">{current.title} · 按 0 生产 / 5 对照 / 6 实验</span>
    </div>
  );
}
