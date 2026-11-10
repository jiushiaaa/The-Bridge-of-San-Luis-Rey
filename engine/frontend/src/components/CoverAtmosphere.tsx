// 封面大气层：Three.js——河面水波 + 加强阳光光柱 + 树冠落叶
// 失败 / prefers-reduced-motion 时由外层静态 <img> 兜底
import { useEffect, useRef } from 'react';
import {
  CanvasTexture,
  Clock,
  Color,
  DoubleSide,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  WebGLRenderer,
} from 'three';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uMap;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uImageSize;
uniform vec2 uSun;
uniform float uBreath;
uniform float uBridge;

varying vec2 vUv;

vec2 coverUV(vec2 uv) {
  float sa = uResolution.x / max(uResolution.y, 1.0);
  float ia = uImageSize.x / max(uImageSize.y, 1.0);
  vec2 scale = vec2(1.0);
  if (sa > ia) scale.y = ia / sa;
  else scale.x = sa / ia;
  return (uv - 0.5) * scale + 0.5;
}

float waterMask(vec2 uv) {
  // The bridge scene's river is below the crossing, not on the central bridge deck.
  if (uBridge > 0.5) return 1.0 - smoothstep(0.20, 0.32, uv.y);
  float band = smoothstep(0.34, 0.40, uv.y) * (1.0 - smoothstep(0.52, 0.58, uv.y));
  float figure = smoothstep(0.50, 0.66, uv.x) * (1.0 - smoothstep(0.42, 0.54, uv.y));
  float titleCorner = (1.0 - smoothstep(0.0, 0.42, uv.x)) * (1.0 - smoothstep(0.0, 0.38, uv.y));
  return band * (1.0 - figure) * (1.0 - 0.85 * titleCorner);
}

float figureMask(vec2 uv) {
  return smoothstep(0.50, 0.66, uv.x) * (1.0 - smoothstep(0.42, 0.54, uv.y));
}

