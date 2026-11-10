// tools/bbs_shots.mjs — 宣传截图：直接服务离线正式包（workspace/{作品}/index.html + 素材，与发布产物一致、无 DEBUG 入口），
// 用全正确答案真实点击通关，在各时期拍桌面图；途中保存存档快照，再复拍竖屏与各语言版本。
// 用法: node tools/bbs_shots.mjs [xdd] [--only desktop|phone|lang]   前置: node tools/build_offline.mjs xdd
// 输出: workspace/{作品}/DEBUG/bbs_pics/*.jpg（运行前清空；--only 时只清对应前缀）
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'frontend', 'package.json'));
const { chromium } = require('@playwright/test');

const GAMES = { xdd: 'xidaduo' };
const args = process.argv.slice(2);
const GAME_ID = args.find((a) => GAMES[a]) || 'xdd';
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const GAME_ROOT = path.join(ROOT, 'workspace', GAMES[GAME_ID]);
const GAME = JSON.parse(fs.readFileSync(path.join(GAME_ROOT, 'final_game.json'), 'utf8'));
const OUT = path.join(GAME_ROOT, 'DEBUG', 'bbs_pics');
const SNAP_FILE = path.join(os.tmpdir(), `bbs_shots_${GAME_ID}_snapshots.json`);

// 每关两张展示卡（补全后带 CG 背景的成品卡面）；竖屏 / 多语言复拍用第二卷中段存档里的 c2_03（待补全）与 c2_12（已补全）
const SHOWCASE = { 1: ['c1_04', 'c1_12'], 2: ['c2_03', 'c2_06'], 3: ['c3_04', 'c3_08'] };
const LANGS = [
  ['en', 'English'], ['ja', '日本語'], ['ko', '한국어'], ['zh-TW', '繁體中文'],
  ['de', 'Deutsch'], ['fr', 'Français'], ['es', 'Español'], ['hi', 'हिन्दी'],
];

// ---------- 静态服务器：服务离线正式包 ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.json': 'application/json',
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const f = path.join(GAME_ROOT, path.normalize(p));
  if (!f.startsWith(GAME_ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) {
  if (!f.endsWith('.jpg')) continue;
  const isDesk = f.includes('_桌面_');
  const isPhone = f.includes('_竖屏_');
  if (!ONLY || (ONLY === 'desktop' && isDesk) || (ONLY === 'phone' && isPhone) || (ONLY === 'lang' && !isDesk && !isPhone)) {
    fs.rmSync(path.join(OUT, f));
  }
}

const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const consoleErrors = [];
const watch = (page, tag) => {
  page.on('response', (r) => { if (r.status() >= 400) consoleErrors.push(`[${tag}] HTTP ${r.status()} ${r.url().replace(BASE, '/')}`); });
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) consoleErrors.push(`[${tag}] ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleErrors.push(`[${tag}] ${String(e)}`));
};

const counters = { desktop: 0, phone: 50, lang: 70 };
async function shot(page, group, name, opts = {}) {
  await page.waitForTimeout(opts.wait ?? 600);
  if (opts.clean) {
    for (let k = 0; k < 24 && (await page.locator('.toast').count()); k++) await page.waitForTimeout(250);
  }
  const n = ++counters[group];
  const file = path.join(OUT, `${String(n).padStart(2, '0')}_${name}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 92 });
  console.log('  [shot]', path.basename(file));
}
const sleep = (page, ms) => page.waitForTimeout(ms);

