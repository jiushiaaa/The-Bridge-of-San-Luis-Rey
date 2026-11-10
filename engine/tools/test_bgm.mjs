// Unit harness for the inherited player. No browser automation or audible review.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'frontend/package.json'));
const { build } = require('esbuild');
const { outputFiles } = await build({
  entryPoints: [path.join(root, 'frontend/src/game/bgm.ts')], bundle: true,
  platform: 'node', format: 'cjs', write: false,
  plugins: [{ name: 'player-unit-dependencies', setup(b) {
    b.onResolve({ filter: /^(react|\.\/data|\.\/store|\.\.\/i18n)$/ }, a => ({ path: a.path, namespace: 'unit' }));
    b.onLoad({ filter: /.*/, namespace: 'unit' }, a => ({ contents: {
      react: 'export const useSyncExternalStore=(_,get)=>get();',
      './data': 'export const data=globalThis.fixture; export const GAME_ID=data.meta.id; export const assetUrl=p=>p;',
      './store': 'export const getState=()=>globalThis.state; export const pushToast=x=>globalThis.toasts.push(x); export const subscribeGame=fn=>globalThis.subscribers.push(fn);',
      '../i18n': 'export const t=(key,params)=>key+JSON.stringify(params||{});',
    }[a.path], loader: 'js' }));
  } }],
});

async function harness(book) {
  const fixture = JSON.parse(await readFile(path.join(root, 'workspace', book, 'final_game.json'), 'utf8'));
  let now = 0, timerId = 0;
  const timers = new Map(), audio = [], prefs = new Map();
  class AudioStub {
    volume = 1; paused = true; ended = false; currentTime = 0; duration = 110; loop = false;
    listeners = new Map();
    constructor() { audio.push(this); }
    set src(v) { this.file = v; this.ended = false; this.currentTime = 0; }
    get src() { return this.file || ''; }
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    async play() { this.paused = false; }
    pause() { this.paused = true; }
  }
  const context = { fixture, state: { level: 1, screen: 'game', cards: {}, stats: {} },
    subscribers: [], toasts: [], Audio: AudioStub, console, performance: { now: () => now },
    localStorage: { getItem: k => prefs.get(k) ?? null, setItem: (k,v) => prefs.set(k,v) },
    exports: {}, module: { exports: {} },
    window: {
      setInterval(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms, at: now + ms, repeat: true }); return id; },
      clearInterval(id) { timers.delete(id); },
      setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms, at: now + ms }); return id; },
      clearTimeout(id) { timers.delete(id); },
    },
  };
  vm.runInNewContext(outputFiles[0].text, context, { filename: 'bgm.unit.cjs' });
  const flush = async () => { for (let i=0;i<6;i++) await Promise.resolve(); };
  const advance = async ms => {
    const until = now + ms;
    while (true) {
      const next = [...timers].filter(([,t]) => t.at <= until).sort((a,b) => a[1].at-b[1].at)[0];
      if (!next) break;
      const [id, timer] = next; now = timer.at;
      if (timer.repeat) timer.at += timer.ms; else timers.delete(id);
      timer.fn(); await flush();
    }
    now = until; await flush();
  };
  return { api: context.module.exports, fixture, context, audio, prefs, advance, flush,
    changed() { context.subscribers.forEach(fn => fn()); } };
}

const h = await harness('sanluisrey'), a = h.api;
const expected = id => .48 * 10 ** ((h.fixture.assets.bgm.find(t=>t.id===id).gainDb ?? 0) / 20);
const near = (got,want) => assert.ok(Math.abs(got-want)<.00001, `${got} != ${want}`);
a.syncBgmStage({ showTitle: true, screen: 'game', level: 1 });
assert.equal(h.audio[0].paused, true, 'no playback before user gesture');
a.unlockBgmGesture(); await h.flush();
assert.equal(h.audio[0].volume, 0, 'gesture-start gets a soft attack');
await h.advance(1200); near(h.audio[0].volume, expected('m_title'));
assert.equal(a.useBgm().trackId, 'm_title');

h.changed();
a.syncBgmStage({ showTitle: false, screen: 'game', level: 1 });
await h.advance(2400);
assert.deepEqual(Array.from(a.bgmPlaylistIds()), ['m1_00']);
h.context.state.cards.c1_03 = { done: true }; h.changed();
await h.advance(2400);
assert.equal(a.useBgm().trackId, 'm1_01', 'new card track unlocks and plays');
assert.equal(a.useBgm().newTrackId, 'm1_01');
assert.ok(h.context.toasts.length);
near(h.audio[0].volume, expected('m1_01'));

a.toggleBgm(); assert.equal(h.audio[0].paused, true);
a.toggleBgm(); await h.flush(); assert.equal(h.audio[0].volume, 0);
await h.advance(1200); near(h.audio[0].volume, expected('m1_01'));
a.setBgmEnabled(false); await h.advance(120); a.setBgmEnabled(true);
await h.advance(1500);
assert.equal(h.audio[0].paused, false, 'cancelled mute fade must not pause a re-enabled track');
near(h.audio[0].volume, expected('m1_01'));

a.playBgmTrack('m1_00'); await h.advance(120); a.playBgmTrack('m1_01');
await h.advance(2500);
assert.equal(a.useBgm().trackId, 'm1_01', 'latest selection wins during fade');
assert.equal(h.audio[0].paused, false);
near(h.audio[0].volume, expected('m1_01'));
a.setBgmTrackSelected('m_title', true);
assert.ok(a.bgmPlaylistIds().includes('m_title'));
a.setBgmMode('one'); assert.equal(h.audio[0].loop, true);
a.setBgmMode('loop'); assert.equal(h.audio[0].loop, false);
a.setBgmMode('shuffle'); assert.equal(a.useBgm().mode, 'shuffle');
assert.ok(h.prefs.get('baima:bgm:slr').includes('shuffle'));
h.context.state.level = 2;
a.syncBgmStage({ showTitle: false, screen: 'game', level: 2 });
await h.advance(2400);
assert.deepEqual(Array.from(a.bgmPlaylistIds()), ['m2_00'], 'chapter switch clears pins and exclusions');
a.setBgmTrackSelected('m2_00', false);
assert.deepEqual(Array.from(a.bgmPlaylistIds()), ['m2_00'], 'last track cannot be removed');

const old = await harness('xidaduo');
old.api.syncBgmStage({showTitle:true,screen:'game',level:1}); old.api.unlockBgmGesture();
await old.flush(); near(old.audio[0].volume,.48);
assert.equal(old.audio[0].paused,false,'original book keeps its playback behavior');
console.log('PASS: gesture, gain, soft attack, unlock, pause/resume, mute cancellation, rapid reselection, modes, pins, chapter reset, last-track protection, upstream default. Unit simulation; audible/platform behavior is separate.');
