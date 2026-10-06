# Emby_Plus · 组件详尽文档 (Addons Documentation)

本项目提供 10 个轻量、解耦、即插即用的原生功能组件，存放在 `addons/` 目录下。
所有组件均自带独立样式（通过动态注入 `<style id="embyplus-addon-*">` 实现），**无外部依赖、无需在 Emby 后台额外建立 CSS 条目**。

---

## 一、通用开发与运行约定

1. **单体自包含**：每个组件均为单个独立 `.js` 文件，装齐即可获得完整版体验，亦可单选装载；
2. **样式幂等注入**：组件加载时检测自身 `<style id="embyplus-addon-*">` 是否存在，杜绝重复插入；
3. **安全自检测**：组件运行在 `@run-at document-idle` 阶段，启动时检测 `window.EmbyPlus` 宿主是否存在；若缺失宿主则在控制台打印提示并安全退出，不产生未捕获异常；
4. **组件声明契约**：统一走公共接口 `EmbyPlus.defineAddon(id, label, config, function (host) { ... }, style)`。
   - `config` 为组件配置默认值，宿主仅补齐 `CINEMA_CONFIG` 中缺失的键，**绝不覆盖用户取值**；
   - 实现全部写在工厂函数内（内部变量天然隔离，无需 IIFE）；
   - `style` 为组件样式文本，精简版由宿主幂等注入，单文件版由 `scripts/build_full.py` 并入 `Emby_Plus.full.css`。

---

## 二、10 个 Addon 功能组件详尽技术规范

### 01-外链品牌Logo.js (`id: link-logos`)

| 维度 | 说明 |
|---|---|
| **核心功能** | 详情页补充**多渠道外链品牌 Logo** 与评级入口 |
| **技术实现** | 扫描详情页链接区 `.linksSection / .itemLinks / .itemExternalLinks`，将文本链接替换为标准高度（`22px ~ 24px`）的高清品牌矢量 Logo（透明豆瓣、IMDb、TMDB、TheTVDB、Trakt），并自动清除链接间的原生逗号分隔符；若检测到元数据中存在 Douban ID 但未渲染链接，自动补齐直达豆瓣页面链接 |
| **生效位置** | 影视 / 剧集详情页（`#!/item?id=...`） |
| **依赖宿主** | `$` / `DomList` / `CommonUtils` |
| **配置项** | `enableLinkLogos` |
| **注入样式 ID** | `embyplus-addon-link-logos` |

---

### 02-卡片分级徽章.js (`id: media-ratings`)

| 维度 | 说明 |
|---|---|
| **核心功能** | 媒体库海报上的**年龄分级彩色胶囊徽章** |
| **技术实现** | 扫描卡片上的 `.mediaInfoItem` 年龄分级文本，写入 `data-rating-group` 属性；配套 11 种国际分级配色规则（绿/黄/橙/红/粉/紫/蓝/灰等），渲染为半透明毛玻璃微高亮徽章 |
| **生效位置** | 首页、媒体库列表、搜索结果等所有卡片 |
| **依赖宿主** | `$` / `DomList` / `CommonUtils` |
| **配置项** | `enableMediaRatings` |
| **注入样式 ID** | `embyplus-addon-media-ratings` |

---

### 03-集页面美化.js (`id: season-page`)

| 维度 | 说明 |
|---|---|
| **核心功能** | 详情页与季集页面四合一深度排版增强 |
| **技术实现** | 1. **连载/完结状态角标**：详情页元数据行追加 `.cinema-media-status-badge` 状态徽章（连载中 / 已完结）；<br>2. **季集多行平铺**：解除 Emby 季集列表的单行虚拟截断，移除 `virtualScrollLayout`，平铺展开所有剧集；<br>3. **列表多选美化**：多选勾选框（`.chkListItem*`）与顶部多选操作栏（`.selectionCommandsPanel`）质感美化；<br>4. **海报角标隔离**：隐藏详情页左侧海报上的角标与多余按钮（下载、排序、随机播放），确保右侧元数据标签栏必定显示完整 |
| **生效位置** | 影视详情页、季/集列表页、列表多选态 |
| **依赖宿主** | `$` / `DomList` / `CommonUtils` |
| **配置项** | `enableSeasonEpisodesLayout`、`enableSeriesStatusBadge` |
| **注入样式 ID** | `embyplus-addon-episode-page` |

---

### 04-TMDB影评.js (`id: tmdb-reviews`)

