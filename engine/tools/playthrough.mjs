// tools/playthrough.mjs — 全正确答案真实点击通关 bot（自玩验证 + 全程截图）
// 用法: node tools/playthrough.mjs [--game xdd|bad|murder|weicheng] [--shots-only]
// 依赖 dev server: http://localhost:5174
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'frontend', 'package.json'));
const { chromium } = require('@playwright/test');

const GAMES = { xdd: 'xidaduo', bad: 'badblood', murder: 'murder', weicheng: 'WeiCheng_QianZhongShu' };
const argGame = process.argv.find((a) => a.startsWith('--game='))?.slice('--game='.length)
  ?? (process.argv.includes('--game') ? process.argv[process.argv.indexOf('--game') + 1] : 'xdd');
const GAME_ID = GAMES[argGame] ? argGame : 'xdd';
const GAME_DIR = GAMES[GAME_ID];

const GAME = JSON.parse(fs.readFileSync(path.join(ROOT, 'workspace', GAME_DIR, 'final_game.json'), 'utf8'));
const OUT = path.join(ROOT, 'workspace', GAME_DIR, 'DEBUG', 'playthrough');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:5174';
const MAX_LEVEL = Math.max(...Object.keys(GAME.timelines).map(Number));
const cardsOfLevel = (lv) => GAME.cards.filter((c) => c.level === lv);
const correctCell = (c) => ({ row: c.row, col: GAME.timelines[String(c.level)].cols.indexOf(c.col) });
/** 空位的全部正确词条（数组答案展开） */
const ansOf = (b) => (Array.isArray(b.answer) ? b.answer : [b.answer]);
const cardTags = (c) => {
  const ids = new Set();
  for (const s of c.segments) for (const m of s.text.matchAll(/\{\{(e_[a-z0-9_]+)\|/g)) ids.add(m[1]);
  return [...ids];
};
/** 取某 chip 在卡中的显示名（{{eid|显示名}}） */
const chipDisplay = (c, eid) => {
  for (const s of c.segments) {
    const m = s.text.match(new RegExp(`\\{\\{${eid}\\|([^}]*)\\}\\}`));
    if (m) return m[1];
  }
  return null;
};
const archPagesOfLevel = (lv) => {
  const out = [];
  for (const [eid, def] of Object.entries(GAME.entries))
    (def.archive || []).forEach((p, i) => { if (p.level === lv) out.push({ eid, pageIdx: i, page: p }); });
  return out;
};

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(String(e)));

// 崩溃诊断：截图 + 状态转储 + console 错误
process.on('uncaughtException', async (e) => {
  try {
    await page.screenshot({ path: path.join(OUT, 'ERROR.png') });
    const st = await S().catch(() => null);
    console.error('\nCRASH:', e.message);
    console.error('state: screen=%s tab=%s level=%s introLevel=%s', st?.screen, st?.tab, st?.level, st?.introLevel);
    console.error('console errors:', consoleErrors.slice(0, 8));
    const body = await page.evaluate(() => document.body.innerText.slice(0, 400)).catch(() => '');
    console.error('body text:', JSON.stringify(body));
  } catch {}
  process.exit(1);
});

let shotN = 0;
async function shot(name) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${String(++shotN).padStart(2, '0')}_${name}.png`) });
  console.log('  [shot]', name);
}
const S = () => page.evaluate(() => window.__game.getState());
const sleep = (ms) => page.waitForTimeout(ms);
const log = (...a) => console.log(...a);

async function clickBtn(re, idx = 0) {
  await page.getByRole('button', { name: re }).nth(idx).click({ timeout: 4000 });
  await sleep(180);
}

/** 等情节卡正文上屏完成：反复尝试点「全部显示」，直到按钮消失且段数稳定 */
async function settleChat() {
  const all = page.getByRole('button', { name: /全部显示/ });
  let last = -1;
  for (let k = 0; k < 24; k++) {
    if (await all.count()) await all.first().click({ timeout: 800 }).catch(() => {});
    const n = await page.locator('.chat-body .msg').count();
    if (!(await all.count()) && n > 0 && n === last) return;
    last = n;
    await sleep(250);
  }
}

/** 过场阅读台自适应推进：点「继续」直到「进入本卷」出现（各作过场条数不同） */
async function advanceIntro() {
  for (let i = 0; i < 12; i++) {
    const enter = page.getByRole('button', { name: /进入本卷/ });
    if (await enter.count()) { await enter.first().click({ timeout: 4000 }); return; }
    await clickBtn(/^继续/);
  }
  await page.getByRole('button', { name: /进入本卷/ }).first().click({ timeout: 4000 });
}

async function openCardsTab() {
  await page.locator('.tabs .tab', { hasText: '情节卡' }).click();
  await sleep(200);
}

// ---------- 开局流程（标题 → 第一卷过场 → 主界面） ----------
await page.goto(BASE + `/?game=${GAME_ID}`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await shot('title');
await clickBtn(/新的开始/);
await shot('level-intro-1');
await advanceIntro();
await sleep(400);
await openCardsTab();
await shot('game-start');

// ---------- 关卡主循环 ----------
for (let lv = 1; lv <= MAX_LEVEL; lv++) {
  log(`\n===== 第 ${lv} 关 =====`);
  const lvCards = cardsOfLevel(lv);
  const lvPages = archPagesOfLevel(lv);
  const chipped = new Set();
  let stuckRounds = 0;

  for (let round = 0; round < 300; round++) {
    const st = await S();
    if (st.level !== lv) break; // 已过闸门进入下一关
    // 闸门前置是否已满足
    const locked = lvCards.filter((c) => st.cards[c.id]?.pos?.locked).length;
    const pagesDone = lvPages.filter((p) => st.entries[p.eid]?.pagesDone.includes(p.pageIdx)).length;
    if (locked === lvCards.length && pagesDone === lvPages.length) break;

    let progressed = false;

    // A. 点读所有已解锁卡的词条 chip（按数据驱动 chip 表逐个点击，并以游戏状态 famCards 复核补点）
    for (const c of lvCards) {
      if (!st.cards[c.id]?.unlocked || chipped.has(c.id)) continue;
      await page.locator(`[data-card-item="${c.id}"]`).first().click();
      await sleep(300);
      await settleChat();
      for (const eid of cardTags(c)) {
        const disp = chipDisplay(c, eid);
        if (!disp) continue;
        for (let retry = 0; retry < 4; retry++) {
          const done = (await S()).entries[eid]?.famCards?.includes(c.id);
          if (done) break;
          const chips = page.locator('.chat-body .entry-chip');
          const n = await chips.count();
          let hit = false;
          for (let i = 0; i < n; i++) {
            const t = ((await chips.nth(i).innerText().catch(() => '')) || '').replace(' ✓', '').trim();
            if (t === disp) {
              hit = true;
              await chips.nth(i).click({ timeout: 2500 })
                .catch((e) => log(`    [chip失败] ${c.id} ${eid} ${String(e.message || e).split('\n')[0].slice(0, 100)}`));
              break;
            }
          }
          if (!hit) log(`    [chip未找到] ${c.id} ${eid}「${disp}」`);
          await sleep(180);
        }
      }
      chipped.add(c.id);
      progressed = true;
    }

    // B. 填写并验证所有答案已收集的卡
    for (const c of lvCards) {
      const cs = (await S()).cards[c.id];
      if (!cs?.unlocked || cs.done) continue;
      const st2 = await S();
      if (!c.blanks.every((b) => ansOf(b).some((id) => st2.entries[id]?.collected))) continue;
      await page.locator(`[data-card-item="${c.id}"]`).first().click();
      await sleep(200);
      for (const b of c.blanks) {
        if (cs.slotLocked[b.slot]) continue;
        const pick = ansOf(b).find((id) => st2.entries[id]?.collected) || ansOf(b)[0];
        await page.locator(`.blank-area [data-slot="${b.slot}"]`).click();
        await sleep(150);
        await page.locator(`[data-pick="${pick}"]`).click();
        await sleep(120);
      }
      await page.getByRole('button', { name: /验证此卡/ }).click();
      await sleep(250);
      progressed = true;
    }

    // C. 时间轴归位（只动「未放置」或「放错位置」的卡；已在正确格但行未凑齐的不要反复重放，否则永远是"有进展"，卡死检测失效）
    {
      const st3 = await S();
      const toPlace = lvCards.filter((c) => {
        const cs = st3.cards[c.id];
        if (!cs?.done || cs.pos?.locked) return false;
        const cell = correctCell(c);
        return !cs.pos || cs.pos.row !== cell.row || cs.pos.col !== cell.col;
      });
      if (toPlace.length) {
        await clickBtn(/时间轴/);
        for (const c of toPlace) {
          const cell = correctCell(c);
          await page.locator(`[data-chip="${c.id}"]`).click();
          await sleep(120);
          await page.locator(`[data-cell="${cell.row}:${cell.col}"]`).click();
          await sleep(150);
          progressed = true;
        }
        await clickBtn(/情节卡/);
      }
    }

    // D. 分析（按钮在档案界面：先切档案页签并聚焦词条；熟悉度按关刷新，上限=本关标签+单一答案卡数，数组答案不计入）
    {
      const st4 = await S();
      const famMaxOf = (eid) =>
        lvCards.filter((c) => cardTags(c).includes(eid) || c.blanks.some((b) => b.answer === eid)).length;
      for (const [eid, def] of Object.entries(GAME.entries)) {
        const e = st4.entries[eid];
        if (!e || e.familiarity < famMaxOf(eid)) continue;
        const target = (def.archive || []).findIndex((p, i) => p.level === lv && !e.pagesUnlocked.includes(i));
        if (target < 0) continue;
        await clickBtn(/档案/);
        await page.locator(`[data-arc="${eid}"]`).click();
        await sleep(200);
        const btn = page.locator(`[data-analyze="${eid}"]`);
        if (await btn.count()) {
          await btn.click();
          await sleep(2400); // 读条 2s
          progressed = true;
        }
        await clickBtn(/情节卡/);
      }
    }

    // E. 档案补全
    {
      const st5 = await S();
      const todo = lvPages.filter((p) => {
        const e = st5.entries[p.eid];
        return e?.pagesUnlocked.includes(p.pageIdx) && !e.pagesDone.includes(p.pageIdx)
          && p.page.fields.every((f) => !f.blank || st5.entries[f.blank.answer]?.collected);
      });
      if (todo.length) {
        await clickBtn(/档案/);
        for (const p of todo) {
          await page.locator(`[data-arc="${p.eid}"]`).click();
          await sleep(150);
          // 档案页竖排展示：所有留白操作限定在对应关卡小节内
          const sec = page.locator(`[data-arc-tab="${p.pageIdx}"]`);
          await sec.scrollIntoViewIfNeeded();
          await sleep(150);
          for (const [fi, f] of p.page.fields.entries()) {
            if (!f.blank) continue;
            await sec.locator(`[data-arc-blank="${fi}"]`).click();
            await sleep(120);
            await page.locator(`[data-pick="${f.blank.answer}"]`).click();
            await sleep(100);
          }
          await sec.locator('[data-arc-check]').click();
          await sleep(200);
          progressed = true;
        }
        await clickBtn(/情节卡/);
      }
    }

    // F. 搜寻（按词条驱动：任一已收集且有剩余的词条搜一次）
    {
      const st6 = await S();
      for (const eid of Object.keys(GAME.entries)) {
        if (!st6.entries[eid]?.collected) continue;
        const remain = lvCards.filter(
          (c) => !st6.cards[c.id]?.unlocked && cardTags(c).includes(eid),
        ).length;
        if (remain === 0) continue;
        const btn = page.locator(`[data-search="${eid}"]`);
        if (await btn.count() && (await btn.isEnabled())) {
          await btn.click();
          await sleep(250);
          progressed = true;
          log(`    [搜寻] ${eid} → 解锁 1 张（体力 ${(await S()).stamina}）`);
          break; // 每轮最多解锁 1 张，模拟真实节奏
        }
      }
    }

    // G. 休整
    const st7 = await S();
    if (!progressed) {
      if (st7.stamina <= 0) {
        await clickBtn(/休整/);
        progressed = true;
      } else {
        stuckRounds++;
        if (stuckRounds > 6) {
          const missing = lvCards.filter((c) => !st7.cards[c.id]?.pos?.locked).map((c) => c.id);
          const missPages = lvPages.filter((p) => !st7.entries[p.eid]?.pagesDone.includes(p.pageIdx))
            .map((p) => `${p.eid}#${p.pageIdx}`);
          const collectedNow = Object.keys(GAME.entries).filter((id) => st7.entries[id]?.collected);
          const lockedDetail = missing.map((cid) => {
            const cc = lvCards.find((x) => x.id === cid);
            const stc = st7.cards[cid];
            return `${cid}(unlocked=${!!stc?.unlocked},done=${!!stc?.done},tags=${cardTags(cc).join('|')})`;
          });
          throw new Error(`第${lv}关卡死：未归位 ${missing.join(',')} 未完成档案 ${missPages.join(',')} 体力${st7.stamina}\n已收集: ${collectedNow.join(',')}\n锁定卡: ${lockedDetail.join(' ')}`);
        }
      }
    } else {
      stuckRounds = 0;
    }
  }

  // 状态快照
  const stMid = await S();
  log(`  归位 ${lvCards.filter((c) => stMid.cards[c.id]?.pos?.locked).length}/${lvCards.length}，`
    + `档案 ${lvPages.filter((p) => stMid.entries[p.eid]?.pagesDone.includes(p.pageIdx)).length}/${lvPages.length}，体力 ${stMid.stamina}`);
  await clickBtn(/时间轴/);
  await shot(`level${lv}-timeline-done`);

  // ---------- 闸门（完形填空已内嵌在时间轴右栏，默认折叠需先展开） ----------
  const gate = GAME.gates.find((g) => g.after === lv);
  await shot(`level${lv}-gate`);
  await page.locator('[data-gate-expand]').click();
  await sleep(200);
  for (const [i, b] of gate.blanks.entries()) {
    await page.locator(`[data-gate-blank="${i}"]`).click();
    await sleep(150);
    const key = b.answerEntry ? 'entry:' + b.answerEntry : 'title:' + b.answerTitle;
    await page.locator(`[data-pick="${key}"]`).click();
    await sleep(120);
  }
  await shot(`level${lv}-gate-filled`);
  await page.locator('[data-gate-check]').click();
  await sleep(800);
  await shot(`level${lv}-gate-fx`);
  await sleep(1800);

  if (lv < MAX_LEVEL) {
    await shot(`level${lv + 1}-intro`);
    await advanceIntro();
    await sleep(300);
    await openCardsTab();
  } else {
    await sleep(500);
    for (let i = 0; i < 6; i++) {
      const b = page.getByRole('button', { name: /^继续/ }).first();
      if (await b.count()) { await b.click(); await sleep(250); }
    }
    await shot('ending');
  }
}

const fin = await S();
log('\n===== 通关 =====');
log('结局屏:', fin.screen, '| 总错误:', fin.stats.errors, '| 提示:', fin.stats.hints, '| 休整:', fin.stats.rests, '| 体力:', fin.stamina);
log('各关星级:', JSON.stringify(Object.fromEntries(Object.entries(fin.gates).map(([k, v]) => [k, v.stars]))));
log('console 错误:', consoleErrors.length ? consoleErrors.slice(0, 5) : '无');
if (fin.screen !== 'ending') { console.error('未到达结局！'); process.exit(1); }
await browser.close();