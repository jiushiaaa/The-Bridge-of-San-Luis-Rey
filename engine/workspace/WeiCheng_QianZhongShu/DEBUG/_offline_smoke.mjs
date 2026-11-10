// 离线单文件版冒烟：file:// 打开 index.html，验证标题、无 console 错误、素材可载
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(HERE, '..', '..', '..', 'frontend', 'package.json'));
const { chromium } = require('@playwright/test');
const FILE = path.join(HERE, '..', 'index.html');

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('file://' + FILE.replace(/\\/g, '/'));
await page.waitForTimeout(1500);
const title = await page.locator('h1, .title, [class*=title]').first().textContent().catch(() => '(no h1)');
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 200));
// 验证一张头像图能加载
const imgOk = await page.evaluate(() => {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(true);
    im.onerror = () => res(false);
    im.src = 'wc-assets/avatars/e_fanghongjian.jpg';
    setTimeout(() => res(false), 5000);
  });
});
console.log('标题相关文本:', JSON.stringify(bodyText.slice(0, 80)));
console.log('头像图加载:', imgOk ? 'OK' : 'FAIL');
console.log('console 错误数:', errors.length, errors.slice(0, 5));
await browser.close();
