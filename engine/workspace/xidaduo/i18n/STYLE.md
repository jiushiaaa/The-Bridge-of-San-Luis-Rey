# 悉达多叙事翻译规范

> 引擎层（`t()`、切语言、西语排版、工具命令）见 [doc/13-i18n.md](../../../doc/13-i18n.md)。本文件只约束**叙事译文**。

- 简体中文 `final_game.json` 是唯一可写真源。
- 德语专名锁定赫尔曼·黑塞 1922《Siddhartha》：Gotama、Sansara、Nirwana、Savathi、Samana、Kamaswami。正文译游戏中文，不整段抄小说。
- 英语专名与德语对齐；轮回用读者更熟的 Samsara（仅英语）。西/法语同样：Gotama、Samsara、Nirvana、Savathi、Samana、Kamaswami；正文译游戏中文。
- 日语叙述体用常体（だ／である），不用です／ます。
- 韩语用해라체/한다체（문어），不用합니다체。专名跟 glossary（싯다르타、고타마、윤회）。
- 印地语专名用通行天城体（सिद्धार्थ、गौतम、संसार、निर्वाण、श्रावस्ती、श्रमण），略偏文言但不堆砌 तत्सम。正文译游戏中文，不贴梵文原典。
- 繁体用台湾用词（祇園、沙門、輪迴），专名跟 glossary。
- `{{e_id|显示名}}` 的显示名必须等于该语 `entries[id].name`。
- 不译：id、type、slot、路径、look、*Prompt、art、数值、blanks.answer。
