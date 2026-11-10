# 情节卡解谜 · 多作品引擎（README_dev）

> **技术文档入口**：本文件只提供简介、目录与索引；具体技术说明拆分在 [`doc/`](doc/) 下分篇维护。
> 游戏设计与内容生产规则见 [README_game.md](README_game.md)。
>
> **自维护要求**：改动玩法数值/技术方案后，同步更新 `doc/` 下对应分篇与 README_game.md；只记"当前结果"，不留历史流水账。新增文档必须在本文件的「文档目录」登记。

## 一、项目简介

一套**数据驱动的情节卡解谜引擎**：引擎零故事内容，每部作品只是一份 `workspace/{作品}/final_game.json`。玩家通过搜寻残页（情节卡）→ 填人物/地点空 → 在时间轴上归位 → 解锁词条档案 → 通过关卡闸门的完形填空，逐层拼回整个故事。

| 项目 | 当前状态 |
| --- | --- |
| 前端 | Vite + React 18 + TypeScript，DOM/CSS 渲染，集中式状态机（无额外运行时依赖）；玩家语言自研 `t()`，见 [13](doc/13-i18n.md) |
| 后端 | `backend/server.js`，零依赖 node 静态服务器，端口 **6872**（仅测试版用，最终游戏不依赖后端） |
| 作品 | `xdd` 悉达多 / `bad` 坏血 / `murder` 一桩事先张扬的凶杀案 / `weicheng` 围城 |
| 三种运行形态 | 离线单文件版（双击即玩）· 后端测试版 :6872 · dev 热更新版 :5174 |
| 质检 | `tools/validate_data.py`（CI 级全量质检 + 通关模拟 + BGM 规格）+ Playwright + 自动通关 bot；两档严重度按 `meta.status` 切换 |
| 内容编辑 | 后端在线时游戏内 DEBUG 可改 `final_game.json` 的**全部**字段，含生图 / 音乐 prompt 复制与换图 / 换音频 |
| 音乐 | `assets.bgm[]` 每关开篇曲 + 卡曲，Suno v5.5 并发生成（`tools/gen_bgm.py`），规范见 [14](doc/14-bgm-pipeline.md) |

## 二、快速开始

```bat
cd frontend && npm run dev              :: dev 热更新 http://localhost:5174（?game=xdd 切作品）
node backend/server.js                  :: 测试版 http://localhost:6872（或双击 run.bat）
python tools/validate_data.py xdd      :: 改完 final_game.json 必跑
node tools/build_offline.mjs xdd       :: 导出离线版 → workspace/xidaduo/index.html
npm run build && npx lumimaker publish  :: 悉达多正式版发布到幻光文游平台（根 dist/ 只含 xdd，见 doc/05 §1b）
```

完整命令、调试接口与测试说明见 [doc/05 构建、运行、测试](doc/05-build-run-test.md)。

## 三、文档目录

| # | 文档 | 内容 |
| --- | --- | --- |
| 01 | [架构总览与文件结构](doc/01-architecture.md) | 技术选型、作品清单、端口、目录树（每个文件干什么） |
| 02 | [数据 schema 与存档结构](doc/02-data-schema.md) | `final_game.json` 全字段注解、localStorage `GameState` |
| 03 | [关键机制实现](doc/03-gameplay-logic.md) | 搜寻优先级、熟悉度、时间轴归位锁定、分析、闸门评分等 `logic.ts` 玩法内核 |
| 04 | [美术管线](doc/04-art-pipeline.md) | 生图 API 规范、定妆照、生成脚本、引擎侧三处应用与兜底 |
| 05 | [构建、运行、测试](doc/05-build-run-test.md) | 全部命令、`window.__game` 测试接口、DEBUG 弹层 |
| 06 | [DEBUG 内容编辑器](doc/06-copyedit-editor.md) | 在游戏内改全部内容：`/api/*` 数据通道、存档消毒、AI 重绘、九个编辑器、两档严重度 |
| 07 | [如何修改内容](doc/07-content-authoring.md) | 换文案 / 调数值 / 加删卡的红线与流程 |
| 08 | [新作品接入指南](doc/08-new-game-guide.md) | 用本模板做一个全新故事的完整步骤 |
| 09 | [UI 与交互约定](doc/09-ui-conventions.md) | 布局、窄屏断点、情节卡/时间轴/词条库/选择器的呈现定案 |
| 10 | [工程约束与已知决策](doc/10-constraints-decisions.md) | 关卡数推导、bat 纯 ASCII、难度分档、体力经济等硬约束 |
| 11 | [跨模式踩坑经验](doc/11-cross-mode-pitfalls.md) | **改图片/静态资源前必读**：三形态 URL 基准、离线导出污染 dist |
| 12 | [回顾本关故事](doc/12-story-recap.md) | 多页图文长廊：`recaps` 数据、页数与字数公式、生产流程、写作要求 |
| 13 | [多语言 i18n](doc/13-i18n.md) | 引擎 UI 五语、悉达多平行叙事 JSON、专名/不译字段、校验管线、西语排版 |
| 14 | [背景音乐 BGM（skill）](doc/14-bgm-pipeline.md) | 六条设计规则（动机 / 人物乐器 / 开篇曲 / 曲数公式 / 逐行分配 / 辨识度）、prompt 模板、`gen_bgm.py` 并发生成、`check_bgm` 校验、按关歌单与新曲光效、DEBUG 换音频 |