// ---------- 数据驱动的正确答案（同 playthrough.mjs） ----------
const MAX_LEVEL = Math.max(...Object.keys(GAME.timelines).map(Number));
const cardsOfLevel = (lv) => GAME.cards.filter((c) => c.level === lv);
const correctCell = (c) => ({ row: c.row, col: GAME.timelines[String(c.level)].cols.indexOf(c.col) });
const ansOf = (b) => (Array.isArray(b.answer) ? b.answer : [b.answer]);
const cardTags = (c) => {
  const ids = new Set();
  for (const s of c.segments) for (const m of s.text.matchAll(/\{\{(e_[a-z0-9_]+)\|/g)) ids.add(m[1]);
  return [...ids];
};
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

const snapshots = ONLY && fs.existsSync(SNAP_FILE) ? JSON.parse(fs.readFileSync(SNAP_FILE, 'utf8')) : {};
const takeSnap = async (page, key) => {
  snapshots[key] = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  fs.writeFileSync(SNAP_FILE, JSON.stringify(snapshots));
};

// ======================================================================
// 桌面：真实通关（简体）
// ======================================================================
async function desktopRun() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  watch(page, 'desktop');
  const S = () => page.evaluate(() => window.__game.getState());
  const shotD = (name, opts) => shot(page, 'desktop', `桌面_${name}`, opts);
  const tab = async (id) => {
    await page.locator(`.tabs .tab[data-tab="${id}"]`).click();
    await sleep(page, 260);
  };
  const clickBtn = async (re, idx = 0) => {
    await page.getByRole('button', { name: re }).nth(idx).click({ timeout: 4000 });
    await sleep(page, 180);
  };
  const settleChat = async () => {
    let last = -1;
    for (let k = 0; k < 30; k++) {
      const n = await page.locator('.chat-body .msg').count();
      if (n > 0 && n === last) return;
      last = n;
      await sleep(page, 300);
    }
  };
  const advanceIntro = async (shotName) => {
    await sleep(page, 2600);
    if (shotName) await shotD(shotName);
    for (let i = 0; i < 14; i++) {
      const enter = page.getByRole('button', { name: /进入本卷/ });
      if (await enter.count()) break;
      await clickBtn(/^继续|翻开本卷/);
      await sleep(page, 500);
    }
    await sleep(page, 2200);
    if (shotName) await shotD(`${shotName}_本卷之问`);
    await page.getByRole('button', { name: /进入本卷/ }).first().click({ timeout: 4000 });
    await sleep(page, 900);
  };
  const openCard = async (cid) => {
    await tab('cards');
    await page.locator(`[data-card-item="${cid}"]`).first().click();
    await sleep(page, 350);
    await settleChat();
  };
  const esc = async () => {
    await page.keyboard.press('Escape');
    await sleep(page, 300);
  };

  // ---- 封面 / 玩法说明 ----
  await page.goto(BASE + '?lang=zh-CN');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await sleep(page, 3200);
  await shotD('封面');
  await page.getByRole('button', { name: /菜单/ }).first().click();
  await sleep(page, 300);
  await page.getByRole('button', { name: /玩法说明/ }).first().click();
  await shotD('玩法说明', { wait: 900 });
  await esc();
  await esc();

  // ---- 第一卷过场 → 主界面 ----
  await clickBtn(/新的开始/);
  await advanceIntro('第一卷过场');
  await shotD('新手引导', { wait: 1500 });
  await page.evaluate(() => {
    const g = window.__game;
    const s = g.getState();
    s.flags.coachSeen = g.allCoachSeen();
    g.setState(s);
  });
  await tab('cards');

  const once = new Set();
  const doOnce = async (key, fn) => {
    if (once.has(key)) return;
    once.add(key);
    try { await fn(); } catch (e) { console.log(`  [skip ${key}]`, String(e.message || e).split('\n')[0]); }
  };

  for (let lv = 1; lv <= MAX_LEVEL; lv++) {
    console.log(`\n===== 第 ${lv} 关 =====`);
    const lvCards = cardsOfLevel(lv);
    const lvPages = archPagesOfLevel(lv);
    const chipped = new Set();
    let stuck = 0;

    for (let round = 0; round < 300; round++) {
      const st = await S();
      if (st.level !== lv) break;
      const locked = lvCards.filter((c) => st.cards[c.id]?.pos?.locked).length;
      const pagesDone = lvPages.filter((p) => st.entries[p.eid]?.pagesDone.includes(p.pageIdx)).length;
      if (locked === lvCards.length && pagesDone === lvPages.length) break;
      let progressed = false;

      // 时期快照与途中镜头
      if (locked >= Math.ceil(lvCards.length / 2)) {
        await doOnce(`mid${lv}`, async () => {
          await takeSnap(page, `l${lv}mid`);
          if (lv === 1) {
            await tab('timeline');
            await shotD('第一卷_时间轴归位中', { clean: true });
          }
          if (lv === 2) {
            await tab('cards');
            for (let k = 0; k < 24 && (await page.locator('.toast').count()); k++) await sleep(page, 250);
            await page.locator('[data-bgm-now]').click();
            await shotD('第二卷_背景音乐歌单', { wait: 900, clean: true });
            await page.locator('[data-bgm-now]').click();
            await page.locator('.tabs .tab[data-tab="timeline"]').click();
            await sleep(page, 300);
            await page.locator('[data-level="1"]').click();
            await shotD('第二卷_只读回顾第一卷', { wait: 900, clean: true });
            await page.locator('[data-level="2"]').click();
            await sleep(page, 400);
          }
          if (lv === 3) {
            await page.locator('.tabs-tools .tool-btn').first().click();
            await shotD('第三卷_提示', { wait: 800, clean: true });
            await esc();
            await tab('notes');
            await shotD('第三卷_故事页', { wait: 900, clean: true });
            await tab('archive');
            await shotD('第三卷_档案库', { wait: 900, clean: true });
          }
        });
      }

      // A. 点读已解锁卡的词条
      for (const c of lvCards) {
        if (!st.cards[c.id]?.unlocked || chipped.has(c.id)) continue;
        await openCard(c.id);
        if (lv === 1 && !once.has('firstChat')) {
          await doOnce('firstChat', () => shotD('第一卷_阅读残页'));
        }
        for (const eid of cardTags(c)) {
          const disp = chipDisplay(c, eid);
          if (!disp) continue;
          for (let retry = 0; retry < 4; retry++) {
            if ((await S()).entries[eid]?.famCards?.includes(c.id)) break;
            const chips = page.locator('.chat-body .entry-chip');
            const n = await chips.count();
            for (let i = 0; i < n; i++) {
              const t = ((await chips.nth(i).innerText().catch(() => '')) || '').replace(' ✓', '').trim();
              if (t === disp) {
                await chips.nth(i).click({ timeout: 2500 }).catch(() => {});
                break;
              }
            }
            await sleep(page, 180);
          }
        }
        chipped.add(c.id);
        progressed = true;
      }

      // B. 填写并验证
      for (const c of lvCards) {
        const cs = (await S()).cards[c.id];
        if (!cs?.unlocked || cs.done) continue;
        const st2 = await S();
        if (!c.blanks.every((b) => ansOf(b).some((id) => st2.entries[id]?.collected))) continue;
        await openCard(c.id);
        for (const [bi, b] of c.blanks.entries()) {
          if (cs.slotLocked[b.slot]) continue;
          const pick = ansOf(b).find((id) => st2.entries[id]?.collected) || ansOf(b)[0];
          await page.locator(`.blank-area [data-slot="${b.slot}"]`).click();
          await sleep(page, 200);
          if (lv === 1 && bi === 0 && c.blanks.length >= 2) await doOnce('picker', () => shotD('第一卷_填空选人'));
          await page.locator(`[data-pick="${pick}"]`).click();
          await sleep(page, 140);
        }
        if (lv === 1 && c.blanks.length >= 2) await doOnce('filled', () => shotD('第一卷_填好待验证'));
        await page.getByRole('button', { name: /验证此卡/ }).click();
        await sleep(page, 400);
        if (lv === 1) await doOnce('solved', () => shotD('第一卷_残页补全', { wait: 1200 }));
        progressed = true;
      }

      // C. 时间轴归位
      {
        const st3 = await S();
        const toPlace = lvCards.filter((c) => {
          const cs = st3.cards[c.id];
          if (!cs?.done || cs.pos?.locked) return false;
          const cell = correctCell(c);
          return !cs.pos || cs.pos.row !== cell.row || cs.pos.col !== cell.col;
        });
        if (toPlace.length) {
          await tab('timeline');
          if (lv === 1 && toPlace.length >= 2) await doOnce('tlPool', () => shotD('第一卷_时间轴待归位'));
          for (const c of toPlace) {
            const cell = correctCell(c);
            await page.locator(`[data-chip="${c.id}"]`).click();
            await sleep(page, 140);
            await page.locator(`[data-cell="${cell.row}:${cell.col}"]`).click();
            await sleep(page, 160);
            progressed = true;
          }
          await tab('cards');
        }
      }

      // D. 分析
      {
        const st4 = await S();
        const famMaxOf = (eid) =>
          lvCards.filter((c) => cardTags(c).includes(eid) || c.blanks.some((b) => b.answer === eid)).length;
        for (const [eid, def] of Object.entries(GAME.entries)) {
          const e = st4.entries[eid];
          if (!e || e.familiarity < famMaxOf(eid)) continue;
          const target = (def.archive || []).findIndex((p, i) => p.level === lv && !e.pagesUnlocked.includes(i));
          if (target < 0) continue;
          await tab('archive');
          await page.locator(`[data-arc="${eid}"]`).click();
          await sleep(page, 250);
          const btn = page.locator(`[data-analyze="${eid}"]`);
          if (await btn.count()) {
            if (lv === 1) await doOnce('analyze', () => shotD('第一卷_档案可分析'));
            await btn.click();
            await sleep(page, 2500);
            progressed = true;
          }
          await tab('cards');
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
          await tab('archive');
          for (const p of todo) {
            await page.locator(`[data-arc="${p.eid}"]`).click();
            await sleep(page, 180);
            const sec = page.locator(`[data-arc-tab="${p.pageIdx}"]`);
            await sec.scrollIntoViewIfNeeded();
            await sleep(page, 160);
            for (const [fi, f] of p.page.fields.entries()) {
              if (!f.blank) continue;
              await sec.locator(`[data-arc-blank="${fi}"]`).click();
              await sleep(page, 130);
              await page.locator(`[data-pick="${f.blank.answer}"]`).click();
              await sleep(page, 110);
            }
            if (lv === 1) await doOnce('arcFill', () => shotD('第一卷_档案填写'));
            await sec.locator('[data-arc-check]').click();
            await sleep(page, 260);
            if (lv === 2) await doOnce('arcDone2', () => shotD('第二卷_档案补完', { wait: 900 }));
            progressed = true;
          }
          await tab('cards');
        }
      }

      // F. 搜寻
      {
        const st6 = await S();
        for (const eid of Object.keys(GAME.entries)) {
          if (!st6.entries[eid]?.collected) continue;
          const remain = lvCards.filter((c) => !st6.cards[c.id]?.unlocked && cardTags(c).includes(eid)).length;
          if (remain === 0) continue;
          const btn = page.locator(`[data-search="${eid}"]`);
          if ((await btn.count()) && (await btn.isEnabled())) {
            await btn.click();
            await sleep(page, 280);
            progressed = true;
            break;
          }
        }
      }

      // G. 休整 / 卡死检测
      const st7 = await S();
      if (!progressed) {
        if (st7.stamina <= 0) {
          await clickBtn(/休整/);
        } else if (++stuck > 6) {
          throw new Error(`第${lv}关卡死：未归位 ${lvCards.filter((c) => !st7.cards[c.id]?.pos?.locked).map((c) => c.id).join(',')}`);
        }
      } else {
        stuck = 0;
      }
    }

    // ---- 本卷收尾：展示卡、时间轴、闸门 ----
    for (const cid of SHOWCASE[lv] || []) {
      const c = GAME.cards.find((x) => x.id === cid);
      await openCard(cid);
      await shotD(`第${'一二三'[lv - 1]}卷_${c.title}`, { wait: 1200, clean: true });
    }
    await tab('timeline');
    await shotD(`第${'一二三'[lv - 1]}卷_时间轴全部归位`, { wait: 1200, clean: true });
    if (lv === 1) {
      const recap = page.locator(`[data-recap="${lv}"]`);
      if (await recap.count()) {
        await recap.first().click();
        await shotD('第一卷_故事回顾', { wait: 1400, clean: true });
        const next = page.getByRole('button', { name: /下一页/ });
        if (await next.count()) {
          await next.first().click();
          await shotD('第一卷_故事回顾_续', { wait: 1200 });
        }
        await esc();
      }
    }
    const gate = GAME.gates.find((g) => g.after === lv);
    await page.locator('[data-gate-expand]').click();
    await sleep(page, 300);
    for (const [i, b] of gate.blanks.entries()) {
      await page.locator(`[data-gate-blank="${i}"]`).click();
      await sleep(page, 160);
      const key = b.answerEntry ? 'entry:' + b.answerEntry : 'title:' + b.answerTitle;
      await page.locator(`[data-pick="${key}"]`).click();
      await sleep(page, 130);
    }
    await shotD(`第${'一二三'[lv - 1]}卷_关卡出口完形填空`);
    await page.locator('[data-gate-check]').click();
    await shotD(`第${'一二三'[lv - 1]}卷_过关`, { wait: 1100 });
    await sleep(page, 1800);

    if (lv < MAX_LEVEL) {
      await advanceIntro(`第${'一二三'[lv]}卷过场`);
      await takeSnap(page, `l${lv + 1}start`);
      await tab('cards');
    }
  }

  // ---- 结局 ----
  await sleep(page, 1500);
  await takeSnap(page, 'ending');
  await shotD('结局', { wait: 2500 });
  // 结局逐页点开；读完会自动弹出「通关纪念」
  const settleOpen = () => page.locator('.settle-ceremony').count();
  for (let i = 0; i < 14; i++) {
    if ((await settleOpen()) || (await page.locator('.ending-foot .ending-btn').count())) break;
    await page.locator('.ending').click({ position: { x: 720, y: 450 } }).catch(() => {});
    await sleep(page, 900);
  }
  await sleep(page, 1500);
  if (!(await settleOpen())) await page.locator('.ending-foot .ending-btn').first().click().catch(() => {});
  await shotD('通关纪念', { wait: 2200 });
  const closeSettle = page.locator('.settle-ceremony [aria-label="关闭"]').first();
  if (await closeSettle.count()) await closeSettle.click().catch(() => {});
  else await esc();
  await shotD('结局_尾声', { wait: 1500 });
  const fin = await S();
  console.log('结局屏:', fin.screen, '| 错误', fin.stats?.errors, '| 星级', JSON.stringify(Object.fromEntries(Object.entries(fin.gates).map(([k, v]) => [k, v.stars]))));
  await ctx.close();
}

// ======================================================================
// 存档快照复拍
// ======================================================================
async function restore(page, snapKey, lang) {
  await page.goto(BASE + `?lang=${lang}`);
  await page.evaluate((snap) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(JSON.parse(snap))) localStorage.setItem(k, v);
  }, snapshots[snapKey]);
  await page.goto(BASE + `?lang=${lang}`);
  await page.waitForTimeout(2400);
}
async function continueGame(page) {
  await page.locator('.cover-btn.is-primary').first().click();
  await page.waitForTimeout(1200);
}

