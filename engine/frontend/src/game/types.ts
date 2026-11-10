// final_game.json 的数据类型与游戏状态类型定义
// 所有故事内容均以 final_game.json 为准，引擎代码不硬编码任何剧情文本

// ---------- 数据层（final_game.json schema） ----------

export interface StaminaConf {
  start: number;
  perLevel: number;
  searchCost: number;
  completeReward: number;
  restGain: number;
}

export interface CardSpec {
  avg: number; // 情节卡平均字数（去标记文本计），校验器据此检查 S/M/L 分层
}

/** 全局画风后缀（迁移自 tools/gen_assets.py 的 STYLE_*，生图时拼在 prompt 尾部） */
export interface ArtStyleConf {
  portrait: string; // 人物头像（1:1）
  scene: string; // 地点/标题/结局等场景图
  item: string; // 物品静物
  concept: string; // 概念象征意象
  cg: string; // 情节卡 16:9 CG
  icon: string; // 作品主题图标（情节列头 + favicon）
}

/** 游戏难度：easy=简单（阅读者，满星 3）｜hard=困难（解谜玩家，满星 5；本关完成度 ≥20% 后才切入则满星 4） */
export type Difficulty = 'easy' | 'hard';

/** 作品完成度（见 README_game §9「使用者与时机」）：
 *  wip   = 使用者是 AI（生产期），全部设计规范强制执行；
 *  final = 使用者是用户/内容总监，规范类问题降级为建议，只有完整性错误仍拦截。 */
export type GameStatus = 'wip' | 'final';

export interface Meta {
  id: string;
  title: string;
  subtitle: string;
  /** 全作之问：封面副标题下再压一行的问句（README_game §4.7）；可缺省 */
  tagline?: string;
  /** 改编出处：封面副标题同一行右侧的一行小字（可缺省） */
  adaptedFrom?: string;
  version: number;
  stamina: StaminaConf;
  cardSpec?: CardSpec; // 字数量化规格（历史作品可缺省，缺省不检查字数分层）
  status?: GameStatus; // 缺省视为 wip
  art?: ArtStyleConf; // 缺省时生图工具用内置默认风格
}

/** 框架故事段：旁白，或纯文本标签发言（无词条头像） */
export type FrameSeg =
  | { kind: 'narration'; text: string }
  | { kind: 'dialogue'; speaker: string; text: string };

export interface Ending {
  title: string;
  segments: FrameSeg[];
  credit: string;
}

export interface Frame {
  levelIntro: Record<string, FrameSeg[]>;
  ending: Ending;
}

export type EntryType = 'person' | 'place' | 'item' | 'concept';

export interface ArchiveBlank {
  answer: string; // 词条 id
  pool: EntryType; // 候选池类型
}

export interface ArchiveField {
  label: string;
  text?: string;
  blank?: ArchiveBlank;
}

export interface ArchivePage {
  level: number;
  title: string;
  fields: ArchiveField[];
}

export type EntryTier = 'core' | 'major' | 'minor';

export interface EntryDef {
  name: string;
  type: EntryType;
  desc: string;
  tier?: EntryTier; // 重要度分层（见 README_game §4.2），缺省视为 major
  avatar?: string;
  image?: string;
  archive?: ArchivePage[];
  look?: string; // 定妆照速记：情节卡 CG 生成时拼到 prompt 尾部，保证跨图形象一致
  avatarPrompt?: string; // 头像生图 prompt（不含 meta.art.portrait 后缀）
  imagePrompt?: string; // 地点/物品/概念图生图 prompt（不含风格后缀）
  /** 形象变体（如 old 中老年版）：仅供生图管线使用（tools/art_spec.py），游戏内展示不受影响 */
  variants?: Record<string, { look?: string; avatar?: string; avatarPrompt?: string }>;
}

/** 卡内段：旁白 / slot 发言 / 词条发言人 / 配角发言（纯文本名，淡色首字印章） / 内心独白 */
export type CardSeg =
  | { kind: 'narration'; text: string }
  | { kind: 'dialogue'; slot: string; text: string }
  | { kind: 'dialogue'; speakerEntry: string; text: string }
  | { kind: 'dialogue'; speaker: string; text: string }
  | { kind: 'monologue'; slot: string; text: string };

export type CardForm = 'scene' | 'dialogue' | 'monologue';

export interface BlankDef {
  slot: string; // NPC1|NPC2|NPC3|NPC4|地点
  kind: 'person' | 'place';
  answer: string | string[]; // 词条 id；地点可为数组（任一即对）
}

