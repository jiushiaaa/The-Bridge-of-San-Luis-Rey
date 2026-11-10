/** 风格实验室用只读 fixture，不读写真实存档。 */

export type VariantId = 'v5' | 'v6';
export type SceneId = 'title' | 'game' | 'overlay' | 'intro';
export type GameTab = 'notes' | 'cards' | 'archive' | 'timeline';
export type FrameId = 'fluid' | 'phone' | 'narrow' | 'desktop';

export const VARIANTS: {
  id: VariantId;
  combo: string;
  short: string;
  styles: string;
  metaphor: string;
}[] = [
  {
    id: 'v5',
    combo: '组合 5',
    short: '5 纸刊阅读',
    styles: '#56 纸刊 + #46 层叠（阅读向）',
    metaphor: '冷白纸刊对照：合并前的冻结份',
  },
  {
    id: 'v6',
    combo: '组合 5 备份',
    short: '6 纸刊备份',
    styles: '生产纸刊的实验叠层，改这里不会改生产',
    metaphor: '冷白纸刊实验：后续视觉试验只动这一份',
  },
];

export const FRAMES: { id: FrameId; label: string; width: string }[] = [
  { id: 'fluid', label: '铺满', width: '100%' },
  { id: 'phone', label: '手机 390', width: '390px' },
  { id: 'narrow', label: '窄窗 1100', width: '1100px' },
  { id: 'desktop', label: '桌面 1440', width: '1440px' },
];

export const SAMPLE = {
  title: '尘埃落定',
  subtitle: '把打乱的情节卡拼回完整故事',
  level: 2,
  stamina: 4,
  stats: { errors: 2, hints: 1, rests: 0 },
  chapter: '土司家的规矩',
  cards: [
    {
      id: 'c1',
      form: 'scene' as const,
      title: '夜里谁在北仓门口',
      desc: '夜里有人在仓库外停住脚步，灯火只亮了一角。',
      status: 'todo' as const,
      slots: ['empty', 'empty'] as const,
    },
    {
      id: 'c2',
      form: 'dialogue' as const,
      title: '仓房对质',
      desc: '两个人把话说得很轻，像怕被墙听见。',
      status: 'sort' as const,
      slots: ['locked', 'draft'] as const,
      active: true,
    },
    {
      id: 'c3',
      form: 'monologue' as const,
      title: '我把钥匙还回去',
      desc: '我反复告诉自己：这只是一件该做的事。',
      status: 'done' as const,
      slots: [] as const,
    },
  ],
  chat: {
    title: '仓房对质',
    form: 'dialogue' as const,
    status: 'sort' as const,
    narr: '灯只亮了半边。仓房门半开，里面的气味又潮又旧。两个人谁也不肯先把名字说全。',
    lines: [
      { who: 'npc', name: 'NPC1', text: '你来得太晚。钥匙还在原来的地方吗？' },
      { who: 'known', name: '塔娜', text: '别用那种口气。今晚不是审问。' },
      { who: 'extra', name: '看守', text: '（低声）外面还有人。' },
    ],
  },
  entries: [
    { id: 'e1', kind: 'person' as const, name: '塔娜', desc: '土司家的人，说话总留半句。', fam: 3, search: false },
    { id: 'e2', kind: 'person' as const, name: '桑吉', desc: '新来的书记官，记性好。', fam: 2, search: true, best: true },
    { id: 'e3', kind: 'place' as const, name: '北仓', desc: '夜里上锁，白天卸货。', fam: 1, search: false },
    { id: 'e4', kind: 'item' as const, name: '铜钥匙', desc: '齿纹很浅，像被磨过。', fam: 0, search: true },
  ],
  archive: [
    { name: '塔娜', pages: '2 / 3', state: 'open' as const },
    { name: '桑吉', pages: '0 / 2', state: 'locked' as const },
    { name: '北仓', pages: '1 / 1', state: 'done' as const },
  ],
  timeline: [
    { title: '仓房对质', state: 'placed' as const, form: 'dialogue' as const },
    { title: '？？？', state: 'undone' as const, form: 'scene' as const },
    { title: '我把钥匙还回去', state: 'locked' as const, form: 'monologue' as const },
    { title: '选中格', state: 'selected' as const, form: 'scene' as const },
  ],
  metrics: { restored: 18, placed: 12, archives: 9, readers: '1,284' },
  toast: '词条已收入：铜钥匙',
  picker: ['塔娜', '桑吉', '麦其', '翁姆'],
};
