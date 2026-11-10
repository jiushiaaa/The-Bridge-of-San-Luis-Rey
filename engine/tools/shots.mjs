// tools/shots.mjs — 巡屏截图：从标题页一路点到游戏主界面，逐屏拍照
// 用法: node tools/shots.mjs [xdd|bad|murder|weicheng]（默认 xdd）
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'frontend', 'package.json'));
const { chromium } = require('@playwright/test');

const GAMES = { xdd: 'xidaduo', bad: 'badblood', murder: 'murder', weicheng: 'WeiCheng_QianZhongShu' };
const GAME = GAMES[process.argv[2]] ? process.argv[2] : 'xdd';
const OUT = path.join(ROOT, 'workspace', GAMES[GAME], 'DEBUG', 'shots');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:5174';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

let n = 0;
const shot = async (name) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${String(++n).padStart(2, '0')}_${name}.png`) });
  console.log('shot', n, name);
};
const clickBtn = async (re) => {
  const b = page.getByRole('button', { name: re }).first();
  await b.click({ timeout: 3000 });
  await page.waitForTimeout(220);
};

await page.goto(BASE + `/?debug=1&game=${GAME}`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await shot('01-title');

// 开始游戏 → 序章（逐条）
await clickBtn(/新的开始|开始游戏/);
for (let i = 0; i < 8; i++) {
  const last = await page.getByRole('button', { name: /收下残稿/ }).count();
  if (last) break;
  await clickBtn(/继续/);
  if (i === 3) await shot('02-opening-mid');
}
await shot('03-opening-last');
await clickBtn(/收下残稿/);
await shot('04-guide');
// 玩法说明：翻页浏览
for (let i = 0; i < 6; i++) {
  const next = page.getByRole('button', { name: /下一页|下页|继续/ }).first();
  if (await next.count()) await next.click().catch(() => {});
  await page.waitForTimeout(150);
}
await shot('05-guide-last');
// 关闭玩法说明
const closeG = page.getByRole('button', { name: /开始修复|关闭|知道了|进入/ }).first();
if (await closeG.count()) await closeG.click();
await shot('06-intro1');
// 过场
for (let i = 0; i < 6; i++) {
  const btn = page.getByRole('button', { name: /继续|进入第一卷|翻开残稿|开始/ }).first();
  if (await btn.count()) await btn.click().catch(() => {});
  await page.waitForTimeout(200);
}
await shot('07-game-tutorial');
// 跳过教学（如果有）
const skip = page.getByRole('button', { name: /跳过/ }).first();
if (await skip.count()) { await skip.click(); await page.waitForTimeout(200); }
await shot('08-game-main');

console.log('console errors:', errors.length ? errors : '无');
await browser.close();
