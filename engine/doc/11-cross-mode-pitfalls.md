# 11 · 跨模式踩坑经验（离线 vs 后端/dev · 必读）

> 上级索引：[README_dev.md](../README_dev.md)　·　相关：[04 美术管线](04-art-pipeline.md)、[05 构建、运行、测试](05-build-run-test.md)

本项目有三种运行形态，**素材（图片）的 URL 解析基准各不相同**，这是历史上最容易「一处改动只在一种模式生效」的坑区。改任何涉及图片/静态资源的代码前，先读本节。

## 1. 三种形态与资源基准

- **离线版**（`workspace/{作品}/index.html`）：`build_offline.mjs` 把 JS/CSS **内联进单个 html**，图片用相对目录引用；文档基准 = 该 html 所在目录（`workspace/xidaduo/`），素材在其兄弟目录 `xdd-assets/`。
- **后端版**（`node backend/server.js`，:6872）与 **dev 版**（`npm run dev`，:5174）：CSS/JS 是 `/app/` 下的**独立文件**，素材经 `ASSETS_MAP` 前缀（`/xdd-assets/` 等）映射到各作品美术目录；页面 URL 为 `/?game=xxx`，文档基准 = 站点根 `/`。
- `assetUrl(p)` 只做一件事：`p.replace(/^\/+/, '')` 去掉开头斜杠 → **相对路径**（离线必需）。相对路径能否解析对，取决于**由谁来解析**。

## 2. 核心坑：CSS 变量里的 `url()` 按「样式表所在目录」解析，不是按文档（Chrome/Blink 行为）

- `<img src={assetUrl(...)}>`、以及**元素内联** `style={{backgroundImage:`url(${assetUrl(...)})`}}` → 按**文档基准**解析 → 三种模式全部正确。
- 但把路径塞进 CSS 自定义属性（`style={{['--x']:`url(...)`}}`）再在 `styles.css` 里用 `var(--x)` 引用 → 按**引用 `var()` 的样式表目录**解析：离线版 CSS 内联进 html 恰好对，后端/dev 版落到 `/app/xdd-assets/...` → 命中 SPA 回退拿到 `index.html`（200 但是 HTML）→ 背景**变纯黑 / 只剩半透明遮罩**。
- 历史事故：地点词条卡背景（`--card-bg`）、补完后情节卡 CG 背景（`--cg`）都栽在这。**已全部改为真实 `<img>` 元素铺底**（`.entry-bg-img` / `.chat-cg-img`：absolute inset:0 + object-fit:cover + onError 隐藏，上叠 `::after` 遮罩）。

## 3. 规则（写死，勿再违反）

- 所有游戏素材图**一律用 `<img src={assetUrl(...)}>`**（或迫不得已用**元素内联** background，绝不经 CSS 变量）。**`styles.css` 中不得出现任何指向运行时素材的 `url()`**（构建期 `public/` 资产由 Vite 处理，不在此列）。
- 新增/改动任何图片显示后，**必须在后端版（:6872）实测**，不能只看离线版——离线版会「恰好」掩盖此类问题。可用 `curl.exe -s -o NUL -w "%{http_code} %{content_type}" http://localhost:6872/xxx-assets/...` 验证：图片应返回 `200 image/jpeg`；若返回 `text/html` 说明路径错、被 SPA 回退了。
- 其他跨模式一致性前提（当前已满足，改动时别破坏）：游戏数据 JSON **内联进 JS 包**；纸刊字体为构建期 Vite 处理的 OFL woff2（`frontend/src/style-lab/fonts/`，与 `public/` 同类，不经运行时素材 `url()`）；离线导出时把 `dist/app/*.woff2` 拷到 html 同目录，内联 CSS 里的 `url(./xxx.woff2)` 才能在 file:// 下解析。favicon 走 Vite `publicDir`。这些若改成运行时加载外部文件，需同样按本节核对三模式基准。**唯一受控例外**：非离线版启动时 `GET /api/data` 拉最新数据覆盖内联（DEBUG 内容编辑器所需，见 [06](06-copyedit-editor.md)）——离线版不发请求、失败静默回退内联，三模式行为不破坏。

## 4. 离线导出会污染 dist（单作 vs 全量）

`build_offline.mjs` 用 `VITE_ONLY_GAME=<作品>` 构建，只把该作数据内联进包（其余被 Rollup 摇树移除，见 `data.ts` 的 `REGISTRY`），**并覆盖 `frontend/dist`**。悉达多单作包仍内联其多语叙事 JSON。而后端版（:6872）与 `?game=` 多作切换依赖 dist 内联「全部作品」——导完某作后直接访问 `:6872/?game=xdd`，若 dist 只含 `bad`，`pickGameId` 找不到 xdd 便回退到那唯一单作，表现为「选谁都进最后导出的作品」（历史事故：导完 bad 后选 xdd 却进坏血）。

**修复**：`build_offline.mjs` 结束时自动跑一次不带 `VITE_ONLY_GAME` 的全量 build 恢复 dist（批量导出可传 `--no-restore` 跳过，末次再恢复）。判断 dist 是否全量：看 `frontend/dist/app/index-*.js` 的体积——全量明显大于单作。也可直接在该 js 里搜四部作品名（悉达多 / 坏血 / 一桩事先张扬的凶杀案 / 围城）是否齐全。

## 5. 批处理脚本必须纯英文 / 纯 ASCII

见 [10 工程约束与已知决策](10-constraints-decisions.md)。cmd.exe 在不同代码页下会把非 ASCII 字节当乱码命令执行（曾报「'夜晚)' 不是内部或外部命令」）。菜单/提示/注释全英文，作品用拼音 id + 英文译名，中文信息只放 README 或前端界面。
