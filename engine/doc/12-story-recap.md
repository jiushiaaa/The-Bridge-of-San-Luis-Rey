# 12 · 回顾本关故事

> 上级索引：[README_dev.md](../README_dev.md)　·　设计规范见 [README_game.md](../README_game.md) §4.9　·　相关：[02 数据 schema](02-data-schema.md)、[03 关键机制](03-gameplay-logic.md)、[06 DEBUG 内容编辑器](06-copyedit-editor.md)

玩家花一整关把碎片拼回去，拼完手里是几十张卡、脑子里未必有一条完整的线。这个功能把那条线还给他：
一组**多页图文长廊**，左半屏是本页覆盖到的情节 CG 轮播，右半屏是一篇第三方旁白口吻的回顾文章。

## 1. 数据

```jsonc
"recaps": {
  "1": { "pages": [
    { "rows": [0, 1],                       // 本页覆盖的时间行下标（连续区间）
      "title": "辍学创业 — 完美演示",
      "cards": ["c1_01","c1_07","c1_02"],   // 覆盖卡；默认＝这些行上的全部卡
      "images"?: ["bad-assets/cg/c1_02.jpg"], // 缺省＝取 cards 中已补完卡的 cg
      "segments": [
        { "kind": "narration", "text": "……" },
        { "kind": "quote", "entry": "e_holmes", "text": "……" }
      ] }
  ] }
}
```

`recaps` 是可选字段：没写的作品不显示回顾按钮，校验器也整段跳过。

## 2. 三条硬性规格

| 规格 | 值 | 严重度 |
| --- | --- | --- |
| 页数 | `int(时间段数 × 0.5 + 0.5)` | 设计规范（差一页只是提示） |
| 页数上界 | **必须 < 时间段数** | 完整性错误 |
| 行区间 | 每页连续、各页不重叠、合起来**恰好铺满全关** | 完整性错误 |
| 每页字数 | 该页**覆盖卡正文总字数的 10%~20%** | 设计规范 |

字数区间是这个功能的性格所在：超过 20% 就成了复读，低于 10% 会漏掉半数事件。

公式在三处保持同源，改一处必须改另两处：

- 前端 `frontend/src/game/data.ts` 的 `recapPageCount` / `recapRowGroups` / `cardsOfRows` / `cardsTextLen` / `textLen`
- 校验器 `tools/validate_data.py` 的 `check_recap` / `recap_page_count` / `recap_len`
- 生成器 `tools/init_recaps.py` 的 `page_count` / `row_groups` / `card_len` / `recap_len`（`apply_recaps.py` 直接复用它）

**字数口径统一为「去掉 `{{词条}}` 标记、去掉全部空白后的字符数」**，旁白与引语都算。
三处必须一致，否则会出现「写作时看着达标、校验时又不达标」。
（注意别去改 `validate_data.card_text_len`——那个是情节卡 `len` 字数档在用的，口径不同。）

## 3. 解锁与呈现

- 解锁：`recapAvailable(lv)` = 有 pages **且**（情节列整列归位 `plotColumnDone` 或该关已通关）。
- 入口：时间轴中列底部「📖 回顾本关故事」；只读回顾旧关时恒可用。过关后各页标题写入「故事」页目录，点开即同一套图文长廊（一页一条，可「下一页」顺读）。
- 组件：`frontend/src/components/StoryRecap.tsx`，挂在 `App.tsx` 根层，由 `ui.recapLevel` 驱动。
  - 覆盖层 97vw × 98vh，上下只留极窄边距——这是要沉下心读的东西。
  - 左 `PreviewPane`：主图 `object-fit:cover` 铺满，每 4.5s 交叉淡入切下一张；底部小图条**水平居中**
    （`justify-content: safe center`，`safe` 保证张数多到溢出时不切掉最左那张）、可手点定格（点了就停自动播）。
    图源优先 `page.images`，否则取 `page.cards` 中**已补完**卡的 `cg`（未补完不露，与时间轴格子同一套防剧透规则），
    全空时回落 `assets.titleImage`。
  - 右 `.recap-article`：`narration` 渲染成首行缩进的段落，`quote` 渲染成「头像 + 金底斜体气泡」（复用 `.bubble.mono`）。
  - 底部：上一页 / 页码圆点 / 下一页 + `DEBUG-故事回顾` 入口；←/→ 翻页，Esc 或点遮罩关闭。
    **最后一页的「下一页」换成主色「关闭」**——读到底顺手就能出去，不用回头找右上角。
  - 头部只有「第 N 关 · 故事回顾」与本页标题，**不列覆盖的时间段**：时间点名默认是藏着的
    （花 1 体力或整行归位才揭示，README_game §4.4），回顾长廊不能反过来把它免费送出去。
- 窄屏（<1000px）左右两栏改上下。

## 4. 生产流程

```bat
python tools/init_recaps.py [作品|all]     :: 生成分页骨架 → workspace/{作品}/DEBUG/recaps.json
:: 逐页写 title 与 segments（骨架里的 _meta 是给写作者看的任务书）
python tools/apply_recaps.py [作品|all]    :: 合并进 final_game.json（丢弃 _meta）
python tools/validate_data.py 作品          :: check_recap 把关
```

骨架每页的 `_meta` 提供：`rowNames`（本页覆盖的时间点名）、`baseChars`（覆盖卡总字数）、
`targetChars`（`[下限, 上限]` 字数目标）、`cards`（每张覆盖卡的标题/形态/所属列/字数）。
`init_recaps.py` **不会覆盖已写好的正文**（按页序对齐保留），只刷新 `_meta` 与覆盖卡；重建骨架加 `--force`。

游戏内也可以直接改：DEBUG「故事回顾」编辑器能按建议一键切页、调行区间（自动重算覆盖卡与预览图）、
增删覆盖卡、逐段编辑旁白与引语，每页实时显示「本页字数 / 目标区间」。

## 5. 写作要求（摘自 README_game §4.9）

- 第三方全知旁白、过去时态、以事件推进为主；**不用第二人称、不出现玩法词汇、不对读者说话**。
- 不是逐卡复述：重新组织成一条有因果、有轻重的叙述线，但每张覆盖卡的核心事件都要有着落。
  情节列的卡给主干，角色列的独白/对话卡给动机与内心。
- 人名一律写真名（不写 NPCn）。
- 引语每页 1~2 条封顶，尽量化用卡面已有的台词，不凭空编；`entry` 必须是真实存在的人物词条。
- 语气跟着作品走，与该作已有卡面文本和过场保持同一语感。
