/* ================================================================
   Emby_Plus Addon · 全站海报评分角标
   契约：EmbyPlus.defineAddon(id, label, config, factory, style)
   依赖：先加载宿主 Emby_Plus.js（提供 window.EmbyPlus 公共接口）
   ================================================================ */

EmbyPlus.defineAddon("poster-ratings", "全站海报评分角标", {
    enableGlobalPosterRatings: true,
}, function (host) {

    /* ---------------- 宿主能力别名 ---------------- */
    var CinemaHome = host;
    var $ = host.$;
    var DomList = host.DomList;
    var CommonUtils = host.CommonUtils;

    function initGlobalPosterRatings() {
        const appendRatingField = (query) => {
            if (!query) return;
            const needed = ["CommunityRating", "ProviderIds"];
            if (typeof query.Fields === "string") {
                needed.forEach(f => {
                    if (!query.Fields.includes(f)) query.Fields += "," + f;
                });
            } else if (Array.isArray(query.Fields)) {
                needed.forEach(f => {
                    if (!query.Fields.includes(f)) query.Fields.push(f);
                });
            } else if (query.Fields === undefined) {
                query.Fields = needed.join(",");
            }
        };

        const hookApiClientProto = (proto) => {
            if (!proto || proto._cinemaRatingHooked) return;
            proto._cinemaRatingHooked = true;

            const origGetLatestItems = proto.getLatestItems;
            if (typeof origGetLatestItems === "function") {
                proto.getLatestItems = function (options) {
                    appendRatingField(options);
                    return origGetLatestItems.apply(this, arguments);
                };
            }

            const origGetItems = proto.getItems;
            if (typeof origGetItems === "function") {
                proto.getItems = function (userId, options) {
                    if (typeof userId === "object" && !options) {
                        appendRatingField(userId);
                    } else {
                        appendRatingField(options);
                    }
                    return origGetItems.apply(this, arguments);
                };
            }

            const origGetNextUpEpisodes = proto.getNextUpEpisodes;
            if (typeof origGetNextUpEpisodes === "function") {
                proto.getNextUpEpisodes = function (options) {
                    appendRatingField(options);
                    return origGetNextUpEpisodes.apply(this, arguments);
                };
            }
        };

        const hookClient = (client) => {
            if (!client) return;
            if (client.constructor && client.constructor.prototype) {
                hookApiClientProto(client.constructor.prototype);
            }
            hookApiClientProto(client);
        };

        const applyCardBuilderHook = (cardBuilderModule) => {
            const cb = (cardBuilderModule && cardBuilderModule.default) || cardBuilderModule;
            if (!cb || cb._cinemaRatingHooked) return;
            cb._cinemaRatingHooked = true;

            const ensureRatingField = (options) => {
                if (!options) return;
                // 绝不无中生有覆盖为固定数组，仅在已有 options.fields 数组时补齐 CommunityRating
                if (Array.isArray(options.fields) && !options.fields.includes("CommunityRating")) {
                    options.fields.push("CommunityRating");
                }
            };

            const origSetListOptions = cb.setListOptions;
            if (typeof origSetListOptions === "function") {
                cb.setListOptions = function (items, options) {
                    ensureRatingField(options);
                    if (options && options.lines === 2) {
                        options.lines = 3;
                    }
                    return origSetListOptions.apply(this, arguments);
                };
            }

            const tagRatingSource = (items, container) => {
                if (!container || !Array.isArray(items)) return;
                const cards = container.querySelectorAll ? container.querySelectorAll(".card[data-id]") : [];
                cards.forEach(card => {
                    const id = card.getAttribute("data-id");
                    const it = items.find(x => String(x.Id || x.id) === String(id));
                    if (!it) return;
                    const pids = it.ProviderIds || {};
                    let source = null;
                    if (pids.Douban || pids.douban) source = "douban";
                    else if (pids.Imdb || pids.imdb) source = "imdb";
                    else if (pids.Tmdb || pids.tmdb) source = "tmdb";
                    if (source) {
                        const starEl = card.querySelector(".starRatingContainer");
                        if (starEl && !starEl.getAttribute("data-rating-source")) {
                            starEl.setAttribute("data-rating-source", source);
                        }
                    }
                });
            };

            const origBuildCards = cb.buildCards;
            if (typeof origBuildCards === "function") {
                cb.buildCards = function (items, options) {
                    ensureRatingField(options);
                    if (options && options.lines === 2) {
                        options.lines = 3;
                    }
                    const res = origBuildCards.apply(this, arguments);
                    try {
                        tagRatingSource(items, this.element || (options && options.parentContainer));
                    } catch (e) {
                    }
                    return res;
                };
            }

            const origGetItemsHtml = cb.getItemsHtml;
            if (typeof origGetItemsHtml === "function") {
                cb.getItemsHtml = function (items, options) {
                    ensureRatingField(options);
                    if (options && options.lines === 2) {
                        options.lines = 3;
                    }
                    return origGetItemsHtml.apply(this, arguments);
                };
            }
        };

        const hookListController = (lcModule) => {
            const lc = (lcModule && lcModule.default) || lcModule;
            if (!lc || !lc.prototype || lc.prototype._cinemaFieldsHooked) return;
            lc.prototype._cinemaFieldsHooked = true;

            const origGetViewSettings = lc.prototype.getViewSettings;
            if (origGetViewSettings) {
                lc.prototype.getViewSettings = function () {
                    const settings = origGetViewSettings.apply(this, arguments);
                    if (settings && settings.fields && Array.isArray(settings.fields)) {
                        if (!settings.fields.includes("CommunityRating")) {
                            settings.fields.push("CommunityRating");
                        }
                    }
                    return settings;
                };
            }

            const origGetSortByValue = lc.prototype.getSortByValue;
            if (origGetSortByValue) {
                lc.prototype.getSortByValue = function () {
                    const val = origGetSortByValue.apply(this, arguments);
                    if (!val || val === "SortName") {
                        return "PremiereDate,ProductionYear,SortName";
                    }
                    return val;
                };
            }

            const origGetSortValues = lc.prototype.getSortValues;
            if (origGetSortValues) {
                lc.prototype.getSortValues = function () {
                    const values = origGetSortValues.apply(this, arguments);
                    if (values && (values.sortBy === "PremiereDate,ProductionYear,SortName" || !values.sortBy)) {
                        values.sortOrder = values.sortOrder || "Descending";
                    }
                    return values;
                };
            }
        };

        if (window.Emby && window.Emby.importModule) {
            window.Emby.importModule("./modules/cardbuilder/cardbuilder.js").then(applyCardBuilderHook).catch(() => {
            });
            window.Emby.importModule("./modules/tabbedview/listcontroller.js").then(hookListController).catch(() => {
            });
            window.Emby.importModule("./modules/emby-apiclient/connectionmanager.js").then((cmModule) => {
                const cm = (cmModule && cmModule.default) || cmModule;
                if (cm && cm.currentApiClient) hookClient(cm.currentApiClient());
            }).catch(() => {
            });
        }

        if (typeof require === "function") {
            try {
                require(["./modules/cardbuilder/cardbuilder.js"], applyCardBuilderHook);
            } catch (e) {
            }
            try {
                require(["modules/cardbuilder/cardbuilder.js"], applyCardBuilderHook);
            } catch (e) {
            }
            try {
                require(["cardBuilder"], applyCardBuilderHook);
            } catch (e) {
            }
            try {
                require(["./modules/tabbedview/listcontroller.js"], hookListController);
            } catch (e) {
            }
            try {
                require(["connectionManager"], (cmModule) => {
                    const cm = (cmModule && cmModule.default) || cmModule;
                    if (cm && cm.currentApiClient) hookClient(cm.currentApiClient());
                });
            } catch (e) {
            }
        }

        if (window.ConnectionManager) {
            hookClient(window.ConnectionManager.currentApiClient());
            if (window.Events) {
                window.Events.on(window.ConnectionManager, "apiclientcreated", (e, client) => hookClient(client));
            }
        }
        if (window.ApiClient) hookClient(window.ApiClient);

    }

    initGlobalPosterRatings.call(host);

}, `
/* 消除海报评分重复：若已有专属评分徽章，隐藏原生评分容器 */
.cardBox:has(.cinema-card-rating-badge) .starRatingContainer,
.cardBox:has(.cinema-rating-badge-tmdb) .starRatingContainer {
    display: none !important;
}

/* 豆瓣渠道专属评分徽章 */
.cardBox .starRatingContainer[data-rating-source="douban"] {
    border-color: rgba(0, 181, 29, 0.4) !important;
    color: #4ade80 !important;
}
.cardBox .starRatingContainer[data-rating-source="douban"]:not(:has(img))::before {
    content: "豆" !important;
    font-size: 10.5px !important;
    font-weight: 800 !important;
    color: #22c55e !important;
    margin-right: 3px !important;
}
.cardBox .starRatingContainer[data-rating-source="douban"] .starIcon {
    display: none !important;
}

/* IMDb 渠道专属评分徽章 */
.cardBox .starRatingContainer[data-rating-source="imdb"] {
    border-color: rgba(245, 197, 24, 0.4) !important;
    color: #fde047 !important;
}
.cardBox .starRatingContainer[data-rating-source="imdb"]:not(:has(img))::before {
    content: "IMDb" !important;
    font-size: 9.5px !important;
    font-weight: 800 !important;
    color: #f5c518 !important;
    margin-right: 3px !important;
    letter-spacing: -0.5px !important;
}
.cardBox .starRatingContainer[data-rating-source="imdb"] .starIcon {
    display: none !important;
}

/* TMDB 渠道专属评分徽章 */
.cardBox .starRatingContainer[data-rating-source="tmdb"] {
    border-color: rgba(1, 180, 228, 0.4) !important;
    color: #38bdf8 !important;
}
.cardBox .starRatingContainer[data-rating-source="tmdb"]:not(:has(img))::before {
    content: "TMDB" !important;
    font-size: 9px !important;
    font-weight: 800 !important;
    color: #01b4e4 !important;
    margin-right: 3px !important;
}
.cardBox .starRatingContainer[data-rating-source="tmdb"] .starIcon {
    display: none !important;
}

/* ================================================================
   模块 13：海报左上角评分徽章与右上角角标
   - 统一定位于海报图片左上角 (top: 8px, left: 8px, z-index: 25)
   - 右上角集数角标严格水平顶线对齐 (top: 8px, right: 8px, z-index: 25)
   - 升级翡翠绿半透明毛玻璃高质感
   - 详情页海报专属排除 (详情页元数据已有评分，海报不重复显示)
   ================================================================ */
.cardBox .starRatingContainer {
    position: absolute !important;
    top: 6px !important;
    left: 6px !important;
    z-index: 25 !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 3px !important;
    height: 20px !important;
    padding: 0 7px !important;
    box-sizing: border-box !important;
    border-radius: 9999px !important;
    background: rgba(0, 0, 0, 0.45) !important;
    backdrop-filter: blur(12px) saturate(180%) !important;
    -webkit-backdrop-filter: blur(12px) saturate(180%) !important;
    border: 1px solid rgba(255, 255, 255, 0.14) !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    line-height: 20px !important;
    color: rgba(255, 255, 255, 0.95) !important;
    pointer-events: none !important;
    white-space: nowrap !important;
    transition: opacity 0.2s ease !important;
}
.cardBox .starRatingContainer img {
    width: 13px !important;
    height: 13px !important;
    vertical-align: -1px !important;
    margin-right: 2px !important;
}
/* 多选激活时隐藏评分（所有设备） */
.card.item-multiselected .cardBox .starRatingContainer,
.multi-select-active .cardBox .starRatingContainer {
    opacity: 0 !important;
    pointer-events: none !important;
}
/* 鼠标悬停隐藏评分：仅限真实 hover 设备（桌面），手机端 tap 不触发 */
@media (hover: hover) {
    .card:hover .cardBox .starRatingContainer,
    .cardBox:hover .starRatingContainer {
        opacity: 0 !important;
        pointer-events: none !important;
    }
}
.cardBox .starRatingContainer .starIcon {
    font-size: 12px !important;
    width: 12px !important;
    height: 12px !important;
    line-height: 12px !important;
    color: #ffb800 !important;
    margin: 0 !important;
    padding: 0 !important;
    vertical-align: middle !important;
    display: inline-block !important;
}
`);
