/* ================================================================
   Emby_Plus Addon · 详情页 · 演职人员其他作品
   契约：EmbyPlus.defineAddon(id, label, config, factory, style)
   依赖：先加载宿主 Emby_Plus.js（提供 window.EmbyPlus 公共接口）
   ================================================================ */

EmbyPlus.defineAddon("person-works", "详情页 · 演职人员其他作品", {
    enablePersonWorks: true,
}, function (host) {

    /* ---------------- 宿主能力别名 ---------------- */
    var CinemaHome = host;
    var $ = host.$;
    var DomList = host.DomList;
    var CommonUtils = host.CommonUtils;
    var escapeHtml = host.escapeHtml;

    function initPersonWorks() {
        if (!this.config || !this.config.enablePersonWorks) return;

        let lastProcessedId = null;

        const processDetailPage = async () => {
            const activePage = document.querySelector(".view-item-item:not(.hide)") || document.querySelector(".itemView:not(.hide)");
            if (!activePage) return;

            const idMatch = location.href.match(/[?&]id=([A-Za-z0-9]+)/);
            const pageId = idMatch ? idMatch[1] : null;
            if (!pageId) return;

            const getApi = () => (typeof ApiClient !== "undefined" && ApiClient) || window.ApiClient || null;
            const api = getApi();
            if (!api) return;

            let cb = null;
            try {
                cb = (await require(["cardBuilder"]))[0];
            } catch (e) {
            }
            if (!cb || typeof cb.buildCards !== "function") return;
            let item = null;
            try {
                item = await CinemaHome.fetchDetailPageItem(pageId);
            } catch (e) {
                return;
            }

            if (lastProcessedId === pageId && activePage.querySelector(".actorMoreSection")) return;
            lastProcessedId = pageId;

            if (!item.People || !item.People.length) return;
            const userId = api.getCurrentUserId ? api.getCurrentUserId() : (api._serverInfo && api._serverInfo.UserId);

            activePage.querySelectorAll(".actorMoreSection").forEach(el => el.remove());

            const actors = item.People.filter(p => p.Type === "Actor");
            const director = item.People.find(p => p.Type === "Director");

            // 探测候选演职人员
            const targets = [];
            let foundActor = null;
            for (const a of actors.slice(0, 5)) {
                try {
                    const checkRes = await api.getItems(userId, {
                        Recursive: true,
                        IncludeItemTypes: "Movie,Series",
                        Fields: "PrimaryImageAspectRatio,ProductionYear,CommunityRating,PremiereDate",
                        SortBy: "PremiereDate,ProductionYear,SortName",
                        SortOrder: "Descending",
                        PersonIds: a.Id,
                        Limit: 100
                    });
                    let list = ((checkRes && checkRes.Items) || []).filter(m => m.Id !== item.Id);
                    const getYear = (m) => m.ProductionYear || (m.PremiereDate ? new Date(m.PremiereDate).getFullYear() : 0);
                    list.sort((x, y) => getYear(y) - getYear(x));
                    if (list.length >= 1) {
                        foundActor = {person: a, label: `${a.Name} 其他作品`, allMovies: list};
                        break;
                    }
                } catch (e) {
                }
            }
            if (foundActor) targets.push(foundActor);

            if (director && director.Id !== foundActor?.person?.Id) {
                try {
                    const dirRes = await api.getItems(userId, {
                        Recursive: true,
                        IncludeItemTypes: "Movie,Series",
                        Fields: "PrimaryImageAspectRatio,ProductionYear,CommunityRating,PremiereDate",
                        SortBy: "PremiereDate,ProductionYear,SortName",
                        SortOrder: "Descending",
                        PersonIds: director.Id,
                        Limit: 100
                    });
                    let list = ((dirRes && dirRes.Items) || []).filter(m => m.Id !== item.Id);
                    const getYear = (m) => m.ProductionYear || (m.PremiereDate ? new Date(m.PremiereDate).getFullYear() : 0);
                    list.sort((x, y) => getYear(y) - getYear(x));
                    if (list.length >= 1) {
                        targets.push({person: director, label: `${director.Name}（导演） 其他作品`, allMovies: list});
                    }
                } catch (e) {
                }
            }

            const aboutSection = activePage.querySelector(".aboutSection, .linksSection, .scenes, .similarSection");

            for (const target of targets) {
                if (!target.allMovies || !target.allMovies.length) continue;

                const section = document.createElement("div");
                section.className = "verticalSection verticalSection-cards actorMoreSection emby-scrollbuttons-scroller";
                section.style.cssText = "margin: 0 !important;";

                const titleH2 = document.createElement("h2");
                titleH2.className = "sectionTitle sectionTitle-cards padded-left padded-left-page padded-right";
                titleH2.style.cssText = "display: flex; align-items: center; justify-content: flex-start; gap: 14px; user-select: text; cursor: default;";

                const labelSpan = document.createElement("span");
                labelSpan.textContent = target.label;
                titleH2.appendChild(labelSpan);

                const BATCH_SIZE = 12;
                const hasMore = target.allMovies.length > BATCH_SIZE;
                let refreshBtn = null;
                if (hasMore) {
                    refreshBtn = document.createElement("button");
                    refreshBtn.type = "button";
                    refreshBtn.className = "emby-button actorMoreRefreshBtn";
                    refreshBtn.innerHTML = '<i class="md-icon">refresh</i><span>换一批</span>';
                    titleH2.appendChild(refreshBtn);
                }
                section.appendChild(titleH2);

                const scroller = document.createElement("div");
                scroller.setAttribute("is", "emby-scroller");
                scroller.className = "emby-scroller padded-top-focusscale padded-bottom-focusscale padded-left padded-left-page padded-right scrollX hiddenScrollX scrollFrameX";
                scroller.setAttribute("data-mousewheel", "false");
                scroller.setAttribute("data-focusscroll", "false");
                scroller.setAttribute("data-horizontal", "true");
                scroller.style.cssText = "overflow-x: auto; overflow-y: hidden;";

                const itemsContainer = document.createElement("div");
                itemsContainer.setAttribute("is", "emby-itemscontainer");
                itemsContainer.className = "scrollSlider focuscontainer-x itemsContainer focusable actorMoreItemsContainer scrollSliderX emby-scrollbuttons-scrollSlider";
                itemsContainer.setAttribute("data-focusabletype", "nearest");

                scroller.appendChild(itemsContainer);
                section.appendChild(scroller);

                if (aboutSection) {
                    aboutSection.insertAdjacentElement("beforebegin", section);
                } else {
                    activePage.appendChild(section);
                }
                const getYear = (m) => m.ProductionYear || (m.PremiereDate ? new Date(m.PremiereDate).getFullYear() : 0);
                let pool = [...target.allMovies];
                // 严格按上映时间从新到旧排序展示与刷新
                pool.sort((x, y) => getYear(y) - getYear(x));
                let offset = 0;

                const renderBatch = () => {
                    let batch;
                    if (pool.length <= BATCH_SIZE) {
                        batch = pool;
                    } else {
                        if (offset >= pool.length) {
                            offset = 0; // 轮换完毕后无缝回到最新作品
                        }
                        batch = pool.slice(offset, offset + BATCH_SIZE);
                        offset += BATCH_SIZE;
                    }
                    cb.buildCards(batch, {
                        itemsContainer: itemsContainer,
                        parentContainer: section,
                        shape: "auto",
                        scalable: true,
                        centerText: true,
                        fields: ["Name", "ProductionYear", "CommunityRating"],
                        overlayPlayButton: false,
                        overlayText: false,
                        cardLayout: false
                    });

                    // 移动端 App 交互增强：与日历/榜单对齐，显式代理点击进入详情与长按呼出菜单
                    itemsContainer.querySelectorAll(".card").forEach(card => {
                        const id = card.getAttribute("data-id");
                        if (!id) return;
                        const targetMovie = batch.find(m => String(m.Id) === String(id)) || {Id: id};

                        // 1. 点击直达影视详情页
                        card.addEventListener("click", (e) => {
                            // 排除点击多选复选框
                            if (e.target.closest(".chkItemSelectContainer")) return;
                            CinemaHome.showItem(id);
                        });

                        // 2. 移动端长按呼出原生上下文菜单 (ActionSheet)
                        let touchTimer = null;
                        let startX = 0;
                        let startY = 0;
                        card.addEventListener("touchstart", (e) => {
                            const touch = e.touches[0];
                            if (!touch) return;
                            startX = touch.clientX;
                            startY = touch.clientY;
                            clearTimeout(touchTimer);
                            touchTimer = setTimeout(async () => {
                                touchTimer = null;
                                try {
                                    if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(40);
                                    const itemContextMenu = (await require(["itemContextMenu"]))[0];
                                    const api = (typeof ApiClient !== "undefined" && ApiClient) || window.ApiClient;
                                    const user = api ? await api.getCurrentUser() : null;
                                    if (itemContextMenu) {
                                        itemContextMenu.show({
                                            items: [targetMovie],
                                            positionTo: card,
                                            user: user
                                        });
                                    }
                                } catch (err) {
                                }
                            }, 550);
                        }, {passive: true});

                        card.addEventListener("touchmove", (e) => {
                            const touch = e.touches[0];
                            if (!touch || !touchTimer) return;
                            if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) {
                                clearTimeout(touchTimer);
                                touchTimer = null;
                            }
                        }, {passive: true});

                        card.addEventListener("touchend", () => {
                            if (touchTimer) {
                                clearTimeout(touchTimer);
                                touchTimer = null;
                            }
                        });
                        card.addEventListener("touchcancel", () => {
                            if (touchTimer) {
                                clearTimeout(touchTimer);
                                touchTimer = null;
                            }
                        });
                    });
                    scroller.scrollLeft = 0;
                    if (scroller.scrollTo) scroller.scrollTo({left: 0, behavior: "instant"});
                };
                renderBatch();

                if (refreshBtn) {
                    refreshBtn.onclick = (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const icon = refreshBtn.querySelector("i");
                        if (icon) {
                            icon.style.transition = "transform 0.4s ease";
                            icon.style.transform = `rotate(${(parseInt(icon.dataset.rot || "0") + 360)}deg)`;
                            icon.dataset.rot = (parseInt(icon.dataset.rot || "0") + 360).toString();
                        }
                        renderBatch();
                    };
                }
            }
        };

        let timer = null;
        const onNav = () => {
            clearTimeout(timer);
            timer = setTimeout(processDetailPage, 400);
        };

        window.addEventListener("popstate", onNav);
        window.addEventListener("hashchange", onNav);
        document.addEventListener("viewshow", onNav);
        setTimeout(processDetailPage, 900);
    }

    initPersonWorks.call(host);

}, `
/* 演职人员正圆头像：容器高度严格约束为单行高度 (175px)，彻底防止 Emby 虚拟滚动计算出多行 */
.peopleSection .itemsContainer,
.peopleItemsContainer,
.peopleSection .scrollSlider,
.peopleSection .emby-scrollbuttons-scrollSlider {
    height: 175px !important;
    max-height: 175px !important;
    min-height: 175px !important;
    flex-wrap: nowrap !important;
    display: flex !important;
    overflow-x: auto !important;
    white-space: nowrap !important;
}

.peopleSection .card,
.peopleItemsContainer .card {
    flex-shrink: 0 !important;
    flex-grow: 0 !important;
    height: 170px !important;
}

/* ================================================================
   演职人员正圆头像横滑排版：强制单行横向滚动，绝对禁止折行
   ================================================================ */
.peopleSection .itemsContainer,
.peopleItemsContainer,
.peopleSection .scrollSlider,
.peopleSection .emby-scrollbuttons-scrollSlider {
    flex-wrap: nowrap !important;
    display: flex !important;
    overflow-x: auto !important;
    white-space: nowrap !important;
}

.peopleSection .card,
.peopleItemsContainer .card {
    flex-shrink: 0 !important;
    flex-grow: 0 !important;
}

/* ================================================================
   模块 12：演职人员相关作品联动与换一批微型胶囊按钮
   ================================================================ */
/* 演职人员相关作品卡片：严格遵循 Emby 原生规范，彻底杜绝换行与尺寸失真 */
.cinema-person-works-section,
.actorMoreSection {
    margin: 0 !important;
    padding-bottom: 12px !important;
}
.cinema-person-works-section .emby-scroller,
.actorMoreSection .emby-scroller {
    overflow-x: auto !important;
    overflow-y: hidden !important;
    -webkit-overflow-scrolling: touch !important;
    scrollbar-width: none !important;
    touch-action: pan-x !important;
}
/* 手机端详情页底部留白：保证最后一个板块（xxx 其他作品等）可完整滚出可视区，不被底部栏遮挡 */
@media (max-width: 41.99em) {
    .itemView.view-item-item {
        padding-bottom: 96px !important;
    }
    .actorMoreSection:last-of-type,
    .cinema-person-works-section:last-of-type {
        padding-bottom: 24px !important;
    }
}
/* 演职人员其他作品卡片*/
.actorMoreItemsContainer .card {
    cursor: pointer !important;
    touch-action: manipulation !important;
}
.actorMoreItemsContainer .card * {
    pointer-events: auto !important;
}
.actorMoreRefreshBtn {
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px !important;
    height: 22px !important;
    line-height: 22px !important;
    font-size: 11px !important;
    font-weight: 500 !important;
    padding: 0 8px !important;
    margin: 0 !important;
    background: rgba(255, 255, 255, 0.08) !important;
    border: 1px solid rgba(255, 255, 255, 0.16) !important;
    border-radius: 11px !important;
    color: rgba(255, 255, 255, 0.85) !important;
    text-decoration: none !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    vertical-align: middle !important;
    box-sizing: border-box !important;
}
.actorMoreRefreshBtn:hover {
    background: rgba(255, 255, 255, 0.18) !important;
    border-color: rgba(255, 255, 255, 0.32) !important;
    color: #ffffff !important;
    text-decoration: none !important;
    transform: scale(1.03);
}
.actorMoreRefreshBtn,
.actorMoreRefreshBtn * {
    text-decoration: none !important;
}
.actorMoreRefreshBtn .md-icon {
    font-size: 13px !important;
    width: 13px !important;
    height: 13px !important;
    line-height: 13px !important;
    color: #48c6ef !important;
}
.actorMoreRefreshBtn span {
    font-size: 11px !important;
    line-height: 1 !important;
    text-decoration: none !important;
}

/* ================================================================
   模块 05：演职人员正圆头像与排版居中规范
   ================================================================ */
/* 演职人员圆形头像与卡片 */
.peopleSection .card,
.peopleItemsContainer .card {
    width: 130px !important;
    flex: 0 0 130px !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: 170px !important;
    box-sizing: border-box !important;
}
.peopleSection .cardBox,
.peopleItemsContainer .cardBox {
    height: auto !important;
    min-height: 0 !important;
    padding: 6px 4px 6px 4px !important;
    margin: 0 auto !important;
    box-sizing: border-box !important;
    transition: background-color 0.2s ease, transform 0.2s ease !important;
}
.peopleSection .cardBox-bottompadded,
.peopleItemsContainer .cardBox-bottompadded {
    margin-bottom: 0 !important;
}
/* 分类卡片：评分及其空白占位行移出文档流；年份、标签等真实信息仍参与布局 */
.itemsContainer.vertical-wrap .cardBox > .cardText:has(> .cardMediaInfoItems:only-child):not(:has(> .cardMediaInfoItems > :not(.starRatingContainer, .mediaInfoCriticRating))) {
    position: absolute !important;
    top: 6px !important;
    left: 6px !important;
    z-index: 25;
    overflow: visible !important;
    padding: 0 !important;
    margin: 0 !important;
}
.itemsContainer.vertical-wrap .cardBox > .cardText > .cardMediaInfoItems > .starRatingContainer {
    position: static !important;
}
/* 播出季/合集等横向卡片行：空占位信息行（&nbsp;）不占据高度，保证同一行卡片高度完全一致 */
.cardBox > .cardText > .cardMediaInfoItems:not(:has(*)) {
    display: none !important;
}
/* 播出季卡片保持 Emby 原生尺寸与比例，不做任何覆盖（避免与原生宽高/按钮定位冲突） */

/* 手机端卡片副信息行（年份 / 连载状态）统一占一行高度：
   空占位也保留同样高度，避免个别卡片多出该行导致整行文字与后续板块错位 */
@media (max-width: 41.99em) {
    .cardBox > .cardText-secondary {
        min-height: 1.3em !important;
    }
}
.peopleSection .card:hover .cardBox,
.peopleSection .card:focus .cardBox,
.peopleItemsContainer .card:hover .cardBox {
    background-color: rgba(255, 255, 255, 0.08) !important;
    border-radius: 10px !important;
}
.peopleSection .cardScalable,
.peopleItemsContainer .cardScalable {
    border-radius: 50% !important;
    aspect-ratio: 1 / 1 !important;
    width: 110px !important;
    height: 110px !important;
    max-width: 110px !important;
    max-height: 110px !important;
    margin: 0 auto 6px auto !important;
    overflow: hidden !important;
    contain: none !important;
    -webkit-mask-image: -webkit-radial-gradient(white, black) !important;
    mask-image: radial-gradient(white, black) !important;
}
.peopleSection .cardPadder-portrait,
.peopleItemsContainer .cardPadder-portrait {
    aspect-ratio: 1 / 1 !important;
    width: 110px !important;
    height: 110px !important;
    padding-bottom: 0 !important;
    margin: 0 auto !important;
    border-radius: 50% !important;
}
/* 手机端：演职人员圆形头像整体缩小，单屏可容纳更多卡片 */
@media (max-width: 41.99em) {
    .peopleSection .card,
    .peopleItemsContainer .card {
        width: 92px !important;
        flex: 0 0 92px !important;
        max-height: 140px !important;
    }
    .peopleSection .cardBox,
    .peopleItemsContainer .cardBox {
        padding: 4px 2px !important;
    }
    .peopleSection .cardScalable,
    .peopleItemsContainer .cardScalable,
    .peopleSection .cardPadder-portrait,
    .peopleItemsContainer .cardPadder-portrait {
        width: 76px !important;
        height: 76px !important;
        max-width: 76px !important;
        max-height: 76px !important;
    }
}
.peopleSection .cardContent,
.peopleSection .cardImageContainer,
.peopleSection .coveredImage {
    border-radius: 50% !important;
    overflow: hidden !important;
    background-size: cover !important;
    background-position: center center !important;
    object-fit: cover !important;
}
.peopleSection .cardScalable img {
    border-radius: 50% !important;
    object-fit: cover !important;
    width: 100% !important;
    height: 100% !important;
}
/* 演职人员头像 */
.peopleSection .cardContent,
.peopleSection .cardContent-button,
.peopleSection .cardScalable,
.peopleSection .cardOverlayContainer,
.peopleItemsContainer .cardContent,
.peopleItemsContainer .cardContent-button,
.peopleItemsContainer .cardScalable,
.peopleItemsContainer .cardOverlayContainer {
    background: transparent !important;
    background-color: transparent !important;
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
    transform: none !important;
}
/* 演职人员头像内部图片保持正圆与纯净 */
.peopleSection .card:hover .cardScalable,
.peopleSection .card:focus .cardScalable,
.peopleItemsContainer .card:hover .cardScalable,
.peopleItemsContainer .card:focus .cardScalable {
    box-shadow: none !important;
    border: none !important;
    transform: none !important;
    background: transparent !important;
}
/* 演职人员文本居中排版 */
.peopleSection .cardText,
.peopleItemsContainer .cardText {
    text-align: center !important;
    margin-top: 6px !important;
}
.peopleSection .cardText-secondary,
.peopleItemsContainer .cardText-secondary {
    opacity: 0.72 !important;
    font-size: 0.88em !important;
    text-align: center !important;
}
/* 海报大图丰富元数据徽章 */
/* 附加徽章容器弹性排版 */
.cinema-banner .cinema-extra-meta-badges {
    display: inline-flex !important;
    align-items: center !important;
    gap: 8px !important;
    flex-wrap: wrap !important;
    vertical-align: middle !important;
}
/* 基础通用增强胶囊徽章 */
.cinema-banner .cinema-rich-badge {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 2px 7px !important;
    border-radius: 4px !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    line-height: 1.3 !important;
    letter-spacing: 0.2px !important;
    white-space: nowrap !important;
    color: #ffffff !important;
    background: rgba(255, 255, 255, 0.12) !important;
    border: 1px solid rgba(255, 255, 255, 0.18) !important;
    box-sizing: border-box !important;
    backdrop-filter: blur(8px) !important;
    transition: transform 0.2s ease, background-color 0.2s ease !important;
}
.cinema-banner .cinema-rich-badge:hover {
    transform: scale(1.05) !important;
}
`);