| 维度 | 说明 |
|---|---|
| **核心功能** | 影视详情页 **TMDB 精选影评**板块 |
| **技术实现** | 读取条目 TMDB ID 调用官方接口获取真实观众长评，渲染 `.emby-reviews-section`（含影评人头像、星级评分、多语种国旗、长评折叠/展开）；手机端自动将折叠字数减半适应窄屏排版；未配置 Key 时优雅展示纯净无边框空状态提示 |
| **生效位置** | 影视详情页（位于演职人员上方） |
| **依赖宿主** | `$` / `DomList` / `CommonUtils` / `getEffectiveTmdbKey` |
| **配置项** | `enableReviews` / `maxReviews` / `reviewPreviewLength` / `showLanguageFlags`；TMDB Key 见全局 `tmdbApiKey` |
| **注入样式 ID** | `embyplus-addon-tmdb-reviews` |

---

### 05-剧照画廊.js (`id: stage-photos`)

| 维度 | 说明 |
|---|---|
| **核心功能** | 影视详情页 **剧照 / 同人图画廊**板块 |
| **技术实现** | 异步拉取剧照与同人图，在详情页插入 `.cinema-stagephotos-section` 横向画廊，统一卡片比例、圆角、阴影与悬停微光效果 |
| **生效位置** | 影视详情页（位于演职人员下方） |
| **依赖宿主** | `$` / `DomList` / `CommonUtils` |
| **配置项** | `enableStagePhotos` |
| **注入样式 ID** | `embyplus-addon-stage-photos` |

---

### 06-演职人员作品.js (`id: person-works`)

| 维度 | 说明 |
|---|---|
| **核心功能** | 详情页 **演职人员「其他作品」**联动列表与头像规范 |
| **技术实现** | 1. **其他作品联动**：读取演职员 `PersonIds` 查询 Emby 库内其他作品并按年份排序，插入 `.actorMoreSection` 横向平铺列表，支持“换一批”刷新；<br>2. **正圆头像单行轨道**：`.peopleSection` 容器高度严格约束为 `175px !important`，彻底防止 Emby 虚拟滚动引擎计算出两行折行，杜绝头像排版错乱 |
| **生效位置** | 影视详情页演职人员区 |
| **依赖宿主** | `$` / `DomList` / `CommonUtils` / `escapeHtml` |
| **配置项** | `enablePersonWorks` |
| **注入样式 ID** | `embyplus-addon-person-works` |

---

### 07-海报评分角标.js (`id: poster-ratings`)

| 维度 | 说明 |
|---|---|
| **核心功能** | 全站海报角标（显式区分豆瓣、IMDb、TMDB 品牌标识，彻底消除重复） |
| **技术实现** | 1. **渠道判定**：严格依据元数据中真实存在的 `ProviderIds` 打标（`Douban` → 绿标「豆」、`Imdb` → 黄标「IMDb」、`Tmdb` → 蓝标「TMDB」），无第三方 ID 时保持 Emby 原生星标，绝不胡乱打标；<br>2. **角标去重**：采用 `:not(:has(img))` 排除已包含豆瓣图片的刮削卡片，彻底根除「豆 豆 7.x」重复；<br>3. **行数自适应扩容**：在 `cardBuilder` 切面中自动将限制 2 行的配置扩容为 3 行（`options.lines = 3`），第 2 行评分移出流定位在海报左上角，第 3 行年份完好保留在海报正下方，根治年份被挤压消失问题 |
| **生效位置** | 首页、媒体库列表、搜索结果等全站所有卡片 |
| **依赖宿主** | `$` / `DomList` / `CommonUtils` |
| **配置项** | `enableGlobalPosterRatings` |
| **注入样式 ID** | `embyplus-addon-poster-ratings` |

---

### 08-播放器美化.js (`id: player-beauty`)

| 维度 | 说明 |
|---|---|
| **核心功能** | 播放器 OSD 界面、进度条与操作栏美化（纯样式组件） |
| **技术实现** | 美化原生播放器控制台、音量滑块、移动端播控布局（`.videoOsd*`）；优化播放页「更多来自本季」卡片比例与轨道选择栏布局 |
| **生效位置** | 播放界面 / 播放器控制台 |
| **依赖宿主** | 仅需宿主提供注入点 |
| **配置项** | 纯样式组件，无配置项（factory 为 `null`） |
| **注入样式 ID** | `embyplus-addon-player-beauty` |

---

### 09-追剧日历与热门榜单.js (`id: calendar-charts-tab`)

