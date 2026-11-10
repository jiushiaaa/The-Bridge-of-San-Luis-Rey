# 来源与致谢

本项目直接基于柳柳《悉达多》完整工程制作，在 `engine/` 中保留其玩法、界面组件、状态管理、存档、播放器、编辑器和构建工具，接入《圣路易斯雷大桥》的内容与素材。

- [模板](https://lumi.66rpg.com/templates/4v6x5qs1569s)，标识 `53287/xidaduo`。
- [完整开源工程](https://lumi.66rpg.com/projects/4sx679m5bim8)，取得日期 2026-11-10。
- 未修改的下载文件与文件哈希基线保存在作者本地 `参考工程/`。

原著为 Thornton Wilder 的 *The Bridge of San Luis Rey*（1927）。使用作者提供的原文与译本对照，来源锚点和文本方式记录在 `engine/workspace/sanluisrey/provenance.json`。新增对白连接、场景重述与英文译写属于改编，不冒充逐字原文。购买的原书文件不作为源码附件上传。

插图由内置图像生成工具制作，采用暖纸、水粉与铅笔的视觉方向；配乐由 SeedAudio 1.0 生成。生成与检查记录位于 `engine/workspace/sanluisrey/authoring/`。音频原文件保留，播放器按曲目增益和淡入淡出设置播放。

Noto Serif SC、Noto Sans SC、Inter 沿用上游字体，文件及随附 OFL 位于 `engine/frontend/src/style-lab/fonts/`。React、Vite、Three.js、uisfx 等依赖的许可在各包内保留。

本仓库没有替上游工程或小说译文重新授予 MIT 等宽泛许可。引用、改编出处和已有许可说明须保留；后续复用条件由项目作者确认。早期独立版本的说明保存在 `docs/history/`。
