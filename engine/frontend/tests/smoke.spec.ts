// 冒烟测试：启动无报错、关键界面可打开、按钮与重要文本可见、弹层可关
import { expect, test, type Page } from '@playwright/test';

// debug 注入直达游戏主界面（跳过过场与标题）
async function freshGame(page: Page) {
  await page.goto('/?debug=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => {
    const g = (window as any).__game;
    g.newGame();
    const s = g.getState();
    s.flags.introSeen = { '1': true, '2': true, '3': true };
    s.flags.coachSeen = g.allCoachSeen(); // 新手引导气泡会挤动版面，除非用例本身要测它
    s.introLevel = null;
    s.screen = 'game';
    g.setState(s);
  });
  await page.reload();
  await page.getByRole('button', { name: /继续游戏/ }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('启动：标题页可见且无 console 报错', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await expect(page.getByRole('heading', { name: '悉达多' })).toBeVisible();
  await expect(page.getByRole('button', { name: /新的开始/ })).toBeVisible();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('开局流程：新的开始→第一卷过场→主界面（无片头/自动玩法说明）', async ({ page }) => {
  await page.getByRole('button', { name: /新的开始/ }).click();
  // 直接进入第一卷过场（残卷片头已删除）
  await expect(page.getByText('第一卷 · 弃家求道')).toBeVisible();
  // 过场段数由文案决定（数据驱动）：一路点到出现「进入本卷」为止。
  // 按钮文案随段落变（翻开本卷／继续／进入本卷），且逐字未打完时点击只是显全，故一段最多点两下
  const enter = page.getByRole('button', { name: /进入本卷/ });
  const next = page.locator('.lv-intro-btn');
  for (let i = 0; i < 40 && !(await enter.count()); i++) {
    await next.click();
    await page.waitForTimeout(60);
  }
  // 末屏是「问句幕」：本卷之问单独一屏（数据里有 gates[].question 才有）
  await expect(page.locator('[data-intro-question]')).toBeVisible();
  await expect(page.locator('[data-intro-question] h2')).toContainText('？');
  for (let i = 0; i < 3 && (await page.locator('.lv-intro').count()); i++) {
    await enter.click();
    await page.waitForTimeout(120);
  }
  // 进入本卷落到情节卡页签（玩家刚被交给一个问题，手边就该是可读的残页）
  await expect(page.locator('.tabs-brand')).toBeVisible();
  await expect(page.locator('.modal')).toHaveCount(0);
  await expect(page.locator('.tab.active[data-tab="cards"]')).toBeVisible();
  await expect(page.locator('.pane-right').getByText('词条库')).toBeVisible();
  // 新手引导蒙版会挡住页签点击：先点掉「目标」弹窗与两步页签介绍
  for (let i = 0; i < 8; i++) {
    const btn = page.locator('[data-coach-root] .coach-ok, [data-coach-root] .coach-modal-ok');
    if ((await btn.count()) === 0) break;
    await btn.first().click();
    await page.waitForTimeout(60);
  }
  await expect(page.locator('.tab', { hasText: '故事' })).toBeVisible();
  await expect(page.locator('.tab', { hasText: '时间轴' })).toBeVisible();
  await expect(page.locator('.tab', { hasText: '档案' })).toBeVisible();
  await expect(page.locator('.pane-right').getByText('词条库')).toBeVisible();
  // 开局赠送词条在库（侨文达本关仍有可搜寻的卡）
  await expect(page.locator('.entry-name', { hasText: '侨文达' })).toBeVisible();
  await expect(page.locator('[data-search="e_qiaowenda"]')).toBeVisible();
});

test('多游戏：?game=xdd 加载悉达多标题页且无报错', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?game=xdd&lang=zh-CN');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('heading', { name: '悉达多' })).toBeVisible();
  await expect(page.getByRole('button', { name: /新的开始/ })).toBeVisible();
  await expect(page.locator('.cover-lang')).toContainText('简体中文');
  await page.locator('.cover-lang').click();
  await expect(page.locator('.cover-lang-modal')).toBeVisible();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('.cover-lang')).toContainText('English');
  await expect(page.getByRole('heading', { name: 'Siddhartha' })).toBeVisible();
  await expect(page.locator('.cover-lang-modal')).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('多游戏：?game=murder 加载一桩事先张扬的凶杀案标题页且无报错', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?game=murder');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('heading', { name: '一桩事先张扬的凶杀案' })).toBeVisible();
  await expect(page.getByRole('button', { name: /新的开始/ })).toBeVisible();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('多游戏：?game=weicheng 加载围城标题页且无报错', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?game=weicheng');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('heading', { name: '围城' })).toBeVisible();
  await expect(page.getByRole('button', { name: /新的开始/ })).toBeVisible();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('常驻提示：可打开、永不为空、可关闭', async ({ page }) => {
  await freshGame(page);
  // 词条行上也有同名的「提示」小按钮，这里要的是页签栏工具区那一个
  await page.locator('.tool-btn[aria-label="提示"]').click();
  await expect(page.getByText('下一步做什么')).toBeVisible();
  const hintItems = page.locator('.hint-modal-body .hint-row');
  expect(await hintItems.count()).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal')).toHaveCount(0);
});

test('搜寻规则：一次只解锁一张新卡，按钮显示剩余数', async ({ page }) => {
  await freshGame(page);
  // 开局已解锁 startUnlocked 的卡；侨文达搜寻有剩余
  await expect(page.locator('[data-search="e_qiaowenda"]')).toContainText('剩');
  const before = await page.locator('.card-item').count();
  const st0 = await page.evaluate(() => (window as any).__game.getState().stamina);
  await page.locator('[data-search="e_qiaowenda"]').click();
  await page.waitForTimeout(300);
  const after = await page.locator('.card-item').count();
  expect(after).toBe(before + 1); // 恰好多一张
  const st1 = await page.evaluate(() => (window as any).__game.getState().stamina);
  expect(st1).toBe(st0 - 1); // 耗 1 体力
});

test('最佳搜寻标记：存在搜寻按钮时恰好一个推荐放大镜，且点它可解锁新卡', async ({ page }) => {
  await freshGame(page);
  await expect(page.locator('[data-search="e_qiaowenda"]')).toBeVisible();
  await expect(page.locator('[data-search-best]')).toHaveCount(1);
  await expect(page.locator('[data-search-best] .search-ico')).toHaveCount(1);
  const before = await page.locator('.card-item').count();
  await page.locator('[data-search-best]').click();
  await page.waitForTimeout(300);
  expect(await page.locator('.card-item').count()).toBe(before + 1);
  expect(await page.locator('[data-search-best]').count()).toBeLessThanOrEqual(1);
});

test('i18n：?game=xdd&lang=de 德语标题页且可热切 English', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?game=xdd&lang=de');
  await page.evaluate(() => localStorage.removeItem('xdd_locale'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('heading', { name: 'Siddhartha' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Neuer Anfang/ })).toBeVisible();
  await page.locator('.cover-menu').click();
  await page.getByRole('button', { name: 'English' }).click();
  await page.locator('.game-menu-close').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Siddhartha' })).toBeVisible();
  await expect(page.getByRole('button', { name: /New beginning/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test('i18n：?game=xdd&lang=ja 日语标题页', async ({ page }) => {
  await page.goto('/?game=xdd&lang=ja');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByRole('heading', { name: 'シッダールタ' })).toBeVisible();
});

test('i18n：?game=xdd&lang=zh-TW 繁体标题页', async ({ page }) => {
  await page.goto('/?game=xdd&lang=zh-TW');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
  await expect(page.getByRole('heading', { name: '悉達多' })).toBeVisible();
});

test('i18n：?game=xdd&lang=es 西班牙语标题页', async ({ page }) => {
  await page.goto('/?game=xdd&lang=es');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('heading', { name: 'Siddhartha' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Nuevo comienzo/ })).toBeVisible();
});

test('i18n：?game=xdd&lang=fr 法语标题页', async ({ page }) => {
  await page.goto('/?game=xdd&lang=fr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('heading', { name: 'Siddhartha' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Nouveau départ/ })).toBeVisible();
});

test('i18n：?game=xdd&lang=ko 韩语标题页', async ({ page }) => {
  await page.goto('/?game=xdd&lang=ko');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect(page.getByRole('heading', { name: '싯다르타' })).toBeVisible();
});

test('i18n：?game=xdd&lang=hi 印地语标题页', async ({ page }) => {
  await page.goto('/?game=xdd&lang=hi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await expect(page.getByRole('heading', { name: 'सिद्धार्थ' })).toBeVisible();
});

test('音量开关：标题页可见、可切换且刷新后保持', async ({ page }) => {
  await page.locator('.cover-menu').click();
  await expect(page.getByRole('button', { name: '关闭音量' })).toBeVisible();
  await page.getByRole('button', { name: '关闭音量' }).click();
  await expect(page.getByRole('button', { name: '开启音量' })).toBeVisible();
  await page.reload();
  await page.locator('.cover-menu').click();
  await expect(page.getByRole('button', { name: '开启音量' })).toBeVisible();
});