| 维度 | 说明 |
|---|---|
| **核心功能** | 顶栏双 Tab 整合版（追剧日历 + 8 大流媒体热门榜单，与首页无缝融合） |
| **技术实现** | 1. **双 Tab 注册**：在一个组件中同步注册 `calendar`（日历）与 `charts`（榜单）两个 Tab；<br>2. **原版 Full 移植**：包含 8 大流媒体平台官方 TMDB 矢量 Logo、Netflix 大数字排行榜、Spotlight 焦点图与横向日期选择条；<br>3. **顶栏背景融合**：滚动容器背景纯净透明，Hero 大图从顶部状态栏自然渐隐延伸向下过渡，消除生硬黑块；<br>4. **卡片排版**：100% 遵循 Emby 原生卡片布局规范；<br>5. **空状态优雅展示**：未配置 Key 时纯净展示居中无框提示，零旋转加载动画，不渲染多余标签行 |
| **生效位置** | 首页顶栏导航 Tab（`#!/home?tab=calendar` / `tab=charts`） |
| **依赖宿主** | `registerTab` / `fetchWithCache` / `ensureLibraryIndex` / `getEffectiveTmdbKey` |
| **配置项** | `calendarRequireAdmin`、`chartsRequireAdmin`、`chartLimit` |
| **注入样式 ID** | `embyplus-addon-calendar-charts` |

---

### 10-MoviePilot联动.js (`id: moviepilot`)

| 维度 | 说明 |
|---|---|
| **核心功能** | 详情弹窗与 MoviePilot 联动控制台（缺集药丸 / 资源搜索 / 一键订阅） |
| **技术实现** | 1. **全景详情弹窗**：在海报右上角绝对定位悬浮圆形半透明关闭按钮（`32px`），底部提供 `[进入剧集]`、`[资源搜索]`、`[一键订阅]`、`[配置 MP]`；<br>2. **缺集控制台**：多季分开 Tab，根据缺集情况生成纯数字药丸轨道，点击一键联动搜索与转存；<br>3. **权限严密受控**：默认仅 Emby 管理员可见联动操作栏；可通过组件内部 `CONFIG.moviePilotRequireAdmin = false` 开放给普通用户；<br>4. **双向地址兼容**：支持 `internalHost` 与 `CINEMA_MP_HOST` 多种存储格式读取 |
| **生效位置** | 详情弹窗浮层（点击日历/榜单卡片或详情页时弹出） |
| **依赖宿主** | `$` / `DomList` / `CommonUtils` / `checkUserAdminStatus` |
| **配置项** | `enableMoviePilot`、`moviePilotRequireAdmin`、`moviePilotUrl`、`moviePilotToken` |
| **注入样式 ID** | `embyplus-addon-moviepilot` |

---

## 三、编写自定义 Addon 规范

统一契约（Lite / Full 通用，唯一入口）：

```javascript
EmbyPlus.defineAddon(id, label, config, function (host) { ... }, style);
```

| 参数 | 说明 |
|---|---|
| `id` | 组件唯一标识（重复定义会被跳过并告警） |
| `label` | 组件显示名，用于日志 |
| `config` | 组件配置默认值：宿主仅补齐 `CINEMA_CONFIG` 缺失的键，不覆盖用户取值 |
| `factory` | 组件实现，形参 `host` 即宿主公共接口；纯样式组件可传 `null` |
| `style` | 组件样式文本：精简版由宿主幂等注入 `<style id="embyplus-addon-<id>">`；单文件版由构建脚本并入 `Emby_Plus.full.css` |

完整示例见 [`addons/template_addon.js`](template_addon.js)：

```javascript
EmbyPlus.defineAddon("my-feature", "我的扩展功能", {
    enableMyFeature: true,
}, function (host) {
    const $ = host.$;                 // 宿主 DOM 工具
    const config = host.config;       // 全局配置中心 CINEMA_CONFIG

    function scan() {
        if (config.enableMyFeature === false) return;
        // 详情页条目：await host.fetchDetailPageItem(id)
        // 视图事件：document.addEventListener("viewshow", scan)
    }

    scan();
}, `
.my-feature-badge { display: inline-flex; }
`);
```

宿主公共接口（`host`）常用成员：

| 分类 | 成员 |
|---|---|
| DOM 工具 | `$`、`DomList`、`CommonUtils` |
| 格式化 | `escapeHtml`、`padZero`、`formatDateYMD`、`formatBytes`、`generateDatesList`、`debounce` |
| 数据服务 | `getEffectiveTmdbKey`、`getTmdbImg`、`fetchWithCache`、`checkInLibrary`、`checkMissingEpisodesInfo`、`ensureLibraryIndex`、`checkUserAdminStatus`、`fetchDetailPageItem` |
| Tab 框架 | `registerTab`、`HOME_TABS`、`updateCinemaTabTopOffset` |
| 模板与常量 | `heroPlaceholderHtml`、`heroContentHtml`、`posterCardHtml`、`showTabPageState`、`loadingStateHtml`、`TMDB_KEY`、`PLATFORMS`、`REGIONS`、`GENRE_MAP`、`CALENDAR_COUNTRIES`、`weekdays` |
| 配置 | `config`（即 `CINEMA_CONFIG`） |

> 单文件版无需手工处理样式与配置：`python scripts/build_full.py` 会自动抽取 `style` 与 `config`。
