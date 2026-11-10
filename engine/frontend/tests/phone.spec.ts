// 竖版冒烟：390×844 触控视口，以悉达多为验收样本
import { expect, test, type Page } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

async function freshXdd(page: Page) {
  await page.goto('/?game=xdd&debug=1&lang=zh-CN');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => {
    const g = (window as any).__game;
    g.newGame();
    const s = g.getState();
    s.flags.introSeen = { '1': true, '2': true, '3': true };
    s.flags.coachSeen = g.allCoachSeen();
    s.introLevel = null;
    s.screen = 'game';
    g.setState(s);
  });
  await page.reload();
  await page.getByRole('button', { name: /继续游戏/ }).click();
}

test('竖版悉达多：标题页可见且无 console 报错', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?game=xdd&lang=zh-CN');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-layout', 'phone');
  await expect(page.getByRole('heading', { name: '悉达多' })).toBeVisible();
  await expect(page.getByRole('button', { name: /新的开始/ })).toBeVisible();
  await page.waitForTimeout(400);
  expect(errors).toEqual([]);
});

test('竖版悉达多：底栏四页签、打开一张卡、时间轴可见', async ({ page }) => {
  await freshXdd(page);
  await expect(page.locator('html')).toHaveAttribute('data-layout', 'phone');
  await expect(page.locator('.tabs-bottom')).toBeVisible();
  await expect(page.locator('.tabs-bottom .tab[data-tab="notes"]')).toBeVisible();
  await expect(page.locator('.tabs-bottom .tab[data-tab="cards"]')).toBeVisible();
  await expect(page.locator('.tabs-bottom .tab[data-tab="archive"]')).toBeVisible();
  await expect(page.locator('.tabs-bottom .tab[data-tab="timeline"]')).toBeVisible();
  await expect(page.locator('.phone-hud')).toBeVisible();

  await page.locator('.tabs-bottom .tab[data-tab="cards"]').click();
  await expect(page.locator('.card-item').first()).toBeVisible();
  await page.locator('.card-item').first().click();
  await expect(page.locator('.chat-wrap, .chat-empty').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '卡片列表' })).toBeVisible();

  await page.locator('.tabs-bottom .tab[data-tab="timeline"]').click({ force: true });
  await expect(page.locator('.tl-layout')).toBeVisible();
  await expect(page.locator('.tl-grid')).toBeVisible();
  // 表头吸附靠表格自己滚动，行头必须留在视口内
  const headLeft = await page.locator('.tl-grid th.row-head').first().boundingBox();
  expect(headLeft!.x).toBeGreaterThanOrEqual(0);
});

test('竖版悉达多：过场正文与继续按钮都在屏内', async ({ page }) => {
  await page.goto('/?game=xdd&debug=1&lang=zh-CN');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: /新的开始/ }).click();
  await expect(page.locator('.lv-intro')).toBeVisible();
  const btn = page.locator('.lv-intro-btn');
  await expect(btn).toBeVisible();
  const box = await btn.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  // 题名幕之后是正文：整段应落在按钮之上，不越界
  await btn.click();
  const line = page.locator('.lv-intro-line');
  await expect(line).toBeVisible();
  const lineBox = await line.boundingBox();
  const btnBox = await btn.boundingBox();
  expect(lineBox!.y + lineBox!.height).toBeLessThanOrEqual(btnBox!.y + 1);
});
