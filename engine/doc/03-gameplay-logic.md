# 03 · 关键机制实现（logic.ts 为主）

> 上级索引：[README_dev.md](../README_dev.md)　·　相关：[02 数据 schema](02-data-schema.md)、[09 UI 与交互约定](09-ui-conventions.md)

## 搜寻 `searchEntry`

当前关、未解锁、正文含该词条的卡为候选，按优先级取高者（同分按 cards 数组顺序取早者），耗 1 体力；新残页 `pos=null` 进入时间轴「待归位残页」区；按钮剩余数 `searchRemaining`。

优先级 `searchPriority`（总原则「回答>收集」，**严格分层、命中即返回**；共享上下文 `buildSearchCtx`：潜在池 = 已收集词条 ∪ 本关已解锁卡正文可收集 `{{词条}}`，及未解锁卡 tag 索引）：

1. **+10000 完美作答（现货）**——每个空位都能用已收集词条作答（数组答案任一命中）→ `10000 - 空位数`（待答项目越少越优先）；
2. **+1000 完美作答（可预期）**——每个空位都能用潜在池作答 → `1000 - 空位数`；
3. **+100 收集价值**——卡面能收集到新的**有效**词条（未收集，且为人物/地点、或还有其他未解锁卡提及它即有后续搜索价值）→ `100 + 新有效词条的本关熟悉度上限（familiarMaxOf）最大值`；
4. **兜底（恒 <100）**——`10×已可作答空位 + 4×潜在池可作答空位 + 2×其余新词条（无搜索价值的物品/概念） - 空位数`，`min(99,…)` 封顶。

**硬规定（独白防连发）**：上一张搜到的卡是某 NPC 的独白时，下一次搜卡该 NPC 的独白卡**优先级直接置 0**（同一 NPC 的独白永不连发；不同 NPC 的独白可相邻；候选池只剩它们时仍发放，永不卡死）。

**连发抑制（跨层版，独白外的其他重复）**：候选与最近解锁的卡同列（同角色）且同形态时——连发 1 张扣 6 分（只在层内让位：空位差 ≤5 < 6 < 层间距，第 3 层下限钳到 100 保持恒压第 4 层）；连发 ≥2 张**跨层降级**到 `min(原分, 99 - 空位数)`（压到第 3 层之下），强制让可预期作答/收集向的卡插队——**同类连发至多 2 张**；候选池全是同类时仍取空位最少者（优雅退化，永不卡死）。xdd 第一关实测：原 4 连发独白 → 独白全部被情节/对话（或另一 NPC 的独白）隔开。连发序列由 `unlockedAt` 推导（`buildSearchCtx.recentKeys`），不新增存档字段（`tools/validate_data.py` 的通关模拟用同规则，且模拟按全局最佳选卡、跟踪解锁顺序）。

**最佳搜寻标记** `bestSearchTarget`：所有已收集且有剩余搜寻的词条中，取候选卡优先级全局最高者（平手按词条定义序/卡序，确定性）——词条库中该词条的「搜寻」按钮带放大镜 SVG（`.search-ico`），推荐项加 `data-search-best`：放大镜朱红、放射环 + 小幅环绕（体力不足禁用时特效仍播放），一直点它即最佳路径；`currentHints` 的搜寻建议同源。

## 点词条 `clickEntry`

首次收集 toast；打勾（`famCards` 记录本卡已点，RichText 显示 ✓）与熟悉度自增**解耦**——熟悉度已满时点击仍打勾（toast「已很熟悉」），自增才封顶本关上限 `familiarMaxOf`。

## 熟悉度分关

`familiarMaxOf(eid, lv)`（= 该关 tag 卡数+单一答案卡数，不做容错折扣；数组答案卡不计入——补完只给玩家所选词条 +1，计入会让未被选的词条上限不可达）取代旧 `familiarMax` 字段；`startLevel` 进关时全词条 `familiarity` 清零（收集状态、档案页进度继承）。圆点/排序/分析判定（`analyzable`）均取本关上限。

## 时间轴 `selectChip/placeSelected`

