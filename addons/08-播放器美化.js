/* ================================================================
   Emby_Plus Addon · 播放器美化（控制台 / 进度条 / 播放页横版卡片）
   契约：EmbyPlus.defineAddon(id, label, config, factory, style)
   依赖：先加载宿主 Emby_Plus.js（提供 window.EmbyPlus 公共接口）
   ================================================================ */

EmbyPlus.defineAddon("player-beauty", "播放器美化（控制台 / 进度条 / 播放页横版卡片）", {}, null, `
/* ================================================================
   模块 09：播放器控制台、进度条与移动端播控布局优化
   ================================================================ */
/* 移动端播放器控件布局 */
@media not all and (pointer: fine) {

    .videoOsdBottom-buttons,
    .videoOsd-centerButtons-autolayout,
    .videoOsd-btnPause-autolayout {
        position: inherit !important;
        margin-top: 0 !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        font-size: inherit !important;
    }
}
/*【播放界面】播放器调整横屏竖屏时的控件按钮大小*/
@media all and (min-width: 20em) and (max-width: 25em) {

    .videoOsdBottom-buttons,
    .videoosd-transportbuttons.videoOsdBottom-buttons-right {
        font-size: 0.9em !important;
        margin-bottom: 0.5em;
    }
}
@media all and (min-width: 40em) and (max-width: 66em) {

    .videoOsdBottom-buttons,
    .videoosd-transportbuttons.videoOsdBottom-buttons-right {
        font-size: 1.2em !important;
        margin-bottom: 0.5em;
    }
}
.videoOsdBottom-buttons-remotecontrol {
    font-size: 1.5em !important;
}
/*【播放界面】播放器调整远程控制投屏播放控件样式*/
@media all and (max-width: 50em) {
    .videoOsdBottom-buttons.videoOsdBottom-buttons-remotecontrol .videoosd-transportbuttons {
        font-size: 0.8em;
    }

    .videoosd-transportbuttons.videoOsdBottom-contentbuttons.videoOsd-customFont.videoOsd-customFont-remotecontrol {
        font-size: 0.9em;
    }

    .noScrollY.accent-emby:not(.transparentDocument) .btnSkipIntro.raised-backdropfilter.videoOsd-customFont {
        bottom: 4.7em;
        font-size: 1em;
    }
}
/*【播放界面】播放器顶部控件增加立体感阴影*/
.videoOsdHeader.headerTop {
    filter: drop-shadow(1px 1px 3px rgba(0, 0, 0, 1));
}
/*【播放界面】播放器顶部背景条透明度*/
.skinHeader.semiTransparent.headroom-scrolling::before {
    opacity: 0;
}
/*【播放界面】播放器底部控件增加立体感阴影*/
.videoOsdBottom-maincontrols {
    -webkit-filter: drop-shadow(1px 1px 3px rgba(0, 0, 0, 0.75));
    -moz-filter: drop-shadow(0px 0px 0px rgba(0, 0, 0, 0.75));
}
/*【播放界面】播放器底部背景条透明度*/
.videoOsdBottom.videoOsdBottom-video {
    background: linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0));
}
/*【播放界面】播放器底部缓冲条透明度*/
.emby-slider-background .emby-slider-background-inner {
    background: rgb(255 255 255 / 0%);
}
/*【播放界面】播放器底部章节导航栏靠左对齐*/
.videoosd-tabsContainer .videoOsdBottom-tabs {
    justify-content: flex-start;
}
/*【播放界面】播放器底部章节导航栏文字样式和颜色*/
.videoOsdBottom-tabs .videoosd-tabsslider .secondaryText {
    color: white;
    font-weight: 540;
}
/*【播放界面】播放器底部控件增加间距以防误触*/
@media all and (max-height: 40em) and (min-width: 30em) and (hover: none) {
    .videoOsdBottom-buttons .md-icon {
        margin-left: 0.23em;
        margin-right: 0.23em;
    }
}
@media not all and (pointer: fine) {
    .videoOsd-customFont {
        margin-bottom: 0.7em;
    }
}
/*【播放界面】播放器底部章节背景提高透明度*/
.videoosd-padded-left.videoosd-padded-right .cardContent-bg-black {
    background-color: rgba(0, 0, 0, 0.3) !important;
}
/*【播放界面】播放器底部信息栏背景提高透明度*/
.videoosd-tabcontainers .videoosd-tabBackground {
    background-color: rgba(0, 0, 0, 0.3);
}
/*【播放界面】播放器底部信息栏简介文字颜色*/
.videoosd-info-overview.secondaryText {
    color: white;
}
/*【播放界面】播放器底部过长的标题名和剧集名截断不换行*/
.videoOsdText .videoOsdParentTitle:not(.videoOsdParentTitle-small) {
    max-width: 30%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.videoOsdText .videoOsdTitle:not(.secondaryText) {
    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
/* 集页面操作按钮 */
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

/* ================================================================
   模块 10：播放页剧集横版卡片与外部播放器按钮
   ================================================================ */
/* 播放页横版卡片尺寸适当放大，舒展饱满（电脑端 6 列，中屏 5 列） */
.moreFromSeasonSection .card {
    width: calc(100% / 6) !important;
    box-sizing: border-box !important;
    contain: none !important;
}

@media (max-width: 1500px) {
    .moreFromSeasonSection .card {
        width: calc(100% / 5) !important;
    }
}

@media (max-width: 1200px) {
    .moreFromSeasonSection .card {
        width: calc(100% / 4) !important;
    }
}

@media (max-width: 900px) {
    .moreFromSeasonSection .card {
        width: calc(100% / 3) !important;
    }
}

@media (max-width: 600px) {
    .moreFromSeasonSection .card {
        width: calc(100% / 2) !important;
    }
}

/* 单行多选列表布局 */

/* 视听选单布局 */

/* 1. 视听选单：仅在已选中具体单集（非隐藏状态）下才生效，绝不强行展示在电视剧总览页！ */
.trackSelections.hide,
.trackSelections .selectContainer.hide,
.trackSelections .selectSourceContainer.hide,
.trackSelections .selectVideoContainer.hide,
.trackSelections .selectAudioContainer.hide,
.trackSelections .selectSubtitlesContainer.hide,
.trackSelections .trackSelectContainer.hide {
    display: none !important;
}

@media (min-width: 769px) {
    .trackSelections:not(.hide) {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        gap: 10px 28px !important;
        width: 100% !important;
        margin-top: 6px !important;
        margin-bottom: 8px !important;
    }

    .trackSelections .selectSourceContainer:not(.hide),
    .trackSelections .selectVideoContainer:not(.hide),
    .trackSelections .selectAudioContainer:not(.hide) {
        display: inline-flex !important;
        flex-direction: row !important;
        align-items: center !important;
        width: auto !important;
        max-width: none !important;
        margin: 0 !important;
    }

    .trackSelections .selectSubtitlesContainer:not(.hide) {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        width: 100% !important;
        margin-top: 2px !important;
        margin-bottom: 4px !important;
    }

    .trackSelections .selectContainer .selectLabelContainer {
        margin-right: 8px !important;
        margin-bottom: 0 !important;
    }

    .trackSelections .detailTrackSelect {
        width: auto !important;
        min-width: unset !important;
    }
}

/* 2. 手机端：首行仅排布 [播放] 与 [外部播放]，且样式 100% 统一（白底黑字，同高度同圆角） */
@media (max-width: 768px) {
    .mainDetailButtons {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 10px 8px !important;
    }

    .mainDetailButtons .btnPlay,
    .mainDetailButtons .btnResume {
        flex: 1 1 auto !important;
        order: 0 !important;
        margin: 0 !important;
    }

    .mainDetailButtons .extPlayerDropdownWrap {
        flex: 0 0 auto !important;
        order: 0 !important;
        margin: 0 !important;
    }

    .mainDetailButtons .extPlayerLineBreak,
    .mainDetailButtons::after {
        content: "" !important;
        display: block !important;
        width: 100% !important;
        flex-basis: 100% !important;
        height: 0 !important;
        order: 1 !important;
        border: none !important;
    }

    /* 移动端外部播放按钮 */
    .extPlayerTriggerBtn {
        height: 42px !important;
        min-height: 42px !important;
        padding: 0 10px !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        border-radius: .42em !important;
        background: rgba(255, 255, 255, 0.12) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        color: #ffffff !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        box-shadow: none !important;
    }

    .extPlayerTriggerBtn .extPlayerMainIcon,
    .extPlayerTriggerBtn .extPlayerArrowIcon,
    .extPlayerTriggerBtn .button-text {
        color: #ffffff !important;
    }

    /* 首行隔断 */
    .extPlayerLineBreak {
        width: 100% !important;
        flex-basis: 100% !important;
        height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
        border: none !important;
        visibility: hidden !important;
    }

    /* 隐藏多余按钮 */
    .mainDetailButtons .btnSyncDownload,
    .mainDetailButtons .btnSortItems,
    .mainDetailButtons .btnGroupBy,
    .mainDetailButtons button[is="emby-downloadbutton"],
    .btnSyncDownload,
    .btnSortItems,
    .btnGroupBy {
        display: none !important;
    }

    /* 操作按钮居中 */
    /* 操作按钮水平等距排布，居中对齐，禁止文字换行挤压 */
    .mainDetailButtons .btnPlaystate:not(.hide),
    .mainDetailButtons .btnUserRating:not(.hide),
    .mainDetailButtons .btnDeleteItem:not(.hide),
    .mainDetailButtons .btnMoreCommands:not(.hide) {
        flex: 0 1 auto !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
        margin-top: 8px !important;
        order: 2 !important;
        min-width: 72px !important;
    }
    .mainDetailButtons .detailButton-autotext-text {
        white-space: nowrap !important;
        word-break: keep-all !important;
        overflow: visible !important;
        text-align: center !important;
        font-size: 12px !important;
        margin-top: 4px !important;
    }
    .mainDetailButtons .detailButton-autotext-icon {
        margin: 0 auto !important;
    }
}

/* 手机端首行宽度 */
@media (max-width: 768px) {
    .mainDetailButtons:not(:has(.extPlayerDropdownWrap)) .btnPlay,
    .mainDetailButtons:not(:has(.extPlayerDropdownWrap)) .btnResume {
        width: 100% !important;
        flex-basis: 100% !important;
    }
}

/* 文件夹型条目（剧集/播出季）不提供删除入口：Emby 以 .hide 隐藏该按钮，
   部分客户端 .hide 会被后续 .emby-button 规则覆盖而重新显示，这里强制钉死为不显示 */
.mainDetailButtons .btnDeleteItem.hide,
.detailButtons .btnDeleteItem.hide {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
}

/* 删除图标不依赖原生字体子集；仅替换已获权限按钮内的字形，不修改按钮显隐。 */
.btnDeleteItem.detailButton:not(.hide) > .md-icon {
    display: inline-block !important;
    width: 1em !important;
    height: 1em !important;
    flex-shrink: 0 !important;
    overflow: hidden !important;
    text-indent: -9999px !important;
    background: currentColor !important;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat !important;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat !important;
}

/* 全局隐藏多余操作按钮 */
.btnSyncDownload,
.btnSortItems,
.btnGroupBy,
.btnShuffle,
.btnPlayTrailer,
.btnPlayTrailer-main,
button[is="emby-downloadbutton"],
button.btnSyncDownload,
button.btnSortItems,
button.btnGroupBy,
button.btnShuffle,
button.btnPlayTrailer,
button[data-action="download"],
button[data-action="sort"],
button[data-action="groupby"],
button[data-action="shuffle"],
button[data-action="playtrailer"],
button[data-action="customtrailer"],
button[data-action="customtrailer-main"],
.mainDetailButtons .btnSyncDownload,
.mainDetailButtons .btnSortItems,
.mainDetailButtons .btnGroupBy,
.mainDetailButtons button[is="emby-downloadbutton"],
.detailButtons .btnSyncDownload,
.detailButtons .btnSortItems,
.detailButtons .btnGroupBy,
.detailButtons button[is="emby-downloadbutton"],
button:has(.btnSortText),
button:has(i.btnSortIcon),
button:has(div.btnSortText),
.btnSortText,
.btnSortIcon,
.btnSyncDownloadIcon {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    width: 0 !important;
    height: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    pointer-events: none !important;
}
`);
