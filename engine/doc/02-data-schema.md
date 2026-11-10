# 02 · 数据 schema 与存档结构

> 上级索引：[README_dev.md](../README_dev.md)　·　相关：[03 关键机制实现](03-gameplay-logic.md)、[07 如何修改内容](07-content-authoring.md)、[13 多语言](13-i18n.md)

## 1. final_game.json

简体这份是编辑真源。悉达多另有完整平行包 `workspace/xidaduo/i18n/{de,en,ja,zh-TW}/final_game.json`（结构相同、可译字段换成该语；id / slot / 答案 / 路径 / prompt 不译）。其它作品目前只有简体叙事。详见 [13](13-i18n.md)。

```jsonc
{
 "meta": {"id","title","subtitle","version":2,
          "tagline"?: "全作之问（一句问句，封面副标题下一行；README_game §4.7）",
          "stamina":{"start":8,"perLevel":4,"searchCost":1,"completeReward":1,"restGain":2},
          "cardSpec"?: {"avg":700},
          "status"?: "wip|final",   // 使用者与时机（README_game §9）：缺省 wip
                                    //   wip   = 使用者是 AI，全部设计规范强制执行；
                                    //   final = 使用者是内容总监，规范降级为建议（完整性错误仍拦）。
                                    //   校验器与 DEBUG 编辑器两侧同时生效
          "art"?: {"portrait","scene","item","concept","cg","icon"}},
                                    // 六段画风后缀，生图时按用途拼到 prompt 尾部；
                                    //   缺省用 tools/art_spec.py 的 DEFAULT_ART
 // 注：评星规则固定在引擎（简单满 3 / 困难满 5，每 3 次错误或休整扣一星），meta 里没有可配置项；旧的 meta.starCaps 已废弃，校验器报规范错
 // cardSpec：字数量化规格（存在时校验器强制检查每卡 len 分层与全卡平均；历史作品可缺省）
 "frame": {"levelIntro":{"1":[...],"2":[...],"3":[...]},
           "ending":{"title","segments":[FrameSeg],"credit"}},
 // FrameSeg = {kind:"narration",text} | {kind:"dialogue",speaker:"故事内角色",text}
 // frame 只讲故事：旁白禁用第二人称（你/您/玩家）、全 frame 禁用玩法词汇（残页/页序/拼回/归位/词条/时间轴…）、
 //   不得给玩家安排身份或由框架叙述者派活；subtitle/credit 不挂身份词。校验器强制（README_game §4.7）
 // 无 opening：开局流程为 标题页 → 第一卷过场(levelIntro[1]) → 问句幕(gates[after=1].question) → 「进入本卷」进情节卡页签
 // 过场恒 5 段：首段 ≤16 字卷名「第N卷 · 名字」（题名幕）+ 4 段正文（每段 60~130 字，本卷主角第一人称）；
//   末段应落成本卷之问（警告级）；第 1 卷正文还要抛出全作之问（≥2 个「？」，警告级）；第 1 关 startUnlocked 恰 2 张（警告级）。写法见 README_game §4.7
 "entries": { eid: {"name","type":"person|place|item|concept","desc",
                    "tier"?: "core|major|minor",             // 重要度分层；缺省视为 major（老作品可不写）
                                                             //   校验器按 tier 强制 desc 字数/档案页数/字段数/字段字数/留白数（README_game §4.2）
                    "avatar"?: "assets/avatars/{eid}.jpg",   // person 必有
                    "image"?:  "assets/images/{eid}.jpg",    // 全量绘图：place/item/concept 均必有（见 README_game §4.8）
                    "look"?: "定妆照速记",                     // person：拼进每张有该人物出场的 CG prompt，保证跨图形象一致（新写一律中文，见 doc/04 §2）
                    "avatarPrompt"?: "原文 prompt",            // 头像生图；不含画风后缀，由 meta.art.portrait 自动拼
                    "imagePrompt"?: "原文 prompt",             // 地点/物品/概念图；画风按 type 取 art.scene/item/concept
                    "variants"?: {"old|...": {"look"?, "avatar"?, "avatarPrompt"?}},
                                                             // 形象变体（如中老年版）：仅供生图管线；avatar 缺省时回退基础头像
                                                             //   变体头像以基础头像为参考图生成；游戏内展示不受影响
                    "archive"?: [{"level":1..最大关,"title",
                       "fields":[{"label","text"} | {"label","blank":{"answer":eid,"pool":type}}]}]} },
 // 熟悉度上限不写死：familiarMaxOf(eid, lv) = 该关正文 tag 卡数 + 单一答案卡数（无容错折扣；数组答案不计入；分关刷新，进新关清零）
 "cards": [{ "id":"c1_01","level":1,"form":"scene|dialogue|monologue",
             "difficulty":"easy|normal|hard",
             "col":"名场面|李文秀|...","row":0,"title":"雪夜托孤",
             "cg"?: "assets/cg/{id}.jpg",  // 全量绘图：每卡一张 16:9 CG，补完后显示在正文顶部（见 README_game §4.8）
             "cgDark"?: true,              // CG 偏暗：正文改用暗系遮罩（换图/重绘后自动测算）
             "cgPrompt"?: "场景原文",        // CG 生图；不含各人物 look 与 art.cg 后缀，生成时自动拼（新写一律中文，见 doc/04 §2）
             "cgChars"?: [eid,...],        // CG 出场人物：拼 look 描述 + 取其头像作图生图参考
             "cgCharVariants"?: {eid: "old", ...},
                                           // 出场人物的形象变体：该卡 CG 里此人改用 variants.{变体}.look 与变体头像
             "segments":[CardSeg], "blanks":[{"slot":"NPC1|NPC2|NPC3|NPC4|地点","kind":"person|place","answer":eid 或 [eid,...]}],
             "len"?: "S|M|L", "startUnlocked"?:true }],
 // 情节卡不再有 hints 文案字段（2026-09 起废弃：提示改为「⚡提示」花体力替玩家填/亮答案，见 03 §情节卡）；校验器遇到残留 hints 会报规范错
 // len 字数档：S=60–70%avg（独白/低难）、M=85–115%avg、L≈130%avg（群戏/关键情节）
 // difficulty：easy=无地点空（独白卡）；hard=**登场人物**全匿名（无 speakerEntry，人物空可达 NPC4）。
 //   hard 不禁止正文出现人名 chip——不许露名的只有本卡待猜的那几个人，那由匿名铁律统管（对所有难度生效），
 //   顺带提及的第三方照常可以做 chip（README_game §4.1）
 // blanks.answer：地点可为数组，玩家选中任一即对；熟悉度记入所选词条。
//   一卡涉及多地（角色移动、电话两端各在一处等）时必须列全为数组：所有本卡实际发生地都是正确答案
 // CardSeg = {kind:"narration",text} | {kind:"dialogue",slot:"NPC1",text}
 //         | {kind:"dialogue",speakerEntry:eid,text} | {kind:"dialogue",speaker:"酒保",text}
 //         | {kind:"monologue",slot:"NPC1",text}
 // speaker：纯配角（不在人物表）的文本名发言，引擎渲染淡色首字印章头像；不得与人物表角色重名（校验器拦截）
 // 段文本内联标记：{{e_x|显示名}}=可点词条；[[NPCn]]=匿名人物占位（选中候选即显示头像+人名，锁定后标红）
 "timelines": {"1":{"rows":[时段名],"cols":["名场面",人物名...]},"2":...,"3":...},
 // 时间轴密度红线：每行≥2卡、情节列每行恰1张、每个角色列≥2卡、角色列填充>40%
 "levelStartEntries": {"1":[eid],"2":[...],"3":[...]},
 "gates": [{"after":1,
            // 没有关名字段：关卡出口面板的关名 = levelChapterTitle(after) = frame.levelIntro[after][0]（「第一卷 · 弃家求道」），
            //   与「故事」页同源同字；旧字段 title 已从全部作品数据中删除
            "question": "两个一起长大的朋友，为什么走上了两条路？",   // 本卷之问（必填；问句、≤30 字、无第二人称/玩法词汇）
            "intro": "……",                                           // 旧字段，界面已不显示，保留兼容
            "blanks":[{"prompt","answerEntry":eid} | {"prompt","answerTitle":cardId},
                      // 每题可带 "revealAt":"start"|"gate"（缺省 gate）：start = 展开问题即见题面；gate = 70% 前显示「？？？」
                      // 题目随时可展开阅读；70% 前不渲染答案栏（不能填、不能提交）
                      // 每卷 ≥3 道 start，且 start 题面不得含本卷任何空位答案词条的 name（README_game §4.5）
                      ...]}],
 // question 五处共用：过场末屏「问句幕」、关卡出口面板头部、新手引导目标弹窗标题、顶栏常驻提示首条、（无 question 时回退 intro）
 "assets": {"mysteryAvatar","titleImage","endingImage",
            "sceneIcon"?: "assets/images/scene_icon.jpg",  // 作品主题图标：时间轴情节列头（52px，与人物头像同尺寸）
            "favicon"?:   "assets/images/favicon.png",     // 由 sceneIcon 中心裁切的 64×64 站点图标（main.tsx 运行时设置 link[rel=icon]）
            "titleImagePrompt"?, "endingImagePrompt"?, "sceneIconPrompt"?,  // 三张特殊图的原文 prompt
            "bgm"?: [{"id","file":"assets/audio/{id}.mp3","title","stage":"title"|"ending"|关号,
                      "unlockCard"?: 卡 id,      // 缺省 = 该关开篇曲（进关即播）；有 = 该卡验证完成后解锁入单即播
                      "prompt","tags","note"?}]},  // Suno 生成真源 / 风格标签 / 设计备注；规则与生成见 doc/14-bgm-pipeline.md
 // bgm：每关恰 1 首开篇曲，曲数 ≥ max(round(本关正文字数/1500), 2)（含开篇曲），卡曲按 row 逐行铺开；validate_data.check_bgm 校验
 "recaps"?: {"1":{"pages":[RecapPage]},"2":...},
 // 【回顾本关故事】多页图文长廊（README_game §4.9 / doc/12-story-recap.md）
 // RecapPage = {"rows":[连续行下标], "title", "cards":[卡 id],
 //              "images"?:[图路径],   // 缺省＝取 cards 中已补完卡的 cg
 //              "segments":[{kind:"narration",text} | {kind:"quote",entry:eid,text}]}
 // 硬性：页数 = int(行数×0.5+0.5) 且 < 行数；各页 rows 连续、不重叠、铺满全关；
 //       每页字数 = 覆盖卡正文总字数的 10~20%
}
```

