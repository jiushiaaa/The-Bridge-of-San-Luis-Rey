# 圣路易斯雷大桥

根据 Thornton Wilder 1927 年同名小说改编，直接使用柳柳《悉达多》完整开源工程制作。当前为 **2.0.0-dev 制作阶段**：三卷内容、中英文本包及节点素材已接入，正在进行文学润色、体验与平台验收。

![当前首页](docs/screenshots/home-desktop-20261110.jpg)

## 本地运行

需要 Node.js 22、npm 和 Python 3。在仓库根目录运行：

```sh
npm --prefix engine/frontend ci
npm run build
npm run preview
```

打开 <http://127.0.0.1:4186/>。热更新使用 `npm run dev`，地址 <http://127.0.0.1:5196/>。运行游戏不需要 API key 或在线模型，素材按需加载。

当前制作目录为 `engine/`。构建、预览和检查均已指向它。`game/`、`docs/history/` 及早期交付记录保留为历史，对应当时实现。

## 当前内容

- 三卷 60 张卡、50 个词条、51 页档案、30 行时间轴、15 页回顾、17 个卷末答题空，以及序章与尾声。
- 60 张独立剧情 CG，另配人物、形象变体、词条与序尾插画。此次首页新增横竖版背景、中英标题字标和菜单装饰，共五项素材，不计作新增剧情 CG。
- 32 首 SeedAudio 1.0 配乐，绑定封面、剧情节点与尾声，保留解锁、播放模式、固定／排除和迷你播放器。
- 当前开放简体中文与英文，覆盖正文、档案、序尾、回顾、题目和界面。其余七语延后制作，原工程九语框架与资源保留。
- 搜寻、填空、熟悉度、档案分析、时间轴行列与连片锁定、关卡门槛、难度、体力、休整、评星、提示、引导、回顾长廊、手机布局和编辑器沿用原工程。
- 首页按已选方案采用全屏油画、居中定制标题字与细金线菜单；中英字标、手机竖版背景、纸色弹窗同步适配。新开、续档、音乐与语言继续调用原工程逻辑，已有存档重开前会确认。详见 [首页验收](design-qa.md)。

存档沿用本地 `localStorage`，键为 `slr_save_v1`。中英文共用稳定 ID 和同一进度，语言偏好保存在 `slr_locale`。不同浏览器、域名和端口不自动共享进度；当前继承工程尚未接入平台云存档。

## 改稿与检查

中文主稿为 `engine/workspace/sanluisrey/final_game.json`，英文主稿为同目录下 `i18n/en/final_game.json`。可以分别润色，中文改动通过增量流程送审英文。见 [中英文改稿说明](docs/中英文改稿说明.md)。

```sh
npm run i18n:status
npm run i18n:prepare
npm run i18n:merge
npm run check:release
```

`compile_slr.py --replace` 是显式编稿工具，不在构建链内。编辑器改过中文后，先与 `authoring/` 对齐再使用它。首次翻译分片 `tr_*.json` 作为记录保留，日常以当前英文主稿为准。

已通过中英文实际规则模块的三卷回归、八项增量改稿检查和播放器规则检查；实际手机视口验证了搜寻、填空、CG 解锁、切语与重载续读。详见 [阶段验收](docs/完整工程重制阶段验收.md)。

**40 分钟以上是体验目标，首次读者计时尚未完成。** 自动规则遍历不证明阅读时长、文学质量或真实触控体验。逐曲听审、全作连续阅读、真实设备和平台运行仍待验收。

## 来源

- [改编锚点](engine/workspace/sanluisrey/provenance.json)。
- [图片记录](engine/workspace/sanluisrey/authoring/generated-images.json)。
- [配乐编排](engine/workspace/sanluisrey/authoring/music.json)和[音频技术检查](engine/workspace/sanluisrey/authoring/audio-audit.json)。
- [研究来源](docs/研究来源.json)与[来源致谢](THIRD_PARTY_NOTICES.md)。

已购原书、私人知识库、原下载工程、生成原图、原始音频和凭据保留在本地资料目录，公开制作副本不依赖私人文件。
