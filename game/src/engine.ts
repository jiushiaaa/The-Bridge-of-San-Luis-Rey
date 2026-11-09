// Adapted from 柳柳《悉达多》: collectible entries → search → identity blanks → timeline → chapter gate.
// This edition removes stamina/ranking, and separates a narrated dream from factual chronology.
import type { Action, Book, Card, CardState, Save } from './types';
const emptyCard = (): CardState => ({ read: false, solved: false, placed: false, answers: {} });
export const cardsOfChapter = (book: Book, chapter: number) => book.cards.filter(c => c.chapter === chapter);
export const entryIdsInText = (text: string): string[] => [...text.matchAll(/\{\{(e_[a-z0-9_]+)\|[^}]*\}\}/g)].map(m => m[1]);
export const plainText = (text: string) => text.replace(/\{\{e_[a-z0-9_]+\|([^}]*)\}\}/g, '$1');
export const resolved = (card: Card, save: Save) => Boolean(save.cards[card.id]?.solved && save.cards[card.id]?.read && (card.kind === 'dream' || save.cards[card.id]?.placed));
export const chapterDone = (book: Book, save: Save, chapter = save.chapter) => cardsOfChapter(book, chapter).every(c => resolved(c, save));
export function newSave(book: Book, now = Date.now(), run = `${now}-${Math.random().toString(36).slice(2)}`): Save {
  const s: Save = { story: book.id, version: book.version, run, phase: 'intro', chapter: 1, introPage: 0, endingPage: 0, selected: '', cards: {}, known: [], passed: [], gateAnswers: {}, reflections: {}, stats: { startedAt: now, finishedAt: null, activeMs: 0, hints: 0, attempts: 0 }, settings: { music: false, volume: .24, fontSize: 19 } };
  startChapter(book, s, 1); return s;
}
function startChapter(book: Book, s: Save, chapter: number) {
  s.chapter = chapter; s.introPage = 0; s.phase = 'intro';
  for (const c of cardsOfChapter(book, chapter).filter(c => c.start)) s.cards[c.id] = emptyCard();
  s.selected = cardsOfChapter(book, chapter).find(c => s.cards[c.id])!.id;
}
export function transition(book: Book, current: Save, action: Action, now = Date.now()): { state: Save; message?: string } {
  const s: Save = structuredClone(current);
  const chapter = book.chapters.find(c => c.id === s.chapter)!;
  const card = 'id' in action ? book.cards.find(c => c.id === action.id) : undefined;
  const activeCard = card && card.chapter === s.chapter && s.cards[card.id] && s.phase === 'reading';
  const result = (message?: string) => ({ state: s, message });
  switch (action.type) {
    case 'introNext':
      if (s.phase !== 'intro') break;
      if (s.introPage < chapter.intro.length - 1) s.introPage++; else s.phase = 'reading';
      break;
    case 'select':
      if (card && s.cards[card.id] && (card.chapter <= s.chapter)) s.selected = card.id;
      break;
    case 'read':
      if (!activeCard) break;
      s.cards[card!.id].read = true;
      // Reading collects mentions too: keyboard/accessibility users need not hunt every highlighted word.
      s.known = [...new Set([...s.known, ...card!.entries])];
      return result('已读。人物与线索收入索引，可以据此寻找新的残页。');
    case 'collect':
      if (s.phase !== 'reading' || !book.entries[action.id]) break;
      if (!Object.keys(s.cards).some(id => book.cards.find(c => c.id === id)?.entries.includes(action.id))) break;
      s.known = [...new Set([...s.known, action.id])];
      return result(`已记下：${book.entries[action.id].name}`);
    case 'search': {
      if (s.phase !== 'reading' || !s.known.includes(action.id)) break;
      const next = cardsOfChapter(book, s.chapter).find(c => !s.cards[c.id] && c.entries.includes(action.id));
      if (!next) return result('这一卷与该词条有关的残页已经全部找到。');
      s.cards[next.id] = emptyCard(); s.selected = next.id;
      return result(`找到残页：${next.title}`);
    }
    case 'answer':
      if (!activeCard || s.cards[card!.id].solved || !card!.blanks.some(b => b.id === action.slot) || !s.known.includes(action.value)) break;
      s.cards[card!.id].answers[action.slot] = action.value; break;
    case 'solve': {
      if (!activeCard || s.cards[card!.id].solved) break;
      const cs = s.cards[card!.id];
      if (!cs.read) return result('先把这页读完，再辨认其中的人。');
      if (card!.blanks.some(b => !cs.answers[b.id])) return result('还有身份没有填写。');
      s.stats.attempts++;
      if (!card!.blanks.every(b => cs.answers[b.id] === b.answer)) return result('有一处与文字不符。可以打开提示，回到具体的句子。');
      cs.solved = true;
      return result(card!.kind === 'dream' ? '梦境插页已收入旁注，不放入真实事件的时间线。' : '人物已辨明。接下来，把这页放回故事发生的阶段。');
    }
    case 'place':
      if (!activeCard || !s.cards[card!.id].solved || card!.kind === 'dream') break;
      if (action.period !== card!.period) return result('这一阶段还对不上。留意信件、疾病或出行发生在什么之前、之后。');
      s.cards[card!.id].placed = true;
      return result('已归档。这个阶段内的几件事不必再排出原著没有交代的先后。');
    case 'hint':
      if (!activeCard) break;
      s.stats.hints++; return result(card!.blanks.map(b => b.hint).join(' '));
    case 'gateAnswer':
      if (s.phase !== 'reading' || !chapter.gate.some(b => b.id === action.slot) || !s.known.includes(action.value)) break;
      (s.gateAnswers[String(s.chapter)] ??= {})[action.slot] = action.value; break;
    case 'gate':
      if (s.phase !== 'reading' || !chapterDone(book, s)) return result('这一卷还有未读、未辨认或未归档的残页。');
      if (!chapter.gate.every(b => s.gateAnswers[String(s.chapter)]?.[b.id] === b.answer)) return result('回顾中的人物尚未全部对应。答案只依据事件，不评判谁值得被爱。');
      s.passed = [...new Set([...s.passed, s.chapter])];
      if (s.chapter < book.chapters.length) startChapter(book, s, s.chapter + 1);
      else { s.phase = 'ending'; s.endingPage = 0; }
      break;
    case 'reflect':
      if (s.phase === 'reading') s.reflections[String(s.chapter)] = action.value.slice(0, 1000);
      break;
    case 'endingNext':
      if (s.phase !== 'ending') break;
      if (s.endingPage < book.ending.length - 1) s.endingPage++;
      else { s.phase = 'complete'; s.stats.finishedAt = now; }
      break;
    case 'settings': {
      const v = action.value;
      if (typeof v.music === 'boolean') s.settings.music = v.music;
      if (Number.isFinite(v.volume)) s.settings.volume = Math.max(0, Math.min(.6, v.volume!));
      if (Number.isFinite(v.fontSize)) s.settings.fontSize = Math.max(17, Math.min(25, v.fontSize!));
      break;
    }
    case 'tick':
      if (s.phase !== 'complete' && Number.isFinite(action.ms) && action.ms > 0 && action.ms <= 20000) s.stats.activeMs += action.ms;
      break;
  }
  return result();
}

