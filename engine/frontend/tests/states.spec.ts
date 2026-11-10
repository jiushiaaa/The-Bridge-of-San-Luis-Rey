// 关键状态直达测试：用调试面板复现各界面状态并截图基线
// 截图输出：workspace/xidaduo/DEBUG/baseline/
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASELINE = path.resolve(HERE, '..', '..', 'workspace', 'xidaduo', 'DEBUG', 'baseline');
fs.mkdirSync(BASELINE, { recursive: true });
const GAME = JSON.parse(
  fs.readFileSync(path.resolve(HERE, '..', '..', 'workspace', 'xidaduo', 'final_game.json'), 'utf8'),
);

async function fresh(page: import('@playwright/test').Page) {
  await page.goto('/?debug=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // 快速进入游戏（跳过过场，直接写入存档后读档）
  await page.evaluate(() => {
    const g = (window as any).__game;
    g.newGame();
    const s = g.getState();
    s.flags.introSeen = { '1': true, '2': true, '3': true };
    s.flags.coachSeen = g.allCoachSeen(); // 基线截图里不要出现新手引导气泡
    s.introLevel = null;
    s.screen = 'game';
    g.setState(s);
  });
  await page.reload();
  await page.getByRole('button', { name: /继续游戏/ }).click();
}

test('状态基线：第一关中段（解锁全卡+聊天卡面）', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: /解锁本关全卡/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(BASELINE, 'l1-cards.png') });
  // 打开一张对话卡 c1_03（NPC1 = 侨文达，开局已收集）
  await page.locator('[data-card-item="c1_03"]').click();
  await page.waitForTimeout(500);
  const all = page.getByRole('button', { name: /全部显示/ });
  if (await all.count()) {
    await all.first().click({ timeout: 1200 }).catch(() => {});
    for (let k = 0; k < 15 && (await all.count()); k++) await page.waitForTimeout(250);
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(BASELINE, 'l1-card-chat.png') });
  // 填对 NPC1=侨文达，验证 -> 气泡应显示真名+头像
  await page.locator('.blank-area [data-slot="NPC1"]').click();
  await page.locator('[data-pick="e_qiaowenda"]').click();
  await page.getByRole('button', { name: /验证此卡/ }).click();
  await page.waitForTimeout(400);
  await expect(page.locator('.speaker-name.known').first()).toContainText('侨文达');
  await page.screenshot({ path: path.join(BASELINE, 'l1-card-solved-slot.png') });
});

test('状态基线：时间轴散落与归位', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: /解锁本关全卡/ }).click();
  await page.locator('.tab', { hasText: '时间轴' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(BASELINE, 'l1-timeline-scattered.png') });
  // 关卡出口：关名与「故事」页同源（过场首段卷名）；进度 <70% 时也能展开看题面，
  // 但没有答案栏、不能填、不能提交；revealAt=gate 的题只露「？？？」
  const gate = GAME.gates.find((g: { after: number }) => g.after === 1);
  await expect(page.locator('[data-gate-chapter]')).toHaveText(GAME.frame.levelIntro['1'][0].text);
  await expect(page.locator('[data-gate-question]')).toHaveText(gate.question);
  await expect(page.locator('.gate-sheet')).toHaveCount(0);
  await expect(page.locator('[data-gate-expand]')).toBeEnabled();
  await page.locator('[data-gate-expand]').click();
  await expect(page.locator('.gate-q')).toHaveCount(gate.blanks.length);
  await expect(page.locator('.gate-answer')).toHaveCount(0);
  const hiddenN = gate.blanks.filter((b: { revealAt?: string }) => b.revealAt !== 'start').length;
  await expect(page.locator('.gate-q.is-hidden')).toHaveCount(hiddenN);
  await expect(page.locator('[data-gate-check]')).toHaveCount(0);
  // 左列：未补完的卡用模糊标题；轴内格子同样是模糊标题 + 预览正文
  await expect(page.locator('.tl-pool-text.is-veiled').first()).toBeVisible();
  await expect(page.locator('.tl-pool-title')).toContainText('待归位情节卡');
});

test('状态基线：档案与闸门、结局', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: /直达结局前态/ }).click();
  await page.waitForTimeout(400);
  // 档案页（第三关视角）
  await page.locator('.tab', { hasText: '档案' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(BASELINE, 'l3-archive.png') });
  // 闸门（末关，前置已满足）：完形填空内嵌在时间轴右栏
  await page.locator('.tab', { hasText: '时间轴' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(BASELINE, 'l3-gate.png') });
  // 答完末关闸门 → 结局（题面开局常显；进度已满，「开始作答」可点、答案栏可点）
  // 调试面板固定在右下角，正压住填空的最后几行，先收起
  await page.locator('.debug-title').click();
  await expect(page.locator('[data-gate-question]')).toBeVisible();
  await page.locator('[data-gate-expand]').click();
  const gate = GAME.gates.find((g: { after: number }) => g.after === 3);
  for (const [i, b] of gate.blanks.entries()) {
    await page.locator(`[data-gate-blank="${i}"]`).click();
    const key = b.answerEntry ? 'entry:' + b.answerEntry : 'title:' + b.answerTitle;
    await page.locator(`[data-pick="${key}"]`).click();
    await page.waitForTimeout(120);
  }
  await page.locator('[data-gate-check]').click();
  await page.waitForTimeout(800);
  // 结局整屏点击推进（提示是「点击画面继续」），走到末段后出现「通关纪念」
  for (let i = 0; i < 16; i++) {
    if (await page.getByRole('button', { name: '通关纪念' }).count()) break;
    await page.locator('.ending-title').click();
    await page.waitForTimeout(120);
  }
  await expect(page.getByRole('button', { name: '通关纪念' })).toBeVisible();
  await page.getByRole('button', { name: '通关纪念' }).click();
  await expect(page.getByText('你已走完这条河')).toBeVisible();
  await expect(page.getByRole('button', { name: '回到封面' })).toBeVisible();
  await page.screenshot({ path: path.join(BASELINE, 'ending.png') });
});
