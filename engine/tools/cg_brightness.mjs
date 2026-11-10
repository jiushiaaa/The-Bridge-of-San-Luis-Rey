// tools/cg_brightness.mjs — 预计算各情节卡 CG 图亮度，写回 final_game.json 的 card.cgDark
// 规则：仅「明显较亮」的图用亮系样式(cgDark=false)；亮度一般或偏暗用暗系样式(cgDark=true)
// 用法: node tools/cg_brightness.mjs [xidaduo]（默认 xidaduo）
// 通过 data: URL 载入图片到 Chromium 画布采样，避免 file:// 画布被污染无法读像素
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Playwright 装在 frontend 下：从 frontend 解析，避免受运行目录影响
const require = createRequire(path.join(ROOT, 'frontend', 'package.json'));
const { chromium } = require('@playwright/test');
const PROJ = process.argv[2] || 'xidaduo';
const WS = path.join(ROOT, 'workspace', PROJ);
const JSON_PATH = path.join(WS, 'final_game.json');

// 感知亮度阈值(0-255)：≥ 该值判为「明显较亮」→ 亮系；否则暗系。
const BRIGHT_THRESHOLD = 150;

const game = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const cards = game.cards.filter((c) => c.cg);
if (cards.length === 0) {
  console.log('没有带 cg 的情节卡，跳过。');
  process.exit(0);
}

const browser = await chromium.launch();
const page = await browser.newPage();

function lumOf(dataUrl) {
  return page.evaluate(
    (url) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const w = 80;
          const h = Math.max(1, Math.round((img.height / img.width) * w));
          const cv = document.createElement('canvas');
          cv.width = w;
          cv.height = h;
          const ctx = cv.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const { data } = ctx.getImageData(0, 0, w, h);
          let sum = 0;
          let n = 0;
          for (let i = 0; i < data.length; i += 4) {
            // 感知亮度 (Rec.601)
            sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            n++;
          }
          resolve(sum / n);
        };
        img.onerror = () => reject(new Error('img load failed'));
        img.src = url;
      }),
    dataUrl,
  );
}

let changed = 0;
const rows = [];
for (const c of cards) {
  const abs = path.join(WS, c.cg.replace(/^\/+/, ''));
  if (!fs.existsSync(abs)) {
    rows.push(`${c.id}  (缺图) ${c.cg}`);
    continue;
  }
  const ext = path.extname(abs).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  const dataUrl = `data:image/${mime};base64,${fs.readFileSync(abs).toString('base64')}`;
  const lum = await lumOf(dataUrl);
  const dark = lum < BRIGHT_THRESHOLD;
  if (c.cgDark !== dark) changed++;
  c.cgDark = dark;
  rows.push(`${c.id}  lum=${lum.toFixed(1).padStart(6)}  ${dark ? '暗系' : '亮系'}`);
}

await browser.close();

rows.sort();
console.log(rows.join('\n'));
const darkN = cards.filter((c) => c.cgDark).length;
console.log(`\n阈值 ${BRIGHT_THRESHOLD}：暗系 ${darkN} / 亮系 ${cards.length - darkN}（共 ${cards.length}，更新 ${changed}）`);

fs.writeFileSync(JSON_PATH, JSON.stringify(game, null, 1));
console.log('已写回', JSON_PATH);