**生图 prompt 的唯一真源就是这份 json**（`meta.art` + `entries[].look/avatarPrompt/imagePrompt` +
`cards[].cgPrompt/cgChars` + `assets.*Prompt`）。`tools/gen_assets.py`（全量补图）、
`tools/regen_image.py`（DEBUG 里的单张 AI 重绘）、`tools/gen_scene_icons.py` 都从这里读，
拼装规则集中在 `tools/art_spec.py`，见 [04 美术管线](04-art-pipeline.md)。

## 2. 存档 GameState

localStorage，键按 `meta.id` 分如 `xdd_save_v1`/`bad_save_v1`：

```
{storyId,version,screen,introLevel,introIdx,endingIdx,level,stamina,
 difficulty:"easy"|"hard",   // 难度，随时可切（旧档缺省 easy）
 tab,selectedCardId,archiveFocus,
 cards:{id→{unlocked,done,read,slotDraft,slotLocked,pos:{row,col,locked}|null,unlockedAt?,doneAt?}},  // 旧档多出的 hintsShown 忽略即可
 entries:{id→{collected,familiarity,famCards,pagesUnlocked,pageFields,pagesDone}},
 gates:{after→{blanks:[{draft,locked}],passed,stars,maxStars?,score?,autoFill?}},   // maxStars = 过关时的满星数（3/5/4；旧档缺省 3）
 rowHints:{level→[花体力揭示的时间行下标]},
 typeHints:{level→[花体力揭示了可收集总数的词条分类]},
 stats:{errors,hints,rests,startedAt,finishedAt,
        perLevel:{lv→{errors,hints,rests,hardLate?}}},   // 评星只看 perLevel 的 errors/rests（按关记、过关换新关计数）；hardLate = 本关 ≥20% 后才切困难（满星 4）；顶层 hints/rests 为全局累计仅供统计
 flags:{introSeen}}
```

旧档缺 `rowHints` 时 `loadGame` 补空对象。UiState（picker/toast/guideOpen/分析中/过关动画/时间轴选中/fx 脉冲）瞬态不入档。

**只读回顾与故事回顾也不入档**：`ui.reviewLevel`（正在回看的历史关）、`ui.reviewCard`（回看时打开的卡）、
`ui.recapLevel`（正在展示回顾长廊的关）都是瞬态 UiState。回看历史关不需要快照——`cards` 是全局
record，过去关卡的 `done` / `pos.locked` 本来就一直留着，换个关卡号渲染即可（见 [03](03-gameplay-logic.md)）。
