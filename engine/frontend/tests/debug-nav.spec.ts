import { expect, test, type Page } from '@playwright/test';

async function enterGame(page: Page) {
  await page.goto('/?game=xdd&lang=zh-CN');
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
  await expect(page.locator('.tabs-tools')).toBeVisible();
}

test('DEBUG 弹窗：去掉右上关闭，作品设置可返回总览', async ({ page }) => {
  await enterGame(page);
  await page.getByRole('button', { name: '菜单' }).click();
  await page.getByRole('button', { name: /DEBUG-进度/ }).click();

  const hub = page.locator('.dbg-modal');
  await expect(hub).toBeVisible();
  await expect(hub.locator('.modal-head').getByRole('button', { name: '关闭' })).toHaveCount(0);
  await expect(hub.locator('.modal-foot').getByRole('button', { name: '关闭' })).toHaveCount(1);

  const works = page.getByRole('button', { name: /作品设置/ });
  await expect(works).toBeVisible({ timeout: 4000 });
  await works.click();

  const editor = page.locator('.ce-modal');
  await expect(editor).toBeVisible();
  await expect(hub).toHaveCount(0);
  await expect(editor.locator('.modal-head').getByRole('button', { name: '关闭' })).toHaveCount(0);
  await expect(editor.locator('.modal-head').getByRole('button', { name: '返回' })).toHaveCount(1);
  await expect(editor.locator('.modal-foot').getByRole('button', { name: '关闭' })).toHaveCount(1);

  await editor.locator('.modal-head').getByRole('button', { name: '返回' }).click();
  await expect(page.locator('.dbg-modal')).toBeVisible();
  await expect(page.locator('.ce-modal')).toHaveCount(0);

  await page.getByRole('button', { name: /关卡管理/ }).click();
  await expect(page.locator('.ce-modal .modal-title')).toContainText('关卡管理');
  await page.locator('.ce-modal').getByRole('button', { name: /行/ }).first().click();
  await expect(page.locator('.ce-modal .modal-title')).toContainText('时间轴');
  await page.locator('.ce-modal .modal-head').getByRole('button', { name: '返回' }).click();
  await expect(page.locator('.ce-modal .modal-title')).toContainText('关卡管理');
  await page.locator('.ce-modal .modal-head').getByRole('button', { name: '返回' }).click();
  await expect(page.locator('.dbg-modal')).toBeVisible();

  await page.locator('.dbg-modal .modal-foot').getByRole('button', { name: '关闭' }).click();
  await page.locator('.tab', { hasText: '时间轴' }).click();
  const inGame = page.getByRole('button', { name: 'DEBUG-时间轴' });
  await expect(inGame).toBeVisible();
  await inGame.click();
  await expect(page.locator('.ce-modal')).toBeVisible();
  await expect(page.locator('.ce-modal .modal-head').getByRole('button', { name: '返回' })).toHaveCount(0);
  await expect(page.locator('.ce-modal .modal-foot').getByRole('button', { name: '关闭' })).toHaveCount(1);
});
