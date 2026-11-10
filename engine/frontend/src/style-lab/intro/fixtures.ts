/** 开场过场实验用只读 fixture：照抄「悉达多」三卷的真实文案与插图，不读写存档。
 *  图片走 dev 服务器的 /xdd-assets 中间件（见 frontend/vite.config.ts）。 */

export type SegKind = 'narration' | 'dialogue';

export interface Seg {
  kind: SegKind;
  text: string;
  speaker?: string;
}

export interface IntroVolume {
  level: number;
  /** 首段即卷名，单独做题名幕，不混进正文 */
  title: string;
  image: string;
  segs: Seg[];
}

export const VOLUMES: IntroVolume[] = [
  {
    level: 1,
    title: '第一卷 · 弃家求道',
    image: '/xdd-assets/images/intro_c1.jpg',
    segs: [
      { kind: 'narration', text: '大河上起着薄雾。筏尾立着一个白发的撑船人，篙子插在水里，却不急着推——他在听。' },
      {
        kind: 'narration',
        text: '水声里什么都有：赶集人的吆喝，牛蹄踏进浅滩，远处婴儿的夜啼，还有一个少年站了整整一夜、天亮时才吐出来的那口气。千百种声音搅在一处，末了并成一个又低又稳的音，像大地自己在哼。',
      },
      { kind: 'narration', text: '撑船人听见的，是他自己的一辈子。而这一辈子，要从很远的地方讲起——从两千五百年前，从这条河上游的一座婆罗门院子讲起。' },
      { kind: 'narration', text: '那院子里的无花果树影，每天从东墙挪到西墙。院里长大的少年会背诵所有的经文，会在河边做完整套沐浴与献祭。长者们说，他将来会是祭司中的祭司。' },
      { kind: 'narration', text: '只有他自己不安：经文里、供奉里、父亲的言语里，都没有他要找的那个「我」。' },
      { kind: 'narration', text: '一个雨季的黄昏，三个沙门走过村口。尘土里露出他们瘦削的肩胛，眼睛亮得反常，一句话也没有留下。' },
      { kind: 'narration', text: '那天夜里，少年站到父亲的门前，一动不动。他站了整整一夜，天亮时父亲让他走。' },
    ],
  },
  {
    level: 2,
    title: '第二卷 · 尘世轮回',
    image: '/xdd-assets/images/intro_c2.jpg',
    segs: [
      { kind: 'narration', text: '苦修林里的三年，他学会了斋戒、忍痛、把自己从身体里放出去。可饥饿只能把那个「我」压小，从来没有把它化开。' },
      { kind: 'narration', text: '他和同伴一起去祇园精舍听那位圆满者说法。听完，他向那人行礼，然后独自离开——道理可以传授，觉悟不能。' },
      { kind: 'narration', text: '过河之后是一座繁华大城：绸缎、香料、骰子、名妓的园子，和一个正在扩张的商号。他先学会了写字算账，再学会了饮酒与情爱。' },
      { kind: 'narration', text: '二十年过去，他有了宅第、仆人和一屋子华服，也有了新的心事：怕输、怕老、怕失去。镜子里的脸一年年软下去。' },
      { kind: 'narration', text: '一个清晨，他丢下宅子与账簿往河边走。走到水边才发现，胸口那个声音已经很久没有响过了。' },
    ],
  },
  {
    level: 3,
    title: '第三卷 · 河水圆融',
    image: '/xdd-assets/images/intro_c3.jpg',
    segs: [
      { kind: 'narration', text: '他回到当年渡他过河的渡口。那位船夫维稣德瓦还在，认出了他，也没有多问一句。' },
      { kind: 'narration', text: '他跟着船夫撑船、编绳、修桨，学着听水声。河水一年比一年说得多：它同时在源头、在渡口、在入海口，从不着急。' },
      { kind: 'narration', text: '许多年后，城里的名妓伽摩拉带着一个孩子来渡河，在岸边被蛇咬了。她死在草舍里，孩子留了下来。' },
      { kind: 'narration', text: '那孩子恨这条河，也恨这个忽然出现的父亲。他不肯撑船，不肯吃粗饭，某个夜里带着钱往城里逃了。' },
      { kind: 'narration', text: '追到半路，悉达多在水面上看见一张脸——那是他父亲的脸，也是他自己的。他掉头回了渡口。' },
    ],
  },
];

/** 对白段落在别的作品里会出现，四个方案都要能排版，这里给一份混合样本 */
export const DIALOGUE_SAMPLE: Seg[] = [
  { kind: 'narration', text: '灯只亮了半边。仓房门半开，里面的气味又潮又旧。' },
  { kind: 'dialogue', speaker: '塔娜', text: '你来得太晚。钥匙还在原来的地方吗？' },
  { kind: 'dialogue', speaker: '看守', text: '（低声）外面还有人。' },
];

export const INTRO_VARIANTS: {
  id: IntroVariantId;
  short: string;
  name: string;
  metaphor: string;
}[] = [
  { id: 'a', short: 'A 影院字卡', name: '独幕字卡', metaphor: '默片幕间字卡：一次只留一句，画面完整' },
  { id: 'b', short: 'B 对开书页', name: '对开书页', metaphor: '精装书摊开：左页插图、右页正文，点击翻页' },
  { id: 'c', short: 'C 竖排经卷', name: '竖排经卷', metaphor: '经卷自右展开：竖排列，读过的列留在纸上' },
  { id: 'd', short: 'D 残稿显影', name: '残稿显影', metaphor: '墨迹渗进残稿：逐字显影，点一下立刻显全' },
];

export type IntroVariantId = 'a' | 'b' | 'c' | 'd';
