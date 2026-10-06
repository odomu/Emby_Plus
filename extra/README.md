# extra · 附加脚本

独立于 Emby_Plus 组件体系（不依赖 `window.EmbyPlus`），单文件自包含，可与 `addons/` 同时启用。

| 文件 | 类型 | 作用 | 来源·作者 | 安装 |
| --- | --- | --- | --- | --- |
| `外部播放器.js` | 用户脚本 / 自定义 JS | 详情页调用本地外部播放器（PotPlayer 等） | [bpking1/embyExternalUrl](https://github.com/bpking1/embyExternalUrl)（@bpking） | 油猴 / CustomCssJS |
| `一起看视频.js` | 用户脚本 | 多人同步观影 | [VideoTogether](https://videotogether.github.io/)（maggch） | 油猴 |
| `隐藏导航栏按钮.js` | 自定义 JS / 用户脚本 | 按库类型裁剪顶栏 Tab | 自用 | CustomCssJS / 油猴（补 `@match`） |

## 外部播放器.js

魔改自上游 [bpking1/embyExternalUrl](https://github.com/bpking1/embyExternalUrl)（`embyLaunchPotplayer`，版本 1.2.1）：

- **下拉菜单重构**：将平铺的多行播放器按钮收纳为单个紧凑的「外部播放 ▾」下拉按钮，紧随原生「播放」按钮之后；
- **原生 Emby 图标**：菜单项使用 Emby 内置 Material 播放图标（`&#xe037;`），**无需从 GitHub / jsdelivr 下载任何外部 webp 图标**；
- **自适应系统过滤**：根据当前操作系统（Windows / macOS / iOS / Android）精准筛选展示可用播放器，杜绝无效选项；
- **主题适配**：触发按钮 `.extPlayerTriggerBtn` 纯净对齐原生播放按钮高度与圆角，深浅色主题均自然融合。

## 安装

| 方式 | 说明 |
| --- | --- |
| 油猴 | 粘贴全文；建议 `@run-at document-end` |
| CustomCssJS | `.js` → 自定义 JS，`.css` → 自定义 CSS，状态强制开启 |
| 原生注入 | 文件放服务端 `dashboard-ui`，`index.html` 加 `<script>` / `<link>` |

改完不生效：`Ctrl+F5`；仍不生效清 CustomCssJS 的 localStorage（`customjs*` / `customcss*`）。

第三方脚本以上游为准，版权归各自作者。