/** 空位的全部正确词条（数组答案展开） */
export const blankAnswers = (b: BlankDef): string[] => (Array.isArray(b.answer) ? b.answer : [b.answer]);

export type CardDifficulty = 'easy' | 'normal' | 'hard';

export interface CardDef {
  id: string;
  level: number;
  form: CardForm;
  difficulty?: CardDifficulty; // easy 无地点空；hard 全文匿名（无人名 chip、无 speakerEntry）
  col: string; // 正确列名（timelines.cols 之一）
  row: number; // 正确行下标
  title: string;
  cg?: string; // 该卡 16:9 CG 图路径；补完后显示在正文顶部（见 README_game §4.8）
  cgDark?: boolean; // CG 亮度偏暗/一般时为 true：正文区改用暗系遮罩 + 白名黑投影（由 tools/cg_brightness.mjs 预计算）
  cgPrompt?: string; // CG 生图 prompt（场景原文，不含各人物 look 与 meta.art.cg 后缀）
  cgChars?: string[]; // CG 中出场的人物词条 id：拼 look 描述 + 取其头像作图生图参考
  cgCharVariants?: Record<string, string>; // 出场人物的形象变体（{词条 id: 变体名}，如 {"e_xidaduo": "old"}），生图时取 variants 里的 look 与头像
  segments: CardSeg[];
  blanks: BlankDef[];
  len?: 'S' | 'M' | 'L'; // 字数档：S 短篇（60–70%avg，独白/低难）、M 标准、L 长篇（≈130%avg，群戏/关键情节）
  startUnlocked?: boolean;
}

export interface TimelineDef {
  rows: string[];
  cols: string[];
}

/** 题面可见时机：start = 进关起就显示题面；gate（缺省）= 70% 开闸前显示「？？？」 */
export type GateReveal = 'start' | 'gate';

export interface GateBlank {
  prompt: string;
  answerEntry?: string;
  answerTitle?: string; // 卡 id
  revealAt?: GateReveal;
}

export interface GateDef {
  after: number;
  /** 关名不在这里：界面一律取过场首段的卷名 `levelChapterTitle(after)`，与「故事」页同源（旧字段 title 已删除） */
  /** 旧字段：一句陈述性的小结。界面已改用 question，保留只为兼容老数据 */
  intro: string;
  /** 本卷之问：一句问句（README_game §4.5）。过场末屏、出口面板头部、目标弹窗、常驻提示首条共用 */
  question?: string;
  blanks: GateBlank[];
}

/** 章节 BGM：stage 为 title / ending / 关卡号。同一 stage 可多曲（见 doc/14-bgm-pipeline.md）。
 *  无 unlockCard：本关**开篇曲**，进关即解锁并起播；有 unlockCard：对应情节卡验证完成（出 CG）后解锁、入本关歌单即播。
 *  prompt / tags 是 Suno 生成用的真源（tools/gen_bgm.py 读取；DEBUG 里可复制），note 记设计意图（动机、人物、BPM）。 */
export interface BgmTrackDef {
  id: string;
  file: string;
  title: string;
  stage: 'title' | 'ending' | number;
  unlockCard?: string;
  prompt?: string;
  tags?: string;
  note?: string;
  /** Optional measured per-track playback gain; original audio is preserved. */
  gainDb?: number;
  /** Optional soft attack for tracks whose recording starts abruptly. */
  fadeInMs?: number;
}

export interface AssetsConf {
  mysteryAvatar: string;
  titleImage: string;
  endingImage: string;
  levelIntroImages?: Record<string, string>; // 各卷开场背景图；缺省回退到 titleImage
  sceneIcon?: string; // 情节列头图标（1:1，按作品主题绘制，见 README_game §4.8）
  favicon?: string; // 由 sceneIcon 裁切的站点图标（运行时动态设置 link[rel=icon]）
  titleImagePrompt?: string;
  endingImagePrompt?: string;
  sceneIconPrompt?: string;
  bgm?: BgmTrackDef[]; // 可选；无曲目时不显示播放器、不播 BGM
}

// ---------- 回顾本关故事（见 README_game §4.9 / doc/12-story-recap.md） ----------

/** 回顾文章段：旁白（主体）或人物引语气泡（少量） */
export type RecapSeg =
  | { kind: 'narration'; text: string }
  | { kind: 'quote'; entry: string; text: string };

