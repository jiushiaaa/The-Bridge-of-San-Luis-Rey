# 04 · 美术管线

> 上级索引：[README_dev.md](../README_dev.md)　·　设计约束见 [README_game.md](../README_game.md) §4.8

## 1. 图像生成 API

游戏中所有需要的图片，都应使用 `Lumi/Lumi_API_gpt-image2-tencent` 生成。调用时请遵守以下规范：

- **并发与效率**：使用多线程并发生成，最多开启 **10 个线程**。
- **规格限制**：只可使用 **low 清晰度**、**1K 尺寸**、**jpg 格式** 的图片。
- **角色/道具统一**：如果素材中包含需要多次重复出现的角色或道具，必须先为其设计"定妆照"——用一套详尽、稳定的语言描述该角色/道具的外观、服饰、配色、气质、标志性物品等。之后每次绘制包含该角色/道具的图像时，都要在 prompt 尾部声明其特色，确保形象一致。
- **画风统一**：
  - 禁止使用照片风格（photorealistic / live-action）。
  - 统一使用**日式动画（anime）风格**，画风**明亮清新**，以**京都动画（京阿尼/KyoAni）风格**为最佳参考。

## 2. prompt 的唯一真源：final_game.json

**每张图的 prompt 都存在 `workspace/{作品}/final_game.json` 里**，不再散落在脚本中：

| 字段 | 内容 | 生成时拼的画风 |
| --- | --- | --- |
| `meta.art.{portrait,scene,item,concept,cg,icon}` | 六段画风后缀 | —— |
| `entries[].avatarPrompt` | 人物头像原文 | `art.portrait` |
| `entries[].imagePrompt` | 地点/物品/概念图原文 | 按 `type` 取 `art.scene / item / concept` |
| `entries[].look` | **定妆照速记**：拼进每张有该人物出场的 CG | —— |
| `entries[].variants.{名}.{look,avatar,avatarPrompt}` | **形象变体**（如 `old` 中老年版）：定妆照 + 变体头像 | 变体头像拼 `art.portrait`，以基础头像为参考图 |
| `cards[].cgPrompt` + `cards[].cgChars` + `cards[].cgCharVariants` | 情节卡场景原文 + 出场人物 + 各人的形象变体 | `". The scene features " + 各人 look（变体取 variants look）+ art.cg`；同时取这些人的头像（变体取变体头像）作图生图参考 |
| `assets.{titleImagePrompt,endingImagePrompt,sceneIconPrompt}` | 三张特殊图 | `art.scene` / `art.scene` / `art.icon` |

**库里存的一律是「不带画风后缀的原文」**，后缀在生成时按用途现拼——这样改一次 `meta.art` 就能统一换风，
而且 DEBUG 编辑器里作者看到的 prompt 干净、只有画面本身。

**prompt 语言规范（2026-08 起）**：新写或重绘的 CG 画面描述（`cards[].cgPrompt`）与人物定妆照
（`entries[].look`、`variants.*.look`、`avatarPrompt`）一律用**中文**撰写；
`meta.art` 六段画风后缀维持英文模板不变（拼装时自动接在尾部，无需翻译）。
存量英文 prompt 不强制回译，重绘时一并中文化。

**形象变体（年龄段/造型差）**：同一人物在故事跨度里形象变化明显时（如老年版），
在 `entries[].variants` 登记变体：`look` 为变体定妆照、`avatar` 为变体头像路径、
`avatarPrompt` 为变体头像 prompt；变体头像以**基础头像为参考图**生成，保持同一人物辨识度。
情节卡用 `cgCharVariants: { "<eid>": "old" }` 指定该卡 CG 中此人改用变体——
拼装时取变体 look、参考图取变体头像。**变体仅供生图管线使用**，游戏内头像/档案/时间轴列头
仍一律显示 `entries[].avatar`（引擎无感知）。校验器检查 `cgCharVariants` 键 ⊆ `cgChars`
且变体存在。

拼装规则集中在 **`tools/art_spec.py`**（`compose()` / `build_jobs()` / `resolve_one()`），
全量生成、单张重绘、主题图标三条路径共用它，保证「批量跑出来的图」和「DEBUG 里点一下重绘的图」规格完全一致。

