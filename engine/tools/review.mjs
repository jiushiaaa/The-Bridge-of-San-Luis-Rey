// tools/review.mjs — 迭代自查：抓取指定界面状态
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'frontend', 'package.json'));
const { chromium } = require('@playwright/test');

// 用法: node tools/review.mjs [xdd|bad|murder|weicheng]（默认 xdd）
const GAMES = { xdd: 'xidaduo', bad: 'badblood', murder: 'murder', weicheng: 'WeiCheng_QianZhongShu' };
const GAME = GAMES[process.argv[2]] ? process.argv[2] : 'xdd';
const OUT = path.join(ROOT, 'workspace', GAMES[GAME], 'DEBUG', 'review');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const sleep = (ms) => page.waitForTimeout(ms);
let n = 0;
const shot = async (name) => {
  await sleep(350);
  await page.screenshot({ path: path.join(OUT, `${String(++n).padStart(2, '0')}_${name}.png`) });
  console.log('shot', n, name);
};

await page.goto('http://localhost:5174/?debug=1&game=' + GAME);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.evaluate(() => {
  const g = window.__game;
  g.newGame();
  const s = g.getState();
  Object.assign(s.flags, { openingDone: true, guideSeen: true, tutorialDone: true, introSeen: { '1': true, '2': true, '3': true } });
  s.screen = 'game';
  g.setState(s);
});
await page.reload();
await page.getByRole('button', { name: /继续游戏/ }).click();
await sleep(300);

// 1. 时间轴（散落态，检查居中）
await page.getByRole('button', { name: /解锁本关全卡/ }).click();
await page.getByRole('button', { name: /^时间轴/ }).click();
await shot('timeline-centered');

// 2. 填空候选抽屉
await page.getByRole('button', { name: /^情节卡/ }).click();
await page.locator('[data-card-item="c1_01"]').click();
await sleep(400);
await page.locator('.blank-area [data-slot="NPC1"]').click();
await shot('picker-open');
await page.keyboard.press('Escape');

// 3. 教学聚光（手动开 tutorialStep）
await page.evaluate(() => {
  const g = window.__game;
  const s = g.getState();
  s.flags.tutorialDone = false;
  s.flags.tutorialStep = 2;
  g.setState(s);
});
await shot('tutorial-ring');
await page.evaluate(() => {
  const g = window.__game;
  const s = g.getState();
  s.flags.tutorialDone = true;
  g.setState(s);
});

// 4. 第三关时间轴（10 行检查）
await page.getByRole('button', { name: /直达结局前态/ }).click();
await page.getByRole('button', { name: /^时间轴/ }).click();
await shot('l3-timeline-full');

// 5. 词条库全收集滚动区
await shot('l3-entries');

// 6. 分析读条
await page.evaluate(() => {
  const g = window.__game;
  const s = g.getState();
  // 找一个可分析的词条强制满熟悉度
  const id = 'e_supu';
  s.entries[id] = s.entries[id] || { collected: true, familiarity: 0, famCards: [], pagesUnlocked: [], pageFields: {}, pagesDone: [] };
  s.entries[id].collected = true;
  s.entries[id].familiarity = 99;
  s.level = 1;
  g.setState(s);
});
await sleep(300);
const anaBtn = page.locator('[data-analyze="e_supu"]');
if (await anaBtn.count()) {
  await anaBtn.click();
  await sleep(900);
  await shot('analyzing');
  await sleep(1800);
  await shot('analyze-done-archive');
}

await browser.close();
