export type Segment = { kind: 'narration' | 'quote'; text: string; attribution?: string };
export type Entry = { name: string; role: string; desc: string; image?: string; portraitPosition?: string; after: number; sources: string[] };
export type Blank = { id: string; prompt: string; answer: string; hint: string };
export type Card = {
  id: string; chapter: number; title: string; segments: Segment[]; entries: string[];
  blanks: Blank[]; period: number | null; kind: 'event' | 'dream'; image: string;
  sources: string[]; sourceNote: string; start?: boolean;
};
export type Chapter = {
  id: number; title: string; subtitle: string; question: string; image: string; music: string;
  intro: string[]; periods: { title: string; hint: string }[]; gate: Blank[];
  reflection: { question: string; options: string[] }; recap: string[];
};
export type Book = {
  id: string; version: number; title: string; subtitle: string;
  entries: Record<string, Entry>; cards: Card[]; chapters: Chapter[];
  ending: { title: string; text: string; image: string; sources: string[] }[];
  credits: string[];
};
export type CardState = { read: boolean; solved: boolean; placed: boolean; answers: Record<string, string> };
export type Save = {
  story: string; version: number; run: string; phase: 'intro' | 'reading' | 'ending' | 'complete';
  chapter: number; introPage: number; endingPage: number; selected: string;
  cards: Record<string, CardState>; known: string[]; passed: number[];
  gateAnswers: Record<string, Record<string, string>>; reflections: Record<string, string>;
  stats: { startedAt: number; finishedAt: number | null; activeMs: number; hints: number; attempts: number };
  settings: { music: boolean; volume: number; fontSize: number };
};
export type Action =
  | { type: 'introNext' } | { type: 'select'; id: string } | { type: 'read'; id: string }
  | { type: 'collect'; id: string } | { type: 'search'; id: string }
  | { type: 'answer'; id: string; slot: string; value: string } | { type: 'solve'; id: string }
  | { type: 'place'; id: string; period: number } | { type: 'hint'; id: string }
  | { type: 'gateAnswer'; slot: string; value: string } | { type: 'gate' }
  | { type: 'reflect'; value: string } | { type: 'endingNext' }
  | { type: 'settings'; value: Partial<Save['settings']> } | { type: 'tick'; ms: number };