## 3. 生成脚本与引擎兜底

- `tools/gen_assets.py [作品] [只生成某些 rel 路径...]`：从 final_game.json 展开全部任务，10 线程并发，
  **已存在跳过**（重跑只补缺失），失败重试 2 次。**两波生成**：先无参考图的头像/词条图/特殊图，
  再生成依赖头像作参考图的情节卡 CG。缺 prompt 的图会在开头列出来并跳过。
- `tools/regen_image.py 作品 素材相对路径 [--prompt … --ratio … --ref eid]`：**单张重绘，总是覆盖**。
  不传 `--prompt` 就用 json 里现存的。这是游戏内 DEBUG「🎨 AI 重绘」按钮的后端（经 `POST /api/regen-image`，
  旧图由 `backend/server.js` 先备份到 `DEBUG/copyedit_backups/`）。
- `tools/gen_scene_icons.py [作品|all] [--favicon-only]`：主题图标（1:1，emblem 徽章式构图，
  按作品主题/意向/情感特点各不相同，设计约束见 README_game §4.8）→ `assets.sceneIcon`（已存在跳过），
  并**中心裁切 88% 缩为 64×64 PNG** → `assets.favicon`。游戏内 DEBUG「作品设置」里有「重切 favicon」按钮
  （`POST /api/favicon`），换过主题图标后点一下即可。
- `tools/migrate_art_prompts.py`：一次性迁移脚本（把历史上硬编码在 gen_assets.py 里的
  `MANIFEST_*` / `CG_*` / `CHAR_LOOK_*` 搬进 json）。迁移已完成、源表已删除，此后重跑它只做无害的巡检：
  补 `meta` 缺省字段、重新扫描还缺 prompt 的图并刷新 `DEBUG/art_prompts_missing.md`。**所有写入都是
  setdefault，绝不覆盖后来手写的 prompt。**
- 引擎侧：所有 `<img>` 走 `assetUrl()`（相对路径）+ onError 兜底回退「首字印章」色块（`Avatar.tsx` 的 `Seal`）。
- **重绘一张图的两条路**：①游戏内 DEBUG 编辑器改 prompt → 点「🎨 AI 重绘」（情节卡 CG 重绘后会自动重测亮度回填 `cgDark`）；
  ②命令行 `python tools/regen_image.py 作品 路径`。批量补缺失仍用 `gen_assets.py`。

## 4. 引擎侧应用与硬规则

美术 low/1K/jpg 是规范限定；统一明亮动画风；照片风格禁用。**全量绘图**：人物头像 + 每个地点/物品/概念词条图（1:1）+ 每张情节卡 16:9 CG。三处应用：

1. 档案 hero（`avatar ?? image`）；
2. 地点词条卡背景图（`.entry-card.has-bg` 内嵌 `<img class="entry-bg-img">`，opacity≈0.8 + 暗色渐变 + 白字深描边，文字须仍清晰）；
3. 情节卡补完后主区 CG 常驻背景（`.chat-cg-bg` 内嵌 `<img class="chat-cg-img">` + `::after` 遮罩）。

4. 【回顾本关故事】长廊左栏的预览图轮播（取覆盖卡中**已补完**卡的 CG，见 [12](12-story-recap.md)）。

**所有图片一律用 `<img src={assetUrl(...)}>` 相对文档加载，禁止用 CSS 变量 `url()` 经 `var()` 引用**（否则后端/dev 版按 `/app/` 目录解析而失效，详见 [11 跨模式踩坑](11-cross-mode-pitfalls.md)）。CG 用定妆照 base64 参考图 + prompt 设定保证人物/画风一致，忌两人对站构图、忌泄露待猜身份。

## 5. 历史缺口

`workspace/{作品}/DEBUG/art_prompts_missing.md` 记录该作还缺 prompt 的图（图片文件在、当年的 prompt 已不可考）。
缺口清完文件会自动删除。补写方式：游戏内 DEBUG 的词条 / 情节卡 / 作品设置编辑器里直接写，写完就能一键重绘。