async function phoneRun() {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  watch(page, 'phone');
  const shotP = (name, opts) => shot(page, 'phone', `竖屏_${name}`, opts);
  const tabP = async (id) => {
    await page.locator(`.tabs-bottom .tab[data-tab="${id}"]`).click({ force: true });
    await page.waitForTimeout(400);
  };

  await restore(page, 'l2mid', 'zh-CN');
  await shotP('封面', { wait: 1200 });
  await continueGame(page);
  await tabP('cards');
  await shotP('情节卡列表');
  await page.locator('[data-card-item="c2_03"]').first().click();
  await shotP('情节卡待补全', { wait: 1500 });
  await page.locator('.phone-back').click().catch(() => {});
  await page.waitForTimeout(300);
  await page.locator('[data-card-item="c2_12"]').first().click();
  await shotP('情节卡已补全', { wait: 1500 });
  await page.locator('.phone-back').click().catch(() => {});
  await page.waitForTimeout(300);
  const drawer = page.locator('[data-entry-drawer]');
  if (await drawer.count()) {
    await drawer.click();
    await shotP('词条库抽屉', { wait: 900 });
    await page.locator('.drawer-mask').click().catch(() => {});
    await page.waitForTimeout(300);
  }
  await tabP('timeline');
  await shotP('时间轴', { wait: 900 });
  await tabP('archive');
  await page.locator('[data-arc="e_fuqin"]').first().click().catch(() => {});
  await shotP('档案', { wait: 1000 });
  await tabP('notes');
  await shotP('故事页', { wait: 900 });

  await restore(page, 'l3start', 'zh-CN');
  await continueGame(page);
  await tabP('cards');
  await page.locator('[data-card-item="c3_01"]').first().click().catch(() => {});
  await shotP('第三卷情节卡', { wait: 1500 });

  await restore(page, 'ending', 'zh-CN');
  await continueGame(page);
  await shotP('结局', { wait: 2500 });
  await ctx.close();
}