/** Validate imported/untrusted saves before adopting them. Never mutate the input or silently start over. */
export function validateSave(book: Book, raw: unknown): Save {
  const fail = (): never => { throw new Error('存档格式或内容不兼容，原进度没有被替换。'); };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail();
  const s = raw as Save;
  if (s.story !== book.id || s.version !== book.version || typeof s.run !== 'string' || !s.run || s.run.length > 100) return fail();
  if (!['intro','reading','ending','complete'].includes(s.phase) || !Number.isInteger(s.chapter) || s.chapter < 1 || s.chapter > book.chapters.length) return fail();
  const ch = book.chapters[s.chapter - 1];
  if (!Number.isInteger(s.introPage) || s.introPage < 0 || s.introPage >= ch.intro.length || !Number.isInteger(s.endingPage) || s.endingPage < 0 || s.endingPage >= book.ending.length) return fail();
  if (!s.cards || Array.isArray(s.cards) || !Array.isArray(s.known) || !Array.isArray(s.passed) || !s.gateAnswers || !s.reflections || !s.stats || !s.settings) return fail();
  if (s.known.some(id => typeof id !== 'string' || !Object.hasOwn(book.entries, id)) || new Set(s.known).size !== s.known.length) return fail();
  for (const [id, cs] of Object.entries(s.cards)) {
    const c = book.cards.find(c => c.id === id);
    if (!c || c.chapter > s.chapter || !cs || !cs.answers || typeof cs.read !== 'boolean' || typeof cs.solved !== 'boolean' || typeof cs.placed !== 'boolean') return fail();
    for (const [slot, answer] of Object.entries(cs.answers)) if (!c.blanks.some(b => b.id === slot) || !s.known.includes(answer)) return fail();
    if (cs.solved && (!cs.read || !c.blanks.every(b => cs.answers[b.id] === b.answer))) return fail();
    if (cs.placed && (!cs.solved || c.kind === 'dream')) return fail();
  }
  if (!s.cards[s.selected] || !cardsOfChapter(book, s.chapter).filter(c => c.start).every(c => s.cards[c.id])) return fail();
  const expectedPassed = Array.from({ length: s.phase === 'ending' || s.phase === 'complete' ? book.chapters.length : s.chapter - 1 }, (_, i) => i + 1);
  if (JSON.stringify(s.passed) !== JSON.stringify(expectedPassed)) return fail();
  for (const [lv, answers] of Object.entries(s.gateAnswers)) {
    const c = book.chapters.find(c => String(c.id) === lv);
    if (!c || c.id > s.chapter || !answers || Array.isArray(answers)) return fail();
    for (const [id, value] of Object.entries(answers)) if (!c.gate.some(b => b.id === id) || !s.known.includes(value)) return fail();
  }
  for (const lv of s.passed) if (!chapterDone(book, s, lv) || !book.chapters[lv-1].gate.every(b => s.gateAnswers[String(lv)]?.[b.id] === b.answer)) return fail();
  for (const [lv, value] of Object.entries(s.reflections)) if (!book.chapters.some(c => String(c.id) === lv) || typeof value !== 'string' || value.length > 1000) return fail();
  for (const n of ['startedAt','activeMs','hints','attempts'] as const) if (!Number.isFinite(s.stats[n]) || s.stats[n] < 0) return fail();
  if (s.phase === 'complete' ? !Number.isFinite(s.stats.finishedAt) || s.stats.finishedAt! < s.stats.startedAt : s.stats.finishedAt !== null) return fail();
  if (typeof s.settings.music !== 'boolean' || !Number.isFinite(s.settings.volume) || s.settings.volume < 0 || s.settings.volume > .6 || !Number.isFinite(s.settings.fontSize) || s.settings.fontSize < 17 || s.settings.fontSize > 25) return fail();
  return structuredClone(s);
}