## 四、按任务查

| 我要做的事 | 看这里 |
| --- | --- |
| 改一句台词 / 换一张图 | [07](doc/07-content-authoring.md)，图形化改法看 [06](doc/06-copyedit-editor.md) |
| 加一张情节卡、加一个词条 | [07](doc/07-content-authoring.md) 红线 → [02](doc/02-data-schema.md) 字段 → 跑 validate；图形化建卡建关看 [06](doc/06-copyedit-editor.md) |
| 改 prompt 重画某一张图 | [04](doc/04-art-pipeline.md)（prompt 存在 final_game.json 里，DEBUG 里可一键重绘） |
| 写 / 改「回顾本关故事」 | [12](doc/12-story-recap.md) |
| 改本卷之问 / 题面开局可见性 / 封面题记 / 开局两张卡 | [02](doc/02-data-schema.md) `gates[].question` · `revealAt` · `meta.tagline` · `startUnlocked` → [03 · 闸门](doc/03-gameplay-logic.md) → 规则见 [README_game §4.1/§4.5/§4.7](README_game.md)；DEBUG 里在「闸门」「作品设置」编辑器改 |
| 改关卡出口面板上的关名 | 关名 = 过场首段卷名（`levelChapterTitle`，与「故事」页同源；`gates[].title` 已删除）→ 在「过场」编辑器改首段，见 [02](doc/02-data-schema.md)·[03 · 闸门](doc/03-gameplay-logic.md) |
| 作品完工后想绕过字数等规范 | 把 `meta.status` 改成 `final` → [README_game §9](README_game.md#9-使用者与时机规范什么时候是硬的) |
| 调体力/难度/闸门分数 | [02](doc/02-data-schema.md) `meta.stamina` + [03](doc/03-gameplay-logic.md) 闸门 + [10](doc/10-constraints-decisions.md) 体力经济 |
| 接入一部新作品 | [08](doc/08-new-game-guide.md) |
| 切语言 / 翻 UI / 翻悉达多正文 | [13](doc/13-i18n.md)；叙事文风见 `workspace/xidaduo/i18n/STYLE.md` |
| 生成/重做美术素材 | [04](doc/04-art-pipeline.md) |
| 为一部作品设计并批量生成 BGM | [14](doc/14-bgm-pipeline.md)：`bgm_plan.py` 看曲数 → 写 `assets.bgm`（prompt）→ `gen_bgm.py --clean` |
| 换某一首 BGM / 改音乐 prompt | DEBUG「背景音乐」编辑器（试听 / 更换音频 / 复制prompt，无重生成）→ [06](doc/06-copyedit-editor.md)·[14](doc/14-bgm-pipeline.md) |
| 改玩法逻辑（搜寻、归位、分析） | [03](doc/03-gameplay-logic.md) |
| 改界面样式、适配窄屏 | [09](doc/09-ui-conventions.md) |
| 图片在某一种运行模式下不显示 | [11](doc/11-cross-mode-pitfalls.md) |
| 「选哪部作品都进同一部」 | [11 · 离线导出污染 dist](doc/11-cross-mode-pitfalls.md#4-离线导出会污染-dist单作-vs-全量) |
| 跑测试 / 自动通关 / 截图 | [05](doc/05-build-run-test.md) |
| 拍宣传截图（桌面 / 竖屏 / 多语言） | `node tools/bbs_shots.mjs xdd` → [05](doc/05-build-run-test.md) |
| 改完简体后同步悉达多八语 | `tools/i18n_sync.py`（增量，只译改动）→ [13 §5](doc/13-i18n.md) |
| 发布 / 更新到幻光文游平台 | [05 §1b](doc/05-build-run-test.md)（`npm run build` + `npx lumimaker publish`，规范见 `.cursor/skills/lumimaker`） |

## 五、关键词索引

**玩法机制**：搜寻优先级 `searchPriority` / 最佳搜寻 `bestSearchTarget`（推荐放大镜） / 连发抑制 → [03](doc/03-gameplay-logic.md)；熟悉度 `familiarMaxOf`（分关刷新）→ [02](doc/02-data-schema.md)·[03](doc/03-gameplay-logic.md)；时间轴归位与锁定 `applyTimelineLocks`（行/列 + 连片≥4）→ [03](doc/03-gameplay-logic.md)；分析 `analyzeEntry` / 档案三态徽标 → [03](doc/03-gameplay-logic.md)；闸门 `checkGate`（70% 开闸、得分）/ 题面开局常显 `revealAt`（70% 前答案栏禁用、`gate` 题显「？？？」）→ [03](doc/03-gameplay-logic.md)；本卷之问 `levelQuestion` / 问句幕 `introPageCount`（过场末屏、出口面板头部、目标弹窗标题、常驻提示首条共用）→ [03](doc/03-gameplay-logic.md)·[09](doc/09-ui-conventions.md)；新手引导 `coach.ts`（落地情节卡页：goal → tabCards → tabTimeline → 主循环）→ [09](doc/09-ui-conventions.md)；难度与星级 `setDifficulty` / `starBreakdown`（简单 3 星 / 困难 5 星、迟切 4 星、每 3 次错误或休整扣一星、四处引导差异 `isEasy`）→ [03](doc/03-gameplay-logic.md)·[09](doc/09-ui-conventions.md)·[README_game §4.5](README_game.md)；「⚡提示」`hintCard` / `hintArchivePage`（情节卡与档案页同一套：花体力替填 / 亮答案 3s，`hints` 文案已废弃）→ [03](doc/03-gameplay-logic.md)·[09](doc/09-ui-conventions.md)；「可填写 / 待补全」`cardFillable` → [09](doc/09-ui-conventions.md)；常驻提示 `currentHints` → [03](doc/03-gameplay-logic.md)；关卡带与只读回顾 `ui.reviewLevel` / 卡底跳转 `CardNav` → [03](doc/03-gameplay-logic.md)·[09](doc/09-ui-conventions.md)；回顾长廊 `recapAvailable` / `StoryRecap` → [12](doc/12-story-recap.md)。

**数据与存档**：`final_game.json` 字段 / `tier` 分层 / `len` 字数档 / `difficulty` 三档 / 数组地点答案 / `gates[].question` 本卷之问 / `revealAt` 题面可见时机 / `meta.tagline` 全作之问 → [02](doc/02-data-schema.md)；`meta.status` 两档严重度 → [README_game §9](README_game.md#9-使用者与时机规范什么时候是硬的)·[06](doc/06-copyedit-editor.md)；`recaps` 回顾数据 → [12](doc/12-story-recap.md)；生图 prompt 落库（`meta.art` / `look` / `cgPrompt`）→ [04](doc/04-art-pipeline.md)；`GameState` 存档键与字段 → [02](doc/02-data-schema.md)；改数据后的存档消毒 → [06](doc/06-copyedit-editor.md)。

**运行与构建**：`?debug=1` / `?seed=N` / `window.__game` → [05](doc/05-build-run-test.md)；`VITE_ONLY_GAME` 与 dist 全量恢复 → [11](doc/11-cross-mode-pitfalls.md)；`ASSETS_MAP` 素材映射 → [01](doc/01-architecture.md)·[11](doc/11-cross-mode-pitfalls.md)；`assetUrl` 相对路径铁律 → [11](doc/11-cross-mode-pitfalls.md)。

**界面**：断点 `BP_MID/BP_NARROW`（`layout.ts` 与 `styles.css` 各一份必须同步）→ [09](doc/09-ui-conventions.md)；`BlankButton` 填空按钮 / 形态字标 / 状态章 → [09](doc/09-ui-conventions.md)；词条库显示模式 `ui.entryView`（完整 / 精简）→ [09 §6](doc/09-ui-conventions.md)；Toast 上限 → [09](doc/09-ui-conventions.md)；背景音乐 `bgm.ts`（按关歌单 `syncBgmStage` / 卡曲解锁 `watchUnlocks` / 新曲光效 `newTrackId`）/ 黑胶迷你播放器 `BgmMiniPlayer` / 歌单三组 `BgmMenu` → [09](doc/09-ui-conventions.md)·[14](doc/14-bgm-pipeline.md)；BGM 设计规则与生成 `assets.bgm[].prompt` / `gen_bgm.py` / `check_bgm` → [14](doc/14-bgm-pipeline.md)；故事页目录全展开 + 3:2 主图 / 情节卡正文对齐（`--speaker-area`）→ [09](doc/09-ui-conventions.md)；地点卡 4:3 背景图布局 → [03](doc/03-gameplay-logic.md)；西语单列词条/标题下行/打字机倍率 → [13](doc/13-i18n.md)·[09](doc/09-ui-conventions.md)。

**多语言**：`t()` / `setLocale` / `xdd_locale` / `?lang=` → [13](doc/13-i18n.md)；叙事平行包与 glossary → [13](doc/13-i18n.md)；语言包结构校验 `i18n_check.py`（字数红线仍只跑简体）→ [13](doc/13-i18n.md)·[05](doc/05-build-run-test.md)。

**按源码文件反查**：

| 源码 | 相关文档 |
| --- | --- |
| `frontend/src/game/data.ts` | [01](doc/01-architecture.md)·[02](doc/02-data-schema.md)·[11](doc/11-cross-mode-pitfalls.md)·[13](doc/13-i18n.md) |
| `frontend/src/i18n/*` | [13](doc/13-i18n.md) |
| `frontend/src/game/logic.ts` | [03](doc/03-gameplay-logic.md) |
| `frontend/src/game/store.ts` / `save.ts` | [02](doc/02-data-schema.md)·[09](doc/09-ui-conventions.md) |
| `frontend/src/game/copyedit.ts` / `content.ts` | [06](doc/06-copyedit-editor.md) |
| `components/LevelBar.tsx` / `StoryRecap.tsx` / `NotesPanel.tsx` | [03](doc/03-gameplay-logic.md)·[09](doc/09-ui-conventions.md)·[12](doc/12-story-recap.md) |
| `frontend/src/game/bgm.ts` / `components/BgmMiniPlayer.tsx` / `BgmMenu.tsx` / `BgmPlayer.tsx` | [09](doc/09-ui-conventions.md)·[14](doc/14-bgm-pipeline.md) |
| `components/copyedit/BgmEditor.tsx` / `tools/gen_bgm.py` / `tools/bgm_plan.py` / `Lumi/Lumi_API_suno_ttapi.py` | [14](doc/14-bgm-pipeline.md)·[06](doc/06-copyedit-editor.md) |
| `frontend/src/theme-portrait.css` | [09 §2b](doc/09-ui-conventions.md) |
| `frontend/src/game/layout.ts` / `styles.css` | [09](doc/09-ui-conventions.md)·[11](doc/11-cross-mode-pitfalls.md) |
| `components/Timeline.tsx` / `CardList.tsx` / `EntryPanel.tsx` | [03](doc/03-gameplay-logic.md)·[09](doc/09-ui-conventions.md) |
| `components/CardChat.tsx` / `GatePanel.tsx` / `Archive.tsx` / `SlotPicker.tsx` | [03](doc/03-gameplay-logic.md)·[09](doc/09-ui-conventions.md) |
| `screens/Title.tsx` / `LevelIntro.tsx` / `game/coach.ts` / `components/Coach.tsx` | [03 · 闸门 / 常驻提示](doc/03-gameplay-logic.md)·[09 §1 / §8](doc/09-ui-conventions.md) |
| `components/copyedit/*` | [06](doc/06-copyedit-editor.md) |
| `backend/server.js` / `frontend/vite.config.ts` | [01](doc/01-architecture.md)·[05](doc/05-build-run-test.md)·[06](doc/06-copyedit-editor.md) |
| `tools/validate_data.py` | [05](doc/05-build-run-test.md)·[07](doc/07-content-authoring.md)·[10](doc/10-constraints-decisions.md) |
| `tools/i18n_*.py`（含增量同步 `i18n_sync.py`） | [13](doc/13-i18n.md) |
| `tools/art_spec.py` / `gen_assets.py` / `regen_image.py` / `gen_scene_icons.py` / `migrate_art_prompts.py` / `gen_icons.mjs` | [04](doc/04-art-pipeline.md) |
| `tools/init_recaps.py` / `apply_recaps.py` | [12](doc/12-story-recap.md) |
| `tools/build_offline.mjs` / `playthrough.mjs` / `bbs_shots.mjs` | [05](doc/05-build-run-test.md)·[11](doc/11-cross-mode-pitfalls.md) |
| `tools/build_dist.mjs` / 根 `package.json` / `.lumimaker/` | [05 §1b](doc/05-build-run-test.md) |
| `run.bat`（及任何 .bat/.cmd） | [10](doc/10-constraints-decisions.md) |
