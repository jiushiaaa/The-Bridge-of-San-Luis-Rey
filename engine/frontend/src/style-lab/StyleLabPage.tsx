import { useEffect, useMemo, useState } from 'react';
import SampleGameUI from './SampleGameUI';
import {
  FRAMES,
  VARIANTS,
  type FrameId,
  type SceneId,
  type VariantId,
} from './fixtures/sample-states';
import IntroProto from './intro/IntroProto';
import { INTRO_VARIANTS, VOLUMES, type IntroVariantId } from './intro/fixtures';

const SCENES: { id: SceneId; label: string }[] = [
  { id: 'title', label: '标题页' },
  { id: 'game', label: '主界面' },
  { id: 'overlay', label: '弹窗 + Toast' },
  { id: 'intro', label: '开场过场' },
];

function readParam(key: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(key);
  } catch {
    return null;
  }
}

function writeParams(variant: VariantId, scene: SceneId, frame: FrameId) {
  const url = new URL(window.location.href);
  url.searchParams.set('v', variant);
  url.searchParams.set('s', scene);
  url.searchParams.set('f', frame);
  history.replaceState(null, '', url);
}

export default function StyleLabPage() {
  const initial = useMemo(() => {
    const v = readParam('v');
    const s = readParam('s');
    const f = readParam('f');
    return {
      variant: VARIANTS.some((x) => x.id === v) ? (v as VariantId) : 'v5',
      scene: SCENES.some((x) => x.id === s) ? (s as SceneId) : 'game',
      frame: FRAMES.some((x) => x.id === f) ? (f as FrameId) : 'fluid',
    };
  }, []);

  const [variant, setVariant] = useState<VariantId>(initial.variant);
  const [scene, setScene] = useState<SceneId>(initial.scene);
  const [frame, setFrame] = useState<FrameId>(initial.frame);
  const [intro, setIntro] = useState<IntroVariantId>('a');
  const [vol, setVol] = useState(0);
  const [dialogue, setDialogue] = useState(false);
  const onIntro = scene === 'intro';

  useEffect(() => {
    writeParams(variant, scene, frame);
  }, [variant, scene, frame]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === '5') setVariant('v5');
      if (e.key === '6') setVariant('v6');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const meta = VARIANTS.find((x) => x.id === variant)!;
  const frameW = FRAMES.find((x) => x.id === frame)!.width;

  return (
    <div className="style-lab" data-variant={variant} data-scene={scene}>
      <div className="sl-toolbar">
        <div className="sl-toolbar-brand">
          <strong>UI 风格实验室</strong>
          <span>不写入存档 · 不进入生产包</span>
        </div>
        <div className="sl-toolbar-pills" role="group" aria-label="风格组合">
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={variant === v.id ? 'is-on' : ''}
              aria-pressed={variant === v.id}
              title={v.styles}
              onClick={() => setVariant(v.id)}
            >
              {v.short}
            </button>
          ))}
        </div>
        <div className="sl-toolbar-pills" role="group" aria-label="代表性界面">
          {SCENES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={scene === s.id ? 'is-on' : ''}
              aria-pressed={scene === s.id}
              onClick={() => setScene(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="sl-toolbar-pills" role="group" aria-label="视口">
          {FRAMES.map((f) => (
            <button
              key={f.id}
              type="button"
              className={frame === f.id ? 'is-on' : ''}
              aria-pressed={frame === f.id}
              onClick={() => setFrame(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {onIntro ? (
          <>
            <div className="sl-toolbar-pills" role="group" aria-label="过场方案">
              {INTRO_VARIANTS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={intro === v.id ? 'is-on' : ''}
                  aria-pressed={intro === v.id}
                  title={v.metaphor}
                  onClick={() => setIntro(v.id)}
                >
                  {v.short}
                </button>
              ))}
            </div>
            <div className="sl-toolbar-pills" role="group" aria-label="卷与段落类型">
              {VOLUMES.map((v, i) => (
                <button
                  key={v.level}
                  type="button"
                  className={!dialogue && vol === i ? 'is-on' : ''}
                  aria-pressed={!dialogue && vol === i}
                  onClick={() => {
                    setVol(i);
                    setDialogue(false);
                  }}
                >
                  第{v.level}卷
                </button>
              ))}
              <button
                type="button"
                className={dialogue ? 'is-on' : ''}
                aria-pressed={dialogue}
                title="别的作品的过场里有对白段，检验这一版式排不排得下"
                onClick={() => setDialogue((v) => !v)}
              >
                对白样本
              </button>
            </div>
          </>
        ) : null}
        <p className="sl-toolbar-note">
          {onIntro
            ? `${INTRO_VARIANTS.find((v) => v.id === intro)!.metaphor} · 点画面或按空格推进`
            : `${meta.metaphor} · 快捷键 1–6 切换组合`}
        </p>
      </div>
      <div className="sl-stage" data-frame={frame} style={{ width: frameW }}>
        {onIntro ? (
          <IntroProto variant={intro} volume={vol} dialogue={dialogue} />
        ) : (
          <SampleGameUI scene={scene} />
        )}
      </div>
    </div>
  );
}
