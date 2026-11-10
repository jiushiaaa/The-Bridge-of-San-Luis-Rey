# 01 · 架构总览与文件结构

> 上级索引：[README_dev.md](../README_dev.md)

## 1. 总览

- 前端：**Vite + React 18 + TypeScript**（无额外运行时依赖），DOM/CSS 渲染（不用 Canvas），集中式状态机 + 数据驱动。
- 数据：每部作品一个 `workspace/{作品}/final_game.json`（构建期内联进 JS 包）。引擎零故事内容，只解释数据。现有作品：**悉达多**（`xdd`，黑塞小说改编，3 卷 53 卡 42 词条，素材前缀 `xdd-assets/`）、**坏血**（`bad`，纪实调查改编，v2：71 卡 72 词条 46 档案页，素材前缀 `bad-assets/`）、**一桩事先张扬的凶杀案**（`murder`，马尔克斯小说改编，素材前缀 `murder-assets/`）、**围城**（`weicheng`，钱锺书小说改编，素材前缀 `wc-assets/`）。
- 游戏选择：`frontend/src/game/data.ts` 的 REGISTRY 内联全部作品（`xdd`/`bad`/`murder`/`weicheng`），按 离线注入 `__GAME_ID` → URL `?game=` → 默认 xdd 选取；存档键按 `meta.id` 分（save.ts）。悉达多另内联 `i18n` 各语 `final_game.json`，切语言热替换叙事包（见 [13](13-i18n.md)）。
- 后端：`backend/server.js`（零依赖 node 静态服务器，端口 **6872**），仅服务"测试版"（frontend/dist + 各作品美术目录）；**最终游戏不依赖后端**。
- 离线版：每部作品各自 `workspace/{作品}/index.html`（JS/CSS 内联单文件 + 相对引用素材目录，双击即玩，file:// 可运行）；根目录 `离线游戏.html` 为多作选择页。
- 测试：Playwright（系统 Chrome channel）+ 全流程自动通关 bot（数据驱动，各作通用）。
- 端口推导（Lumi 规范）：(7-1)×31×24 + (17-1)×24 + 23 + 2001 = 6872。

## 2. 文件结构

