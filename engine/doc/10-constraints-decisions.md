# 10 · 工程约束与已知决策

> 上级索引：[README_dev.md](../README_dev.md)　·　相关：[09 UI 与交互约定](09-ui-conventions.md)、[11 跨模式踩坑](11-cross-mode-pitfalls.md)

## 1. 代码与数据的硬约束

- **关卡数一律从数据推导，任何地方都不许写死**（三关与更多关共用同一套代码）：前端 `data.ts` 的 `maxLevel = max(gates.after)`（档案编辑器关卡选择器、`debugPreEnding`、`?debug=1` 的「跳关 N」按钮数都取它）；`tools/validate_data.py` 的 `game_levels()/max_level_of()`（timelines 键 ∪ cards.level ∪ gates.after）供档案页 level 合法性、弧光断线、通关模拟共用；`tools/playthrough.mjs` 的 `MAX_LEVEL` 取 timelines 键。校验器的 `check_levels()` 强制两套真源一致：关卡编号从 1 连续到最大关，且每关都有时间轴 / 情节卡 / **闸门** / 过场——**末关也必须写闸门**，否则前端 `maxLevel` 会少一关。
- **批处理脚本（`run.bat` 等 .bat/.cmd）必须纯英文 / 纯 ASCII**：不得含中文或任何非 ASCII 字符，不得用 `chcp`。cmd.exe 在不同代码页下会把非 ASCII 字节解析成乱码命令（曾出现「'夜晚)' 不是内部或外部命令」等报错）。菜单、提示、注释一律用英文；作品名用拼音 id + 英文译名。若需展示中文信息，放到 README 或前端界面，勿写进 .bat。
  前端另有 `allLevels()`（timelines 键升序）供关卡带与关卡管理列举；游戏内 DEBUG「关卡管理」建关时会一次把
  时间轴 / 闸门 / 过场都建好、删关时一并删干净，就是为了不让这四张表走散。
- 旧版 `merge_data.py` 与 `build_data.py`（一次性旧数据转换管线）已随旧工程一并退役：内容一律直接维护 `final_game.json`。
- **生图 prompt 一律存在 `final_game.json`，脚本里不许再硬编码**（历史上散在 `gen_assets.py` 的
  `MANIFEST_*`/`CG_*`/`CHAR_LOOK_*` 里，导致 badblood 换过一轮图后 29 张的 prompt 彻底失传）。
  拼装规则集中在 `tools/art_spec.py`，批量生成与单张重绘共用，见 [04](04-art-pipeline.md)。
- **校验的两档严重度**（README_game §9）：完整性错误恒拦，设计规范按 `meta.status` 决定拦或提示。
  新增检查项时先想清楚它属于哪一档——放错档会让内容总监期寸步难行，或者让 AI 生产期溜过真正的坏数据。
- 图片加载路径的硬规则（禁 CSS 变量 `url()`）见 [11 跨模式踩坑](11-cross-mode-pitfalls.md)。
- **玩法只认 id**：填空答案、搜寻、存档键都是 `e_*` / `c1_01`。界面显示名随语言包变，但 id 永不翻译。悉达多切语言不换存档。详见 [13](13-i18n.md)。

## 2. 玩法数值与内容决策

- **难度三档**：`easy`（13 张独白卡，无地点空）；`normal`（人名+地点）；`hard`（7 张：**登场人物**全匿名——无 speakerEntry，人物空 3~4 个；伪装名「阿斯托」作为剧情关键线索以裸文本保留）。校验器检查一致性（easy 不得有地点空；hard 不得含 speakerEntry），**均为设计规范档**（`meta.status=final` 时降级为建议）。
  `hard` 曾经还禁止「正文出现任何人名标签」，那是过度解读：需要藏起来的只有**本卡待猜**的人，而这一条对所有难度都由匿名铁律统管；顺带提及的第三方（「那是某某的公司」）本就该做 chip，否则困难卡交代不了背景、词条也断了收集来源。该项已从难度检查中移除。
- **地名答案支持数组**（`answer: [eid,...]`，任一命中即对，如 c1_13 = [草棚, 小丘]）；引擎（verifyCard/RichText/Speaker/BlankButton/搜寻优先级）与校验器、通关 bot 均已适配。
- **地名词条靠正文 chip 获得**（不再开局赠送），人物词条仍靠正文 chip 收集。
- **地点按故事实际发生地设置**（16 个地点词条：计老人的草棚、部落营地、草原小丘、草原坟地、车尔库家门口、篝火会场、苏普家帐篷、草原岔路口、荒山山洞、迷宫大殿等），替代早期「铁延部」一统的做法；旧大地名（铁延部/大戈壁等）保留为可收集词条。**地名不开局赠送**：每个地点在正文中至少有一处可点 chip（获得靠阅读；`levelStartEntries` 只送人名/物品类起始词条）。
- **体力经济总量**（回答>收集搜寻规则下）盈余大约 16~20 点（0 休整）：有意的"软门槛"设计，调整前先想想要不要收紧。

## 3. 测试与调试环境

- Playwright 用系统 Chrome（`channel:'chrome'`）：本机网络装不了 playwright 自带浏览器；换机器若已装可去掉 channel。
- 调试面板会遮挡右下角（仅 `?debug=1` 时存在）。