void main() {
  vec2 uv = coverUV(vUv);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.06, 0.05, 0.04, 1.0);
    return;
  }

  float w = waterMask(uv);
  float fg = figureMask(uv);
  float t = uTime;

  vec2 ripple = vec2(
    sin(uv.y * 36.0 + t * 1.1) * 0.0009 + sin(uv.x * 22.0 - t * 0.7) * 0.0006,
    cos(uv.x * 30.0 + t * 0.9) * 0.0007 + cos(uv.y * 18.0 + t * 0.55) * 0.0005
  );
  vec2 sampleUv = uv + ripple * w;
  vec3 col = texture2D(uMap, clamp(sampleUv, 0.0, 1.0)).rgb;

  float caustic =
    sin((uv.x * 24.0 + uv.y * 12.0) + t * 0.9) *
    sin((uv.x * 10.0 - uv.y * 18.0) - t * 0.7);
  caustic = caustic * 0.5 + 0.5;
  col += vec3(1.0, 0.92, 0.72) * pow(caustic, 3.0) * 0.04 * w;

  vec2 toSun = uv - uSun;
  float dist = length(toSun);

  float below = smoothstep(0.02, -0.02, toSun.y);
  float column = exp(-toSun.x * toSun.x * 120.0);
  float path = column * below * w;
  float shimmer = 0.5 + 0.5 * sin(uv.y * 90.0 - t * 3.2 + uv.x * 28.0);

  // 阳光忽明忽暗：慢呼吸 + 稍快一层，峰值时很明显
  float pulse = 0.5 + 0.5 * sin(t * 1.15);
  pulse = 0.42 + 0.58 * pulse * pulse;
  pulse *= mix(1.0, 0.24, uBridge);
  float pulse2 = 0.65 + 0.35 * sin(t * 0.55 + 0.8);

  col += vec3(1.0, 0.95, 0.78) * path * (0.14 + 0.1 * shimmer) * pulse;

  float rays = 0.0;
  float ang = atan(toSun.y, toSun.x);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float spoke = pow(max(0.0, cos(ang * (6.0 + fi * 0.4) + t * (0.12 + fi * 0.02))), 3.5 + fi * 0.28);
    rays += spoke * exp(-dist * (1.9 + fi * 0.26));
  }
  rays /= 6.0;
  float sky = smoothstep(0.48, 0.60, uv.y) * (1.0 - fg);
  float softRay = pow(max(0.0, 1.0 - dist * 1.4), 2.4) * (0.5 + 0.5 * sin(ang * 2.5 + t * 0.15));
  col += vec3(1.0, 0.9, 0.62) * rays * 0.28 * sky * pulse;
  col += vec3(1.0, 0.88, 0.55) * softRay * 0.14 * sky * pulse2;

  float sunGlow = exp(-dist * dist * 48.0);
  float sunHalo = exp(-dist * dist * 14.0);
  col += vec3(1.0, 0.9, 0.55) * sunGlow * 0.28 * (1.0 - fg) * pulse;
  col += vec3(1.0, 0.85, 0.5) * sunHalo * 0.12 * sky * pulse2;

  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    vec2 c = vec2(
      fract(0.2 + fi * 0.11 + sin(t * 0.06 + fi * 1.3) * 0.04),
      fract(0.52 + fi * 0.07 + cos(t * 0.08 + fi * 0.9) * 0.05)
    );
    float d = length((vUv - c) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0));
    float mote = exp(-d * d * (9000.0 + fi * 800.0)) * sky;
    col += vec3(1.0, 0.95, 0.8) * mote * (0.04 + 0.05 * pulse) * (0.7 + 0.3 * sin(t * 1.4 + fi));
  }

  col *= 1.0 + 0.04 * pulse * (1.0 - fg) * sky;
  gl_FragColor = vec4(col, 1.0);
}
`;

const LEAF_COUNT = 29; // 约原密度 70%

type Leaf = {
  x: number;
  y: number;
  rot: number;
  spin: number;
  fall: number;
  sway: number;
  swayAmp: number;
  scale: number;
  drift: number;
};

function makeLeafTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.translate(32, 34);
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.bezierCurveTo(18, -14, 16, 10, 0, 26);
  ctx.bezierCurveTo(-16, 10, -18, -14, 0, -26);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -26, 0, 26);
  g.addColorStop(0, 'rgba(72, 92, 42, 0.82)');
  g.addColorStop(0.45, 'rgba(52, 72, 30, 0.8)');
  g.addColorStop(1, 'rgba(88, 64, 28, 0.78)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(36, 42, 18, 0.4)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(0, 22);
  ctx.stroke();
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function resetLeaf(L: Leaf, fromTop: boolean): void {
  // 从右上树冠一带飘出（正交相机 -1..1）；尺寸要够大才看得见
  L.x = 0.05 + Math.random() * 1.05;
  L.y = fromTop ? 0.7 + Math.random() * 0.55 : -0.15 + Math.random() * 1.35;
  L.rot = Math.random() * Math.PI * 2;
  L.spin = (Math.random() - 0.5) * 0.9;
  L.fall = 0.048 + Math.random() * 0.064; // 约原速 40%
  L.sway = Math.random() * Math.PI * 2;
  L.swayAmp = 0.08 + Math.random() * 0.1;
  L.scale = 0.03 + Math.random() * 0.03; // 约原尺寸 30%
  L.drift = -0.016 - Math.random() * 0.024;
}

export default function CoverAtmosphere({
  src,
  onReady,
  variant = 'river',
}: {
  src: string;
  onReady?: () => void;
  variant?: 'river' | 'bridge';
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let disposed = false;
    let raf = 0;
    let renderer: WebGLRenderer | null = null;
    let material: ShaderMaterial | null = null;
    let geometry: PlaneGeometry | null = null;
    let texture: Texture | null = null;
    let mesh: Mesh | null = null;
    let leafMesh: InstancedMesh | null = null;
    let leafGeo: PlaneGeometry | null = null;
    let leafMat: MeshBasicMaterial | null = null;
    let leafTex: CanvasTexture | null = null;
    let ro: ResizeObserver | null = null;
    const clock = new Clock();
    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 10);
    const dummy = new Object3D();
    const leaves: Leaf[] = Array.from({ length: LEAF_COUNT }, () => {
      const L = {} as Leaf;
      resetLeaf(L, false);
      return L;
    });

    const onVis = () => {
      if (!document.hidden) clock.start();
    };

    const loader = new TextureLoader();
    loader.load(
      src,
      (tex) => {
        if (disposed) {
          tex.dispose();
          return;
        }
        texture = tex;
        texture.colorSpace = SRGBColorSpace;
        const img = texture.image as { width: number; height: number };

        try {
          renderer = new WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
          });
        } catch {
          texture.dispose();
          texture = null;
          return;
        }

        const canvas = renderer.domElement;
        canvas.className = 'cover-fx-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        host.appendChild(canvas);

        geometry = new PlaneGeometry(2, 2);
        material = new ShaderMaterial({
          uniforms: {
            uMap: { value: texture },
            uTime: { value: 0 },
            uResolution: { value: new Vector2(1, 1) },
            uImageSize: { value: new Vector2(img.width || 1, img.height || 1) },
            uSun: { value: variant === 'bridge' ? new Vector2(0.73, 0.89) : new Vector2(0.49, 0.55) },
            uBreath: { value: 0 },
            uBridge: { value: variant === 'bridge' ? 1 : 0 },
          },
          vertexShader: VERT,
          fragmentShader: FRAG,
          depthTest: false,
          depthWrite: false,
        });
        mesh = new Mesh(geometry, material);
        mesh.position.z = -1;
        mesh.renderOrder = 0;
        scene.add(mesh);

        // —— 落叶：从右上树冠飘向河面（相机朝 -Z，叶子放在负 z 才看得见）——
        leafTex = makeLeafTexture();
        leafGeo = new PlaneGeometry(1, 1.35);
        leafMat = new MeshBasicMaterial({
          map: leafTex,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          side: DoubleSide,
          opacity: 0.78,
          toneMapped: false,
        });
        leafMesh = new InstancedMesh(leafGeo, leafMat, LEAF_COUNT);
        // The new painting has no right-hand canopy; retain the upstream leaves only for its river cover.
        leafMesh.visible = variant !== 'bridge';
        leafMesh.frustumCulled = false;
        leafMesh.renderOrder = 1;
        for (let i = 0; i < LEAF_COUNT; i++) {
          const warm = Math.random();
          leafMesh.setColorAt(
            i,
            new Color().setRGB(0.55 + warm * 0.12, 0.58 - warm * 0.08, 0.32 + warm * 0.08),
          );
          const L = leaves[i];
          dummy.position.set(L.x, L.y, -0.5);
          dummy.rotation.set(0, 0, L.rot);
          dummy.scale.set(L.scale, L.scale, 1);
          dummy.updateMatrix();
          leafMesh.setMatrixAt(i, dummy.matrix);
        }
        if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
        leafMesh.instanceMatrix.needsUpdate = true;
        scene.add(leafMesh);

        const resize = () => {
          if (!renderer || !material || !host) return;
          const w = host.clientWidth || window.innerWidth;
          const h = host.clientHeight || window.innerHeight;
          const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
          renderer.setPixelRatio(dpr);
          renderer.setSize(w, h, false);
          material.uniforms.uResolution.value.set(w, h);
        };
        resize();
        ro = new ResizeObserver(resize);
        ro.observe(host);
        document.addEventListener('visibilitychange', onVis);

        const tick = () => {
          if (disposed) return;
          raf = requestAnimationFrame(tick);
          if (document.hidden || !renderer || !material || !leafMesh) return;
          const dt = Math.min(clock.getDelta(), 0.05);
          const t = clock.elapsedTime;
          material.uniforms.uTime.value = t;
          material.uniforms.uBreath.value = 0.5 + 0.5 * Math.sin(t * 0.35);

          for (let i = 0; i < LEAF_COUNT; i++) {
            const L = leaves[i];
            L.sway += dt * 1.4;
            L.rot += L.spin * dt;
            L.y -= L.fall * dt;
            L.x += (L.drift + Math.sin(L.sway) * L.swayAmp * 0.35) * dt;
            if (L.y < -1.15 || L.x < -1.2) resetLeaf(L, true);

            const sx = L.scale * (0.9 + 0.1 * Math.sin(L.sway));
            dummy.position.set(L.x + Math.sin(L.sway) * L.swayAmp, L.y, -0.5);
            dummy.rotation.set(Math.sin(L.sway * 0.7) * 0.55, 0, L.rot + Math.cos(L.sway) * 0.4);
            dummy.scale.set(sx, sx, 1);
            dummy.updateMatrix();
            leafMesh.setMatrixAt(i, dummy.matrix);
          }
          leafMesh.instanceMatrix.needsUpdate = true;
          renderer.render(scene, camera);
        };

        tick();
        onReadyRef.current?.();
      },
      undefined,
      () => {
        /* 贴图失败：静默回退静态图 */
      },
    );

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      ro?.disconnect();
      if (mesh) scene.remove(mesh);
      if (leafMesh) scene.remove(leafMesh);
      material?.dispose();
      geometry?.dispose();
      texture?.dispose();
      leafGeo?.dispose();
      leafMat?.dispose();
      leafTex?.dispose();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
  }, [src, variant]);

  return <div className="cover-fx" ref={hostRef} aria-hidden="true" />;
}