async function langRun() {
  // 拉丁/天城体标签更长，1440 宽时顶栏作品名会被压成省略号；多语言组用 1680×1050
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  watch(page, 'lang');
  for (const [lang, label] of LANGS) {
    const shotL = (name, opts) => shot(page, 'lang', `${label}_${name}`, opts);
    await restore(page, 'l2mid', lang);
    if (['en', 'ja', 'hi'].includes(lang)) await shotL('封面', { wait: 1200 });
    await continueGame(page);
    await page.locator('.tabs .tab[data-tab="cards"]').click();
    await page.waitForTimeout(300);
    await page.locator('[data-card-item="c2_12"]').first().click();
    await shotL('情节卡', { wait: 1500, clean: true });
    await page.locator('.tabs .tab[data-tab="timeline"]').click();
    await shotL('时间轴', { wait: 1000 });
    if (['en', 'ja', 'ko'].includes(lang)) {
      await page.locator('.tabs .tab[data-tab="archive"]').click();
      await page.locator('[data-arc="e_fuqin"]').first().click().catch(() => {});
      await shotL('档案', { wait: 1000 });
    }
  }
  await ctx.close();
}

try {
  if (!ONLY || ONLY === 'desktop') await desktopRun();
  for (const k of ['l2mid', 'l3start', 'ending']) {
    if (!snapshots[k]) throw new Error(`缺少存档快照 ${k}：请先完整跑一次（不带 --only）`);
  }
  if (!ONLY || ONLY === 'phone') await phoneRun();
  if (!ONLY || ONLY === 'lang') await langRun();
} finally {
  await browser.close();
  server.close();
}
const shots = fs.readdirSync(OUT).filter((f) => f.endsWith('.jpg')).length;
console.log(`\n完成：${shots} 张 → ${path.relative(ROOT, OUT)}`);
console.log('console 错误:', consoleErrors.length ? consoleErrors.slice(0, 12) : '无');
