// Exercise the actual inherited actions, data, locale and local-save modules.
// Only React rendering, sound output and phone navigation are stubbed. This is
// a rule regression, not a human playthrough or a reading-time measurement.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'frontend/package.json'));
const { build } = require('esbuild');
const result = await build({
  stdin: { contents: `export * as logic from './game/logic'; export * as store from './game/store';
    export * as data from './game/data'; export * as save from './game/save'; export * as locale from './i18n';`,
    resolveDir: path.join(root, 'frontend/src'), loader: 'ts' },
  bundle: true, platform: 'node', format: 'cjs', write: false,
  define: { 'import.meta.env': '{"VITE_ONLY_GAME":"slr"}' },
  plugins: [{ name: 'non-browser-rule-harness', setup(b) {
    b.onResolve({ filter: /\.json\?raw$/ }, a => ({ path: path.resolve(a.resolveDir, a.path.slice(0, -4)), namespace: 'raw' }));
    b.onLoad({ filter: /.*/, namespace: 'raw' }, async a => ({ contents: await fs.readFile(a.path, 'utf8'), loader: 'text' }));
    b.onResolve({ filter: /^(react|\.\/sfx|\.\/layout)$/ }, a => ({ path: a.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, a => ({ contents: {
      react: 'export const useSyncExternalStore=(_,get)=>get(); export const useEffect=()=>{}; export const useState=x=>[x,()=>{}];',
      './sfx': 'export const playCue=()=>{}; export const sfxCommitSelect=()=>{}; export const sfxSkipLayer=()=>{}; export const startLoop=()=>1; export const stopAllSfx=()=>{}; export const stopLoop=()=>{}; export const sfxOnUiChange=()=>{};',
      './layout': 'export const isPhone=()=>false; export const pushMobileLayer=()=>{};',
    }[a.path], loader: 'js' }));
  } }],
});

function harness(language) {
  const prefs = new Map([['slr_locale', language], ['xdd_locale', 'de']]);
  let now = 0, nextTimer = 0;
  const timers = new Map();
  const setTimer = (fn, delay) => { const id = ++nextTimer; timers.set(id, {fn, at: now + delay}); return id; };
  const context = { console, structuredClone, URLSearchParams, module: {exports:{}}, exports:{},
    navigator: {languages: [language]},
    localStorage: {getItem: k => prefs.get(k) ?? null, setItem: (k,v) => prefs.set(k,v), removeItem: k => prefs.delete(k)},
    setTimeout: setTimer, clearTimeout: id => timers.delete(id),
    window: { location: {search:''}, setTimeout: setTimer, clearTimeout: id => timers.delete(id), matchMedia: () => ({matches:true}) },
  };
  vm.runInNewContext(result.outputFiles[0].text, context, {filename: 'slr-rules.cjs'});
  return {...context.module.exports, prefs, tick(ms) {
    const end = now + ms;
    while (true) {
      const next = [...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
      if (!next) break;
      const [id,t] = next; timers.delete(id); now=t.at; t.fn();
    }
    now=end;
  }};
}

const serialized = x => JSON.stringify(x);
function play(language, difficulty, order) {
  const h = harness(language), {logic:l, store:s, data:d, save:v, locale:i} = h;
  assert.equal(i.getLocale(), language, 'book-specific language preference');
  assert.equal(d.GAME_LOCALES.join(','), 'zh-CN,en');
  i.setLocale('de'); assert.equal(i.getLocale(), language, 'unfinished languages cannot be selected');
  l.newGame(); l.setDifficulty(difficulty);
  let searches=0, analyzed=0;
  for (let level=1; level<=3; level++) {
    assert.equal(s.getState().level, level);
    assert.equal(l.gateChecklist(level).ok, false);
    l.autoFillGate(level);
    assert.ok(!s.getState().gates[String(level)], 'auto answers require full completion');
    for (let n=0; s.getState().introLevel != null && n<20; n++) l.advanceIntro();
    assert.equal(s.getState().introLevel, null);
    assert.equal(l.recapAvailable(level), false);
    let iterations=0;
    while (iterations++ < 150) {
      let progress=false;
      for (const c of d.cardsOfLevel(level)) {
        if (!s.getState().cards[c.id]?.unlocked) continue;
        l.markRead(c.id);
        for (const segment of c.segments) for (const eid of d.entryIdsInText(segment.text)) {
          if (l.clickEntry(eid, c.id)) progress=true;
          const fam=s.getState().entries[eid].familiarity;
          l.clickEntry(eid,c.id);
          assert.equal(s.getState().entries[eid].familiarity, fam, 'same chip cannot farm familiarity');
        }
        if (!s.getState().cards[c.id].done && l.cardFillable(c)) {
          for (const blank of c.blanks) {
            const options=Array.isArray(blank.answer)?blank.answer:[blank.answer];
            l.setSlotDraft(c.id,blank.slot,options.find(eid=>s.getState().entries[eid]?.collected));
          }
          l.verifyCard(c.id); assert.equal(s.getState().cards[c.id].done,true); progress=true;
          const before=s.getState().stamina;
          l.verifyCard(c.id); assert.equal(s.getState().stamina,before,'card reward is not repeatable');
          const cell=d.correctCell(c); l.placeCard(c.id,cell.row,cell.col);
        }
      }
      if (d.cardsOfLevel(level).every(c=>s.getState().cards[c.id]?.done)) break;
      if (!progress) {
        const available=Object.keys(d.data.entries).filter(eid=>s.getState().entries[eid]?.collected && l.searchRemaining(eid)>0);
        assert.ok(available.length,`no discoverable path at level ${level}`);
        const target=order==='recommended'?l.bestSearchTarget().entryId:available[available.length-1];
        if(s.getState().stamina<d.data.meta.stamina.searchCost) l.rest();
        const before=Object.values(s.getState().cards).filter(c=>c.unlocked).length;
        l.searchEntry(target); searches++;
        assert.equal(Object.values(s.getState().cards).filter(c=>c.unlocked).length,before+1,'search never repeats a card');
      }
    }
    assert.ok(iterations<150, 'discovery converges');
    assert.equal(l.gateChecklist(level).locked,20);
    assert.equal(l.recapAvailable(level),true);
    for (const [eid,e] of Object.entries(d.data.entries)) {
      while(l.analyzable(eid)) { l.analyzeEntry(eid); h.tick(2001); analyzed++; }
      e.archive.forEach((page,idx)=>{
        if(page.level!==level) return;
        assert.ok(s.getState().entries[eid]?.pagesUnlocked.includes(idx), `${eid} archive reachable`);
        page.fields.forEach((field,fi)=>{ if(field.blank) l.setArchiveDraft(eid,idx,fi,field.blank.answer); });
        l.checkArchivePage(eid,idx);
        assert.ok(s.getState().entries[eid].pagesDone.includes(idx));
      });
    }
    assert.equal(l.gateChecklist(level).progress,1);
    const beforeSwitch=serialized(s.getState());
    i.setLocale(i.getLocale()==='en'?'zh-CN':'en');
    assert.equal(serialized(s.getState()),beforeSwitch,'language switch preserves save state');
    assert.equal(serialized(v.loadGame()),beforeSwitch,'saved IDs remain compatible across languages');
    for (const c of d.cardsOfLevel(level)) assert.equal(s.getState().cards[c.id].pos.col,d.correctCell(c).col);
    l.autoFillGate(level); l.checkGate(level); h.tick(2201);
    assert.equal(s.getState().gates[String(level)].passed,true);
    assert.equal(s.getState().gates[String(level)].maxStars,difficulty==='hard'?5:3);
    if(level<3) {
      assert.ok(Object.values(s.getState().entries).every(e=>e.familiarity===0),'chapter familiarity resets');
      const beforeReview=serialized(s.getState()); l.reviewLevel(level);
      assert.equal(serialized(s.getState()),beforeReview,'past chapter review must not overwrite progress');
      l.reviewLevel(null);
    }
  }
  assert.equal(s.getState().screen,'ending');
  for(let n=0;n<d.data.frame.ending.segments.length+2;n++) l.advanceEnding();
  assert.equal(s.getState().endingIdx,d.data.frame.ending.segments.length-1);
  const finished=serialized(s.getState()); l.backToTitle(); l.continueGame();
  assert.equal(serialized(s.getState()),finished);
  assert.equal(serialized(v.loadGame()),finished);
  assert.equal(Object.values(s.getState().cards).filter(c=>c.done).length,60);
  console.log(`PASS ${language}/${difficulty}/${order}: 60 cards, ${analyzed} archive pages, ${searches} distinct searches, three gates, ending, live language changes and save reload.`);
}

play('zh-CN','easy','recommended');
play('en','hard','reverse');
const h=harness('zh-CN'); h.logic.newGame();
const first=h.data.cardsOfLevel(1).find(c=>h.store.getState().cards[c.id]?.unlocked);
const b=first.blanks[0];
h.logic.setSlotDraft(first.id,b.slot,'e_care'); h.logic.verifyCard(first.id);
assert.equal(h.store.getState().stats.errors,1);
assert.ok(!h.store.getState().cards[first.id].slotDraft[b.slot]);
for(let n=0;n<3;n++) h.logic.rest();
assert.equal(h.logic.starBreakdown().restDed,1);
h.prefs.set('slr_save_v1','{broken'); assert.equal(h.save.loadGame(),null);
console.log('PASS wrong-answer clearing, rest/star deduction and malformed-save rejection. Human reading time, visuals and platform behavior are not measured here.');
