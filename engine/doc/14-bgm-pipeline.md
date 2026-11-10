# 14 · 背景音乐（BGM）：设计规范 · 批量生成 · 引擎行为（skill）

> 这是一份 **skill**：一款作品文案 / 美术完工后，按本篇一次性完成全部 BGM 的设计与制作。
> 真源只有一处：`final_game.json` 的 `assets.bgm[]`（每条含 `prompt` / `tags` / `note`）；设计意图另记在 `workspace/{作品}/DEBUG/BGM_DESIGN.md`。
> 引擎侧播放模型与 UI 见 §5、[09 §1](09-ui-conventions.md)；数据字段见 [02](02-data-schema.md)；DEBUG 编辑器见 [06](06-copyedit-editor.md)。
> 参考实例：`workspace/xidaduo/DEBUG/BGM_DESIGN.md`（26 首）。

## 0. 何时用 / 输入 / 产出

- **何时**：作品 `cards` / `frame` / `gates` 定稿之后（曲数与绑定都由正文推导，正文一改曲目表就要复核）。
- **输入**：`workspace/{作品}/final_game.json`、作品设计稿（`DEBUG/DESIGN.md`：主题、每关定位、人物表）。
- **产出**：
  1. `DEBUG/BGM_DESIGN.md`——音乐圣经（主题、动机、人物动机表、每关曲目表、辨识度自检）；
  2. `assets.bgm[]` 全部条目（`id/file/title/stage/unlockCard?/prompt/tags/note`）；
  3. `{前缀}-assets/audio/*.mp3` 全部文件 + `DEBUG/bgm_alt/*.mp3` 备选 + `DEBUG/bgm_gen_log.json`。
- **工具**：`tools/bgm_plan.py`（统计与自检）、`tools/gen_bgm.py`（并发生成）、`tools/validate_data.py` 的 `check_bgm`（硬校验）、`Lumi/Lumi_API_suno_ttapi.py`（Suno v5.5 / TTAPI 通道，`gen_bgm.py` 直接 import）。

## 1. 设计规则（六条，缺一不可）

1. **旋律为主、有记忆点、与整个故事匹配。** 先写「音乐圣经」：主题一句话、全作基调、乐器调色盘、**全作统一动机**（一段 4–6 音的旋律乐句，给它起名，如「河流动机」）。每一首都以不同乐器 / 速度 / 调式复现或变形这个动机——完整、残缺、变形、卡农——记忆点与统一感都从这里来。每关再定一句「本关定位」，本关全部曲目围着它写。
2. **重要人物有自己的音乐记忆点。** 为每个 `tier=core/major` 人物（至少每关角色列上的人物）指定「乐器 / 流派 / BPM」中的至少一项作为专属动机，写进人物动机表，并在该人物的独白卡 / 名场面卡的 prompt 里点名使用。人物之间的乐器不得相同。
3. **每关有一首开篇曲。** `stage=关号` 且**无** `unlockCard`，恰 1 首；由本关过场（`frame.levelIntro[lv]`）与本卷之问（`gates[].question`）的情绪出发写，进关即播。
4. **每关曲数 = `max(round(本关情节卡总字数 / 1500), 2)`，含开篇曲。** 字数口径 = `validate_data.card_text_len`（`{{eid|显示名}}` 按显示名计）。`python tools/bgm_plan.py <game>` 直接打印各关字数、应有曲数、现有曲数。另加封面曲（`stage:"title"`）与结局曲（`stage:"ending"`）各 1 首。
5. **合理分配，绑在开篇与情节卡上。** 卡曲（`unlockCard`）优先绑「名场面」列与 `monologue` 独白卡（重要情节 / 人物独白）；按时间轴 `row` **逐行铺开**——每行至多 1 首，尽量每行都有，使 BGM 沿剧情线均匀出现；同一人物列不要连续两首。绑 `startUnlocked` 卡会让该曲开局即得，通常不绑。
6. **不同曲目有辨识度。** 同关任意两曲在「主奏乐器 / BPM（差 ≥ 15）/ 调性明暗」三项中至少两项不同；全作 BPM 分层（如卷一 56–100、卷二 60–124、卷三 54–92），曲名 ≤ 6 字（迷你播放器曲名宽 6em）。

**流程铁律**：以上六条全部落成 `assets.bgm` 条目并通过 `validate_data.py`（见 §3）**之后**，再一次性并发生成；不要边设计边生成。

## 2. prompt 写法（Suno description 模式，纯器乐）

每条 `prompt` 为英文、≤ 500 字符，按固定模板：

```
Pure instrumental, absolutely no vocals or lyrics. <用途/场景>, <BPM> BPM, <拍号>.
<全作动机如何出现：完整 / 残缺 / 变形 / 卡农>. <主奏乐器 = 人物动机> + <伴奏 / 底色 / 环境声>.
<情绪弧：开头 → 发展 → 结尾>. 2-3 minutes.
```

`tags`：`instrumental, <主奏乐器>, <伴奏乐器>, <流派>, <情绪>, cinematic, no vocals`。`gen_bgm.py` 固定追加 `negative_tags = vocals, singing, lyrics, rap, voice, choir, spoken word`。
`note`（中文）：绑定的卡 / 人物动机 / BPM / 设计意图——给后人换曲时看。