```
0717_kimi_code_helloworld/           ← 项目根
├── backend/server.js                # 静态服务器：ASSETS_MAP 把 /assets/*、/{前缀}-assets/* 映射到各作品美术目录，其余→frontend/dist（SPA 回退），/ping；
│                                    #   另含 DEBUG 内容编辑 API：/api/health、/api/data（GET 读 / POST 写回 final_game.json，写前备份）、
│                                    #   /api/upload（换图）、/api/regen-image（按 prompt AI 重绘单张）、/api/favicon（重切）、/api/validate（跑质检）
├── frontend/
│   ├── vite.config.ts               # base './'；publicDir:'public'；dev 中间件 ASSETS_MAP 把各 /{前缀}-assets/* 映射到各作品美术；port 5174 strict；inlineDynamicImports；
│                                    #   /api 代理到 6872（编辑 API 只在后端实现一份）；watch 忽略 final_game.json（编辑器保存不触发整页刷新）
│   ├── playwright.config.ts         # 1440×900，channel:'chrome'（本机网络装不了 playwright 浏览器）
│   ├── public/favicon.ico           # 站点图标（tools/gen_icons.mjs 生成，构建时拷入 dist）
│   ├── tests/smoke.spec.ts          # 启动零报错/开局流程/常驻提示/搜寻规则（每次只 1 张）/多游戏 ?game=xdd 标题页
│   ├── tests/states.spec.ts         # 关键状态直达截图基线（默认作品 xdd）→ workspace/xidaduo/DEBUG/baseline/
│   └── src/
│       ├── main.tsx  App.tsx        # 根组件：界面路由 + Esc 关最上层弹层
│       ├── styles.css               # 基础样式 + 纸刊 token
│       ├── theme-editorial.css      # 纸刊定稿组件（原 style-lab v6）
│       ├── theme-portrait.css       # 竖版（html[data-layout=phone]）壳层与各页覆盖（见 doc/09 §2b）
│       ├── debug.ts                 # ?debug=1 面板开关；?seed=N 随机种子；window.__game 测试驱动接口
│       ├── game/
│       │   ├── types.ts             # GameData（final_game.json）与 GameState 类型 + blankAnswers 展开
│       │   ├── data.ts              # REGISTRY 内联各作品 JSON（xdd 另内联 i18n 五语包）+ __GAME_ID/?game=/默认选择 + 查询函数 + familiarMaxOf + assetUrl + replaceGameData/bumpAssetVersion
│       │   ├── store.ts             # useSyncExternalStore store：GameState（入档）与 UiState（瞬态）分离；mulberry32 可种子化 RNG
│       │   ├── logic.ts             # 全部玩法 action（搜寻/点词条/填卡/⚡提示 hintCard/时间轴/分析/档案/闸门/只读回顾/故事回顾/提示推导/调试）
│       │   ├── bgm.ts               # 背景音乐：按关歌单（进关清空只播开篇曲、卡曲解锁入单即播并亮光效）、随机/顺序/单曲三模式、进度 store（见 doc/09 §1、doc/14）
│       │   ├── sfx.ts               # UI 音效（Web Audio 合成）；首次手势后连带解锁 BGM
│       │   ├── copyedit.ts          # DEBUG 数据通道：启动拉取 /api/data、保存回写、存档消毒、换图上传、AI 重绘、自动质检（见 doc/06）
│       │   ├── content.ts           # 结构性增删（建卡/删卡/建关/删关）：跨多张表，立即写回 JSON，删前扫引用
│       │   └── save.ts              # localStorage 存档键按 meta.id 分（xdd_save_v1 / bad_save_v1），校验 storyId+version
│       ├── i18n/                    # 玩家语言：locale/t()、ui/{zh-CN,de,en,ja,zh-TW}.json（见 doc/13）
│       ├── screens/ Title Opening Game Ending
│       └── components/ TopBar RightPanel NotesPanel EntryPanel CardList CardChat SlotPicker Timeline GatePanel Archive
│                        LevelBar（关卡带/只读回顾入口）StoryRecap（回顾本关故事长廊）
│                        BgmMiniPlayer（页签栏黑胶迷你播放器）BgmMenu（模式 + 歌单，弹层与菜单共用）BgmPlayer（「菜单」内 BGM 行）
│                        GuideModal HintModal Toast Avatar FormIcon RichText DebugPanel DebugProgressModal
│                        copyedit/    # DEBUG 内容编辑器：common（按钮/壳/图与 prompt/选择器/预览）+ CopyEditModal 分发
│                                     #   Entries/Card/Timeline/Gate/Archive/Frame/Meta/Level/Recap/Bgm 十个编辑器（Bgm：试听/换 mp3/复制 prompt，无重生成）
├── tools/
│   ├── frame_story.json             # 过场/结局故事源稿示例（纯故事叙述，无玩家身份与派活台词）；各作 frame 节亦可直接写在 final_game.json
│   ├── validate_data.py             # 数据全量质检 + 通关模拟（CI 级，非零即败）；用法 [作品id] [--author|--director]
│                                    #   含 tier 分层规格、档案留白答案分布、卡面重复片段（一事一卡）、人物弧光断线（警告）、回顾分页规格
│                                    #   两档严重度：完整性错误恒拦；设计规范在 meta.status=final 时降级为建议（README_game §9）
│                                    #   汉字字数红线只跑简体真源；语言包用 i18n_check.py（见 doc/13）
│   ├── i18n_clone.py  i18n_check.py i18n_apply_glossary.py i18n_opencc.py i18n_tw_polish.py
│   ├── i18n_strings.py i18n_prose.py i18n_apply_tr.py   # 悉达多平行叙事包管线（见 doc/13）
│   ├── art_spec.py                  # 生图规格唯一定义处：从 final_game.json 读 prompt、按用途拼画风与参考图（下面三个脚本共用）
│   ├── gen_assets.py                # 并发补图（腾讯云 GPT-Image-2，low/1K/jpg，10 线程，跳过已存在）；用法 [作品id]
│   ├── regen_image.py               # 单张重绘（总是覆盖），DEBUG「AI 重绘」的后端；用法 作品id 素材路径 [--prompt/--ref]
│   ├── migrate_art_prompts.py       # 一次性：把历史硬编码 prompt 迁进 json；此后只做缺口巡检（全部 setdefault）
│   ├── gen_icons.mjs                # 程序绘制 favicon.ico（全作共用兜底）与 npc_unknown.png；用法 [作品id]
│   ├── gen_scene_icons.py           # 各作品主题图标（情节列头 1:1）+ 中心裁切 64×64 favicon.png；用法 [作品id|all] [--favicon-only]
│   ├── bgm_plan.py                  # BGM 规划自检：每关正文字数 → 应有曲数 max(round(字数/1500),2)、开篇曲、卡曲 row 分布；用法 [作品id]（见 doc/14）
│   ├── gen_bgm.py                   # 按 assets.bgm 的 prompt 并发生成 mp3（Suno v5.5 / TTAPI，经 Lumi/Lumi_API_suno_ttapi.py）；备选 clip → DEBUG/bgm_alt/；用法 作品id [--clean|--only id|--force|--workers N]
│   ├── init_recaps.py               # 【回顾本关故事】分页骨架（写作任务书）→ DEBUG/recaps.json；用法 [作品id|all]
│   ├── apply_recaps.py              # 把写好的回顾文章合并进 final_game.json；用法 [作品id|all]
│   ├── build_offline.mjs            # vite build → 内联 JS/CSS + 注入 __GAME_ID → workspace/{作品}/index.html；用法 [作品id]
│   ├── playthrough.mjs              # 全正确答案真实点击通关 bot + 截图（需 dev server 5174）；用法 --game 作品id
│   ├── shots.mjs / review.mjs       # 巡屏/定点截图工具；用法 [作品id]
├── workspace/
│   ├── xidaduo/                     # 悉达多（已发布，只留发版所需）：final_game.json、i18n/{de,en,es,fr,hi,ja,ko,zh-TW}/final_game.json + glossary.json + STYLE.md、
│   │                                #   xdd-assets/、index.html + *.woff2（离线产物）、DEBUG/（BGM_DESIGN.md 音乐设计、bbs_pics/ 宣传截图）
│   ├── badblood/                    # 坏血：final_game.json、bad-assets/（avatars/images/cg）、index.html、book/（原著）、DEBUG/（DESIGN.md 设计稿）
│   ├── murder/                      # 一桩事先张扬的凶杀案：final_game.json、murder-assets/、index.html、DEBUG/
│   └── WeiCheng_QianZhongShu/       # 围城：final_game.json、wc-assets/、index.html、DEBUG/
├── run.bat                          # 缺依赖则装、缺 dist 则构建 → 数字菜单选择作品 → 开浏览器 → 起后端 6872（**纯英文/ASCII，禁中文与 chcp**）
├── 离线游戏.html                     # 多作离线版选择页
├── README_game.md  README_dev.md  doc/
└── Lumi/                            # 规范与生图 / 生乐 API（只读参考，勿改；Lumi_API_suno_ttapi.py 被 tools/gen_bgm.py 引用）
```
