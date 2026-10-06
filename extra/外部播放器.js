// ==UserScript==
// @name         embyLaunchPotplayer
// @name:en      embyLaunchPotplayer
// @name:zh      embyLaunchPotplayer
// @name:zh-CN   embyLaunchPotplayer
// @namespace    http://tampermonkey.net/
// @version      1.2.1
// @description  emby/jellfin launch external player
// @description:zh-cn emby/jellfin 调用外部播放器
// @description:en  emby/jellfin to external player
// @description:en  emby/jellfin to external player
// @license      MIT
// @author       @bpking
// @github       https://github.com/bpking1/embyExternalUrl
// @match        *://*/web/index.html
// @match        *://*/web/
// ==/UserScript==

(function () {
    'use strict';
    const iconConfig = {
        // 图标来源,以下三选一,注释为只留一个,3 的优先级最高
        // 1.add icons from jsdelivr, network
        // baseUrl: "https://emby-external-url.7o7o.cc/embyWebAddExternalUrl/icons",
        baseUrl: "",
        // baseUrl: "https://fastly.jsdelivr.net/gh/bpking1/embyExternalUrl@main/embyWebAddExternalUrl/icons",
        // 2.server local icons, same as /emby-server/system/dashboard-ui/icons
        // baseUrl: "icons",
        // 3.add icons from Base64, script inner, this script size 22.5KB to 74KB,
        // 自行复制 ./iconsExt.js 内容到此脚本的 getIconsExt 中
        // 移除最后几个冗余的自定义开关
        removeCustomBtns: true,
    };
    // 启用后将修改直接串流链接为真实文件名,方便第三方播放器友好显示和匹配,
    // 默认不启用,强依赖 nginx-emby2Alist location two rewrite,如发现原始链接播放失败,请关闭此选项
    const useRealFileName = false;
    // 以下为内部使用变量,请勿更改
    let isEmby = true;
    const mark = "embyLaunchPotplayer";
    const playBtnsWrapperId = "ExternalPlayersBtns";
    const lsKeys = {
        iconOnly: `${mark}-iconOnly`,
        hideByOS: `${mark}-hideByOS`,
        notCurrentPot: `${mark}-notCurrentPot`,
        strmDirect: `${mark}-strmDirect`,
    };
    const OS = {
        isAndroid: () => /android/i.test(navigator.userAgent),
        isIOS: () => /iPad|iPhone|iPod/i.test(navigator.userAgent),
        isMacOS: () => /Macintosh|MacIntel/i.test(navigator.userAgent),
        isApple: () => OS.isMacOS() || OS.isIOS(),
        isWindows: () => /compatible|Windows/i.test(navigator.userAgent),
        isMobile: () => OS.isAndroid() || OS.isIOS(),
        isUbuntu: () => /Ubuntu/i.test(navigator.userAgent),
        // isAndroidEmbyNoisyX: () => OS.isAndroid() && ApiClient.appVersion().includes('-'),
        // isEmbyNoisyX: () => ApiClient.appVersion().includes('-'),
        isOthers: () => Object.entries(OS).filter(([key, val]) => key !== 'isOthers').every(([key, val]) => !val()),
    };
    const playBtns = [
        {
            id: "embyPot", title: "Potplayer", iconId: "icon-PotPlayer"
            , onClick: embyPot, osCheck: [OS.isWindows],
        },
        { id: "embyVlc", title: "VLC", iconId: "icon-VLC", onClick: embyVlc, },
        {
            id: "embyIINA", title: "IINA", iconId: "icon-IINA"
            , onClick: embyIINA, osCheck: [OS.isMacOS],
        },
        { id: "embyNPlayer", title: "NPlayer", iconId: "icon-NPlayer", onClick: embyNPlayer, },
        {
            id: "embyMX", title: "MXPlayer", iconId: "icon-MXPlayer"
            , onClick: embyMX, osCheck: [OS.isAndroid],
        },
        {
            id: "embyMXPro", title: "MXPlayerPro", iconId: "icon-MXPlayerPro"
            , onClick: embyMXPro, osCheck: [OS.isAndroid],
        },
        {
            id: "embyInfuse", title: "Infuse", iconId: "icon-infuse"
            , onClick: embyInfuse, osCheck: [OS.isApple],
        },
        {
            id: "embyStellarPlayer", title: "恒星播放器", iconId: "icon-StellarPlayer"
            , onClick: embyStellarPlayer, osCheck: [OS.isWindows, OS.isMacOS, OS.isAndroid],
        },
        { id: "embyMPV", title: "MPV", iconId: "icon-MPV", onClick: embyMPV, },
        {
            id: "embyDDPlay", title: "弹弹Play", iconId: "icon-DDPlay"
            , onClick: embyDDPlay, osCheck: [OS.isWindows, OS.isAndroid],
        },
        {
            id: "embyFileball", title: "Fileball", iconId: "icon-Fileball"
            , onClick: embyFileball, osCheck: [OS.isApple],
        },
        {
            id: "embyOmniPlayer", title: "OmniPlayer", iconId: "icon-OmniPlayer"
            , onClick: embyOmniPlayer, osCheck: [OS.isMacOS],
        },
        {
            id: "embyFigPlayer", title: "FigPlayer", iconId: "icon-FigPlayer"
            , onClick: embyFigPlayer, osCheck: [OS.isMacOS],
        },
        {
            id: "embySenPlayer", title: "SenPlayer", iconId: "icon-SenPlayer"
            , onClick: embySenPlayer, osCheck: [OS.isIOS],
        },
        { id: "embyCopyUrl", title: "复制地址", iconId: "icon-Copy", onClick: embyCopyUrl, },
    ];
    const customBtns = [
        { id: "hideByOS", title: "异构播放器", iconName: "more", onClick: hideByOSHandler, },
        { id: "iconOnly", title: "显示模式", iconName: "open_in_full", onClick: iconOnlyHandler, },
        { id: "notCurrentPot", title: "多开Potplayer", iconName: "select_window", onClick: notCurrentPotHandler, },
        {
            id: "strmDirect", title: "STRM直通", desc: "AList注意关sign,否则不要开启此选项,任然由服务端处理sign"
            , iconName: "media_link", onClick: strmDirectHandler,
        },
    ];
    if (!iconConfig.removeCustomBtns) {
        playBtns.push(...customBtns);
    }
    const fileNameReg = /.*[\\/]|(\?.*)?$/g;
    const selectors = {
        // 详情页评分,上映日期信息栏
        embyMediaInfoDiv: "div[is='emby-scroller']:not(.hide) .mediaInfo:not(.hide)",
        jellfinMediaInfoDiv: ".itemMiscInfo-primary:not(.hide)",
        // 电视直播详情页创建录制按钮
        embyBtnManualRecording: "div[is='emby-scroller']:not(.hide) .btnManualRecording:not(.hide)",
        // 电视直播详情页停止录制按钮
        jellfinBtnCancelTimer: ".btnCancelTimer:not(.hide)",
        // 详情页播放收藏那排按钮
        embyMainDetailButtons: "div[is='emby-scroller']:not(.hide) .mainDetailButtons",
        jellfinMainDetailButtons: "div.itemDetailPage:not(.hide) div.detailPagePrimaryContainer",
        // 详情页字幕选择下拉框
        selectSubtitles: "div[is='emby-scroller']:not(.hide) select.selectSubtitles",
        // 详情页多版本选择下拉框
        selectSource: "div[is='emby-scroller']:not(.hide) select.selectSource:not([disabled])",
    };

    function init () {
        const activeView = document.querySelector(".view:not(.hide)") || document;
        let mainDetailButtons = activeView.querySelector(".mainDetailButtons");
        if (!mainDetailButtons) return;

        let oldWrapper = activeView.querySelector("#" + playBtnsWrapperId);
        if (oldWrapper) oldWrapper.remove();
        let oldDropdown = mainDetailButtons.querySelector("#extPlayerDropdownWrap");
        if (oldDropdown) oldDropdown.remove();
        let oldBreak = mainDetailButtons.querySelector("#extPlayerLineBreak");
        if (oldBreak) oldBreak.remove();

        // Ensure stylesheet is injected
        if (!document.getElementById("extPlayerStyles")) {
            const style = document.createElement("style");
            style.id = "extPlayerStyles";
            style.textContent = `
                /* 外部播放器按钮容器 */
                .extPlayerDropdownWrap {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    vertical-align: middle;
                    z-index: 100;
                    margin: 0 !important;
                }

                /* 电脑端触发按钮：半透磨砂质感 */
                @media (min-width: 769px) {
                    .extPlayerTriggerBtn {
                        cursor: pointer !important;
                        user-select: none !important;
                        outline: none !important;
                        border: none !important; /* 彻底移除多余边框，与原生主播放键完全统一 */
                        box-shadow: none !important;
                        margin: 0 !important;
                        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), filter 0.2s ease !important;
                    }
                    .extPlayerTriggerBtn:hover {
                        filter: brightness(1.18) !important;
                        transform: scale(1.02);
                    }
                    .extPlayerTriggerBtn:active {
                        transform: scale(0.97);
                    }
                    .extPlayerDropdownWrap.is-active .extPlayerTriggerBtn {
                        filter: brightness(1.22) !important;
                    }
                }

                .extPlayerMainIcon {
                    font-size: 1.12em !important;
                    margin-right: 4px !important;
                    color: inherit !important;
                }

                .extPlayerArrowIcon {
                    font-size: 1.05em !important;
                    margin-left: 3px !important;
                    margin-right: 0 !important;
                    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
                    color: inherit !important;
                }

                .extPlayerDropdownWrap:hover .extPlayerArrowIcon,
                .extPlayerDropdownWrap.is-active .extPlayerArrowIcon {
                    transform: rotate(180deg) !important;
                }

                /* 下拉菜单面板 */
                .extPlayerMenu {
                    position: absolute;
                    top: calc(100% + 6px);
                    left: 0;
                    min-width: 175px;
                    background: rgba(18, 22, 30, 0.96) !important;
                    -webkit-backdrop-filter: blur(25px) saturate(180%) !important;
                    backdrop-filter: blur(25px) saturate(180%) !important;
                    border: 1px solid rgba(255, 255, 255, 0.14) !important;
                    border-radius: 12px !important;
                    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.06) !important;
                    padding: 6px !important;
                    z-index: 9999999 !important;
                    opacity: 0;
                    visibility: hidden;
                    transform: translateY(-6px) scale(0.97);
                    transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.2s;
                    pointer-events: none;
                    box-sizing: border-box !important;
                }

                .extPlayerDropdownWrap:hover .extPlayerMenu,
                .extPlayerDropdownWrap.is-active .extPlayerMenu {
                    opacity: 1;
                    visibility: visible;
                    transform: translateY(0) scale(1);
                    pointer-events: auto;
                }

                .extPlayerMenuHeader {
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 1px;
                    color: rgba(255, 255, 255, 0.45);
                    padding: 6px 10px 4px 10px;
                    text-transform: uppercase;
                    user-select: none;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                    margin-bottom: 4px;
                }

                .extPlayerMenuList {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .extPlayerMenuItem {
                    display: flex !important;
                    align-items: center !important;
                    gap: 9px !important;
                    padding: 8px 12px !important;
                    border-radius: 8px !important;
                    cursor: pointer !important;
                    color: rgba(255, 255, 255, 0.88) !important;
                    font-size: 13.5px !important;
                    font-weight: 500 !important;
                    transition: all 0.18s ease !important;
                    user-select: none !important;
                    background: transparent !important;
                    border: none !important;
                    outline: none !important;
                    width: 100% !important;
                    text-align: left !important;
                    box-sizing: border-box !important;
                }

                .extPlayerMenuItem:hover {
                    background: rgba(0, 209, 178, 0.18) !important;
                    color: #00d1b2 !important;
                    transform: translateX(3px);
                }

                .extPlayerMenuItem:active {
                    transform: scale(0.97);
                }

                .extPlayerItemIcon {
                    font-size: 14px !important;
                    width: 16px !important;
                    height: 16px !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    color: inherit !important;
                }

                .extPlayerItemText {
                    font-size: 13.5px !important;
                    white-space: nowrap !important;
                    color: inherit !important;
                }

                /* 移动端操作栏布局 */
                @media (max-width: 768px) {
                    .mainDetailButtons {
                        display: flex !important;
                        flex-direction: row !important;
                        flex-wrap: wrap !important;
                        align-items: center !important;
                        gap: 10px 8px !important;
                    }

                    .mainDetailButtons .btnPlay.raised,
                    .mainDetailButtons .btnResume.raised {
                        flex: 1 1 auto !important;
                        min-width: 0 !important;
                        margin: 0 !important;
                    }

                    .mainDetailButtons .extPlayerDropdownWrap {
                        flex: 0 0 auto !important;
                        margin: 0 !important;
                    }

                    /* 手机端外部播放按钮：半透深色磨砂质感（绝非纯白），圆角与高度精准匹配主播放键，紧凑小巧 */
                    .extPlayerTriggerBtn {
                        border: none !important; /* 消除多余边框 */
                        box-shadow: none !important;
                        margin: 0 !important;
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

                    .extPlayerMenu {
                        min-width: 165px !important;
                        padding: 6px !important;
                        border-radius: 12px !important;
                    }

                    .extPlayerMenuItem {
                        padding: 10px 14px !important;
                        font-size: 14px !important;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // Build dropdown menu items
        let menuItemsHtml = "";
        playBtns.forEach(btn => {
            const shouldHide = btn.osCheck && !btn.osCheck.some(check => check());
            if (!shouldHide) {
                menuItemsHtml += `
                    <div id="${btn.id}" class="extPlayerMenuItem" title="${btn.desc || btn.title}">
                        <i class="md-icon md-icon-fill extPlayerItemIcon">&#xe037;</i>
                        <span class="extPlayerItemText">${btn.title}</span>
                    </div>
                `;
            }
        });

        if (!menuItemsHtml) return;

        // Dropdown component HTML with responsive line-break
        const dropdownHtml = `
            <div id="extPlayerDropdownWrap" class="extPlayerDropdownWrap">
                <button id="extPlayerTriggerBtn" is="emby-button" type="button" class="raised detailButton detailButton-primary emby-button emby-button-backdropfilter raised-backdropfilter extPlayerTriggerBtn" title="第三方播放器">
                    <div class="detailButton-content">
                        <i class="md-icon md-icon-fill button-icon button-icon-left autortl extPlayerMainIcon">&#xe037;</i>
                        <span class="button-text">外部播放</span>
                        <i class="md-icon button-icon extPlayerArrowIcon">&#xe5cf;</i>
                    </div>
                </button>
                <div id="extPlayerMenu" class="extPlayerMenu">
                    <div class="extPlayerMenuHeader">选择播放器</div>
                    <div class="extPlayerMenuList">
                        ${menuItemsHtml}
                    </div>
                </div>
            </div>
            <div id="extPlayerLineBreak" class="extPlayerLineBreak"></div>
        `;

        // Locate primary play / resume button
        let targetBtn = mainDetailButtons.querySelector(".btnPlay:not(.hide)") || 
                        mainDetailButtons.querySelector(".btnResume:not(.hide)") || 
                        mainDetailButtons.querySelector(".btnPlay") || 
                        mainDetailButtons.querySelector(".btnResume");

        if (targetBtn) {
            targetBtn.insertAdjacentHTML("afterend", dropdownHtml);
        } else {
            mainDetailButtons.insertAdjacentHTML("afterbegin", dropdownHtml);
        }

        const wrap = document.getElementById("extPlayerDropdownWrap");
        const triggerBtn = document.getElementById("extPlayerTriggerBtn");

        // Bind click events on each player option
        playBtns.forEach(btn => {
            const btnEle = document.querySelector(`#${btn.id}`);
            if (btnEle) {
                btnEle.onclick = function (e) {
                    e.stopPropagation();
                    if (wrap) wrap.classList.remove("is-active");
                    btn.onClick(e);
                };
            }
        });

        // Toggle dropdown on mobile touch or button click
        if (triggerBtn) {
            triggerBtn.onclick = function (e) {
                e.stopPropagation();
                if (wrap) wrap.classList.toggle("is-active");
            };
        }

        // Close dropdown when clicking outside
        document.addEventListener("click", function (e) {
            if (wrap && !wrap.contains(e.target)) {
                wrap.classList.remove("is-active");
            }
        });
    }

    function getIconsExt () {
        // base64 data total size 72.5 KB from embyWebAddExternalUrl/icons/min, sync modify
        const iconsExt = [];
        return iconsExt;
    }

    async function getItemInfo () {
        let userId = ApiClient._serverInfo.UserId;
        let itemId = /\?id=([A-Za-z0-9]+)/.exec(window.location.hash)[1];
        let response = await ApiClient.getItem(userId, itemId);
        // 继续播放当前剧集的下一集
        if (response.Type == "Series") {
            let seriesNextUpItems = await ApiClient.getNextUpEpisodes({ SeriesId: itemId, UserId: userId });
            if (seriesNextUpItems.Items.length > 0) {
                console.log("nextUpItemId: " + seriesNextUpItems.Items[0].Id);
                return await ApiClient.getItem(userId, seriesNextUpItems.Items[0].Id);
            }
        }
        // 播放当前季season的第一集
        if (response.Type == "Season") {
            let seasonItems = await ApiClient.getItems(userId, { parentId: itemId });
            console.log("seasonItemId: " + seasonItems.Items[0].Id);
            return await ApiClient.getItem(userId, seasonItems.Items[0].Id);
        }
        // 播放当前集或电影
        if (response.MediaSources?.length > 0) {
            console.log("itemId:  " + itemId);
            return response;
        }
        // 默认播放第一个,集/播放列表第一个媒体
        let firstItems = await ApiClient.getItems(userId, { parentId: itemId, Recursive: true, IsFolder: false, Limit: 1 });
        console.log("firstItemId: " + firstItems.Items[0].Id);
        return await ApiClient.getItem(userId, firstItems.Items[0].Id);
    }

    function getSeek (position) {
        let ticks = position * 10000;
        let parts = []
            , hours = ticks / 36e9;
        (hours = Math.floor(hours)) && parts.push(hours);
        let minutes = (ticks -= 36e9 * hours) / 6e8;
        ticks -= 6e8 * (minutes = Math.floor(minutes)),
            minutes < 10 && hours && (minutes = "0" + minutes),
            parts.push(minutes);
        let seconds = ticks / 1e7;
        return (seconds = Math.floor(seconds)) < 10 && (seconds = "0" + seconds),
            parts.push(seconds),
            parts.join(":")
    }

    function getSubPath (mediaSource) {
        let selectSubtitles = document.querySelector(selectors.selectSubtitles);
        let subTitlePath = '';
        //返回选中的外挂字幕
        if (selectSubtitles && selectSubtitles.value > 0) {
            let SubIndex = mediaSource.MediaStreams.findIndex(m => m.Index == selectSubtitles.value && m.IsExternal);
            if (SubIndex > -1) {
                let subtitleCodec = mediaSource.MediaStreams[SubIndex].Codec;
                subTitlePath = `/${mediaSource.Id}/Subtitles/${selectSubtitles.value}/Stream.${subtitleCodec}`;
            }
        }
        else {
            //默认尝试返回第一个外挂中文字幕
            let chiSubIndex = mediaSource.MediaStreams.findIndex(m => m.Language == "chi" && m.IsExternal);
            if (chiSubIndex > -1) {
                let subtitleCodec = mediaSource.MediaStreams[chiSubIndex].Codec;
                subTitlePath = `/${mediaSource.Id}/Subtitles/${chiSubIndex}/Stream.${subtitleCodec}`;
            } else {
                //尝试返回第一个外挂字幕
                let externalSubIndex = mediaSource.MediaStreams.findIndex(m => m.IsExternal);
                if (externalSubIndex > -1) {
                    let subtitleCodec = mediaSource.MediaStreams[externalSubIndex].Codec;
                    subTitlePath = `/${mediaSource.Id}/Subtitles/${externalSubIndex}/Stream.${subtitleCodec}`;
                }
            }

        }
        return subTitlePath;
    }

    async function getEmbyMediaInfo () {
        let itemInfo = await getItemInfo();
        let mediaSourceId = itemInfo.MediaSources[0].Id;
        let selectSource = document.querySelector(selectors.selectSource);
        if (selectSource && selectSource.value.length > 0) {
            mediaSourceId = selectSource.value;
        }
        // let selectAudio = document.querySelector("div[is='emby-scroller']:not(.hide) select.selectAudio:not([disabled])");
        const accessToken = ApiClient.accessToken();
        let mediaSource = itemInfo.MediaSources.find(m => m.Id == mediaSourceId);
        let uri = isEmby ? "/emby/videos" : "/Items";
        let baseUrl = `${ApiClient._serverAddress}${uri}/${itemInfo.Id}`;
        let subPath = getSubPath(mediaSource);
        let subUrl = subPath.length > 0 ? `${baseUrl}${subPath}?api_key=${accessToken}` : "";
        let streamUrl = `${baseUrl}/`;
        if (mediaSource.Path.startsWith("http") && localStorage.getItem(lsKeys.strmDirect) === "1") {
            streamUrl = decodeURIComponent(mediaSource.Path);
        } else {
            let fileName = mediaSource.IsInfiniteStream ? `master.m3u8` : decodeURIComponent(mediaSource.Path.replace(fileNameReg, ""));
            if (isEmby) {
                if (mediaSource.IsInfiniteStream) {
                    streamUrl += useRealFileName && mediaSource.Name ? `${mediaSource.Name}.m3u8` : fileName;
                } else {
                    // origin link: /emby/videos/401929/stream.xxx?xxx
                    // modify link: /emby/videos/401929/stream/xxx.xxx?xxx
                    // this is not important, hit "/emby/videos/401929/" path level still worked
                    streamUrl += useRealFileName ? `stream/${fileName}` : `stream.${mediaSource.Container}`;
                }
            } else {
                streamUrl += `Download`;
                streamUrl += useRealFileName ? `/${fileName}` : "";
            }
            streamUrl += `?api_key=${accessToken}&Static=true&MediaSourceId=${mediaSourceId}&DeviceId=${ApiClient._deviceId}`;
        }
        let position = parseInt(itemInfo.UserData.PlaybackPositionTicks / 10000);
        let intent = await getIntent(mediaSource, position);
        console.log(streamUrl, subUrl, intent);
        return {
            streamUrl: streamUrl,
            subUrl: subUrl,
            intent: intent,
        }
    }

    async function getIntent (mediaSource, position) {
        // 直播节目查询items接口没有path
        let title = mediaSource.IsInfiniteStream
            ? mediaSource.Name
            : decodeURIComponent(mediaSource.Path.replace(fileNameReg, ""));
        let externalSubs = mediaSource.MediaStreams.filter(m => m.IsExternal == true);
        let subs = ''; // 要求是android.net.uri[] ?
        let subs_name = '';
        let subs_filename = '';
        let subs_enable = '';
        if (externalSubs) {
            subs_name = externalSubs.map(s => s.DisplayTitle);
            subs_filename = externalSubs.map(s => s.Path.split('/').pop());
        }
        return {
            title: title,
            position: position,
            subs: subs,
            subs_name: subs_name,
            subs_filename: subs_filename,
            subs_enable: subs_enable
        };
    }

    // URL with "intent" scheme only support
    // String => 'S'
    // Boolean =>'B'
    // Byte => 'b'
    // Character => 'c'
    // Double => 'd'
    // Float => 'f'
    // Integer => 'i'
    // Long => 'l'
    // Short => 's'

    async function embyPot () {
        const mediaInfo = await getEmbyMediaInfo();
        const intent = mediaInfo.intent;
        const notCurrentPotArg = localStorage.getItem(lsKeys.notCurrentPot) === "1" ? "" : "/current";
        let subArg = mediaInfo.subUrl ? `/sub=${encodeURI(mediaInfo.subUrl)} ` : "";
        let potUrl = `potplayer://${encodeURI(mediaInfo.streamUrl)} ${subArg}${notCurrentPotArg} /seek=${getSeek(intent.position)} /title="${intent.title}"`;
        console.log("正在直链唤醒 PotPlayer: ", potUrl);
        window.open(potUrl, "_self");
    }

    async function embyVlc () {
        let mediaInfo = await getEmbyMediaInfo();
        let intent = mediaInfo.intent;
        // android subtitles:  https://code.videolan.org/videolan/vlc-android/-/issues/1903
        let vlcUrl = `intent:${encodeURI(mediaInfo.streamUrl)}#Intent;package=org.videolan.vlc;type=video/*;S.subtitles_location=${encodeURI(mediaInfo.subUrl)};S.title=${encodeURI(intent.title)};i.position=${intent.position};end`;
        if (OS.isWindows()) {
            // 桌面端需要额外设置,参考这个项目:
            // new: https://github.com/northsea4/vlc-protocol
            // old: https://github.com/stefansundin/vlc-protocol
            vlcUrl = `vlc://${encodeURI(mediaInfo.streamUrl)}`;
        }
        if (OS.isIOS()) {
            // https://wiki.videolan.org/Documentation:IOS/#x-callback-url
            // https://code.videolan.org/videolan/vlc-ios/-/commit/55e27ed69e2fce7d87c47c9342f8889fda356aa9
            vlcUrl = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(mediaInfo.streamUrl)}&sub=${encodeURIComponent(mediaInfo.subUrl)}`;
        }
        console.log(vlcUrl);
        window.open(vlcUrl, "_self");
    }

    // https://github.com/iina/iina/issues/1991
    async function embyIINA () {
        let mediaInfo = await getEmbyMediaInfo();
        let iinaUrl = `iina://weblink?url=${encodeURIComponent(mediaInfo.streamUrl)}&new_window=1`;
        console.log(`iinaUrl= ${iinaUrl}`);
        window.open(iinaUrl, "_self");
    }

    // https://sites.google.com/site/mxvpen/api
    // https://mx.j2inter.com/api
    // https://support.mxplayer.in/support/solutions/folders/43000574903
    async function embyMX () {
        const mediaInfo = await getEmbyMediaInfo();
        const intent = mediaInfo.intent;
        // mxPlayer free
        const packageName = "com.mxtech.videoplayer.ad";
        const url = `intent:${encodeURI(mediaInfo.streamUrl)}#Intent;package=${packageName};S.title=${encodeURI(intent.title)};i.position=${intent.position};end`;
        console.log(url);
        window.open(url, "_self");
    }

    async function embyMXPro () {
        const mediaInfo = await getEmbyMediaInfo();
        const intent = mediaInfo.intent;
        // mxPlayer Pro
        const packageName = "com.mxtech.videoplayer.pro";
        const url = `intent:${encodeURI(mediaInfo.streamUrl)}#Intent;package=${packageName};S.title=${encodeURI(intent.title)};i.position=${intent.position};end`;
        console.log(url);
        window.open(url, "_self");
    }

    async function embyNPlayer () {
        let mediaInfo = await getEmbyMediaInfo();
        let nUrl = OS.isMacOS()
            ? `nplayer-mac://weblink?url=${encodeURIComponent(mediaInfo.streamUrl)}&new_window=1`
            : `nplayer-${encodeURI(mediaInfo.streamUrl)}`;
        console.log(nUrl);
        window.open(nUrl, "_self");
    }

    async function embyInfuse () {
        let mediaInfo = await getEmbyMediaInfo();
        // sub 参数限制: 播放带有外挂字幕的单个视频文件（Infuse 7.6.2 及以上版本）
        // see: https://support.firecore.com/hc/zh-cn/articles/215090997
        let infuseUrl = `infuse://x-callback-url/play?url=${encodeURIComponent(mediaInfo.streamUrl)}&sub=${encodeURIComponent(mediaInfo.subUrl)}`;
        console.log(`infuseUrl= ${infuseUrl}`);
        window.open(infuseUrl, "_self");
    }

    // StellarPlayer
    async function embyStellarPlayer () {
        let mediaInfo = await getEmbyMediaInfo();
        let stellarPlayerUrl = `stellar://play/${encodeURI(mediaInfo.streamUrl)}`;
        console.log(`stellarPlayerUrl= ${stellarPlayerUrl}`);
        window.open(stellarPlayerUrl, "_self");
    }

    // 智能获取播放列表与剧集信息（核心支持：剧集单集 Episode、整季 Season、整部剧 Series 全覆盖拉取列表！）
    async function getPlaylistInfo () {
        let itemInfo = await getItemInfo();
        const accessToken = ApiClient.accessToken();
        const deviceId = ApiClient._deviceId;
        const serverAddress = ApiClient._serverAddress;

        let itemsToPlay = [];

        try {
            if (itemInfo.Type === "Episode" && itemInfo.SeriesId) {
                let query = {
                    SeasonId: itemInfo.SeasonId,
                    Fields: "MediaSources,Name,IndexNumber,ParentIndexNumber,SeasonName,SeriesName,Path"
                };
                let res = await ApiClient.getEpisodes(itemInfo.SeriesId, query);
                if (res && res.Items && res.Items.length > 0) {
                    let currentIdx = res.Items.findIndex(e => String(e.Id) === String(itemInfo.Id));
                    itemsToPlay = currentIdx !== -1 ? res.Items.slice(currentIdx) : res.Items;
                }
            } else if (itemInfo.Type === "Season" && itemInfo.SeriesId) {
                let query = {
                    SeasonId: itemInfo.Id,
                    Fields: "MediaSources,Name,IndexNumber,ParentIndexNumber,SeasonName,SeriesName,Path"
                };
                let res = await ApiClient.getEpisodes(itemInfo.SeriesId, query);
                if (res && res.Items && res.Items.length > 0) {
                    itemsToPlay = res.Items;
                }
            } else if (itemInfo.Type === "Series") {
                let query = {
                    Fields: "MediaSources,Name,IndexNumber,ParentIndexNumber,SeasonName,SeriesName,Path"
                };
                let res = await ApiClient.getEpisodes(itemInfo.Id, query);
                if (res && res.Items && res.Items.length > 0) {
                    itemsToPlay = res.Items;
                }
            }
        } catch (e) {
            console.warn("Could not fetch episodes for playlist", e);
        }

        if (itemsToPlay.length === 0) {
            itemsToPlay = [itemInfo];
        }

        // 格式化每一集的清晰标题与直接串流链接
        let playlist = itemsToPlay.map(item => {
            let epTitle = "";
            if (item.Type === "Episode") {
                let sName = item.SeasonName || "";
                let epNum = item.IndexNumber ? `E${String(item.IndexNumber).padStart(2, '0')}` : "";
                let sPrefix = item.SeriesName ? `${item.SeriesName} ` : "";
                epTitle = `${sPrefix}${sName} ${epNum} - ${item.Name}`.trim();
            } else {
                epTitle = item.Name;
            }

            let mediaSource = item.MediaSources && item.MediaSources[0];
            let mediaSourceId = mediaSource ? mediaSource.Id : item.Id;
            let container = mediaSource && mediaSource.Container ? mediaSource.Container : "mkv";
            let streamUrl = `${serverAddress}/emby/videos/${item.Id}/stream.${container}?api_key=${accessToken}&Static=true&MediaSourceId=${mediaSourceId}&DeviceId=${deviceId}`;

            return {
                id: item.Id,
                title: epTitle,
                streamUrl: streamUrl,
                rawItem: item
            };
        });

        // 生成标准 M3U 播放列表格式内容
        let m3uText = "#EXTM3U\n";
        playlist.forEach(item => {
            m3uText += `#EXTINF:-1,${item.title}\n${item.streamUrl}\n`;
        });

        return {
            currentItem: playlist[0],
            playlist: playlist,
            m3uText: m3uText,
            itemInfo: itemInfo
        };
    }

    // MPV：直接直链唤醒播放器（绝不触发浏览器下载，零剪贴板篡改，秒点秒开）
    async function embyMPV () {
        let info = await getPlaylistInfo();
        let current = info.currentItem;

        // 标准 URL-Safe Base64 编码直链与标题
        let streamUrl64 = btoa(unescape(encodeURIComponent(current.streamUrl)))
            .replace(/\//g, "_").replace(/\+/g, "-").replace(/\=/g, "");

        let title64 = btoa(unescape(encodeURIComponent(current.title)))
            .replace(/\//g, "_").replace(/\+/g, "-").replace(/\=/g, "");

        let subParam = "";
        if (current.subUrl && current.subUrl.length > 0) {
            let subUrl64 = btoa(unescape(encodeURIComponent(current.subUrl)))
                .replace(/\//g, "_").replace(/\+/g, "-").replace(/\=/g, "");
            subParam = "&subfile=" + subUrl64;
        }

        let MPVUrl = `mpv://play/${streamUrl64}/?v_title=${title64}${subParam}`;
        if (OS.isIOS() || OS.isAndroid()) {
            MPVUrl = `mpv://${encodeURI(current.streamUrl)}`;
        }

        console.log("正在唤醒 MPV: ", MPVUrl);
        const a = document.createElement("a");
        a.href = MPVUrl;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 1000);
    }

    async function embyDDPlay () {
        // 检查是否windows本地路径
        const fullPathEle = document.querySelector(".mediaSources .mediaSource .sectionTitle > div:not([class]):first-child");
        let fullPath = fullPathEle ? fullPathEle.innerText : "";
        let ddplayUrl;
        if (new RegExp('^[a-zA-Z]:').test(fullPath)) {
            ddplayUrl = `ddplay:${encodeURIComponent(fullPath)}`;
        } else {
            console.log("文件路径不是本地路径,将使用串流播放");
            const mediaInfo = await getEmbyMediaInfo();
            const intent = mediaInfo.intent;
            if (!fullPath) {
                fullPath = intent.title;
            }
            const urlPart = mediaInfo.streamUrl + `|filePath=${fullPath}`;
            ddplayUrl = `ddplay:${encodeURIComponent(urlPart)}`;
            if (OS.isAndroid()) {
                // Subtitles Not Supported: https://github.com/kaedei/dandanplay-libraryindex/blob/master/api/ClientProtocol.md
                ddplayUrl = `intent:${encodeURI(urlPart)}#Intent;package=com.xyoye.dandanplay;type=video/*;end`;
            }
        }
        console.log(`ddplayUrl= ${ddplayUrl}`);
        window.open(ddplayUrl, "_self");
    }

    async function embyFileball () {
        const mediaInfo = await getEmbyMediaInfo();
        // see: app 关于, URL Schemes
        const url = `filebox://play?url=${encodeURIComponent(mediaInfo.streamUrl)}`;
        console.log(`FileballUrl= ${url}`);
        window.open(url, "_self");
    }

    async function embyOmniPlayer () {
        const mediaInfo = await getEmbyMediaInfo();
        // see: https://github.com/AlistGo/alist-web/blob/main/src/pages/home/previews/video_box.tsx
        const url = `omniplayer://weblink?url=${encodeURIComponent(mediaInfo.streamUrl)}`;
        console.log(`OmniPlayerUrl= ${url}`);
        window.open(url, "_self");
    }

    async function embyFigPlayer () {
        const mediaInfo = await getEmbyMediaInfo();
        // see: https://github.com/AlistGo/alist-web/blob/main/src/pages/home/previews/video_box.tsx
        const url = `figplayer://weblink?url=${encodeURIComponent(mediaInfo.streamUrl)}`;
        console.log(`FigPlayerUrl= ${url}`);
        window.open(url, "_self");
    }

    async function embySenPlayer () {
        const mediaInfo = await getEmbyMediaInfo();
        // see: app 关于, URL Schemes
        const url = `SenPlayer://x-callback-url/play?url=${encodeURIComponent(mediaInfo.streamUrl)}`;
        console.log(`SenPlayerUrl= ${url}`);
        window.open(url, "_self");
    }

    function lsCheckSetBoolean (event, lsKeyName) {
        let flag = localStorage.getItem(lsKeyName) === "1";
        if (event) {
            flag = !flag;
            localStorage.setItem(lsKeyName, flag ? "1" : "0");
        }
        return flag;
    }

    function hideByOSHandler (event) {
        const btn = document.getElementById("hideByOS");
        if (!btn) {
            return;
        }
        const flag = lsCheckSetBoolean(event, lsKeys.hideByOS);
        const playBtnsWrapper = document.getElementById(playBtnsWrapperId);
        const buttonEleArr = playBtnsWrapper.querySelectorAll("button");
        buttonEleArr.forEach(btnEle => {
            const btn = playBtns.find(btn => btn.id === btnEle.id);
            const shouldHide = flag && btn.osCheck && !btn.osCheck.some(check => check());
            console.log(`${btn.id} Should Hide: ${shouldHide}`);
            btnEle.style.display = shouldHide ? 'none' : 'block';
        });
        btn.classList.toggle("button-submit", flag);
    }

    function iconOnlyHandler (event) {
        const btn = document.getElementById("iconOnly");
        if (!btn) {
            return;
        }
        const flag = lsCheckSetBoolean(event, lsKeys.iconOnly);
        const playBtnsWrapper = document.getElementById(playBtnsWrapperId);
        const spans = playBtnsWrapper.querySelectorAll("span");
        spans.forEach(span => {
            span.hidden = flag;
        });
        const iArr = playBtnsWrapper.querySelectorAll("i");
        iArr.forEach(iEle => {
            iEle.classList.toggle("button-icon-left", !flag);
        });
        btn.classList.toggle("button-submit", flag);
    }

    function notCurrentPotHandler (event) {
        const btn = document.getElementById("notCurrentPot");
        if (!btn) {
            return;
        }
        const flag = lsCheckSetBoolean(event, lsKeys.notCurrentPot);
        btn.classList.toggle("button-submit", flag);
    }

    function strmDirectHandler (event) {
        const btn = document.getElementById("strmDirect");
        if (!btn) {
            return;
        }
        const flag = lsCheckSetBoolean(event, lsKeys.strmDirect);
        btn.classList.toggle("button-submit", flag);
    }

    async function embyCopyUrl () {
        const mediaInfo = await getEmbyMediaInfo();
        const streamUrl = encodeURI(mediaInfo.streamUrl);
        if (await writeClipboard(streamUrl)) {
            console.log(`copyUrl = ${streamUrl}`);
            this.innerText = '复制成功';
        }
    }

    async function writeClipboard (text) {
        let flag = false;
        if (navigator.clipboard) {
            // 火狐上 need https
            try {
                await navigator.clipboard.writeText(text);
                flag = true;
                console.log("成功使用 navigator.clipboard 现代剪切板实现");
            } catch (error) {
                console.error('navigator.clipboard 复制到剪贴板时发生错误:', error);
            }
        } else {
            flag = writeClipboardLegacy(text);
            console.log("不存在 navigator.clipboard 现代剪切板实现,使用旧版实现");
        }
        return flag;
    }

    function writeClipboardLegacy (text) {
        let textarea = document.createElement('textarea');
        document.body.appendChild(textarea);
        textarea.style.position = 'absolute';
        textarea.style.clip = 'rect(0 0 0 0)';
        textarea.value = text;
        textarea.select();
        if (document.execCommand('copy', true)) {
            return true;
        }
        return false;
    }

    // emby/jellyfin CustomEvent
    // see: https://github.com/MediaBrowser/emby-web-defaultskin/blob/822273018b82a4c63c2df7618020fb837656868d/nowplaying/videoosd.js#L691
    // monitor dom changements
    function checkAndRunInit () {
        const isItemPage = window.location.hash.includes("!/item") || 
                           window.location.href.includes("/item?id=") ||
                           window.location.hash.includes("item?id=");
        if (!isItemPage) {
            const oldWrap = document.getElementById("extPlayerDropdownWrap");
            if (oldWrap) oldWrap.remove();
            return;
        }

        const activeView = document.querySelector(".view:not(.hide)") || document;

        // 演员人物页面排除
        const isPerson = !!activeView.querySelector(".birthDate:not(.hide)") || 
                         window.location.hash.toLowerCase().includes("type=person");
        if (isPerson) {
            const oldWrap = document.getElementById("extPlayerDropdownWrap");
            if (oldWrap) oldWrap.remove();
            return;
        }

        const mainBtns = activeView.querySelector(".mainDetailButtons");
        if (mainBtns && !mainBtns.querySelector("#extPlayerDropdownWrap")) {
            init();
        }
    }

    // 1. 立即执行
    checkAndRunInit();

    // 2. 路由生命周期事件监听（按需精准触发，绝无死循环，零 CPU 占用，彻底根除卡顿与闪烁！）
    document.addEventListener("viewbeforeshow", function (e) {
        if (isEmby === "") {
            isEmby = !!(e.detail && e.detail.contextPath);
        }
        checkAndRunInit();
        setTimeout(checkAndRunInit, 100);
        setTimeout(checkAndRunInit, 400);
    });

    document.addEventListener("viewshow", function (e) {
        checkAndRunInit();
        setTimeout(checkAndRunInit, 150);
        setTimeout(checkAndRunInit, 500);
    });

    // 3. 低频轻量守护：1秒一次检查，杜绝任何高频抢占 CPU
    setInterval(checkAndRunInit, 1000);

})();