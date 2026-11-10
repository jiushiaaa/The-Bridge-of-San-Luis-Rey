# 05 · 构建、运行、测试

> 上级索引：[README_dev.md](../README_dev.md)　·　相关：[06 DEBUG 内容编辑器](06-copyedit-editor.md)、[11 跨模式踩坑](11-cross-mode-pitfalls.md)

## 1. 常用命令

```bat
:: 开发（热更新）
cd frontend && npm run dev              :: http://localhost:5174（?game=xdd 切悉达多）
:: 测试版（后端静态服务）
node backend/server.js                  :: http://localhost:6872（或双击 run.bat 选作品）
:: 离线版导出（每作各导一次）；导出用 VITE_ONLY_GAME 单作构建会覆盖 dist，
:: 故脚本结束会自动全量重建 dist 恢复后端/dev 多作切换（批量导出可加 --no-restore，末次再恢复）
node tools/build_offline.mjs xdd        :: → workspace/xidaduo/index.html（双击 离线游戏.html 选作品）
:: 数据质检（改 final_game.json 后必跑；参数为作品 id）
python tools/validate_data.py xdd       :: 加 --strict-assets 连图片存在性也算错误
                                        :: --author 强制严格（CI 恒用）／--director 强制宽松
                                        :: 缺省档位由 meta.status 决定（README_game §9）
python tools/i18n_check.py all          :: 悉达多语言包与简体结构对齐（不跑汉字字数；见 doc/13）
:: 切语言冒烟（需 dev 5174）：/?game=xdd&lang=de|en|ja|zh-TW
:: 美术（prompt 真源是 final_game.json，见 doc/04）
python tools/gen_assets.py xdd                          :: 批量补缺失的图（已存在跳过）
python tools/regen_image.py xdd xdd-assets/cg/c1_01.jpg  :: 单张重绘（总是覆盖）
python tools/gen_scene_icons.py xdd --favicon-only       :: 由主题图标重切 favicon
:: 回顾本关故事（见 doc/12）
python tools/init_recaps.py xdd         :: 生成分页骨架 → DEBUG/recaps.json（写作任务书）
python tools/apply_recaps.py xdd        :: 把写好的文章合并进 final_game.json
:: 界面测试（需 dev server 在 5174）
cd frontend && npx playwright test      :: 冒烟 + 状态基线（含 ?game=xdd 多游戏冒烟）
:: 全流程通关验证（需 dev server 在 5174；数据驱动，自动适配作品）
node tools/playthrough.mjs --game xdd       :: 截图到 workspace/xidaduo/DEBUG/playthrough/
:: 宣传截图（不需 dev server：脚本自带静态服务，直接跑离线正式包；先 build_offline）
node tools/bbs_shots.mjs xdd                :: 桌面真实通关 + 竖屏 + 八语 → workspace/xidaduo/DEBUG/bbs_pics/
                                            :: --only desktop|phone|lang 只重拍一组（竖屏/多语言复用上次通关存下的存档快照）
```

## 1b. 发布到幻光文游平台（lumimaker）

根目录 `package.json` 只服务发布：`npm run build` = `build_offline.mjs xdd` + `build_dist.mjs xdd`，把悉达多的离线单文件、字体与 `xdd-assets/` 整理进根目录 `dist/`（`final_game.json` / `i18n/` / `DEBUG/` 不进包，数据已内联；脚本会拒绝任何 `http(s)://` 外链）。平台身份记录在 `.lumimaker/`（随仓库保留），`dist/` 与根 `node_modules/` 已 gitignore。

```bat
npx lumimaker whoami        :: 查看登录；未登录 npx lumimaker login（浏览器授权）
npm run build               :: 组装 dist/
npx lumimaker publish       :: 正式版；首次不带 --yes，按退出码 10/11/12 交互（见 .cursor/skills/lumimaker）
```

续发：先改 `package.json.version`，再 `npm run build` + `npx lumimaker publish`；续发不带 `--content`，改名/简介/帖子正文到平台网页操作。

## 2. 测试驱动接口

正常游玩与测试共用同一套状态模型：

- `?debug=1` 开调试面板（解锁全卡/补全本关/体力99/跳关/直达结局前态/清档）；
- `?seed=N` 固定随机数（落位可复现）；
- `?lang=zh-CN|de|en|ja|zh-TW` 强制玩家语言（优先于 localStorage，见 [13](13-i18n.md)）；
- `window.__game = {getState, setState(克隆后派发), getData, newGame, grantAll}`。

## 3. DEBUG 弹层（进度直达 + 内容编辑）

非离线版（dev 5174 / 后端 6872）顶栏「提示」左侧恒显 `DEBUG-进度` 按钮（`.btn-debug`，无需 `?debug=1`），弹层（`DebugProgressModal`，`ui.debugOpen`）含本关进度概览 + 分组一键动作：

- 残页：解锁全部 `debugUnlockLevel` / 已解锁一键填对 `debugSolveUnlocked` / 已补完一键归位 `debugPlaceDone` / 补全本关 `debugFillLevel`；
- 词条与档案：全收集读满 `debugCollectEntries` / 解锁本关档案页 `debugUnlockArchives`；
- 资源与关卡：体力99 / 跳关 / 直达结局前态；
- **内容编辑**（后端在线时才有）：那些界面上没有天然入口的编辑器都挂在这里——
  作品设置 `{kind:'meta'}`、关卡管理 `{kind:'levels'}`、词条库、新建本关情节卡、
  本关时间轴 / 故事回顾 / 过场、结局文本。后端未启动时这一组换成一行提示。
- 危险操作：清档重开。

离线判定为 `debug.ts` 的 `offlineBuild`（构建注入的 `__GAME_ID` 或 file:// 协议），离线单文件版不渲染该按钮。

编辑器本身与各字段的可改范围见 [06 DEBUG 内容编辑器](06-copyedit-editor.md)。
