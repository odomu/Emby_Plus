/* ================================================================
   Emby_Plus Addon · 集页面美化（详情页元数据 / 季集平铺 / 列表多选）
   契约：EmbyPlus.defineAddon(id, label, config, factory, style)
   依赖：先加载宿主 Emby_Plus.js（提供 window.EmbyPlus 公共接口）
   ================================================================ */

EmbyPlus.defineAddon("season-page", "集页面美化（详情页元数据 / 季集平铺 / 列表多选）", {
    enableSeasonEpisodesLayout: true,
    enableSeriesStatusBadge: true,
}, function (host) {

    /* ---------------- 宿主能力别名 ---------------- */
    var CinemaHome = host;
    var $ = host.$;
    var DomList = host.DomList;
    var CommonUtils = host.CommonUtils;

    function initSeasonEpisodesLayout() {
        if (!this.config || !this.config.enableSeasonEpisodesLayout) return;
        const hookContainer = (container) => {
            if (!container || container._cinemaLayoutHooked) return;
            container._cinemaLayoutHooked = true;
            container.removeAttribute("data-virtualscrolllayout");

            let _origGetListOptions = container.getListOptions;
            Object.defineProperty(container, 'getListOptions', {
                configurable: true,
                enumerable: true,
                get() {
                    return function (items) {
                        let orig = _origGetListOptions ? _origGetListOptions.call(this, items) : {};
                        return Object.assign({}, orig, {virtualScrollLayout: null});
                    };
                },
                set(fn) {
                    _origGetListOptions = fn;
                }
            });
        };

        const checkContainers = () => {
            // 季集解除单行虚拟截断；按钮显隐统一交由 CSS 与原生权限处理。
            document.querySelectorAll(".moreFromSeasonItemsContainer, .seriesItemsSection .childrenItemsContainer").forEach(hookContainer);
        };

        document.addEventListener("viewbeforeshow", checkContainers);
        document.addEventListener("viewshow", checkContainers);
        let seasonObserverTimer = null;
        const seasonObserver = new MutationObserver(() => {
            if (seasonObserverTimer) return;
            seasonObserverTimer = setTimeout(() => {
                seasonObserverTimer = null;
                checkContainers();
            }, 300);
        });
        seasonObserver.observe(document.body, {childList: true, subtree: true});
    }

    function initSeriesStatusBadge() {
        const updateBadge = async () => {
            const activePage = document.querySelector(".itemView:not(.hide), .view:not(.hide)");
            if (!activePage) return;

            const idMatch = location.href.match(/[?&]id=([A-Za-z0-9]+)/);
            const pageId = idMatch ? idMatch[1] : null;
            if (!pageId) return;

            let item = null;
            try {
                item = await CinemaHome.fetchDetailPageItem(pageId);
            } catch (e) {
                return;
            }

            if (!item) return;

            const status = item.Status;
            const isSeries = item.Type === "Series" || status === "Ended" || status === "Continuing";
            if (!isSeries) return;

            let attempts = 0;
            const checkAndAttach = () => {
                const mediaInfo = activePage.querySelector(".detailTextContainer .mediaInfoPrimary, .detailTextContainer .mediaInfoItems, .detailTextContainer .mediaInfo");
                if (mediaInfo) {
                    let badge = mediaInfo.querySelector(".cinema-media-status-badge");
                    if (!badge) {
                        badge = document.createElement("span");
                        badge.className = "mediaInfoItem cinema-media-status-badge";
                        mediaInfo.appendChild(badge);
                    }
                    if (status === "Ended") {
                        badge.className = "mediaInfoItem cinema-media-status-badge status-ended";
                        badge.textContent = "已完结";
                    } else {
                        badge.className = "mediaInfoItem cinema-media-status-badge status-continuing";
                        badge.textContent = "连载中";
                    }
                    badge.style.display = "inline-flex";
                    return;
                }
                if (attempts++ < 15) {
                    setTimeout(checkAndAttach, 200);
                }
            };
            checkAndAttach();
        };

        let timer = null;
        const onNav = () => {
            clearTimeout(timer);
            timer = setTimeout(updateBadge, 200);
        };

        window.addEventListener("popstate", onNav);
        window.addEventListener("hashchange", onNav);
        document.addEventListener("viewshow", onNav);
        setTimeout(updateBadge, 400);
    }

    if (host.config.enableSeriesStatusBadge !== false) initSeriesStatusBadge.call(host);
    initSeasonEpisodesLayout.call(host);

}, `
.detailImageContainerCard .cardMediaInfoItems,
.detailImageContainerCard .starRatingContainer,
.detailImageContainerCard .mediaInfoCriticRating,
.detailImageContainerCard .mediaInfoOfficialRating,
.detailImageContainerCard .cardText,
.detailImageContainerCard .cardFooter,
.detailImageContainer .cardMediaInfoItems,
.detailImageContainer .starRatingContainer,
.detailImageContainer .mediaInfoCriticRating,
.detailImageContainer .mediaInfoOfficialRating,
.detailImageContainer .cardText {
    display: none !important;
    visibility: hidden !important;
    height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
}

.detailTextContainer .starRatingContainer,
.detailTextContainer .mediaInfoCriticRating {
    display: inline-flex !important;
    visibility: visible !important;
}

/* ================================================================
   详情页大海报专属：坚决不显示海报下方的评分角标、烂番茄、分级与多余文字
   ================================================================ */

/* ================================================================
   Part 9：剧集列表自适应卡片排版
   - 间距用 item padding 实现（padding 计入 offsetWidth，虚拟滚动绝对定位时也能正确留间距）
   - gap 对 position:absolute 的 item 无效，不使用 gap
   - 图片内缩：item padding 使内容区缩小，图片自然缩小有留白
   ================================================================ */
.virtualItemsContainer,
.moreFromSeasonItemsContainer {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: wrap !important;
    align-content: flex-start !important;
    align-items: flex-start !important;
    width: 100% !important;
    padding: 0 4px !important;
    box-sizing: border-box !important;
}
/* 单集卡片：padding 作为间距（包含在 offsetWidth 内，虚拟滚动正常计算位置）*/
.virtualScrollItem.listItem.listItem-largeImage {
    padding: 8px 6px !important;   /* 上下 8px，左右 6px；相邻卡片合计 12px 水平间距 */
    box-sizing: border-box !important;
    margin: 0 !important;
    flex: 0 0 auto !important;
}
/* 剧集卡片列数（保持与之前一致的宽高）：宽屏 6 列、中大屏 5 列、桌面 4 列、平板 3 列、手机 2 列 */
@media (min-width: 90em) {
    .virtualScrollItem.listItem.listItem-largeImage {
        width: calc(100% / 6) !important;
    }
}
@media (min-width: 74em) and (max-width: 89.99em) {
    .virtualScrollItem.listItem.listItem-largeImage {
        width: calc(100% / 5) !important;
    }
}
@media (min-width: 58em) and (max-width: 73.99em) {
    .virtualScrollItem.listItem.listItem-largeImage {
        width: calc(100% / 4) !important;
    }
}
@media (min-width: 42em) and (max-width: 57.99em) {
    .virtualScrollItem.listItem.listItem-largeImage {
        width: calc(100% / 3) !important;
    }
}
@media (max-width: 41.99em) {
    .virtualScrollItem.listItem.listItem-largeImage {
        width: calc(100% / 2) !important;
    }
}
/* 卡片内部排版：图片铺满卡片上部，标题与简介在图片下方，操作按钮浮于图片右下角，
   避免按钮随文本换行乱跑（电脑端卡片与手机端卡片一致） */
.trackList .listItem-largeImage .listItem-content {
    margin-block: 0 !important;
}
.trackList .listItem-largeImage .listItem-innerwrapper {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
    position: relative;
}
.trackList .listItem-largeImage .listItemImageContainer {
    grid-area: 1 / 1;
    width: 100% !important;
    aspect-ratio: 16 / 9 !important;
    height: auto !important;
    left: 0 !important;
    margin: 0 !important;
    border-radius: 8px !important;
    overflow: hidden !important;
}
.trackList .listItem-largeImage .listItemBody {
    grid-area: 2 / 1;
    min-height: 0 !important;
    min-width: 0;
    padding: 6px 2px 0 !important;
    justify-content: flex-start;
}
.trackList .listItem-largeImage .listItemBody > h3 {
    margin-top: 0 !important;
    font-size: 14px;
}
.trackList .listItem-largeImage .listItem-innerwrapper > .listItemButton {
    grid-area: 1 / 1;
    align-self: end;
    justify-self: end;
    position: relative !important;
    inset: auto !important;
    width: 30px !important;
    height: 30px !important;
    min-width: 30px !important;
    min-height: 30px !important;
    box-sizing: border-box !important;
    margin: 0 6px 6px 0 !important;
    padding: 0 !important;
    background: rgba(0, 0, 0, 0.6) !important;
    border-radius: 50% !important;
    z-index: 3;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    text-align: center !important;
    line-height: 1 !important;
    font-size: 18px !important;
}
.trackList .listItem-largeImage .listItemButton[is="emby-playstatebutton"] {
    margin-right: 40px !important;
}
.trackList .listItem-largeImage .listItemButton[is="emby-ratingbutton"] {
    margin-right: 76px !important;
}
.trackList .listItem-largeImage .listItem-bottomoverview {
    margin-top: 6px;
    padding-inline: 2px;
}
/* 手机端：仅缩小右下角操作按钮，避免与图片中央的原生播放按钮重叠（播放按钮保持 Emby 原生样式） */
@media (max-width: 41.99em) {
    /* 同时禁止剧集卡片左右滑动：隐藏滑动操作条（白色背景 / 滑动删除按钮），并取消拖动位移 */
    .trackList .listItem-largeImage .listItem-drag-x-axis-content,
    .trackList .listItem-largeImage .listItem-drag-xy-axis-content,
    .trackList .listItem-largeImage [class*="drag-x-axis"],
    .trackList .listItem-largeImage [class*="drag-xy-axis"] {
        display: none !important;
        visibility: hidden !important;
    }
    .trackList .listItem-largeImage .listItem-content {
        transform: none !important;
    }
    /* 卡片整体也不允许被拖动位移（虚拟滚动使用 inset 定位，位移只可能来自 transform） */
    .trackList .listItem-largeImage {
        transform: none !important;
    }
    .trackList .listItem-largeImage,
    .trackList .listItem-largeImage * {
        touch-action: pan-y !important;
    }
    .trackList .listItem-largeImage .listItem-innerwrapper > .listItemButton {
        width: 24px !important;
        height: 24px !important;
        min-width: 24px !important;
        min-height: 24px !important;
        margin: 0 4px 4px 0 !important;
        font-size: 14px !important;
    }
    .trackList .listItem-largeImage .listItemButton[is="emby-playstatebutton"] {
        margin-right: 30px !important;
    }
    .trackList .listItem-largeImage .listItemButton[is="emby-ratingbutton"] {
        margin-right: 56px !important;
    }
}
/* 卡片图片容器：无封面条目（defaultCardBackground + md-icon 占位图标）水平垂直居中 */
.listItemImageContainer.listItemImageContainer-large.itemAction.listItemImageContainer-backdrop,
.listItemImageContainer.listItemImageContainer-large.itemAction.listItemImageContainer-fourThree {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background-position: center center !important;
    background-size: cover !important;
}
/* 手机端：条目图片容器固定 16:9 满宽，图片自然内缩，保持与原生一致的圆角 */
@media (max-width: 41.99em) {
    .listItemImageContainer.listItemImageContainer-large.itemAction.listItemImageContainer-backdrop,
    .listItemImageContainer.listItemImageContainer-large.itemAction.listItemImageContainer-fourThree {
        aspect-ratio: 16 / 9 !important;
        width: 100% !important;
        height: auto !important;
        left: 0 !important;
        margin: 0 !important;
        border-radius: 8px !important;
        overflow: hidden !important;
    }
}
/* 有图条目：图片铺满 16:9 容器，统一 cover 裁切，避免拉伸变形与留边 */
.listItemImageContainer.listItemImageContainer-large > img.listItemImage {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    object-position: center center !important;
}
/* 无封面占位图标：居中且尺寸收敛（排除已播放/进度等原生角标，避免角标被放大） */
.listItemImageContainer.listItemImageContainer-large > .md-icon:not(.listItemIndicator):not(.playedIndicator):not([class*="Indicator"]) {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: auto !important;
    height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    line-height: 1 !important;
    font-size: 34px !important;
}
/* 简介文字宽度自然 100% 撑开 */
.listItem-overview.listItem-topoverview.listItemBodyText.listItemBodyText-secondary.secondaryText.listItemBodyText-secondary-of.listItem-overview-autohide.listItem-overview-3-lines {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
}
/* 多选框定位 */
.virtualScrollItem.listItem.listItem-autoactive.itemAction.listItemCursor.listItem-hoverable.listItem-largeImage .chkListItemSelectContainer.chkItemSelectContainer.itemAction.emby-checkbox-label {
    position: absolute;
    height: 2em;
    left: 0.6em;
    top: 0.6em;
}
@media (min-width:800px) and (max-width:94.11875em){
  /* 多选更改 */
  .virtualScrollItem.listItem.listItem-autoactive.itemAction.listItemCursor.listItem-hoverable.listItem-largeImage
  .chkListItemSelectContainer.chkItemSelectContainer.itemAction.emby-checkbox-label{
    position:absolute;
    height:2em;
    left:-0.2em;
    top:0.80em;
  }
  /* 图片调整 */
  .listItemImageContainer.listItemImageContainer-large.itemAction.listItemImageContainer-fourThree{
    display: flex !important;
    justify-content: center !important; /* 水平 */
    align-items: center !important; /* 垂直 */
    aspect-ratio:16/9 !important;
    width: 16em !important;
    height: auto !important;
    border-radius: 8px!important;
  }
}
/* 常驻 */
/* 隐藏 右滑添加到播放列表 */
div.listItem-autoactive.itemAction.listItemCursor.listItem-hoverable.listItem-largeImage.draggable-x.draggable-xy.dragging-over.dragging-over-x-axis{
    display:none !important;
}
/* 图片调整 */
.listItemImageContainer.listItemImageContainer-large.itemAction.listItemImageContainer-backdrop {
  border-radius: 8px!important;
}
.listItemOverlayButton-imagehover {
  background: rgb(0 0 0 / 0%)!important;
}
/* 集整体 悬停效果 */
.virtualScrollItem.listItem.listItem-autoactive.itemAction.listItemCursor.listItem-hoverable.listItem-largeImage {
  transition: transform .2s ease, background-color .2s ease;
}
.virtualScrollItem.listItem.listItem-autoactive.itemAction.listItemCursor.listItem-hoverable.listItem-largeImage:hover {
  border-radius: 8px !important;
  transform: scale(1.05);
}
.virtualScrollItem.listItem.listItem-autoactive.itemAction.listItemCursor.listItem-hoverable.listItem-largeImage
.listItemImageContainer.listItemImageContainer-large.itemAction.listItemImageContainer-backdrop,
.virtualScrollItem.listItem.listItem-autoactive.itemAction.listItemCursor.listItem-hoverable.listItem-largeImage
.listItemImageContainer.listItemImageContainer-large.itemAction.listItemImageContainer-fourThree{

  transition: box-shadow 0.2s ease;
}
.virtualScrollItem.listItem.listItem-autoactive.itemAction.listItemCursor.listItem-hoverable.listItem-largeImage:hover
.listItemImageContainer.listItemImageContainer-large.itemAction.listItemImageContainer-backdrop,
.virtualScrollItem.listItem.listItem-autoactive.itemAction.listItemCursor.listItem-hoverable.listItem-largeImage:hover
.listItemImageContainer.listItemImageContainer-large.itemAction.listItemImageContainer-fourThree{
  box-shadow: 0 0 1.8em rgb(212 212 212 / 0.7);
  transition: box-shadow 0.2s ease;
}
/* 集简介悬停 半透明 */
.listItem-overview.listItem-topoverview.listItemBodyText.listItemBodyText-secondary.secondaryText.listItemBodyText-secondary-of.listItem-overview-autohide.listItem-overview-3-lines {
  opacity: .4;
  transition: opacity .4s ease-in-out;
}
/* 集简介悬停 不透明 */
.virtualScrollItem.listItem.listItem-autoactive.itemAction.listItemCursor.listItem-hoverable.listItem-largeImage:hover
.listItem-overview.listItem-topoverview.listItemBodyText.listItemBodyText-secondary.secondaryText.listItemBodyText-secondary-of.listItem-overview-autohide.listItem-overview-3-lines {
  opacity: 1;
}
/* 季集列表布局 */

.moreFromSeasonSection .emby-scroller {
    overflow: visible !important;
}
.moreFromSeasonSection .emby-scrollbuttons {
    display: none !important;
}
.moreFromSeasonSection .scrollSlider,
.moreFromSeasonSection .moreFromSeasonItemsContainer {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: wrap !important;
    overflow: visible !important;
    transform: none !important;
    width: 100% !important;
    box-sizing: border-box !important;
    padding-bottom: 24px !important;
}

/* ================================================================
   多选勾选框样式优化与左上角自适应适配：
   - 悬停未勾选：半透明磨砂黑晶底托 + 精致微光圆环
   - 已勾选激活：鲜亮翡翠绿渐变圆底 + 纯正无误标准对勾 ✓
   - 位置精准对齐在 top: 6px, left: 6px
   ================================================================ */
.chkCardSelectContainer {
    position: absolute !important;
    top: 6px !important;
    left: 6px !important;
    z-index: 30 !important;
    margin: 0 !important;
    padding: 0 !important;
    width: 20px !important;
    height: 20px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    cursor: pointer !important;
}
/* 消除 Emby 原生 negative margin-top 导致的垂直偏位 */
.chkCardSelect-checkboxLabel {
    position: relative !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    padding: 0 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 20px !important;
    height: 20px !important;
}
/* 未勾选状态：半透明黑晶底托 + 精致微光圆环 */
.chkCardSelect-checkboxLabel::before {
    content: "" !important;
    position: absolute !important;
    inset: 0 !important;
    transform: none !important;
    width: 20px !important;
    height: 20px !important;
    box-sizing: border-box !important;
    border-radius: 9999px !important;
    background: rgba(0, 0, 0, 0.45) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    border: 1.5px solid rgba(255, 255, 255, 0.6) !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35) !important;
    margin: 0 !important;
    padding: 0 !important;
    display: block !important;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
}
.chkCardSelectContainer:hover .chkCardSelect-checkboxLabel::before {
    background: rgba(0, 0, 0, 0.65) !important;
    border-color: #ffffff !important;
}
/* 已勾选状态：鲜亮翡翠绿渐变圆底 + 立体外发光 */
.emby-checkbox:checked + .chkCardSelect-checkboxLabel::before {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%) !important;
    border-color: #ffffff !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), 0 0 8px rgba(34, 197, 94, 0.45) !important;
}
/* 清除原生逻辑 inset 与负外边距，在 20px 圆内居中，并补偿旋转对勾的视觉重心。 */
.emby-checkbox:checked + .chkCardSelect-checkboxLabel::after {
    content: "" !important;
    display: block !important;
    position: absolute !important;
    inset: auto !important;
    inset-inline: auto !important;
    top: 50% !important;
    left: 50% !important;
    width: 6px !important;
    height: 10px !important;
    border: solid #ffffff !important;
    border-width: 0 2px 2px 0 !important; /* 仅保留右边与底边两条边线 */
    transform: translate(-50%, -65%) rotate(45deg) !important;
    transform-origin: center !important;
    background: transparent !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4)) !important;
}
/* 右上角角标容器定位对齐 */
.cardBox .cardIndicators {
    top: 6px !important;
    right: 6px !important;
    z-index: 25 !important;
    margin: 0 !important;
}
/* 集数角标：通透翡翠微光胶囊徽章，严格在 top: 6px 与评分水平对齐并靠紧右上角 */
.cardBox .countIndicator {
    position: absolute !important;
    top: 6px !important;
    right: 6px !important;
    z-index: 25 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    height: 20px !important;
    min-width: 20px !important;
    padding: 0 6px !important;
    box-sizing: border-box !important;
    border-radius: 9999px !important;
    background: rgba(46, 125, 50, 0.72) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
    color: #ffffff !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    line-height: 20px !important;
    transition: opacity 0.2s ease !important;
}
.cardBox .playedIndicator {
    position: absolute !important;
    top: 6px !important;
    right: 6px !important;
    z-index: 25 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    height: 20px !important;
    width: 20px !important;
    box-sizing: border-box !important;
    border-radius: 9999px !important;
    background: rgba(0, 0, 0, 0.45) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    border: 1px solid rgba(255, 255, 255, 0.14) !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
    color: #4ade80 !important;
    font-size: 12px !important;
    line-height: 20px !important;
    transition: opacity 0.2s ease !important;
}
/* 演职人员作品卡片底部间距紧凑化：消除多余下外边距 */
.actorMoreSection .cardBox-bottompadded {
    margin-bottom: 0.6em !important;
}
/* 详情页主海报专属排除：详情页已有顶部元数据评分，海报上坚决不显示评分 */
.detailImageContainer .starRatingContainer,
.detailImageContainerCard .starRatingContainer,
.detailImageContainerCard-cardBox .starRatingContainer,
.detailImageContainer-main .starRatingContainer,
.item-fixed-side .starRatingContainer {
    display: none !important;
}

/* ================================================================
   模块 15：多选顶部工具栏 (selectionCommandsPanel) 样式优化
   - 深色半透明磨砂顶栏，覆盖海报时保持操作与文字清晰
   - 优雅微光胶囊按钮与圆形关闭按键
   ================================================================ */
.selectionCommandsPanel {
    background: rgba(16, 23, 34, 0.94) !important;
    color: #ffffff !important;
    backdrop-filter: blur(24px) saturate(140%) !important;
    -webkit-backdrop-filter: blur(24px) saturate(140%) !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.14) !important;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.24) !important;
    padding: 0 16px !important;
    height: 100% !important;
    box-sizing: border-box !important;
    display: flex !important;
    align-items: center !important;
}
/* 不支持背景模糊的客户端保留上方高遮盖底色。 */
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .selectionCommandsPanel {
        background: rgba(16, 23, 34, 0.8) !important;
    }
}
/* 关闭选择按钮：圆形微光按钮 */
.selectionCommandsPanel .btnCloseSelectionPanel {
    width: 34px !important;
    height: 34px !important;
    border-radius: 50% !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: rgba(255, 255, 255, 0.12) !important;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    color: #ffffff !important;
    margin-right: 12px !important;
    transition: all 0.2s ease !important;
}
.selectionCommandsPanel .btnCloseSelectionPanel:hover {
    background: rgba(255, 255, 255, 0.22) !important;
    border-color: rgba(255, 255, 255, 0.35) !important;
    transform: scale(1.06) !important;
}
/* 选中项计数标题：清晰纯白加粗数字 */
.selectionCommandsPanel .itemSelectionCount {
    font-size: 16px !important;
    font-weight: 700 !important;
    color: #ffffff !important;
    letter-spacing: 0.5px !important;
}
/* 右侧操作按钮组：毛玻璃半透明轻灵胶囊/圆角按钮 */
.selectionCommandsPanel .multiSelectActionsContainer button {
    height: 34px !important;
    min-width: 34px !important;
    border-radius: 9999px !important;
    background: rgba(255, 255, 255, 0.1) !important;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    color: #ffffff !important;
    margin: 0 4px !important;
    padding: 0 10px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
}
.selectionCommandsPanel .multiSelectActionsContainer button:hover {
    background: rgba(255, 255, 255, 0.22) !important;
    border-color: rgba(255, 255, 255, 0.4) !important;
    transform: scale(1.05) !important;
}

/* ===== 详情页基础美化（原独立组件，已并入本组件） ===== */
/* ================================================================
   模块 14：详情页元数据标签与紧凑垂直流式布局规范
   - 彻底解决 Image #2 所示的多余上下间距 (Red Box 1 & Red Box 2)
   - 彻底消除幽灵空行撑高，对齐制作公司、季数、年龄分级、流派、连载状态
   ================================================================ */
/* 紧凑垂直间距：严格收缩每一层垂直区块，消除上下多余空洞 */
.detailTextContainer .mediaInfo,
.detailTextContainer .detail-mediaInfoPrimary,
.detailTextContainer .mediaInfoPrimary,
.detailTextContainer .itemDetailsGroup {
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    flex-wrap: wrap !important;
    gap: 6px !important;
    margin-top: 4px !important;
    margin-bottom: 4px !important;
    padding: 0 !important;
}

/* 视听选单紧凑对齐：上下边距严格收敛，消除与标签行及按钮行之间的多余间隙 (解决 Red Box 1 & 2) */
.detailTextContainer .trackSelections,
.detailTextContainer .trackSelections:not(.hide) {
    margin-top: 2px !important;
    margin-bottom: 4px !important;
    padding: 0 !important;
}

/* 主操作按钮紧凑对齐：消除与视听选单之间的多余间隙 */
.detailTextContainer .mainDetailButtons {
    margin-top: 4px !important;
    margin-bottom: 10px !important;
}

/* 彻底隐藏所有空行容器、空标签或被 Emby 标记隐藏的元素，绝不产生幽灵高度 */
.detailTextContainer .mediaInfo:empty,
.detailTextContainer .mediaInfoPrimary:empty,
.detailTextContainer .mediaInfoSecondary:empty,
.detailTextContainer .mediaInfoItems:empty,
.detailTextContainer .mediaInfoItem:empty,
.detailTextContainer .itemDetailsGroup:empty,
.detailTextContainer .tagline:empty,
.detailTextContainer .hide,
.detailTextContainer [style*="display: none"] {
    display: none !important;
    height: 0 !important;
    min-height: 0 !important;
    max-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
}

/* 统一所有标签外盒基础几何尺寸与外观规格 (严格统一度量衡) */
.detailTextContainer .mediaInfo,
.detailTextContainer .detail-mediaInfoPrimary,
.detailTextContainer .mediaInfoPrimary,
.detailTextContainer .itemDetailsGroup {
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    flex-wrap: wrap !important;
    gap: 6px !important;
    margin-top: 4px !important;
    margin-bottom: 4px !important;
    padding: 0 !important;
}

.detailTextContainer .mediaInfoItem,
.detailTextContainer .mediaInfoItem a,
.detailTextContainer .mediaInfoOfficialRating,
.detailTextContainer a.mediaInfoItem,
.detailTextContainer .cinema-media-status-badge {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    height: 22px !important;
    min-height: 22px !important;
    max-height: 22px !important;
    line-height: 20px !important;
    padding: 0 8px !important;
    box-sizing: border-box !important;
    border-radius: 4px !important;
    font-size: 11.5px !important;
    font-weight: 600 !important;
    margin: 0 !important;
    vertical-align: middle !important;
    text-decoration: none !important;
    white-space: nowrap !important;
    border: 1px solid rgba(255, 255, 255, 0.18) !important;
    background: rgba(255, 255, 255, 0.08) !important;
    color: rgba(255, 255, 255, 0.92) !important;
    text-shadow: none !important;
    box-shadow: none !important;
    transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease !important;
}

/* 若内部已嵌套 a 标签，则外层 span/div 不重复绘制边框与背景 */
.detailTextContainer .mediaInfoItem:has(a) {
    border: none !important;
    background: transparent !important;
    padding: 0 !important;
    height: auto !important;
    min-height: 0 !important;
    box-shadow: none !important;
}

/* 链接标签悬浮交互微光 */
.detailTextContainer a.mediaInfoItem:hover,
.detailTextContainer .mediaInfoItem a:hover {
    background: rgba(255, 255, 255, 0.2) !important;
    border-color: rgba(255, 255, 255, 0.38) !important;
    color: #ffffff !important;
    transform: translateY(-1px) !important;
}

/* 1. 官方分级标签 (如 TW-15+, PG-13, SG-PG13, TV-MA) 保持相同规格，赋予典雅琥珀橙微光 */
.detailTextContainer .mediaInfoOfficialRating,
.detailTextContainer .mediaInfoItem[data-rating-group],
.detailTextContainer .mediaInfoItem.mediaInfoOfficialRating {
    background: rgba(230, 81, 0, 0.28) !important;
    border-color: rgba(255, 152, 0, 0.5) !important;
    color: #ffb74d !important;
}

/* 豆瓣/烂番茄/TMDB评分徽章完全纳入统一标签规范，彻底消灭不统一标签 (解决 Image #1) */
.detailTextContainer .mediaInfoItem:has(.starRatingContainer) {
    border: none !important;
    background: transparent !important;
    padding: 0 !important;
    height: auto !important;
    min-height: 0 !important;
}

.detailTextContainer .starRatingContainer {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    height: 22px !important;
    min-height: 22px !important;
    max-height: 22px !important;
    line-height: 20px !important;
    padding: 0 8px !important;
    box-sizing: border-box !important;
    border-radius: 4px !important;
    font-size: 11.5px !important;
    font-weight: 600 !important;
    margin: 0 !important;
    border: 1px solid rgba(255, 255, 255, 0.18) !important;
    background: rgba(255, 255, 255, 0.08) !important;
    color: rgba(255, 255, 255, 0.92) !important;
}

/* 消除最后一个标签强制占满100%换行的割裂问题，实现自然弹性流式排列 */
.focusable .mediaInfoItem:last-child {
    width: auto !important;
    margin-top: 0 !important;
    margin-bottom: 0 !important;
}

/* 媒体库影评指数与评分徽章对齐 */
.detailTextContainer .mediaInfoItem.mediaInfoCriticRating {
    width: max-content;
}

/*【节目界面】版本、视频、音频、字幕信息自动换行和对齐样式*/
@media all and (min-width: 80em) {
    .noScrollY .trackSelections {
        width: 100%;
    }

    .noScrollY .trackSelections .detailTrackSelect {
        max-width: 24em;
    }

    .layout-tv .trackSelections {
        width: auto;
    }
}

/*【节目界面】播放器控件按钮添加底色背景样式*/
@media all and (min-width: 50em) {

    .darkContentContainer-item .detailTrackSelect,
    .darkContentContainer-item .detailButton {
        background: rgba(115, 115, 115, 0.5);
        backdrop-filter: blur(1.5em) saturate(1.8);
        border-radius: 5em !important;
    }

    .emby-button-focusscale:focus {
        background: var(--theme-primary-color);
    }

    .detailButton {
        box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.2);
    }
}

/*【节目界面】隐藏主页面和导航栏预告片控件按钮 */
.detailButtons.mainDetailButtons .btnPlayTrailer {
    display: none
}

/* .tabs-viewmenubar-slider.emby-tabs-slider.scrollSliderX .emby-tab-button[data-index="3"] {
    display: none
}

 */

@media not all and (min-width: 50em) {
    .detailButtons .detailButton-stacked {
        flex-basis: calc(100%) !important;
        -webkit-flex-basis: calc(100%) !important;
    }
}

/*【节目界面】爱心控件按钮使用全局主题色调*/
.detailButton-autotext-icon.ratingbutton-icon-withrating,
.cardOverlayButton-hover.ratingbutton-icon-withrating,
.dataGridItemCell.ratingbutton-icon-withrating,
.listViewUserDataButton.ratingbutton-icon-withrating {
    color: hsl(var(--theme-primary-color-hue),
            var(--theme-primary-color-saturation),
            var(--theme-primary-color-lightness)) !important;
}

/*【节目界面】数据库链接、标签、拆分版本按钮添加底色背景样式*/
@media all and (min-width: 50em) {

    .darkContentContainer-item .itemLinks .item-tag-button,
    .darkContentContainer-item .itemTags .item-tag-button,
    .darkContentContainer-item .splitVersionContainer .btnSplitVersions {
        background: rgba(115, 115, 115, 0.3);
        backdrop-filter: blur(1.5em) saturate(1.8) !important;
        box-shadow: rgba(255, 255, 255, 0.4) 0 0 0 2.3px;
        border-radius: 30px;
        color: #fff;
        font-size: 0.93em;
        margin-right: 1em;
    }
}

/*【节目界面】媒体源信息和演职人员添加底色背景样式*/
@media all and (min-width: 50em) {

    .darkContentContainer-item .defaultCardBackground.cardPadder-portrait,
    div.mediaStreamPadder,
    div.mediaStreamPadder-tv {
        box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.5);
        background: rgba(115, 115, 115, 0);
    }

    .darkContentContainer-item.cardOverlayContainer .defaultCardBackground {
        backdrop-filter: blur(0.9em);
    }
}

/* ===== 连载 / 完结状态角标（原在精简版，已归位到本组件） ===== */
.detailTextContainer .cinema-media-status-badge {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    height: 22px !important;
    min-height: 22px !important;
    max-height: 22px !important;
    line-height: 20px !important;
    padding: 0 8px !important;
    box-sizing: border-box !important;
    border-radius: 4px !important;
    font-size: 11.5px !important;
    font-weight: 600 !important;
    margin: 0 !important;
    vertical-align: middle !important;
    text-decoration: none !important;
    white-space: nowrap !important;
    border: 1px solid rgba(255, 255, 255, 0.18) !important;
    background: rgba(255, 255, 255, 0.08) !important;
    color: rgba(255, 255, 255, 0.92) !important;
    text-shadow: none !important;
    box-shadow: none !important;
    transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease !important;
}
.detailTextContainer .mediaInfoItem.status-ended, .detailTextContainer .cinema-media-status-badge.status-ended {
    background: rgba(46, 125, 50, 0.32) !important;
    border-color: rgba(76, 175, 80, 0.5) !important;
    color: #81c784 !important;
}
.detailTextContainer .mediaInfoItem.status-continuing, .detailTextContainer .cinema-media-status-badge.status-continuing {
    background: rgba(2, 136, 209, 0.32) !important;
    border-color: rgba(3, 169, 244, 0.5) !important;
    color: #4fc3f7 !important;
}

/* ===== 详情页按钮 / 超出显示（原由外部播放器插件携带，已归位到本组件） ===== */
/* 解除 Emby 原生 topDetailsMain 截断 */
                .topDetailsMain,
                .mainDetailButtons,
                .detailTextContainer {
                    overflow: visible !important;
                }

                /* 隐藏多余按钮 */
                .mainDetailButtons .btnSyncDownload,
                .mainDetailButtons button[is="emby-downloadbutton"],
                .mainDetailButtons .btnSortItems,
                .mainDetailButtons .btnGroupBy,
                .mainDetailButtons .btnShuffle,
                .mainDetailButtons .btnPlayTrailer,
                .mainDetailButtons .btnPlayTrailer-main,
                .btnSyncDownload,
                .btnSortItems,
                .btnGroupBy,
                .btnShuffle,
                .btnPlayTrailer {
                    display: none !important;
                }

/* 移动端操作栏布局 */
                @media (max-width: 768px) {
                    .mainDetailButtons .btnPlay.raised,
                    .mainDetailButtons .btnResume.raised {
                        flex: 1 1 auto !important;
                        min-width: 0 !important;
                        margin: 0 !important;
                    }
                    /* 次行 4 个操作按钮（已播放、收藏、删除、更多）均等分布 */
                    .mainDetailButtons .detailButton.fab,
                    .mainDetailButtons .btnPlaystate,
                    .mainDetailButtons .btnUserRating,
                    .mainDetailButtons .btnDeleteItem,
                    .mainDetailButtons .btnMoreCommands {
                        flex: 1 1 0 !important;
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        justify-content: center !important;
                        margin: 4px 0 0 0 !important;
                    }
}

/* ===== 隐藏详情页多余按钮 / 隐藏顶栏Tab / 节目界面控件美化 ===== */
/* 仅在影视详情页隐藏顶栏 Tab 导航；首页与媒体库(/tv, /videos, /movies等)严格保持原生 Tab 正常展示 */
.view-item-item .headerMiddle.sectionTabs,
.view-item-item .headerTabs.sectionTabs,
.itemView .headerMiddle.sectionTabs,
.itemView .headerTabs.sectionTabs {
    display: none !important;
}

/* 全局隐藏详情页多余按钮：下载、排序、分组、预告片、随机播放 */
.mainDetailButtons .btnSyncDownload,
.mainDetailButtons button[is="emby-downloadbutton"],
.mainDetailButtons .btnSortItems,
.mainDetailButtons .btnGroupBy,
.mainDetailButtons .btnShuffle,
.mainDetailButtons .btnPlayTrailer,
.mainDetailButtons .btnPlayTrailer-main,
.btnSyncDownload,
.btnSortItems,
.btnGroupBy,
.btnShuffle,
.btnPlayTrailer,
button[data-action="download"],
button[data-action="sort"],
button[data-action="groupby"] {
    display: none !important;
}

/* 隐藏媒体库分区内的设置/排序/筛选操作行 */
.tabContent .itemsViewSettingsContainer,
.view[data-type="library"] .itemsViewSettingsContainer,
.scrollSlider .itemsViewSettingsContainer {
    display: none !important;
}

/* ================================================================
   模块 08：影视节目界面、控件按钮与媒体信息美化
   ================================================================ */
/*【节目界面】全局使用圆角样式和选中状态使用圆角样式*/
.scrollFrameY .cardImageContainer,
.scrollFrameY .cardOverlayContainer,
.scrollFrameY .listItemImage {
    contain: layout;
    border-radius: 0.75em;
}

/*【节目界面】艺术家和作曲家页面使用圆角头像样式*/
.cardContent-round.defaultCardBackground {
    border-radius: 10em;
}

/*【节目界面】【桌面模式】媒体选中状态添加边框样式*/
.card-hoverable.focusable:hover .cardOverlayContainer,
.button-hoverable.focusable:hover .cardOverlayContainer {
    transition: opacity 0ms ease-in-out;
    box-shadow: 0 0 0 0.27em hsl(var(--theme-primary-color-hue), var(--theme-primary-color-saturation), var(--theme-primary-color-lightness)) !important;
}

/*【节目界面】修复音乐媒体库界面边框异常*/
.squareCard .cardOverlayContainer {
    transform: scale(0.957);
    border-radius: 0;
}

.bannerCard .cardOverlayContainer {
    transform: scale(1);
    border-radius: 0;
}

.detailImageContainer.detailImageContainer-main .cardOverlayContainer,
.osdRemoteControlImageCardBox .cardOverlayContainer {
    transform: scale(1);
}

.flex-direction-column.darkContentContainer {
    --button-background-alpha: 0.4;
}

/*【节目界面】【电视模式】媒体选中状态添加边框样式*/
.layout-tv .card:focus>.cardBox-focustransform .cardContent.coveredImage {
    border: 0.3em solid;
    color: hsl(var(--theme-primary-color-hue),
            var(--theme-primary-color-saturation),
            var(--theme-primary-color-lightness));
}

/*【节目界面】【桌面模式】媒体选中状态添加边框和颜色*/
.scrollY .card:focus .cardContent-bxsborder {
    box-shadow: 0 0 0 0.27em hsl(var(--theme-primary-color-hue), var(--theme-primary-color-saturation), var(--theme-primary-color-lightness)) !important;
}

/*【节目界面】【电视模式】媒体选中状态添加边框和颜色*/
.scrollY .card:focus-visible .cardContent-bxsborder-fv {
    box-shadow: 0 0 0 0.27em hsl(var(--theme-primary-color-hue), var(--theme-primary-color-saturation), var(--theme-primary-color-lightness)) !important;
}

/* 电视模式最近栏目显示样式 */
.layout-tv .suggestions.padded-bottom-page .sectionTitle-cards {
    margin-top: 3em;
}

.secondaryText.focusPreviewOverview,
.readOnlyContent {
    -webkit-line-clamp: 3;
    max-width: 90ch !important;
}
`);