export interface RecapPage {
  rows: number[]; // 本页覆盖的时间行下标（连续区间）
  title: string;
  cards: string[]; // 本页覆盖的卡 id（默认由 rows 推导，可在 DEBUG 里覆盖）
  images?: string[]; // 综合预览图；缺省取 cards 中已补完卡的 cg
  segments: RecapSeg[];
}

export interface RecapDef {
  pages: RecapPage[];
}

export interface GameData {
  meta: Meta;
  frame: Frame;
  entries: Record<string, EntryDef>;
  cards: CardDef[];
  timelines: Record<string, TimelineDef>;
  levelStartEntries: Record<string, string[]>;
  gates: GateDef[];
  assets: AssetsConf;
  recaps?: Record<string, RecapDef>; // key = 关卡号
}

// ---------- 状态层（存档结构，键按游戏分，见 save.ts） ----------

export interface TimelinePos {
  row: number;
  col: number;
  locked: boolean; // 归位锁定（同时揭示标题）
}

export interface CardState {
  unlocked: boolean;
  done: boolean; // 全部空验证通过
  read: boolean; // 已读过（再次打开直接全显）
  slotDraft: Record<string, string>; // slot -> 草稿词条 id
  slotLocked: Record<string, boolean>; // slot -> 验证通过
  pos: TimelinePos | null; // 时间轴落位
  unlockedAt?: number; // 获得（解锁）时间戳，用于列表排序
  doneAt?: number; // 补完时间戳，用于列表排序
}

export interface ArchiveBlankState {
  draft: string | null;
  locked: boolean;
}

export interface EntryState {
  collected: boolean;
  familiarity: number;
  famCards: string[]; // 已在哪些卡点击过（每卡每词条限一次 +1）
  pagesUnlocked: number[]; // 已分析解锁的档案页下标
  pageFields: Record<string, ArchiveBlankState>; // key = `${pageIdx}:${fieldIdx}`
  pagesDone: number[]; // 已盖「完」印的档案页下标
}

export interface GateBlankState {
  draft: string | null; // 'entry:e_x' | 'title:c_x'
  locked: boolean;
}

export interface GateState {
  blanks: GateBlankState[];
  passed: boolean;
  stars: number; // 未过关为 0 且 passed=false；过关后 0..maxStars
  maxStars?: number; // 过关时的满星数（简单 3 / 困难 5 / 迟切困难 4）；旧档缺省按 3
  score?: number; // 过关得分：round(100×进度) + 星级加成（星数 × 100）
  autoFill?: boolean; // 旧存档遗留字段（自动填写已改为只填草稿不提交，不再标记）
}

export interface LevelStats {
  errors: number; // 本关错误次数（每 3 次扣一星；过关即换新关计数）
  hints: number; // 情节卡「⚡提示」使用次数（每次 −1 体力）
  rests: number; // 本关休整次数（每 3 次扣一星；过关即换新关计数）
  hardLate?: boolean; // 本关完成度 ≥20% 后才从简单切到困难：满星按 4 计
}

export interface Stats {
  errors: number;
  hints: number;
  rests: number;
  startedAt: number;
  finishedAt: number | null;
  perLevel: Record<string, LevelStats>;
}

export interface Flags {
  introSeen: Record<string, boolean>;
  coachSeen: Record<string, boolean>; // 新手引导气泡：key = CoachId，做过一次即永久不再出现
}

export type Screen = 'title' | 'game' | 'ending';
export type TabId = 'notes' | 'cards' | 'timeline' | 'archive';

export interface GameState {
  storyId: string;
  version: number;
  screen: Screen;
  introLevel: number | null; // 正在播放的关卡过场
  introIdx: number;
  endingIdx: number; // 结局进度
  level: number;
  stamina: number;
  difficulty: Difficulty; // 随时可切；见 logic.setDifficulty
  tab: TabId;
  selectedCardId: string | null;
  archiveFocus: string | null; // 档案页签聚焦的词条
  cards: Record<string, CardState>;
  entries: Record<string, EntryState>;
  gates: Record<string, GateState>; // key = gate.after
  rowHints: Record<string, number[]>; // 关卡 → 花体力提前揭示名字的时间行下标（整行归位的自动揭示由渲染层推导）
  typeHints: Record<string, EntryType[]>; // 关卡 → 花体力揭示了「可收集总数」的词条分类（全部收满时渲染层自动显示）
  stats: Stats;
  flags: Flags;
}
