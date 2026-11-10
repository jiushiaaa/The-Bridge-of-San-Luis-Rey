# 08 · 如何用本模板做一个全新故事的游戏

> 上级索引：[README_dev.md](../README_dev.md)　·　内容设计管线见 [README_game.md](../README_game.md) §5

以现有四作（xdd / bad / murder / weicheng）为实例，加一部新作品「new」的步骤：

1. 仿照 `workspace/xidaduo/final_game.json` 与其设计笔记，按 [02 数据 schema](02-data-schema.md) 撰写 `workspace/new/final_game.json`（先按 README_game.md §5 的管线做内容设计，再用 `tools/validate_data.py` 全量过一遍——它的检查清单就是设计红线）。
2. 注册作品（均为一行式登记）：
   - `frontend/src/game/data.ts`：import 新 JSON 并加入 `REGISTRY`（`new: rawNew`）。存档键 save.ts 自动按 `meta.id` 生成，无需改。
   - `frontend/vite.config.ts` 的 `ASSETS_MAP`、`backend/server.js` 的 `ASSETS_MAP`：加 `/new-assets/` → `workspace/new/new-assets`（或复用 assets 命名，注意各作路径前缀必须不同）。
   - `tools/art_spec.py` 的 `GAMES` 与 `ASSET_PREFIX`（生图脚本全都从这里读，只此一处）；
     `tools/validate_data.py`、`tools/build_offline.mjs`、`tools/playthrough.mjs`、`tools/gen_icons.mjs`、`tools/shots.mjs`、`tools/review.mjs` 的 GAMES 映射各加一行；`validate_data.py` 的 `LEAK_OK_BY_GAME` 加空集合（特许再登记）。
3. 生成美术素材（规格见 [04 美术管线](04-art-pipeline.md)）：**prompt 直接写进 `final_game.json`**
   （`meta.art` 六段画风、`entries[].avatarPrompt/imagePrompt/look`、`cards[].cgPrompt/cgChars`、`assets.*Prompt`），
   然后 `gen_assets.py new` 批量出图、`gen_scene_icons.py new` 出主题图标 + favicon、`gen_icons.mjs new` 出剪影；
   在 assets 登记 `sceneIcon`/`favicon`。单张不满意就在 DEBUG 里改 prompt 点「AI 重绘」。
4. 写【回顾本关故事】：`init_recaps.py new` 生成分页骨架 → 逐页写文章 → `apply_recaps.py new`（见 [12](12-story-recap.md)）。
5. 内容生产期把 `meta.status` 留在 `wip`（缺省），全部设计规范强制执行；作品真正完工后再改成 `final`。
6. 跑：validate → playwright（可加一条 `?game=new` 冒烟用例）→ `playthrough --game new` → 导出离线版（命令见 [05 构建、运行、测试](05-build-run-test.md)）。

叙事多语言不是新作必做项。引擎 UI 五语已经通用；要像悉达多那样翻正文，按 [13 多语言](13-i18n.md) 给该作加平行 `i18n/{locale}/final_game.json` 并登记进 `data.ts` 的 LocalePack。缺包会回退简体叙事。

参考规模：悉达多 3 卷 53 卡 / 42 词条（`workspace/xidaduo/final_game.json`）。