时间轴页为 左｜中｜右 三列——左列「待归位情节卡」（`pos=null` 的已解锁卡，已补完的排前面；每项 `PoolItem` = 10px 形态字标 + 标题（未补完用 `VeiledTitle` 模糊标题，与情节卡列表同款）/摘录两行文字，点选后标题行右侧出同尺寸「阅读」小按钮（跳情节卡页并打开该卡）、下方展开情节卡同款槽位行（24px 头像/地名胶囊，复用 `SlotRow` 的 size 参数；情节卡列表内仍为 28px））、中列时间轴表格、右列关卡出口面板（GatePanel 内嵌）；点选→点格；空格移入、占格交换（被挤出者回待归位区）、锁定格拒绝。落位持久化在 `cards[id].pos`。

列头人物头像 52px；**未收集的人物列只显示神秘剪影 +「？？？」**；**情节列头显示作品主题图标**（`assets.sceneIcon`，52px 与人物头像同尺寸，缺失时回退「情」字印章）。

**行头时间点名默认隐藏防剧透**：未揭示时只显示「时间 N」+ 行头下方小按钮「提示♥」（`.row-hint-btn`，`revealRowName` 扣 1 体力、入 `rowHints[level]`）；整行锁定归位（rowStats 满）由渲染层自动揭示，不入档。

**格子大幅增大**（表格 `table-layout:fixed`、宽 `calc(100%-32px)`，行头列按实际文字需要收窄至 60px（上限 84px，长时间点名自动换行）、格高 96px），chip 铺满整格；**补完卡（`cs.done && card.cg`）以其 16:9 CG `<img class="tl-chip-cg">` 铺满格子作底色**（未补完不显示防剧透），标题压深色渐变白字（`.has-cg .chip-title`），锁定卡金描边 + 金调渐变；点选后「阅读」小按钮悬浮格子右上角。

**整行或整列归位后仍空着的格子标记为 `.tl-cell.settled`**（该行/列的卡都已定位 → 这一格确定不会再有卡）：撤掉「可放置」虚线框 + 极淡斜纹（「此处无需填写」的惯用记号），但**仍可放入卡**（只是不高亮，玩法未变）。选中某卡时全表格都会加 `.droptarget` 金色高亮，**该高亮必须写成 `.tl-cell.droptarget:not(.settled)`**：否则从情节卡「待排序」（`gotoTimeline` 带点选状态进入时间轴）跳来时，斜纹会被整片盖掉，看着像「样式没刷新」，其实 `settled` class 一直都在；且金色高亮只能用 `background-color`，用 `background` 简写会把斜纹的 `background-image` 重置成 `none`。

## 关卡带与只读回顾 `LevelBar` / `ui.reviewLevel`

**右栏（关卡出口）顶部**是 `components/LevelBar.tsx`：关卡集合取自 `allLevels()`（`timelines` 的键，**不写死**）。
每格只有「第 N 关」+ 小字「N 段情节」（`cardsOfLevel(lv).length`）——**不显示关名与星级**：关名会剧透走向，
段数不会，却正好回答了「这部作品还有多长」。已通关（`s.gates[lv].passed`）的关可点；当前关高亮、回顾态下点它退出回顾；
未开启的关虚线灰显、`disabled`。

它必须待在右栏而不是中列顶部：回顾旧关时右栏的闸门面板收起，**但 `.tl-right` 容器本身要留着**
（`gateOpen ? <div className="tl-right">…` 不再受 `gate` 是否存在支配），否则玩家点进旧关后就找不到回来的入口了。
窄屏折叠时那根 `.tl-gate-tab` 竖条也改成无条件渲染（回顾态标签写「关卡」），道理一样。