## 3. 生成流程

```bat
python tools/bgm_plan.py xdd                 :: 1) 看每关字数 → 应有曲数
:: 2) 写 DEBUG/BGM_DESIGN.md 与 assets.bgm 全部条目（可用 DEBUG「背景音乐」编辑器，或直接改 json）
python tools/validate_data.py xdd            :: 3) check_bgm：开篇曲、曲数、stage 一致、prompt 齐全
python tools/gen_bgm.py xdd --clean --workers 6   :: 4) 删旧 mp3，全量并发生成（每首约 2–4 分钟，6 线程 26 首约 15 分钟）
python tools/gen_bgm.py xdd --only l2-ledger --force   :: 5) 试听后单曲重做；备选 clip 在 DEBUG/bgm_alt/<id>.mp3
python tools/validate_data.py xdd            :: 6) 资产存在性
```

`gen_bgm.py`：`ThreadPoolExecutor`（≤10 线程，提交间隔 1.2s 防 499 队列满）；每任务提交 → 轮询 → 下载 clip0 到 `file`、clip1 到 `DEBUG/bgm_alt/`；失败 / 超时 / 限流指数退避重试 2 次；结果追加写 `DEBUG/bgm_gen_log.json`（jobId、时长、耗时）。**时长 < 60s 的结果视为失败重做**（Suno 偶发短片段）。缺 `prompt` 的条目拒绝生成。

`validate_data.check_bgm`（`assets.bgm` 非空才跑）：完整性——id / file 唯一、stage 合法、`unlockCard` 存在且所在关 == stage、每关恰 1 首开篇曲；规范——每关曲数 ≥ 公式值、每曲有 prompt；警告——缺封面 / 结局曲、同关两首卡曲绑同一 row。

## 4. 数据字段（`assets.bgm[]`，类型 `BgmTrackDef`）

| 字段 | 说明 |
| --- | --- |
| `id` | 唯一；建议 `title` / `ending` / `l{关}-intro` / `l{关}-{意象}` |
| `file` | `{前缀}-assets/audio/{id}.mp3`（相对路径，见 [11](11-cross-mode-pitfalls.md)） |
| `title` | 曲名，≤ 6 字为佳；随语言包换（[13](13-i18n.md)） |
| `stage` | `"title"` / `"ending"` / 关号 |
| `unlockCard?` | 绑定的情节卡 id；缺省 = 本关开篇曲 |
| `prompt` / `tags` | Suno 生成真源；DEBUG「复制prompt」复制的就是 `prompt` |
| `note?` | 设计备注 |

## 5. 引擎行为（`game/bgm.ts`）

- **按关歌单**：`syncBgmStage` 检测到关号变化（从封面进入、过关、DEBUG 跳关）→ 清空歌单临时状态（`pinned` / `excluded`）→ 歌单 = 本关已解锁曲 → 播本关开篇曲并亮「新曲」光效。
- **卡曲入单即播**：`watchUnlocks` 对照存档发现本关新解锁曲 → toast + 入单 + 立刻切过去播（玩家手动暂停时只换曲不强播）+ `newTrackId` 光效 8s；回补往期卡解锁的曲只 toast。
- **往期曲**：仍在「已解锁」集合里，菜单「往期曲目」组可点播 / 勾选（= 临时 pin 进本关歌单，换关即清）。封面固定封面曲；结局播结局曲。`localStorage baima:bgm:<game>` 只存播放模式。
- **光效**（`.bgm-mini.is-new`，[09 §1](09-ui-conventions.md)）：唱片金色辉光 + 呼吸 + 两圈向外扩散的声波光环、整块播放器边框转金 + 斜向高光扫过、曲名金色带光晕、「新曲」角标弹出；手机版只保留唱片部分。
- **DEBUG「背景音乐」编辑器**（`copyedit/BgmEditor.tsx`）：改绑定 / 曲名 / prompt / tags / note，试听，「更换音频」（`/api/upload` 已允许 `.mp3`，上传即写盘，正在播的曲立即重载），「复制prompt」。**没有「重新生成」按钮**——生成一律走命令行 `gen_bgm.py`。

## 6. 检查清单（交付前逐条打勾）

- [ ] `DEBUG/BGM_DESIGN.md` 有：主题句、全作动机、人物动机表、每关定位与曲目表、辨识度自检
- [ ] `bgm_plan.py` 每关 `OK`：曲数 ≥ 公式、开篇曲恰 1、卡曲逐行铺开
- [ ] 每条 `prompt` 点名了动机出现方式、主奏乐器（人物）、BPM、情绪弧；`tags` 与 `note` 齐全
- [ ] `validate_data.py` 全通过（含资产存在性，无「资产缺失」警告）
- [ ] `bgm_gen_log.json` 无 `error`，无时长 < 60s 的曲
- [ ] 进游戏实听：进关只播开篇曲；补完绑定卡后新曲切入且播放器亮光效；菜单三组分组正确
