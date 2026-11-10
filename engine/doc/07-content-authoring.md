# 07 · 如何修改内容（换文案 / 调数值 / 增删结构）

> 上级索引：[README_dev.md](../README_dev.md)　·　相关：[02 数据 schema](02-data-schema.md)、[06 DEBUG 内容编辑器](06-copyedit-editor.md)

**两条路都通向同一份 `final_game.json`**：手改文件，或后端在线时用游戏内 DEBUG 编辑器（图形化、带实时校验与自动运算，
覆盖全部字段，见 [06](06-copyedit-editor.md)）。手改完必须自己跑 `validate_data.py`；DEBUG 保存会自动跑。

- **改卡面/词条/档案/闸门文案**：直接改 `final_game.json` 对应字段 → 跑 `validate_data.py` → 前端无需动（dev 热更新会重载 JSON import；离线版需重新 `build_offline.mjs`）。
- **改体力数值**：`meta.stamina` 五项。改完必须跑 validate（自动通关模拟会证明不死档）。
- **加/删卡红线**：
  1. 每卡至少 1 个 `{{词条}}` 标签（否则永远无法被搜寻解锁）；
  2. 每个空位答案必须能在某卡正文中点到或开局赠送；
  3. 时间轴 `(level,row,col)` 唯一；
  4. 匿名铁律（答案真名不出现在本卡正文；特许须登记进 validate 的 `LEAK_OK`）。
  5. 删卡前先解掉引用（闸门 `answerTitle`、回顾页的 `cards`）——DEBUG 里删卡会自动扫描并拦下。
- **加/删关卡**：一关要同时具备 `timelines[N]`、`gates` 里 `after=N` 的闸门、`frame.levelIntro[N]`。
  **引擎的总关数取自 `gates.after` 的最大值**，漏了末关闸门就会少一关（见 [10](10-constraints-decisions.md)）。
  关卡编号必须从 1 连续。DEBUG「关卡管理」会一次把这几张表都建好/删干净。
- **改行数后别忘了回顾**：`recaps` 的分页按时间行切，行数变了要去 DEBUG「故事回顾」重新切页（见 [12](12-story-recap.md)）。
- **分段写法**：卡面 segments 手工写就是 `{kind:"narration|dialogue|monologue", slot?, speakerEntry?, text}`；文本里 `[[NPCn]]` 是会随填空变真名的占位，`{{e_x|名}}` 是可点词条。dialogue/monologue 的 slot 必须在该卡 blanks 里。
- **改图**：图片路径写在 `entries[].avatar/image`、`cards[].cg`、`assets.*`；对应的生图 prompt 也在同一份 json 里
  （`avatarPrompt` / `imagePrompt` / `cgPrompt` / `look` / `meta.art`）。改 prompt 后可在 DEBUG 里一键 AI 重绘，
  或跑 `python tools/regen_image.py 作品 路径`，见 [04](04-art-pipeline.md)。
- **作品完工后**：把 `meta.status` 改成 `"final"`，字数/分层/分布这类设计规范就降级为建议，完整性错误仍然拦
  （见 [README_game §9](../README_game.md#9-使用者与时机规范什么时候是硬的)）。作品没真完工前别提前打勾。
- **悉达多改完简体后要同步语言包**（`i18n_check.py`，见 [13](13-i18n.md)）。DEBUG 只写简体；其它语种不要手改 id / slot / 答案。