右栏很窄，关卡带**恒为一行、一页 3 关**：不换行、不出滚动条，超出就靠两端的 `‹` / `›` 翻页；格子固定宽，
末页不满时居中而非拉伸（见 [09](09-ui-conventions.md#5-时间轴信息密度timelinetsx)）。因为会分页，回顾态右栏还必须有一个
`[data-exit-review]` 一键返回按钮——当前关可能不在这一页上，不能让玩家先翻页才找得到回去的路。

`reviewLevel(lv)`（logic.ts）把 `ui.reviewLevel` 置为该关，`Timeline` 内部 `const lv = rv ?? s.level`
后整块按那一关渲染。**不需要任何快照**：`s.cards` 是全局 record，历史关卡的 `done` / `pos.locked` 一直都在。
回顾态与游玩态的差别集中在 `Timeline`：

| | 游玩当前关 | 只读回顾（`reviewLevel != null`） |
| --- | --- | --- |
| 左列 | 待归位情节卡（**本关全部卡归位锁定**后才收起，见下） | 隐去 |
| 格子 | 可点选、可放置、可交换 | `clickable=false`、`droppable=false` |
| 行头时间名 | 未揭示显示「时间 N」 | **全部揭示**（已通关，无所谓剧透） |
| 右列 | 关卡带 + `GatePanel` | 关卡带 + 一句指路（闸门面板收起，容器保留） |
| 点残页「阅读」 | `selectCard` 切到情节卡页签 | **原地弹只读浮层** `CardChat cardId=…` |

「阅读」在回顾态必须走浮层：`CardList` 只列 `s.level` 的卡，切过去会出现「左列是第 3 关、右侧开着第 1 关的卡」的错位。
`CardChat` 为此接受可选的 `cardId` / `onGo` 两个 prop（缺省仍读 `selectedCardId` 与 `selectCard`）。

`reviewLevel` 是**瞬态 UiState**，离开时间轴页签（`setTab`）、过关（`advanceAfterGate`）、DEBUG 跳关都会清掉——
回顾绝不动 `GameState`，与会清熟悉度、覆盖进度的 `debugJumpLevel` 是两回事。

**左列「待归位」何时收起（`timelineAllLocked`，logic.ts）**：判据是**本关全部情节卡都已 `pos.locked`**，
不是「情节列整列锁定」。后者（`plotColumnDone`）只解锁中列的「回顾本关故事」按钮——角色列的卡此时还在等着放；
曾经把两者混为一谈，情节列先满就收掉左栏，结果剩下的卡再也放不上去、闸门进度永远够不到 70%，玩家直接卡关。
最后一张卡锁定的那一下由 `fxTimelineLocks` 侦测（放置与验证两条路都经过它）：`pulseFx('tlall')` +
toast `toast.tlAllDone` + `achievement` 音；`Timeline` 用 `useFxActive('tlall', 2600)` 给左栏加 `.leaving`
（宽度收拢淡出后再卸载）、给布局加 `.tl-layout-alldone`（右栏 / 折叠竖条发光两拍），把视线交给关卡出口。

## 回顾本关故事 `StoryRecap` / `recapAvailable`

`recapAvailable(lv)` = 该关有 `data.recaps[lv].pages` **且**（`plotColumnDone(lv)` 情节列整列归位 或 该关已通关）。
满足时时间轴中列底部出现「📖 回顾本关故事」，点开 `ui.recapLevel` → 根层 `components/StoryRecap.tsx` 全屏覆盖层。

每页左右两栏：左 `PreviewPane` 主图铺满 + 每 4.5s 交叉淡入切换（手点小图后停自动播），
图源 = `page.images` 或**覆盖卡中已补完卡**的 `cg`（未补完的不露，与格子 CG 同规则），全空时回落 `assets.titleImage`；
右 `.recap-article` 渲染 `segments`：`narration` 为段落正文、`quote` 为「头像 + 金底斜体气泡」。
底部翻页 + 页码圆点 + `DEBUG-故事回顾` 入口；←/→ 翻页，Esc 关闭。

页数与字数规则见 [12 回顾本关故事](12-story-recap.md)；`data.ts` 里 `recapPageCount` / `recapRowGroups` /
`cardsOfRows` / `cardsTextLen` 与 `tools/init_recaps.py`、`tools/validate_data.py` 的 `check_recap` 同一套公式。

## 卡面渐进呈现 `CardChat`

未读卡初始 2 条、每 250ms 追加 1 条（可点「全部显示」）；已读卡直接全显。**不自动滚动**（滚动条停顶部）。

## 情节卡「⚡提示」`hintCard`

底边栏的「⚡提示」（每次 −1 体力 `HINT_COST`，按钮面上不写花费、只在悬浮提示里说明）不是文案，是一次**机械核对**：逐个看本卡未锁定的空位——
- 答案词条**已收集**但空着 / 填错的 → 直接替玩家填成正确草稿（只填草稿不锁定，仍要按「验证此卡」），该空位金色闪三下（`ui.hintFlash`，带时间戳，重开卡片不重放）；
- 答案词条**一个都没收集到**的 → 临时把正确答案亮在空位按钮上并左右轻震 3s（`ui.hintPeek`，`HINT_PEEK_MS`），期间提示按钮改写为「尚未收集」、「验证此卡」禁用（`verifyCard` 也在逻辑层拒绝），到时 / 切卡 / 离开情节卡页 / 窗口失焦或切标签页（`clearHintPeek`）立即还原为未填。这等于告诉玩家"名字在词条库里，先去搜寻"，但不白送。
- 两类都没有（全填对了）→ 不扣体力，只 toast 提示直接验证。体力不足时 toast「体力不足」。
- 计数进 `stats.hints` / `perLevel.hints`（不影响评星）。

**档案页同款** `hintArchivePage(entryId, pageIdx)`：对已解锁未完成的档案页逐个字段核对，规则与收尾（`commitHint`）与情节卡完全一致，作用域键 `arcHintKey` = `arc:{entryId}:{pageIdx}`，复用 `ui.hintPeek / hintFlash`；预览期间 `checkArchivePage` 同样拒绝核对。

情节卡的 `hints` 文案字段与 `hintsShown` 状态已整体废弃（2026-09），全部作品数据已清除，`validate_data.py` 遇到残留会报规范错。

**补完（`cs.done`）后**该卡 16:9 CG 作为主区常驻背景（`.chat-cg-bg` 内嵌真实 `<img class="chat-cg-img">`，`card.cg` 走 `assetUrl`，onError 隐藏；上叠 `::after` 半透明纸色/暗色渐变遮罩保正文可读），顶栏「🏞️ 图像」按钮可重放揭示动画（`.cg-cover` 用内联 `backgroundImage` 直接相对文档解析）——未补完不显示，避免剧透。**背景图禁用 CSS 变量 `url()`**：曾用 `--cg` 变量经 `var()` 引用，后端/dev 版按 `/app/` 解析失败，导致只剩半透明遮罩、背景图消失（离线版内联 CSS 恰好正确），故改用 `<img>`（详见 [11 跨模式踩坑](11-cross-mode-pitfalls.md)）。**补完（`cs.done`）后隐藏底边栏 `.blank-area`**（填空/验证/提示按钮不再渲染，含之后每次点进该卡）——补完卡只剩 CG 背景 + 正文 + 顶栏「🏞️ 图像」重放。**补完但未归位时顶栏「图像」左侧还有「待排序」按钮**（走同一个 `gotoTimeline`，见 [09 · 情节卡](09-ui-conventions.md#3-情节卡)）。

**已归位（`cs.pos.locked`）后正文底部追加跳转条 `CardNav`**：同列 row−1 =「上一节」、同列 row+1 =「下一节」、
同行其他列的卡（按列下标排序）。**居中一行、每项用目标卡的 16:9 CG 作缩略底图**（深色渐变 + 白字标题 + 左上角关系角标，
同时段项的角标带列头像；上/下一节在图的左/右边缘融进方向箭头；两组之间一条金色分割线），
配色刻意与旁白/气泡拉开——它不是故事文本，是"读完这张想接着往下读"的入口。
目标格由 `correctCell` 反查（不是玩家的落位）；未补完的目标**不渲染 CG**、退化成纸色斜纹虚框「？？？」且 disabled
——与格子 CG 同一套防剧透规则。样式细节见 [09 · 情节卡](09-ui-conventions.md#3-情节卡)。
点击走 `onGo`（默认 `selectCard`，回顾浮层里换成"在浮层内换卡"），于是拼好的故事可以顺时间线纵读、也可以按时段横读。

## 词条库地点背景图 `EntryPanel`

地点卡（`type==='place'` 且有 `image`）用其图作卡片背景——**用真实 `<img class="entry-bg-img">` 元素铺底**（absolute inset:0 + object-fit:cover + opacity 0.8，onError 隐藏），`::after` 叠由浅到深的暗色渐变，词条名/简介改**白字 + 深描边**、熟悉度圆点加描边，保证图为主时文字仍清晰；物品/概念卡不做背景。

**默认 4:3 + 放不下则撑高（文字绝不裁切）+ 同行等高**（几经反复，最终定案）：地点卡最忌用 `aspect-ratio:4/3` 直接固定卡高——那样会拒绝 grid 的 `align-items:stretch`，同行里与更高的卡不等高。现方案：卡设 `display:grid; grid-template:1fr/1fr`（单格），格内**重叠**两项——`::before`（透明占位，`aspect-ratio:4/3`，按卡宽给出 4:3 的**最小**高度）与 `.entry-card-inner`（真正的名字/简介/按钮，flex 列 + `gap:3px`，`grid-area:1/1` 与占位同格重叠）；格高 = max(占位, **完整内容**) → 名字+简介（+搜寻按钮）在 4:3 内放得下就停在 4:3、放不下就把整卡撑高，**任何时候不对简介做 overflow 裁剪**（曾试过简介 `flex:1+overflow:hidden` 裁剪 + mask 淡出的方案，因裁字被否，勿再回头）。放得下时简介靠 `margin-top:auto` 贴底（有按钮时是「简介+按钮」整体贴底）。卡本身高度 auto（不是 aspect-ratio 固定），故仍受父 grid stretch 支配：同行以最高者拉齐、不同行各自独立。背景 `<img>` absolute inset:0 + `object-fit:cover`，卡撑到多高都会等比放大铺满（填的是 1px 边框内侧的 padding box）。

**占位 `::before` 必须写 `align-self:start` + `min-width:0`**：默认 `stretch` 会把它拉到撑高后的格高（如 109px），`aspect-ratio` 随即由这个「确定的高」反推出更宽的宽度（109×4/3=145），把 `1fr` 列的基准撑到卡宽（120）之外，`.entry-card-inner` 跟着变宽 → 名字/简介/搜寻按钮整体溢出卡片、被 `overflow:hidden` 从右侧切掉（表现为「有搜寻按钮的地点卡，文字和按钮超出图片范围」）。`align-self:start` 后占位只按 `width:100%` 反推出 4:3 的最小高度、不再反向影响列宽。TSX 里 `EntryPanel`／`SlotPicker` 的地点卡内容都必须包一层 `.entry-card-inner`（否则名字/简介会各占一 grid 行、与占位**叠加**成超高卡——曾踩此坑）。答题弹窗 `.picker-place` 复用同一 `::before`+inner 结构拿 4:3，但**不套**上面的简介裁剪（不在 `.entry-grid` 下），简介照常展开。

**注意**：早期用 `--card-bg` CSS 变量 + `::before` 的 `var()` 铺图，Chrome 会把变量里的相对 `url()` 按**样式表所在目录**（构建后为 `/app/`）解析，离线版 CSS 内联进 html 恰好正确、后端/dev 版则 404 变纯黑；故一律改用 `<img>`（相对文档解析，两种模式都可加载，与头像/CG 一致）。`SlotPicker` 的地名候选卡同理。

## 归位锁定 `applyTimelineLocks`

两种触发：

1. **行/列**：某行（或某列）的**全部设计卡**都已补完且放对时，该行/列全部 `pos.locked`（未补完视为该行/列未凑齐；**行/列内混入了放错位置的卡时不得判定完成**）；
2. **连片**：沿正确相对关系（绿线：相邻两格正确格坐标差 == 当前格差）遍历连通簇，未锁定成员 **>= 4** 且全部补完、全部位于正确格 → 一次性全部锁定（错位但相对正确的簇不会锁；已锁定卡可通过不计入）。

**残页（未补完）不参与绿线延伸与连片计数**（不作为连接节点）。单格放对本身不锁定。行/列归位触发扫光（fx 键 `tlrow:{r}`/`tlcol:{c}`）与整行/整列 toast；连片归位触发各卡金光与「N 张残页同时归位」toast。放置/交换本身不给提示 toast。`placeSelected` 与 `verifyCard` 补完时都跑同一判定。相邻格相对位置正确时渲染绿色连接线（`.tl-link`，双方均补完才显示），双方均已锁定则不再显示。

## 分析 `analyzeEntry`

熟悉度满 且本关有未解锁页 → 2 秒读条（`ui.analyzing`，进度条内嵌在锁定卡大按钮里，无全屏遮罩）→ 解锁页 → 自动切档案页签定位。档案页签角标数字 =「可分析」词条数 +「已分析未填完（可填写）」词条数（无红点）；档案列表徽标三态：**可分析**（金）→ **可填写**（朱红，已解开但留白未核对完）→ **已分析**（绿，已解开且全部盖完印）。

入口在档案详情的**锁定卡**（`.arc-page-locked`：内部隐形渲染解锁后的字段结构（幽灵排版，grid 叠放），高度与解锁后**完全一致**；无标题字样，居中叠加熟悉度圆点 + 大「分析」按钮，满格前禁用、可点时带 `data-analyze`），词条库与 hero 栏不提供分析按钮；按钮状态由 `analyzeState`（active/done/wait/none）推导。

## 闸门 `gateChecklist/checkGate`

进度 = （归位卡数×25 + 完成档案页数×10）/（本关卡数×25 + 本关档案页数×10）（归位权重为档案 2.5 倍；**界面只显示百分比，不展示算式**），**≥70% 开闸**；完形填空题面**进关起就能展开阅读**（是「本卷谜题清单」，README_game §4.5）：`blanks[].revealAt === 'start'` 的题直接显示题面，其余（缺省 `gate`）在 70% 前显示「？？？」；**70% 前不渲染答案栏**（不能填、不能提交、也没有核对/自动填写按钮和任何「可以答了」的提示），≥70% 后答案栏才出现（问题在上、答案在下一行）；候选池 = 档案页（level≤当前关）均完成的词条 + 全部已锁定卡的标题；「选择答案」弹窗排序（PickerGroup.keepOrder 尊重传入顺序）：词条组按 分类（TYPE_ORDER）→ 本关熟悉度上限 → 全作熟悉度上限之和；「剧情」组按时间轴行列排成与主界面同构的表格（`PickerGroup.layout:'timeline'`，每格 CG 图 + 标题名可点选）；星级见下节「难度与星级」（过关时把 `starBreakdown` 的满星与星数写入 `gates[after].maxStars / stars`）；**得分 = round(100×进度) + 星级加成（每星 100）**，入 `gates[after].score`，结局结算总分。进度 100% 解锁 `autoFillGate`：**只把答案填入草稿（不锁定、不提交、不影响评级与得分）**，仍由玩家点「核对答案」过关。过关 → 过场 → `startLevel(+1)`（体力+4、注入起始词条）→ 末关 → Ending。完形填空内嵌在时间轴右栏 `GatePanel`（不再弹层）。

**面板布局**：无「关卡出口」字样行，头部第一行是**卷名** `levelChapterTitle(after)`（= `frame.levelIntro[after][0]`，与「故事」页同源同字，如「第一卷 · 弃家求道」；`[data-gate-chapter]`；`gates[].title` 字段已删除）+ **本卷之问**（`levelQuestion(lv)` = `gate.question`，老数据无 question 时回退 `gate.intro`；`[data-gate-question]`）；下接**大按钮内嵌进度条**（`.gate-cta`：上半按钮文字「展开问题 / 收起问题」，任何进度都可点，≥70% 且未展开时带红点；100% 时文字旁加金框徽标「可自动填写」；下半 10px 进度条在 70% 与 100% 处各一个里程碑小圆点 `.gate-cta-dot`，到达后变金；`data-gate-expand` 保留在该按钮上）；再下为计数行 `.gate-stats`（与 `.gate-cta-bar` 同左右 10px 边距，`space-between`：时间轴条左对齐、档案条右对齐）：「[ 时间轴 now / max ]　[ 档案 now / max ]」，标签与数字写在中括号进度条内（浅灰/金软填充上用深字保可读，满时加粗）；不再显示「进度 N%」文字与 `check-line` 行（`check-line` 样式仍被手记面板使用）。闪光 fx 作用于 `.gate-cta` 与 `.gate-stats`。

**答案按钮**（`.blank-btn.gate-answer`）复用情节卡底边栏按钮样式且**贯穿整行**：未答=整行虚线框「选择答案 ▾」（文字 padding 6px 10px）；已选草稿/锁定=左侧方形图标（词条→头像/词条图，剧情标题→该卡 CG 缩略，图标随按钮高度拉伸）+ 文字，锁定态金框加 ✓。**时间轴页签角标 = 待归位数 + 可答题加成**：进度 ≥70% 且本关闸门未过时 +1（`Game.tsx` 的 gateTodo）。

## 难度与星级 `setDifficulty / starBreakdown`

`GameState.difficulty`：`easy`（默认）| `hard`，随时可切（`setDifficulty`）。

- **满星** `maxStarsOf`：简单 `MAX_STARS_EASY`=3；困难 `MAX_STARS_HARD`=5；若本关完成度（`gateChecklist(level).progress`）已 ≥ `HARD_LATE_PROGRESS`=0.2 才从简单切到困难，则该关 `perLevel.hardLate=true`，满星按 `MAX_STARS_HARD_LATE`=4。界面上这一情形先弹确认（`hardSwitchLate`）。困难 → 简单随时直接切（切回简单满星即 3）。
- **扣星** `starBreakdown`：`errDed = floor(perLevel.errors / STAR_STEP)`、`restDed = floor(perLevel.rests / STAR_STEP)`（`STAR_STEP`=3），`stars = max(0, max − errDed − restDed)`。错误与休整都**按关**记在 `stats.perLevel[lv]`，过关自然换到新关的计数；`stats.rests` 仍是全局累计（只用于结局统计）。评星规则固定在引擎里，**不再按关配置**（原 `meta.starCaps` 已废弃，校验器遇到会报规范错）。
- **难度差异**（都走 `isEasy(s)` 判定，只影响引导、不影响规则）：① `CardList` / `CardChat` 状态章的「可填写」只在简单给（情节卡页签角标也只在简单计"可填写"卡数，困难计全部待补全）；② `hintCard` 对未收集的**地名**，困难只震动不亮答案（`hintPeek.slots[slot] = ''`）；③ `EntryPanel` 的最佳搜寻红圈（`bestSearchTarget`）只在简单显示；④ `placeCard` 的单格放对反馈（`tlok` 金环、成功音）与 `Timeline` 的 `.tl-ok` 勾标只在简单给。
- 过关时 `checkGate` 把 `starBreakdown` 的 `max / stars` 写入 `gates[after].maxStars / stars`，过关动画与结局结算按各关自己的满星画空心星。

## 常驻提示 `currentHints`

状态推导 + 兜底，永不为空；条目可带 `act()` 跳转。**首条固定是本卷之问**（`hint.question`，无 `act`）——提醒玩家这一关到底在解什么；兜底条件相应改为「除本卷之问外没有别的条目时」。

## 本卷之问 `levelQuestion` / 过场问句幕 `introPageCount` / 落地页

`data.ts` 的 `levelQuestion(lv)` = `gates[after=lv].question`（老数据回退 `intro`，两者都空为 null），五处共用：过场末屏「问句幕」（`LevelIntro.tsx`）、关卡出口面板头部（`GatePanel`）、新手引导「目标」弹窗标题（`coach.ts` 的 `titleText`）、顶栏常驻提示首条、DEBUG 闸门编辑器。

**过场页数** `introPageCount(lv)` = `levelIntro[lv]` 段数 + （有本卷之问 ? 1 : 0）；`advanceIntro` 按它推进，`s.introIdx === segs.length` 那一页渲染问句幕（不打字、`.lv-intro-title.lv-intro-question`）。**首次进关落地 `tab='cards'`**（情节卡页）而不是故事页——玩家刚被交给一个问题，手边就该是可读的残页；重播过场（`replayIntro`）不改页签。

**新手引导** `coach.ts` 步骤重排：`goal`（落地情节卡页即弹，标题 = 本卷之问，三行收获文案 `coach.goal1~3`）→ `tabCards` → `tabTimeline` → 原有 `chip → entryCard → blank → search → newCard → vitals → searchDiff → timelinePlace → timelineGate`。`tabNotes` / `tabArchive` 两步已删除（老存档里多出的 `coachSeen` 键忽略即可）。

## 档案列表排序与状态（`Archive.tsx`）

可分析（`analyzeState=active`）词条置顶，其余按本关熟悉度上限降序；列表项图标用 `avatar ?? image`（有档案图的词条显示图片）；徽标三态：金色「可分析」（active）/「已分析」（页已解开但留白未补完）/ 绿色「正确」（已解开页留白全部核对通过）。左列与情节卡列表同宽 300px。

hero 栏：无图词条也保持与图像相同的 1:1 占位框（`.arc-hero-frame`，内置首字印章兜底）；名字与分类徽标（👤 人物等）同一行，分类靠右。档案详情的多关页**竖向排列**（每关一个小节：`第N关 · 标题` 小节头 + 页内容；未解锁页显示 `第N关 · ？？？ 🔒`，当前关未解锁页渲染锁定卡 `LockedPageCard`，见上文「分析」），不再用页签切换（`data-arc-tab` 保留在小节容器上供自动化定位）。存在可分析词条时，主界面「档案」页签显示红色小圆点（`.tab-reddot`，与数字角标并存）。
