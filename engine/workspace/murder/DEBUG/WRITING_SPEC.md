# 《一桩事先张扬的凶杀案》写作规格（WRITING_SPEC）

> 分片写作任务必读。设计依据：`DEBUG/DESIGN.md`；取材依据：`DEBUG/book_digest.md`（必要时回查 `book_report.md`）。

## 1. 输出格式

每片产出**一个 JSON 数组**（情节卡片）或**一个 JSON 对象**（entries/frame/gates），写入 `workspace/murder/DEBUG/` 下指定文件。必须是合法 JSON（无注释、无尾逗号），UTF-8。

情节卡完整字段样板：

```json
{ "id": "c1_01", "level": 1, "form": "scene", "difficulty": "normal", "len": "M",
  "col": "名场面", "row": 0, "title": "外乡人到港",
  "cg": "murder-assets/cg/c1_01.jpg",
  "cgPrompt": "英文一两句镜头描述（见 §5）",
  "segments": [
    { "kind": "narration", "text": "……[[NPC1]]……{{e_matou|码头}}……" },
    { "kind": "dialogue", "slot": "NPC1", "text": "（动作）台词" },
    { "kind": "dialogue", "speakerEntry": "e_pulixi", "text": "台词" },
    { "kind": "dialogue", "speaker": "玛格达莱纳", "text": "台词" },
    { "kind": "monologue", "slot": "NPC1", "text": "第一人称内心" }
  ],
  "blanks": [ { "slot": "NPC1", "kind": "person", "answer": "e_shengroman" },
              { "slot": "地点", "kind": "place", "answer": "e_matou" } ],
  "hints": ["方向（不报名字）", "点破（不报名字）"] }
```

- segments 五形态：`narration`（旁白）／`dialogue`+`slot`（待猜人物气泡）／`dialogue`+`speakerEntry`（已具名人物气泡）／`dialogue`+`speaker`（纯配角气泡）／`monologue`+`slot`（独白金底气泡）
- 内联标记：`{{e_x|显示名}}`＝可点词条；`[[NPCn]]`＝匿名人物占位（只写进 narration）
- 地点空数组答案：`"answer": ["e_guaxila", "e_liaoacha"]`
- `startUnlocked: true` 仅 c1_01
- col 取值：L1＝名场面/圣罗曼/安赫拉/纳萨；L2＝名场面/屠夫兄弟/克洛蒂/阿庞特；L3＝名场面/纳萨/贝多亚/普拉西达；L4＝名场面/马尔科/安赫拉/圣罗曼（与 timelines.cols 完全一致）
- entries 的档案字段二选一：`{"label","text"}` 或 `{"label","blank":{"answer":eid,"pool":"person|place|item|concept"}}`；人物用 `"avatar": "murder-assets/avatars/{eid}.jpg"`，其余三类用 `"image": "murder-assets/images/{eid}.jpg"`

## 2. 十条硬红线

1. **匿名铁律**：空位答案的显示名（及任何同义称呼）不得出现在本卡正文——chip、裸文本、台词、独白里都不行。注意防泄漏命名：纳家大宅（禁"纳萨家"）、维卡家（禁"维卡略家"）、老纳（禁"老纳萨"）。
2. **可推理性**：同卡多人空，每人落实 DESIGN 给的差异化识别点；严禁并列无区分。
3. **气泡化**：人物台词一律气泡段，动作写括号"（……）"；旁白只留群体台词/回顾引语/诗歌例外。
4. **同卡同人物 chip 至多一次**（放在首次登场处）；有对话的 speakerEntry 人物本卡必有 chip（放进首次登场的旁白）。
5. **金句一次**：只许使用 DESIGN 分配给本卡的金句，不得跨卡复述。
6. **字数**：S 420–490／M 600–800／L 880–950（去掉 `{{}}`/`[[]]` 标记后的中文字数）。
7. **难度纪律**：easy 卡不设地点空；hard 卡全文不出现任何人名（无人名 chip、无 speakerEntry、无裸文本人名），地点/物品 chip 允许。
8. **hints**：两条，第 1 条指方向、第 2 条接近点破，都不报名字。
9. **每卡 ≥1 个"别处已能获得"的 chip**（用 DESIGN 必织词条即可满足）。
10. **不写玩法词汇**：残页/归位/词条/时间轴/关卡等词禁入正文。

## 3. 语言与人物腔调

- 一律现代通俗白话，短句，口语化；不文白夹杂，不整段搬原文（金句化用要顺现代语法）。
- 腔调表：
  - 纳萨：快活、大大咧咧、带点少爷的满不在乎
  - 安赫拉：前半认命寡言、后半（L4）沉静倔强
  - 圣罗曼：豪爽、简单直接、习惯用钱解决问题
  - 屠夫兄弟：粗直、一句接一句像合唱，话越狠心里越虚
  - 普拉西达：絮叨、迷信、爱儿子的方式是念叨
  - 克洛蒂：急、碎、热心肠，说话带央求
  - 阿庞特：官腔、自我宽慰、爱打太极
  - 维多利：蔫、阴阳怪气、话里有刺
  - 马尔科：克制、念旧、记者式的冷静
  - 预审法官：书面腔里压着怒火
- 称呼替身：正文里不得出现"维卡略/纳萨尔/圣罗曼将军之外的西语全名"；一律用 §命名表用名。

## 4. 人物塑造纪律

- **暧昧人物不自白**：圣罗曼、阿庞特、屠夫兄弟、维多利、安赫拉的独白只写其本人相信的自我合理化逻辑，不写"我知道我在作恶"式判词。
- **纳萨是否有罪，全游戏不下结论**：法官查不到证据、安赫拉咬定"就是他"——两种表述并存，卡面不裁决。
- **避讳**：贞洁话题侧写为"名声/体面/那个秘密"；玛丽亚之家写为歌舞厅（喝酒跳舞的销金窟，不写色情）；凶杀与解剖不渲染血腥——c3_06 镜头止于"他倚着门不再抵抗"，c4_02 不写创口细节；弗洛拉的沦落一笔带过。

## 5. cgPrompt 写法

- 每卡一条英文 prompt（一两句），16:9 CG：明亮日式动画风（京阿尼感），写环境+情绪+镜头，**不写人名**（用"a young man in a white linen suit"这类描述），匿名人物用背影/剪影，避免"两人对站对话"式呆板构图，避免泄露待猜身份，禁止画面文字。
- 出场词条在 prompt 尾部用一句话声明外观（定妆照，见 DESIGN §0.3 与美术阶段的 CHAR_LOOK；写作阶段只需给"who is in the scene"，不必写完整定妆描述）。

## 6. 自检清单（交稿前逐条过）

- [ ] JSON 合法；每卡 id/level/form/difficulty/len/col/row/title/cg/cgPrompt/segments/blanks/hints 齐全
- [ ] 空位答案与 DESIGN 卡表一致；col/row 与卡表一致
- [ ] 匿名铁律逐卡自查（把答案显示名在正文里搜一遍）
- [ ] 字数在 len 档区间内
- [ ] 必织词条全部织入；同卡同人物 chip ≤1
- [ ] 对话全部气泡化；配角 speaker 名字与 DESIGN §0.3 配角表一致
- [ ] hints 不报名字；无玩法词汇；无第二人称
- [ ] 金句未跨卡复述；敏感内容按 §4 避讳
