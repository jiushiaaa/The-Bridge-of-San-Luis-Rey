// 新手引导：落地情节卡页 → 目标弹窗（本卷之问）→ 情节卡 / 时间轴两步页签 → 情节卡主循环
import { expect, test, type Page } from '@playwright/test';

async function firstRunOnCards(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => {
    const g = (window as any).__game;
    g.newGame();
    const s = g.getState();
    s.flags.introSeen = { '1': true, '2': true, '3': true };
    s.introLevel = null;
    s.screen = 'game';
    s.tab = 'cards';
    g.setState(s);
  });
  await page.reload();
  await page.getByRole('button', { name: /继续游戏/ }).click();
}

test('新手引导：落地情节卡页先弹目标（标题是本卷之问），再介绍情节卡与时间轴两个页签', async ({ page }) => {
  await firstRunOnCards(page);

  await expect(page.locator('[data-coach="goal"]')).toBeVisible();
  // 标题 = gates[after=1].question（数据驱动，读引擎里的值来比）
  const q = await page.evaluate(() => (window as any).__game.levelQuestion(1));
  await expect(page.locator('.coach-modal-title')).toHaveText(q);
  await expect(page.locator('.coach-modal-line')).toHaveCount(3);
  await page.locator('.coach-modal-ok').click();

  await expect(page.locator('[data-coach="tabCards"]')).toBeVisible();
  await page.locator('[data-coach="tabCards"] .coach-ok').click();

  await expect(page.locator('[data-coach="tabTimeline"]')).toBeVisible();
  await page.locator('[data-coach="tabTimeline"] .coach-ok').click();

  // 页签介绍完直接接上情节卡主循环（正文里有词条 chip 就出「点词条」提示）
  await expect(page.locator('[data-coach="chip"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-coach="tabNotes"], [data-coach="tabArchive"]')).toHaveCount(0);
});

test('新手引导：情节卡词条 → 词条卡 → 填空提示', async ({ page }) => {
  await firstRunOnCards(page);
  // 跳过目标与页签引导
  await page.evaluate(() => {
    const g = (window as any).__game;
    const s = g.getState();
    s.flags.coachSeen = {
      ...g.allCoachSeen(),
      chip: false,
      entryCard: false,
      blank: false,
      search: false,
      newCard: false,
      vitals: false,
      searchDiff: false,
      timelinePlace: false,
      timelineGate: false,
    };
    // 只保留目标+页签已看
    for (const k of ['goal', 'tabCards', 'tabTimeline']) {
      s.flags.coachSeen[k] = true;
    }
    s.tab = 'cards';
    g.setState(s);
  });
  await page.waitForTimeout(200);
  // 正文可能逐段展开，先等词条 chip 进 DOM
  await expect(page.locator('.chat-body .entry-chip').first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-coach="chip"]')).toBeVisible();
  await page.locator('.chat-body .entry-chip').first().click();
  await expect(page.locator('[data-coach="chip"]')).toHaveCount(0);

  // 等飞行光点后出现词条卡说明
  await expect(page.locator('[data-coach="entryCard"]')).toBeVisible({ timeout: 3000 });
  await page.locator('[data-coach="entryCard"] .coach-ok').click();

  await expect(page.locator('[data-coach="blank"]')).toBeVisible();
  await page.locator('[data-coach="blank"] .coach-ok').click();
  await expect(page.locator('[data-coach="blank"]')).toHaveCount(0);
});

test('新手引导：先关掉搜寻提示再搜寻，仍会接上新卡→体力→搜寻对比', async ({ page }) => {
  await firstRunOnCards(page);
  await page.evaluate(() => {
    const g = (window as any).__game;
    const s = g.getState();
    s.flags.coachSeen = g.allCoachSeen();
    // 模拟：搜寻提示已点过「知道了」，但还没真正搜过
    s.flags.coachSeen.search = true;
    s.flags.coachSeen.newCard = false;
    s.flags.coachSeen.vitals = false;
    s.flags.coachSeen.searchDiff = false;
    s.tab = 'cards';
    g.setState(s);
  });
  await page.waitForTimeout(200);
  await expect(page.locator('[data-search-best], .entry-search').first()).toBeVisible();
  await page.locator('[data-search-best], .entry-search').first().click();

  await expect(page.locator('[data-coach="newCard"]')).toBeVisible({ timeout: 3000 });
  await page.locator('[data-coach="newCard"] .coach-ok').click();

  await expect(page.locator('[data-coach="vitals"]')).toBeVisible();
  await expect(page.locator('[data-coach="vitals"]')).toContainText('体力');
  await page.locator('[data-coach="vitals"] .coach-ok').click();

  await expect(page.locator('[data-coach="searchDiff"]')).toBeVisible();
  await expect(page.getByText(/两种.?搜寻/)).toBeVisible();
  await page.locator('.coach-modal-ok').click();
  await expect(page.locator('[data-coach-root]')).toHaveCount(0);
});

test('新手引导：已看过的存档不出现蒙版', async ({ page }) => {
  await page.goto('/');
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
    s.tab = 'notes';
    g.setState(s);
  });
  await page.reload();
  await page.getByRole('button', { name: /继续游戏/ }).click();
  await expect(page.locator('[data-coach-root]')).toHaveCount(0);
  await page.locator('.tab', { hasText: '情节卡' }).click();
  await expect(page.locator('.coach')).toHaveCount(0);
});
