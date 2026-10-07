/* ================================================================
   Emby_Plus Addon · 详情页 · MoviePilot 联动（订阅 / 网盘资源）
   契约：EmbyPlus.defineAddon(id, label, config, factory, style)
   依赖：先加载宿主 Emby_Plus.js（提供 window.EmbyPlus 公共接口）
   ================================================================ */

EmbyPlus.defineAddon("moviepilot", "详情页 · MoviePilot 联动（订阅 / 网盘资源）", {
    enableMoviePilot: true,
    moviePilotRequireAdmin: true,  // 默认需要管理员权限方可使用及配置 MP，允许配置为 false 放开给普通用户
    moviePilotUrl: "",  // 可在此直接配置 MoviePilot 地址
    moviePilotToken: "",  // 可在此直接配置 MoviePilot API Token
}, function (host) {

    /* 配置统一取自宿主 CINEMA_CONFIG */
    const CONFIG = host.config;

    /* ---------------- 宿主能力别名 ---------------- */
    var CinemaHome = host;
    var $ = host.$;
    var DomList = host.DomList;
    var CommonUtils = host.CommonUtils;
    var escapeHtml = host.escapeHtml;
    var formatBytes = host.formatBytes;
    var getTmdbImg = host.getTmdbImg;
    var showItem = host.showItem;

    async function getMoviePilotIdentity() {
        // 1. 若当前组件禁用则直接返回 null
        if (CONFIG.enableMoviePilot === false) return null;

        try {
            const api = window.ApiClient || (window.CinemaHome && typeof window.CinemaHome.getApiClient === "function" ? await window.CinemaHome.getApiClient() : null);
            if (!api || typeof api.getCurrentUser !== "function" || typeof api.getCurrentUserId !== "function") return null;

            const userId = api.getCurrentUserId();
            const serverId = typeof api.serverId === "function" ? api.serverId() : "server";
            if (!userId) return null;

            const user = await api.getCurrentUser();
            if (!user || String(user.Id) !== String(userId)) return null;

            // 2. 权限判断：默认需要管理员 (moviePilotRequireAdmin !== false)，配置为 false 则放开
            if (CONFIG.moviePilotRequireAdmin !== false) {
                const isAdmin = !!(user.Policy && user.Policy.IsAdministrator === true);
                if (!isAdmin) return null;
            }

            return `CINEMA_MP:${encodeURIComponent(serverId)}:${encodeURIComponent(userId)}`;
        } catch (e) {
            return null;
        }
    }

    function normalizeMoviePilotHost(value) {
        const url = new URL(value);
        if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("invalid-host");
        return url.href.replace(/\/+$/, "");
    }

    function moviePilotError(code, status = null) {
        const messages = {
            "mp-unavailable": "请以 Emby 管理员登录并配置 MoviePilot。",
            "mp-host-missing": "请填写 MoviePilot 地址。",
            "mp-mixed-content": "HTTPS 页面不能调用 HTTP MoviePilot，请改用 HTTPS 地址。",
            "mp-network": `网络请求失败，可能是连接、证书或 CORS 问题。请确认 MP 可达，并允许 ${window.location.origin} 的跨域请求及 OPTIONS、X-API-KEY、Content-Type。`,
            "mp-json": "响应不是有效 JSON，请核对 MoviePilot 地址。",
            "mp-response-format": "接口数据不匹配，请检查 MoviePilot 版本。",
            "mp-backend-rejected": "MoviePilot 拒绝了操作，请查看 MP 或插件日志。",
            "mp-unsupported-version": "无法识别 MoviePilot 版本，仅支持 V2/V3。",
            "mp-resource-format": "资源列表格式异常，请检查 CloudSubscribe 版本。",
            "mp-subscription-format": "订阅列表格式异常，请检查 MoviePilot 版本。",
            "mp-missing-identity": "缺少 TMDB ID，无法匹配订阅。",
            "mp-subscription-id": "缺少订阅 ID，请先到 MoviePilot 检查订阅记录。"
        };
        const httpHint = status === 401 || status === 403 ? "请检查 Token 或访问权限。"
            : status === 404 ? "请检查 MP 地址及插件接口。" : "请检查 MP 服务及反向代理。";
        const error = new Error(code === "mp-http" ? `HTTP ${status}：${httpHint}` : messages[code] || "MoviePilot 请求失败。");
        error.name = "CinemaMoviePilotError";
        error.code = code;
        return error;
    }

    function moviePilotErrorText(error) {
        return error && error.name === "CinemaMoviePilotError" ? error.message : "请求失败，请检查 MoviePilot 配置。";
    }

    async function getSafeMoviePilotConfig(expectedKey = null) {
        const storageKey = await getMoviePilotIdentity();
        if (!storageKey || (expectedKey && expectedKey !== storageKey)) {
            return {isAllowed: false, isConfigured: false};
        }
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || "null") || {};
            const host = (CONFIG.moviePilotUrl || saved.host || "").trim();
            const token = (CONFIG.moviePilotToken || saved.token || "").trim();
            if (host && token) {
                return {isAllowed: true, isConfigured: true, storageKey, host: normalizeMoviePilotHost(host), token};
            }
        } catch (e) {
        }
        return {isAllowed: true, isConfigured: false, storageKey};
    }

    async function moviePilotRequest(storageKey, path, body, responseType = "envelope") {
        const config = await getSafeMoviePilotConfig(storageKey);
        if (!config.isAllowed || !config.isConfigured) throw moviePilotError("mp-unavailable");
        if (!config.host) throw moviePilotError("mp-host-missing");
        if (window.location.protocol === "https:" && new URL(config.host).protocol === "http:") {
            throw moviePilotError("mp-mixed-content");
        }
        let response;
        try {
            response = await fetch(config.host + path, {
                method: body === undefined ? "GET" : "POST",
                headers: {"Content-Type": "application/json", "X-API-KEY": config.token},
                body: body === undefined ? undefined : JSON.stringify(body),
                credentials: "omit", redirect: "error", referrerPolicy: "no-referrer"
            });
        } catch (e) {
            throw moviePilotError("mp-network");
        }
        if (await getMoviePilotIdentity() !== storageKey) throw moviePilotError("mp-unavailable");
        if (!response.ok) throw moviePilotError("mp-http", response.status);
        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw moviePilotError(e instanceof SyntaxError ? "mp-json" : "mp-network");
        }
        if (await getMoviePilotIdentity() !== storageKey) throw moviePilotError("mp-unavailable");
        if (responseType === "list") {
            if (!Array.isArray(data)) throw moviePilotError("mp-response-format");
        } else {
            if (!data || typeof data.success !== "boolean") throw moviePilotError("mp-response-format");
            if (!data.success) throw moviePilotError("mp-backend-rejected");
        }
        return data;
    }

    async function getMoviePilotVersion(storageKey) {
        // 此处 token=moviepilot 是平台公开配置接口的固定参数，不是用户 API Token。
        const json = await moviePilotRequest(storageKey, "/api/v1/system/global?token=moviepilot");
        const match = /^v?([23])\./i.exec(json.data?.BACKEND_VERSION || "");
        if (!match) throw moviePilotError("mp-unsupported-version");
        return Number(match[1]);
    }

    async function openMoviePilotConfigDialog(storageKey) {
        const config = await getSafeMoviePilotConfig(storageKey);
        if (!config.isAllowed) return false;
        const overlay = document.createElement("div");
        overlay.className = "cinema-modal-overlay cinema-mp-overlay";
        overlay.innerHTML = `
				<form class="cinema-mp-config-form" role="dialog" aria-modal="true" aria-label="MoviePilot 本地配置">
					<h2>MoviePilot 本地配置</h2>
					<p>仅此浏览器，按服务器/管理员隔离；本地不加密，请勿在共享设备保存。</p>
					<label>MoviePilot 地址<input name="host" type="url" autocomplete="off" placeholder="http://192.168.1.2:3000"></label>
					<label>API Token<input name="token" type="password" required autocomplete="new-password" spellcheck="false"></label>
					<p class="cinema-mp-config-error" role="alert"></p>
					<div class="cinema-mp-config-actions">
						<button type="button" class="cinema-dialog-btn cinema-mp-config-clear">清除配置</button>
						<button type="button" class="cinema-dialog-btn cinema-mp-config-cancel">取消</button>
						<button type="submit" class="cinema-dialog-btn cinema-dialog-btn-primary">保存</button>
					</div>
				</form>`;
        const form = overlay.querySelector("form");
        const hostInput = form.elements.host;
        const tokenInput = form.elements.token;
        hostInput.value = config.host || "";
        tokenInput.value = config.token || "";
        const previousFocus = document.activeElement;
        return new Promise(resolve => {
            const close = changed => {
                tokenInput.value = "";
                overlay.remove();
                if (previousFocus && previousFocus.isConnected) previousFocus.focus();
                resolve(changed);
            };
            const save = async clear => {
                try {
                    if (await getMoviePilotIdentity() !== storageKey) {
                        close(false);
                        return;
                    }
                    if (!overlay.isConnected) return;
                    if (clear) localStorage.removeItem(storageKey);
                    else {
                        const host = normalizeMoviePilotHost(hostInput.value.trim());
                        const token = tokenInput.value.trim();
                        if (!token || /[\r\n]/.test(token)) throw new Error("invalid-config");
                        localStorage.setItem(storageKey, JSON.stringify({host, token}));
                    }
                    close(true);
                } catch (e) {
                    form.querySelector(".cinema-mp-config-error").textContent = e.name === "CinemaMoviePilotError" ? moviePilotErrorText(e) : "无法保存。请填写 HTTP(S) 地址（不含账号、查询参数或片段）及有效 Token，并允许浏览器本地存储。";
                }
            };
            form.addEventListener("submit", event => {
                event.preventDefault();
                void save(false);
            });
            form.querySelector(".cinema-mp-config-clear").addEventListener("click", () => {
                void save(true);
            });
            form.querySelector(".cinema-mp-config-cancel").addEventListener("click", () => close(false));
            bindCinemaDialogKeyboard(overlay, () => close(false));
            document.body.appendChild(overlay);
            hostInput.focus();
        });
    }

    function bindCinemaDialogKeyboard(overlay, close) {
        overlay.tabIndex = -1;
        overlay.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                close();
            } else if (event.key === "Tab") {
                const controls = Array.from(overlay.querySelectorAll("button:not(:disabled), a[href], input, select, [tabindex='0']"))
                    .filter(element => element.getClientRects().length);
                const first = controls[0], last = controls[controls.length - 1];
                if (first && document.activeElement === overlay) {
                    event.preventDefault();
                    (event.shiftKey ? last : first).focus();
                } else if (first && event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (last && !event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        });
    }

    async function openMoviePilotResourceDialog(item, storageKey) {
        if (!item) return;
        const config = await getSafeMoviePilotConfig(storageKey);
        if (!config.isAllowed || !config.isConfigured) throw moviePilotError("mp-unavailable");
        const tmdbId = item.id || item.tmdb_id;
        const rawTitle = item.title || item.name || "";
        const rawOriginalTitle = item.original_title || item.original_name || "";
        const isMovie = item.mediaType === "movie";
        const mpType = isMovie ? "movie" : "tv";
        const year = (item.release_date || item.first_air_date || "").slice(0, 4);

        const overlay = document.createElement("div");
        overlay.className = "cinema-modal-overlay cinema-mp-overlay";

        overlay.innerHTML = `
				<div class="cinema-mp-dialog-wrap" role="dialog" aria-modal="true" aria-label="MoviePilot 资源搜索">
					<div class="cinema-mp-header">
						<div class="cinema-mp-header-left">
							<svg style="width:20px;height:20px;fill:#60a5fa;" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
							<div class="cinema-mp-header-title" title="${escapeHtml(rawTitle)}">资源搜索：${escapeHtml(rawTitle)}</div>
						</div>
						<div class="cinema-mp-header-actions">
							<button type="button" class="cinema-dialog-btn cinema-mp-refresh-btn">
								<i class="md-icon" style="font-size:14px;margin-right:2px;">refresh</i>
								<span>刷新</span>
							</button>
							<button type="button" class="cinema-dialog-btn cinema-mp-dialog-close">关闭</button>
						</div>
					</div>

					<div class="cinema-mp-tabs-bar" aria-label="资源类型筛选" hidden></div>

					<div class="cinema-mp-body">
						<div class="cinema-mp-loading" role="status"><div class="cinema-spinner"></div><div>正在检索资源...</div></div>
					</div>
				</div>
			`;

        const previousFocus = document.activeElement;
        const closeMpDialog = () => {
            overlay.remove();
            if (previousFocus && previousFocus.isConnected) previousFocus.focus();
        };
        bindCinemaDialogKeyboard(overlay, closeMpDialog);
        overlay.querySelector(".cinema-mp-dialog-close").addEventListener("click", closeMpDialog);

        document.body.appendChild(overlay);
        overlay.querySelector(".cinema-mp-dialog-close").focus();

        const bodyContainer = overlay.querySelector(".cinema-mp-body");
        const tabsBar = overlay.querySelector(".cinema-mp-tabs-bar");

        let doSearchResources = null;
        const refreshBtn = overlay.querySelector(".cinema-mp-refresh-btn");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", () => {
                if (typeof doSearchResources === "function") doSearchResources(true);
            });
        }

        doSearchResources = async (forceRefresh = false) => {
            if (!overlay.isConnected || refreshBtn.disabled) return;
            refreshBtn.disabled = true;
            tabsBar.innerHTML = "";
            tabsBar.hidden = true;
            bodyContainer.innerHTML = '<div class="cinema-mp-loading" role="status"><div class="cinema-spinner"></div><div>正在检索资源...</div></div>';

            try {
                const json = await moviePilotRequest(storageKey, "/api/v1/plugin/CloudSubscribe/resource/search_resources", {
                    title: rawTitle,
                    original_title: rawOriginalTitle,
                    year,
                    media_type: mpType,
                    tmdb_id: tmdbId,
                    season: moviePilotSeason(item),
                    force_refresh: forceRefresh
                });
                if (!overlay.isConnected) return;
                const items = json.data && json.data.items;
                if (!Array.isArray(items) || items.some(it => !it || typeof it !== "object" || Array.isArray(it))) throw moviePilotError("mp-resource-format");
                if (items.length === 0) {
                    const noSources = Array.isArray(json.data.available_sources) && json.data.available_sources.length === 0;
                    bodyContainer.innerHTML = `<div class="cinema-mp-empty" role="status"><strong>${noSources ? "暂无可用搜索渠道" : "暂未检索到可用资源"}</strong><span>${noSources ? "请在 CloudSubscribe 检查渠道配置与账号。" : "可点击刷新重新检索，或在 CloudSubscribe 检查媒体与渠道配置。"}</span></div>`;
                    return;
                }

                // 搜索响应直接提供真实类型、渠道和目标网盘，无需第二次请求 UI 配置。
                const targetDrive = String(json.data.main_cloud_drive || "").toLowerCase();
                const resourceType = it => String(it.resource_type || it.pan_type || "unknown").toLowerCase();
                const sourceNames = new Map((Array.isArray(json.data.available_sources) ? json.data.available_sources : [])
                    .filter(source => source && typeof source.key === "string" && typeof source.name === "string")
                    .map(source => [source.key, source.name]));
                const typeNames = new Map((Array.isArray(json.data.resource_types) ? json.data.resource_types : [])
                    .filter(type => type && typeof type.value === "string" && typeof type.title === "string")
                    .map(type => [type.value, type.title]));
                const typeLabel = it => it.resource_type_name || typeNames.get(resourceType(it)) || resourceType(it);
                if (targetDrive) items.sort((a, b) => Number(resourceType(b) === targetDrive) - Number(resourceType(a) === targetDrive));

                const typeMap = new Map();
                typeMap.set("all", {name: "全部", count: items.length});
                items.forEach(it => {
                    const rt = resourceType(it);
                    if (!typeMap.has(rt)) typeMap.set(rt, {name: typeLabel(it), count: 0});
                    typeMap.get(rt).count++;
                });

                tabsBar.hidden = false;
                tabsBar.innerHTML = Array.from(typeMap.entries()).map(([k, val], idx) => `
						<button type="button" class="cinema-mp-type-tab${idx === 0 ? " is-active" : ""}" data-tab-key="${escapeHtml(k)}" aria-pressed="${idx === 0}">
							<span>${escapeHtml(val.name)}</span><span class="cinema-mp-tab-count">${val.count}</span>
						</button>
					`).join("");

                let activeTab = "all";
                const renderItems = () => {
                    bodyContainer.innerHTML = items.map((it, idx) => {
                        const rt = resourceType(it);
                        if (activeTab !== "all" && rt !== activeTab) return "";
                        const name = escapeHtml(it.title || it.name || "未命名资源");
                        const panClass = ["alipan", "quark", "115", "123", "magnet"].includes(rt) ? ` cinema-mp-pan-${rt}` : "";
                        const source = it.source_name || sourceNames.get(it.source) || it.source || it.channel;
                        const metadata = [];
                        const addMeta = (label, value, className = "cinema-mp-meta-value") => {
                            if ((typeof value === "string" && value.trim()) || (typeof value === "number" && Number.isFinite(value) && value >= 0)) {
                                const text = escapeHtml(label + value);
                                metadata.push(`<span class="${className}" title="${text}">${text}</span>`);
                            }
                        };
                        const rawSize = it.size;
                        const sizeBytes = typeof rawSize === "number" || (typeof rawSize === "string" && /^\d+(?:\.\d+)?$/.test(rawSize.trim())) ? Number(rawSize) : null;
                        const size = it.size_formatted || it.size_human || (sizeBytes !== null && Number.isFinite(sizeBytes) && sizeBytes >= 0
                            ? (sizeBytes === 0 ? "0 B" : CinemaHome.formatBytes(sizeBytes)) : rawSize);
                        addMeta("渠道：", source, "cinema-mp-source-badge");
                        addMeta("", size, "cinema-mp-size-badge");
                        addMeta("范围：", it.episode_range);
                        addMeta("字幕组：", it.fansub);
                        if (rt === "magnet") addMeta("做种：", it.seeders);
                        const tags = Array.isArray(it.tags) ? it.tags : typeof it.tags === "string" ? [it.tags] : [];
                        const tagHtml = [...new Set(tags.filter(tag => typeof tag === "string" && tag.trim()))]
                            .map(tag => `<span class="cinema-mp-quality-tag" title="${escapeHtml(tag)}">${escapeHtml(tag)}</span>`).join("");
                        return `<div class="cinema-mp-res-card">
                                <div class="cinema-mp-res-main">
                                    <div class="cinema-mp-res-line1"><span class="cinema-mp-pan-badge${panClass}" title="${escapeHtml(typeLabel(it))}">${escapeHtml(typeLabel(it))}</span><div class="cinema-mp-res-name" title="${name}">${name}</div></div>
                                    <div class="cinema-mp-res-line2"${metadata.length || tagHtml ? ' tabindex="0" aria-label="资源元数据，可横向滚动"' : ""}>${metadata.join("")}${tagHtml}</div>
                                </div>
                                <button type="button" class="cinema-mp-transfer-btn" data-res-idx="${idx}" aria-label="转存入库：${name}">转存入库</button>
                                <div class="cinema-mp-inline-error" role="alert" hidden></div>
                            </div>`;
                    }).join("");

                    bodyContainer.querySelectorAll(".cinema-mp-transfer-btn").forEach(btn => {
                        btn.addEventListener("click", async () => {
                            const resIdx = parseInt(btn.getAttribute("data-res-idx"), 10);
                            const targetRes = items[resIdx];
                            btn.disabled = true;
                            btn.textContent = "提交中...";
                            const rowError = btn.closest(".cinema-mp-res-card").querySelector(".cinema-mp-inline-error");
                            rowError.hidden = true;
                            rowError.textContent = "";
                            try {
                                await moviePilotRequest(storageKey, "/api/v1/plugin/CloudSubscribe/sync/manual", {
                                    media: {title: rawTitle, tmdb_id: tmdbId, media_type: mpType},
                                    resources: [targetRes]
                                });
                                btn.textContent = "已加入转存";
                                btn.style.background = "#3b82f6";
                            } catch (e) {
                                rowError.textContent = moviePilotErrorText(e);
                                rowError.hidden = false;
                                btn.disabled = false;
                                btn.textContent = "转存入库";
                            }
                        });
                    });
                };

                renderItems();

                tabsBar.querySelectorAll(".cinema-mp-type-tab").forEach(tabBtn => {
                    tabBtn.addEventListener("click", () => {
                        tabsBar.querySelectorAll(".cinema-mp-type-tab").forEach(b => {
                            b.classList.toggle("is-active", b === tabBtn);
                            b.setAttribute("aria-pressed", String(b === tabBtn));
                        });
                        activeTab = tabBtn.getAttribute("data-tab-key");
                        renderItems();
                    });
                });
            } catch (err) {
                if (!overlay.isConnected) return;
                tabsBar.hidden = true;
                bodyContainer.innerHTML = '<div class="cinema-mp-error-state" role="alert"><strong>资源检索未成功</strong><div class="cinema-mp-inline-error"></div></div>';
                bodyContainer.querySelector(".cinema-mp-inline-error").textContent = moviePilotErrorText(err);
            } finally {
                refreshBtn.disabled = false;
            }
        };
        doSearchResources(false);
    }

    function moviePilotSeason(item, missingInfo = null) {
        if (item.mediaType === "movie") return null;
        const code = String(item.epCode || "").match(/S(\d+)E/i);
        const value = item.season_number ?? item.season ?? (missingInfo && missingInfo.targetSeason) ?? (code ? code[1] : null);
        const season = Number(value);
        return value !== null && Number.isInteger(season) && season >= 0 ? season : null;
    }

    async function checkMoviePilotSubscription(storageKey, version, tmdbId, type, season) {
        if (!tmdbId) throw moviePilotError("mp-missing-identity");
        const json = await moviePilotRequest(storageKey, "/api/v1/subscribe/", undefined, version === 2 ? "list" : "envelope");
        const list = version === 2 ? json : json.data;
        if (!Array.isArray(list)) throw moviePilotError("mp-subscription-format");
        return list.find(sub => {
            if (!sub || sub.type !== type) return false;
            const matchesId = sub.media_source
                ? sub.media_source === "themoviedb" && String(sub.media_id) === String(tmdbId)
                : version === 2 && String(sub.tmdbid) === String(tmdbId);
            if (!matchesId) return false;
            return type === "电影" || season === null || (sub.season !== null && sub.season !== undefined && Number(sub.season) === season);
        }) || null;
    }

    const showDetailDialog = window.showDetailDialog = async function (item, inLibId = null, missingInfo = null) {
        if (!item) return;
        const tmdbId = item.id || item.tmdb_id;
        const backdropUrl = getTmdbImg(item.backdrop_path, "w1280");
        const posterUrl = getTmdbImg(item.poster_path, "w500");
        const rawTitle = item.title || item.name || "";
        const rawOriginalTitle = item.original_title || item.original_name || "";
        const title = escapeHtml(rawTitle);
        const originalTitle = escapeHtml(rawOriginalTitle);
        const year = (item.release_date || item.first_air_date || "").slice(0, 4);
        const rating = item.vote_average ? item.vote_average.toFixed(1) : "暂无";
        const overview = escapeHtml(item.overview || "暂无剧情简介。");
        const isMovie = item.mediaType === "movie";
        const typeName = isMovie ? "电影" : (item.isAnime ? "番剧" : "剧集");
        const mpType = isMovie ? "movie" : "tv";

        const mpConfig = await getSafeMoviePilotConfig();
        const subscriptionType = isMovie ? "电影" : "电视剧";
        const subscriptionSeason = moviePilotSeason(item, missingInfo);

        // 构建自研原生全景弹窗
        const overlay = document.createElement("div");
        overlay.className = "cinema-modal-overlay";

        const tmdbUrl = `https://www.themoviedb.org/${mpType}/${tmdbId}`;

        overlay.innerHTML = `
				<div class="cinema-detail-dialog-wrap" role="dialog" aria-modal="true" aria-label="${title}">
					<!-- 右上角悬浮关闭按钮 (统一桌面与移动端，释放底部空间) -->
					<button type="button" class="cinema-dialog-corner-close" aria-label="关闭">
						<svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
					</button>

					${backdropUrl ? `<div class="cinema-dialog-backdrop" style="background-image: url('${backdropUrl}');"></div>` : ""}
					<div class="cinema-dialog-body">
						<div class="cinema-dialog-header">
							${posterUrl ? `<div class="cinema-dialog-poster" style="background-image: url('${posterUrl}');"></div>` : ""}
							<div class="cinema-dialog-meta">
								<div class="cinema-dialog-title">${title}</div>
								${originalTitle && originalTitle !== title ? `<div class="cinema-dialog-sub">${originalTitle}</div>` : ""}
								<div class="cinema-dialog-chips">
									<span class="cinema-dialog-chip cinema-dialog-chip-gold">★ ${rating}</span>
									${year ? `<span class="cinema-dialog-chip">${year}</span>` : ""}
									<span class="cinema-dialog-chip">${typeName}</span>
									${item.network ? `<span class="cinema-dialog-chip">${escapeHtml(item.network)}</span>` : ""}
									<a class="cinema-dialog-chip cinema-dialog-chip-tmdbid" href="${tmdbUrl}" target="_blank" rel="noopener noreferrer" title="在 TMDB 查看原始页面" style="cursor:pointer;text-decoration:none;">TMDB #${tmdbId}</a>
									${inLibId ? (missingInfo && missingInfo.isMissing ? `<span class="cinema-dialog-chip cinema-dialog-chip-gold" style="color:#f59e0b!important;border-color:rgba(245,158,11,0.35)!important;background:rgba(245,158,11,0.15)!important;">${missingInfo.isCurrentSeasonInLibrary === false ? `第 ${missingInfo.targetSeason} 季未入库 (缺 ${missingInfo.totalMissingCount} 集)` : `已入库 (共缺 ${missingInfo.totalMissingCount} 集)`}</span>` : `<span class="cinema-dialog-chip" style="color:#10b981;border-color:rgba(16,185,129,0.3);background:rgba(16,185,129,0.1);">✓ 完整入库</span>`) : ""}
                                    ${mpConfig.isConfigured ? '<span class="cinema-dialog-chip cinema-sub-status-chip is-loading" role="status">查询订阅中...</span>' : ""}
								</div>
							</div>
						</div>
                        ${mpConfig.isAllowed ? '<div class="cinema-mp-inline-error cinema-mp-detail-error" role="alert" hidden></div>' : ""}
						<div class="cinema-dialog-overview" title="点击展开/收起完整简介">${overview}</div>

						<!-- 缺集控制台 (多季 Tab 分开 + 纯数字标签轨道，参考 MP 订阅助手资源弹窗) -->
						${inLibId && missingInfo && missingInfo.isMissing && missingInfo.seasons.length > 0 ? `
							<div class="cinema-dialog-missing-console">
								<div class="cinema-console-header">
									<div class="cinema-season-switcher">
										${missingInfo.seasons.map((s, idx) => `
											<button type="button" class="cinema-season-tab${idx === 0 ? " is-active" : ""}" data-season-idx="${idx}">
												${s.season_name}
											</button>
										`).join("")}
									</div>
									<div class="cinema-console-missing-indicator">
										<span class="cinema-console-missing-text">缺 ${missingInfo.seasons[0].missingCount} 集</span>
									</div>
								</div>
								<div class="cinema-episodes-track">
									${missingInfo.seasons[0].missingEpisodes.map(ep => `
										<div class="cinema-ep-pill" title="第 ${missingInfo.seasons[0].season_number} 季 · 第 ${ep} 集缺失未入库">${ep}</div>
									`).join("")}
								</div>
							</div>
						` : ""}

					</div>

					<div class="cinema-dialog-footer">
						${inLibId ? `
							<button type="button" class="cinema-dialog-btn cinema-dialog-btn-goto cinema-dialog-btn-primary" style="background:#10b981!important;border-color:#10b981!important;">
								<svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z"/></svg>
								<span>进入${isMovie ? "电影" : "剧集"}</span>
							</button>
						` : ""}

						${mpConfig.isAllowed && mpConfig.isConfigured ? `
							<button type="button" class="cinema-dialog-btn cinema-dialog-btn-mp cinema-mp-search-btn"><span>资源搜索</span></button>
							<button type="button" class="cinema-dialog-btn cinema-dialog-btn-primary cinema-mp-sub-btn"><span>查询订阅中...</span></button>
						` : ""}
						${mpConfig.isAllowed ? `
							<button type="button" class="cinema-dialog-btn cinema-mp-config-btn" title="编辑或清除当前浏览器的 MoviePilot 配置"><span>配置 MP</span></button>
						` : ""}
					</div>
				</div>
			`;

        const previousFocus = document.activeElement;
        const closeDialog = () => {
            overlay.remove();
            if (previousFocus && previousFocus.isConnected) previousFocus.focus();
        };

        bindCinemaDialogKeyboard(overlay, closeDialog);
        const detailError = overlay.querySelector(".cinema-mp-detail-error");
        const showMoviePilotDetailError = (error, prefix = "") => {
            if (!detailError) return;
            detailError.textContent = error ? prefix + moviePilotErrorText(error) : "";
            detailError.hidden = !error;
        };
        const cornerClose = overlay.querySelector(".cinema-dialog-corner-close");
        if (cornerClose) cornerClose.addEventListener("click", closeDialog);
        const overviewEl = overlay.querySelector(".cinema-dialog-overview");
        if (overviewEl) overviewEl.addEventListener("click", () => overviewEl.classList.toggle("is-expanded"));

        // 季 Tab 切换联动缺集数字药丸
        const seasonTabs = overlay.querySelectorAll(".cinema-season-tab");
        const missingIndicator = overlay.querySelector(".cinema-console-missing-text");
        const episodesTrack = overlay.querySelector(".cinema-episodes-track");
        if (seasonTabs.length > 0 && missingInfo && missingInfo.seasons) {
            seasonTabs.forEach(tab => {
                tab.addEventListener("click", () => {
                    seasonTabs.forEach(t => t.classList.remove("is-active"));
                    tab.classList.add("is-active");
                    const sIdx = parseInt(tab.getAttribute("data-season-idx"), 10);
                    const sData = missingInfo.seasons[sIdx];
                    if (sData) {
                        if (missingIndicator) missingIndicator.textContent = `缺 ${sData.missingCount} 集`;
                        if (episodesTrack) {
                            episodesTrack.innerHTML = sData.missingEpisodes.map(ep => `
									<div class="cinema-ep-pill" title="第 ${sData.season_number} 季 · 第 ${ep} 集缺失未入库">${ep}</div>
								`).join("");
                        }
                    }
                });
            });
        }

        const configBtn = overlay.querySelector(".cinema-mp-config-btn");
        if (configBtn) {
            configBtn.addEventListener("click", async () => {
                configBtn.disabled = true;
                try {
                    const changed = await openMoviePilotConfigDialog(mpConfig.storageKey);
                    if (changed && overlay.isConnected) {
                        overlay.remove();
                        await showDetailDialog(item, inLibId, missingInfo);
                    }
                } catch (e) {
                    showMoviePilotDetailError(e);
                } finally {
                    configBtn.disabled = false;
                }
            });
        }

        // 0. 进入已入库项目详情
        const gotoBtn = overlay.querySelector(".cinema-dialog-btn-goto");
        if (gotoBtn && inLibId) {
            gotoBtn.addEventListener("click", () => {
                overlay.remove();
                CinemaHome.showItem(inLibId);
            });
        }

        // 订阅列表按 TMDB、原生媒体类型及已知季数匹配，查询失败禁止创建。
        const subBtn = overlay.querySelector(".cinema-mp-sub-btn");
        if (subBtn) {
            let existingSub = null;
            let platformVersion;
            const subSpan = subBtn.querySelector("span");
            const statusChip = overlay.querySelector(".cinema-sub-status-chip");
            const showStatus = (text, state) => {
                statusChip.textContent = text;
                statusChip.className = `cinema-dialog-chip cinema-sub-status-chip is-${state}`;
            };
            const lookupSubscription = async () => {
                showStatus("查询订阅中...", "loading");
                showMoviePilotDetailError(null);
                existingSub = null;
                try {
                    platformVersion = await getMoviePilotVersion(mpConfig.storageKey);
                    existingSub = await checkMoviePilotSubscription(mpConfig.storageKey, platformVersion, tmdbId, subscriptionType, subscriptionSeason);
                    showStatus(existingSub ? "已订阅" : "未订阅", existingSub ? "subscribed" : "unsubscribed");
                    return existingSub;
                } catch (e) {
                    showStatus("订阅状态查询失败", "error");
                    showMoviePilotDetailError(e);
                    throw e;
                }
            };
            subBtn.disabled = true;
            lookupSubscription().then(() => {
                subSpan.textContent = existingSub ? "订阅搜索" : "订阅并搜索";
            }).catch(() => {
                subSpan.textContent = "重查订阅状态";
            }).finally(() => {
                subBtn.disabled = false;
            });

            subBtn.addEventListener("click", async () => {
                if (subBtn.disabled) return;
                subBtn.disabled = true;
                let created = false;
                try {
                    // 每次操作都刷新列表，避免旧状态导致重复创建或搜索已删除订阅。
                    await lookupSubscription();
                    if (!overlay.isConnected) return;
                    if (!existingSub) {
                        subSpan.textContent = "正在订阅...";
                        showStatus("正在订阅...", "loading");
                        const data = await moviePilotRequest(mpConfig.storageKey, "/api/v1/subscribe/", {
                            name: rawTitle,
                            type: subscriptionType,
                            ...(platformVersion === 2
                                ? {tmdbid: Number(tmdbId)}
                                : {media_source: "themoviedb", media_id: String(tmdbId)}),
                            year: year || null,
                            season: subscriptionSeason
                        });
                        created = true;
                        existingSub = {id: data.data && data.data.id};
                        showStatus("已订阅", "subscribed");
                    }
                    if (!/^[1-9]\d*$/.test(String(existingSub.id || ""))) throw moviePilotError("mp-subscription-id");
                    subSpan.textContent = "正在搜索...";
                    await moviePilotRequest(mpConfig.storageKey, `/api/v1/subscribe/search/${existingSub.id}`, platformVersion === 2 ? undefined : {});
                    subSpan.textContent = created ? "已订阅并安排搜索" : "已安排搜索";
                } catch (e) {
                    subSpan.textContent = existingSub ? "重试订阅搜索" : "重查订阅状态";
                    showStatus(created ? "已订阅，搜索失败" : "订阅操作未完成", existingSub ? "warning" : "error");
                    showMoviePilotDetailError(e, created ? "订阅已创建，但搜索未成功。可手动重试订阅搜索。\n" : "订阅查询失败时不会新建订阅。\n");
                } finally {
                    subBtn.disabled = false;
                }
            });
        }

        // 资源弹窗和其内部操作均重新校验当前管理员身份。
        const searchBtn = overlay.querySelector(".cinema-mp-search-btn");
        if (searchBtn) {
            searchBtn.addEventListener("click", async () => {
                searchBtn.disabled = true;
                try {
                    await openMoviePilotResourceDialog(item, mpConfig.storageKey);
                } catch (e) {
                    showMoviePilotDetailError(e);
                } finally {
                    searchBtn.disabled = false;
                }
            });
        }

        document.body.appendChild(overlay);
        if (cornerClose) cornerClose.focus();
    }

}, `
/* ================== 弹窗样式优化 ================== */
.cinema-detail-dialog-backdrop {
    position: relative !important;
    width: 100% !important;
    height: 160px !important;
    background-size: cover !important;
    background-position: center !important;
    border-radius: 12px 12px 0 0 !important;
    margin: -1.2em -1.2em 1em -1.2em !important;
    width: calc(100% + 2.4em) !important;
}
.cinema-detail-dialog-backdrop::after {
    content: '' !important;
    position: absolute !important;
    inset: 0 !important;
    background: linear-gradient(0deg, rgba(20,20,20,1) 0%, rgba(20,20,20,0.4) 100%) !important;
}

/* ==================== 影视详情与 MoviePilot 联动弹窗 ==================== */
.cinema-detail-dialog-wrap {
    position: relative !important;
    width: 720px !important;
    max-width: min(92vw, 100%) !important;
    height: auto !important;
    max-height: 86vh !important;
    border-radius: 18px !important;
    background: #141722 !important;
    border: 1px solid rgba(255, 255, 255, 0.14) !important;
    box-shadow: 0 28px 72px rgba(0, 0, 0, 0.9) !important;
    color: #ffffff !important;
    overflow: hidden !important;
    display: flex !important;
    flex-direction: column !important;
    box-sizing: border-box !important;
}

.cinema-dialog-backdrop {
    position: absolute !important;
    inset: 0 0 auto 0 !important;
    height: 180px !important;
    background-size: cover !important;
    background-position: center !important;
    opacity: 0.3 !important;
    mask-image: linear-gradient(180deg, #000 0%, transparent 100%) !important;
    -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 100%) !important;
    pointer-events: none !important;
}

.cinema-dialog-body {
    position: relative !important;
    z-index: 2 !important;
    padding: 22px 24px 18px 24px !important;
    overflow-y: auto !important;
    max-height: calc(86vh - 76px) !important;
    min-height: 0 !important;
    box-sizing: border-box !important;
}

.cinema-dialog-header {
    display: flex !important;
    gap: 18px !important;
    align-items: flex-start !important;
    margin-bottom: 16px !important;
}

.cinema-dialog-poster {
    flex: 0 0 95px !important;
    width: 95px !important;
    height: 140px !important;
    border-radius: 8px !important;
    background-size: cover !important;
    background-position: center !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6) !important;
}

.cinema-dialog-meta {
    flex: 1 !important;
    min-width: 0 !important;
}

.cinema-dialog-title {
    font-size: 20px !important;
    font-weight: 800 !important;
    color: #ffffff !important;
    line-height: 1.3 !important;
    margin-bottom: 4px !important;
}

.cinema-dialog-sub {
    font-size: 13px !important;
    color: rgba(255, 255, 255, 0.55) !important;
    margin-bottom: 8px !important;
}

.cinema-dialog-chips {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 6px !important;
    align-items: center !important;
}

.cinema-sub-status-chip.is-subscribed {
    color: #86efac !important;
    background: rgba(34, 197, 94, 0.16) !important;
    border-color: rgba(74, 222, 128, 0.4) !important;
}

.cinema-sub-status-chip.is-unsubscribed {
    color: #a8b1bf !important;
    background: rgba(148, 163, 184, 0.08) !important;
    border-color: rgba(148, 163, 184, 0.18) !important;
}

.cinema-sub-status-chip.is-loading {
    color: #d3dbe6 !important;
    background: rgba(148, 163, 184, 0.12) !important;
    border-color: rgba(148, 163, 184, 0.28) !important;
}

.cinema-sub-status-chip.is-warning {
    color: #fcd68b !important;
    background: rgba(245, 158, 11, 0.14) !important;
    border-color: rgba(245, 158, 11, 0.35) !important;
}

.cinema-sub-status-chip.is-error {
    color: #fca5a5 !important;
    background: rgba(239, 68, 68, 0.14) !important;
    border-color: rgba(248, 113, 113, 0.35) !important;
}

.cinema-dialog-chip-tmdbid {
    background: rgba(1, 180, 228, 0.12) !important;
    border-color: rgba(1, 180, 228, 0.35) !important;
    color: #01b4e4 !important;
    font-weight: 600 !important;
    letter-spacing: 0.01em !important;
}
.cinema-dialog-chip-tmdbid:hover {
    background: rgba(1, 180, 228, 0.22) !important;
    border-color: rgba(1, 180, 228, 0.55) !important;
}

.cinema-dialog-chip {
    display: inline-flex !important;
    align-items: center !important;
    padding: 3px 8px !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    border-radius: 4px !important;
    background: rgba(255, 255, 255, 0.08) !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    color: rgba(255, 255, 255, 0.85) !important;
}

.cinema-dialog-chip-gold {
    color: #f5a623 !important;
    border-color: rgba(245, 166, 35, 0.3) !important;
    background: rgba(245, 166, 35, 0.1) !important;
}

.cinema-dialog-overview {
    font-size: 13px !important;
    line-height: 1.6 !important;
    color: rgba(255, 255, 255, 0.75) !important;
    margin-bottom: 16px !important;
}

.cinema-dialog-overview.is-expanded {
    max-height: 200px !important;
    -webkit-line-clamp: unset !important;
    overflow-y: auto !important;
}

/* 底部操作工具栏 */
.cinema-dialog-footer {
    display: flex !important;
    align-items: center !important;
    justify-content: flex-end !important;
    gap: 10px !important;
    padding: 14px 22px !important;
    background: rgba(0, 0, 0, 0.45) !important;
    border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
    flex-wrap: wrap !important;
}

.cinema-dialog-btn {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 6px !important;
    padding: 8px 16px !important;
    font-size: 13px !important;
    font-weight: 700 !important;
    border-radius: 8px !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    background: rgba(255, 255, 255, 0.08) !important;
    color: #ffffff !important;
    white-space: nowrap !important;
    box-sizing: border-box !important;
}

.cinema-dialog-btn:hover {
    background: rgba(255, 255, 255, 0.16) !important;
    transform: translateY(-1px) !important;
}

.cinema-dialog-btn:hover {
    background: rgba(255, 255, 255, 0.16) !important;
    transform: translateY(-1px) !important;
}

.cinema-dialog-btn-primary {
    background: #00a4dc !important;
    border-color: #00a4dc !important;
    color: #ffffff !important;
}

.cinema-dialog-btn-primary:hover {
    background: #00b4f0 !important;
    border-color: #00b4f0 !important;
}

.cinema-dialog-btn-mp {
    background: #2563eb !important;
    border-color: #2563eb !important;
}

.cinema-dialog-btn-mp:hover {
    background: #3b82f6 !important;
}

/* MoviePilot 资源搜索与转存列表面板 */
.cinema-mp-resource-box {
    margin-top: 12px !important;
    padding: 12px 14px !important;
    border-radius: 8px !important;
    background: rgba(0, 0, 0, 0.4) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    display: none;
}

.cinema-mp-resource-header {
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    margin-bottom: 10px !important;
    font-size: 12px !important;
    color: rgba(255, 255, 255, 0.6) !important;
}

.cinema-mp-resource-list {
    max-height: 220px !important;
    overflow-y: auto !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 8px !important;
}

.cinema-mp-resource-item {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 12px !important;
    padding: 8px 10px !important;
    border-radius: 6px !important;
    background: rgba(255, 255, 255, 0.03) !important;
    border: 1px solid rgba(255, 255, 255, 0.06) !important;
    font-size: 12px !important;
}

.cinema-mp-resource-item:hover {
    background: rgba(255, 255, 255, 0.07) !important;
}

.cinema-mp-res-title {
    flex: 1 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    color: rgba(255, 255, 255, 0.9) !important;
    font-weight: 500 !important;
}

.cinema-mp-res-tag {
    padding: 2px 6px !important;
    font-size: 11px !important;
    border-radius: 4px !important;
    background: rgba(255, 255, 255, 0.1) !important;
    color: #8ec5fc !important;
}

.cinema-mp-sync-btn {
    padding: 4px 10px !important;
    font-size: 11.5px !important;
    border-radius: 4px !important;
    background: #10b981 !important;
    border: none !important;
    color: #fff !important;
    cursor: pointer !important;
    flex-shrink: 0 !important;
}

.cinema-mp-sync-btn:hover {
    background: #059669 !important;
}

/* 缺集状态只改变颜色，沿用同一行角标的尺寸与位置。 */
.cinema-card-inlibrary-badge.is-missing {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
    color: #ffffff !important;
    box-shadow: 0 2px 10px rgba(217, 119, 6, 0.5) !important;
}

/* ==================== 缺集控制台 (参考 MP 订阅助手资源弹窗规范) ==================== */
.cinema-dialog-missing-console {
    margin-top: 14px !important;
    padding: 12px 14px !important;
    background: rgba(0, 0, 0, 0.32) !important;
    border-radius: 10px !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
}

.cinema-console-header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    margin-bottom: 10px !important;
    gap: 8px !important;
}

.cinema-season-switcher {
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    flex-wrap: wrap !important;
}

.cinema-season-tab {
    padding: 3px 10px !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    border-radius: 6px !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    background: rgba(255, 255, 255, 0.06) !important;
    color: rgba(255, 255, 255, 0.75) !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
}

.cinema-season-tab:hover {
    background: rgba(255, 255, 255, 0.14) !important;
    color: #ffffff !important;
}

.cinema-season-tab.is-active {
    background: #2563eb !important;
    border-color: #3b82f6 !important;
    color: #ffffff !important;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4) !important;
}

.cinema-console-missing-indicator {
    display: inline-flex !important;
    align-items: center !important;
    padding: 2px 8px !important;
    border-radius: 10px !important;
    font-size: 11.5px !important;
    font-weight: 700 !important;
    background: rgba(245, 158, 11, 0.18) !important;
    border: 1px solid rgba(245, 158, 11, 0.45) !important;
    color: #fbbf24 !important;
}

/* 缺集数字标签滚动轨道 */
.cinema-episodes-track {
    display: flex !important;
    flex-wrap: nowrap !important;
    gap: 6px !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    padding: 2px 0 6px 0 !important;
    scrollbar-width: thin !important;
    scrollbar-color: rgba(255, 255, 255, 0.25) transparent !important;
    -webkit-overflow-scrolling: touch !important;
}

.cinema-episodes-track::-webkit-scrollbar {
    height: 4px !important;
}

.cinema-episodes-track::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.25) !important;
    border-radius: 4px !important;
}

/* 纯数字缺集胶囊药丸 */
.cinema-ep-pill {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    min-width: 32px !important;
    height: 28px !important;
    padding: 0 6px !important;
    border-radius: 6px !important;
    font-size: 13px !important;
    font-weight: 700 !important;
    background: rgba(245, 158, 11, 0.15) !important;
    border: 1px solid rgba(245, 158, 11, 0.45) !important;
    color: #fbbf24 !important;
    flex-shrink: 0 !important;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25) !important;
    transition: all 0.15s ease !important;
    cursor: default !important;
}

.cinema-ep-pill:hover {
    background: rgba(245, 158, 11, 0.28) !important;
    border-color: rgba(245, 158, 11, 0.8) !important;
    color: #fef3c7 !important;
    transform: translateY(-1px) !important;
}

/* ==================== MoviePilot 网盘资源独立弹窗 (对齐 CloudSubscribe 插件风格) ==================== */
.cinema-mp-dialog-wrap {
    position: relative !important;
    width: 920px !important;
    max-width: 100% !important;
    height: 74vh !important;
    height: 74dvh !important;
    max-height: min(860px, calc(100vh - 40px)) !important;
    max-height: min(860px, calc(100dvh - 40px)) !important;
    border-radius: 16px !important;
    background: rgba(17, 22, 34, 0.62) !important;
    backdrop-filter: blur(32px) !important;
    -webkit-backdrop-filter: blur(32px) !important;
    border: 1px solid rgba(190, 215, 255, 0.22) !important;
    box-shadow: 0 28px 72px rgba(0, 0, 0, 0.55), inset 0 1px rgba(255, 255, 255, 0.08) !important;
    color: #ffffff !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
    z-index: 100000 !important;
    box-sizing: border-box !important;
}

.cinema-mp-header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    flex-wrap: wrap !important;
    flex-shrink: 0 !important;
    gap: 10px !important;
    padding: 12px 16px !important;
    background: rgba(255, 255, 255, 0.03) !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
}

.cinema-mp-header-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-left: auto;
}

.cinema-mp-header-actions .cinema-dialog-btn {
    min-height: 34px;
    padding: 6px 12px !important;
    font-size: 12px !important;
}

.cinema-mp-header-left {
    display: flex !important;
    flex: 1 1 220px !important;
    align-items: center !important;
    gap: 8px !important;
    min-width: 0 !important;
}

.cinema-mp-header-left > svg { flex-shrink: 0; }

.cinema-mp-header-title {
    font-size: 17px !important;
    font-weight: 600 !important;
    color: #ffffff !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
}

.cinema-mp-header-sub {
    font-size: 12px !important;
    color: rgba(255, 255, 255, 0.5) !important;
}

.cinema-mp-tabs-bar {
    display: flex !important;
    align-items: center !important;
    flex-wrap: wrap !important;
    align-content: flex-start !important;
    flex-shrink: 0 !important;
    height: auto !important;
    box-sizing: border-box !important;
    gap: 6px !important;
    padding: 10px 16px !important;
    background: rgba(23, 37, 60, 0.22) !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
    overflow: visible !important;
}

/* 保留筛选条的空间，检索前后列表视口高度不变。 */
.cinema-mp-tabs-bar[hidden] { display: flex !important; visibility: hidden !important; }
.cinema-mp-inline-error[hidden] { display: none !important; }

.cinema-mp-type-tab {
    display: inline-flex !important;
    align-items: center !important;
    flex-shrink: 0 !important;
    gap: 6px !important;
    padding: 5px 12px !important;
    border-radius: 9999px !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    background: rgba(255, 255, 255, 0.06) !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    color: rgba(255, 255, 255, 0.75) !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    white-space: nowrap !important;
}

.cinema-mp-type-tab:hover {
    background: rgba(255, 255, 255, 0.14) !important;
    color: #ffffff !important;
}

.cinema-mp-type-tab.is-active {
    background: #2563eb !important;
    border-color: #3b82f6 !important;
    color: #ffffff !important;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4) !important;
}

.cinema-mp-tab-count {
    padding: 1px 6px !important;
    border-radius: 9999px !important;
    font-size: 11px !important;
    background: rgba(0, 0, 0, 0.35) !important;
    color: inherit !important;
}

.cinema-mp-body {
    flex: 1 1 0 !important;
    min-height: 0 !important;
    min-width: 0 !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    padding: 12px 16px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 6px !important;
    scrollbar-width: thin !important;
    scrollbar-gutter: stable !important;
    overscroll-behavior: contain !important;
}

.cinema-mp-loading {
    display: flex !important;
    flex: 1 !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 26px 12px !important;
    gap: 12px !important;
    color: rgba(255, 255, 255, 0.6) !important;
    font-size: 13px !important;
}

.cinema-mp-loading .cinema-spinner { width: 24px !important; height: 24px !important; flex-shrink: 0; }

.cinema-mp-empty {
    display: flex !important;
    flex: 1 !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 22px 12px !important;
    gap: 8px !important;
    text-align: center !important;
    color: rgba(255, 255, 255, 0.7) !important;
    font-size: 13px !important;
}

/* 资源卡片行 (对齐 CloudSubscribe 资源列表样式) */
.cinema-mp-res-card {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) auto !important;
    align-items: center !important;
    flex-shrink: 0 !important;
    min-width: 0 !important;
    gap: 8px 12px !important;
    padding: 10px 12px !important;
    background: rgba(167, 199, 241, 0.07) !important;
    border: 1px solid rgba(190, 215, 255, 0.12) !important;
    border-radius: 8px !important;
    transition: background 0.2s ease, border-color 0.2s ease !important;
}

.cinema-mp-res-card:hover {
    background: rgba(167, 199, 241, 0.13) !important;
    border-color: rgba(190, 215, 255, 0.24) !important;
}

.cinema-mp-res-main {
    flex: 1 !important;
    min-width: 0 !important;
}

.cinema-mp-res-line1 {
    display: flex !important;
    align-items: center !important;
    height: 24px !important;
    gap: 8px !important;
    margin-bottom: 5px !important;
}

.cinema-mp-res-name {
    font-size: 13.5px !important;
    font-weight: 600 !important;
    color: #ffffff !important;
    display: block !important;
    flex: 1 !important;
    min-width: 0 !important;
    line-height: 24px !important;
    text-overflow: ellipsis !important;
    overflow: hidden !important;
    white-space: nowrap !important;
}

.cinema-mp-res-line2 {
    display: flex !important;
    align-items: center !important;
    flex-wrap: nowrap !important;
    gap: 6px !important;
    height: 34px !important;
    min-width: 0 !important;
    padding-bottom: 2px !important;
    box-sizing: border-box !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    white-space: nowrap !important;
    scrollbar-width: thin !important;
    overscroll-behavior-x: contain !important;
    font-size: 11.5px !important;
    color: rgba(255, 255, 255, 0.7) !important;
}

.cinema-mp-res-line2 > span { flex: 0 0 auto; line-height: 18px; white-space: nowrap; }
.cinema-mp-res-line2::-webkit-scrollbar, .cinema-mp-tabs-bar::-webkit-scrollbar { height: 4px; }
.cinema-mp-res-line2::-webkit-scrollbar-thumb, .cinema-mp-tabs-bar::-webkit-scrollbar-thumb { background: rgba(190, 215, 255, 0.3); border-radius: 4px; }

.cinema-mp-pan-badge {
    padding: 2px 6px !important;
    border-radius: 4px !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    flex-shrink: 0 !important;
    max-width: 38% !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    line-height: 18px !important;
    color: #d4dae3;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
}

.cinema-mp-pan-alipan { background: rgba(59, 130, 246, 0.2) !important; color: #60a5fa !important; border: 1px solid rgba(59, 130, 246, 0.4) !important; }
.cinema-mp-pan-quark { background: rgba(239, 68, 68, 0.2) !important; color: #f87171 !important; border: 1px solid rgba(239, 68, 68, 0.4) !important; }
.cinema-mp-pan-115 { background: rgba(16, 185, 129, 0.2) !important; color: #34d399 !important; border: 1px solid rgba(16, 185, 129, 0.4) !important; }
.cinema-mp-pan-123 { background: rgba(245, 158, 11, 0.2) !important; color: #fbbf24 !important; border: 1px solid rgba(245, 158, 11, 0.4) !important; }
.cinema-mp-pan-magnet { background: rgba(168, 85, 247, 0.2) !important; color: #c084fc !important; border: 1px solid rgba(168, 85, 247, 0.4) !important; }

.cinema-mp-source-badge, .cinema-mp-size-badge, .cinema-mp-quality-tag, .cinema-mp-meta-value {
    padding: 2px 6px;
    border: 1px solid rgba(190, 215, 255, 0.14);
    border-radius: 4px;
    background: rgba(190, 215, 255, 0.06);
}

.cinema-mp-source-badge { color: #a5e7ef; border-color: rgba(103, 232, 249, 0.3); background: rgba(6, 182, 212, 0.13); }
.cinema-mp-size-badge { color: #fbd797; border-color: rgba(251, 191, 36, 0.3); background: rgba(217, 158, 25, 0.13); }
.cinema-mp-quality-tag { color: #ddd0ff; border-color: rgba(196, 181, 253, 0.3); background: rgba(139, 92, 246, 0.16); }
.cinema-mp-meta-value { color: #c5d0df; }

.cinema-mp-inline-error {
    grid-column: 1 / -1;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 12px;
    line-height: 1.6;
    color: #f4b2ab;
}

.cinema-mp-detail-error {
    margin: 0 0 12px;
    padding: 10px 12px;
    border: 1px solid rgba(244, 178, 171, 0.25);
    border-radius: 6px;
    background: rgba(244, 178, 171, 0.05);
}

.cinema-mp-error-state { display: flex; flex: 1; flex-direction: column; justify-content: center; align-items: center; padding: 10px 4px; text-align: center; }
.cinema-mp-error-state strong { display: block; margin-bottom: 8px; font-size: 14px; color: #f4b2ab; }
.cinema-mp-overlay button:focus-visible, .cinema-mp-res-line2:focus-visible, .cinema-detail-dialog-wrap button:focus-visible {
    outline: 2px solid #60a5fa !important;
    outline-offset: 2px !important;
}

.cinema-mp-transfer-btn {
    padding: 6px 14px !important;
    min-height: 34px !important;
    min-width: 100px !important;
    white-space: nowrap !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    border-radius: 6px !important;
    border: none !important;
    background: #10b981 !important;
    color: #ffffff !important;
    cursor: pointer !important;
    flex-shrink: 0 !important;
    transition: all 0.2s ease !important;
}

.cinema-mp-transfer-btn:hover {
    background: #059669 !important;
    transform: translateY(-1px) !important;
}

.cinema-mp-transfer-btn:disabled {
    opacity: 0.6 !important;
    cursor: not-allowed !important;
    transform: none !important;
}

/* 弹窗全景遮罩层：轻透柔光，彻底告别死板全黑蒙版，保留底层页面质感 */
.cinema-modal-overlay {
    position: fixed !important;
    inset: 0 !important;
    background: rgba(0, 0, 0, 0.42) !important;
    backdrop-filter: blur(4px) !important;
    -webkit-backdrop-filter: blur(4px) !important;
    z-index: 99999 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 20px !important;
    box-sizing: border-box !important;
}

.cinema-mp-overlay {
    z-index: 100001 !important;
    background: rgba(8, 12, 20, 0.45) !important;
    backdrop-filter: blur(14px) !important;
    -webkit-backdrop-filter: blur(14px) !important;
}

.cinema-mp-config-form {
    width: 460px;
    max-width: 100%;
    max-height: 86vh;
    max-height: min(86dvh, calc(100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom)));
    overflow-y: auto;
    box-sizing: border-box;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    background: #141720;
    color: #fff;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.7);
}

.cinema-mp-config-form h2 { margin: 0 0 10px; font-size: 20px; }
.cinema-mp-config-form p { margin: 8px 0; font-size: 12px; line-height: 1.5; color: #bec5d1; overflow-wrap: anywhere; }
.cinema-mp-config-form p:empty { display: none; }
.cinema-mp-config-form label { display: block; margin-top: 12px; font-size: 14px; }
.cinema-mp-config-form input {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin-top: 6px;
    padding: 10px 12px;
    border: 1px solid #697384;
    border-radius: 8px;
    background: #0c1018;
    color: #fff;
    font-size: 16px;
}
.cinema-mp-config-form input:focus-visible { outline: 2px solid #60a5fa; outline-offset: 2px; }
.cinema-mp-config-form .cinema-mp-config-error { color: #fca5a5; }
.cinema-mp-config-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; margin-top: 16px; }

/* 弹窗卡片本体带有实体深色背景和高质感投影，保证内容对比度与通透并存 */
.cinema-detail-dialog-wrap {
    background: #141720 !important;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.1) !important;
}

/* 手机端移动设备规范：保持标准中心弹窗质感，按钮全屏平铺对齐 */
@media (max-width: 600px) {
    .cinema-modal-overlay {
        align-items: center !important;
        justify-content: center !important;
        padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)) !important;
    }

    .cinema-detail-dialog-wrap {
        width: 100% !important;
        max-width: 440px !important;
        max-height: 86vh !important;
        max-height: min(86dvh, calc(100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom))) !important;
        border-radius: 16px !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
        margin: auto !important;
    }

    .cinema-mp-dialog-wrap {
        width: 100% !important;
        max-width: 480px !important;
        height: 78vh !important;
        height: 78dvh !important;
        max-height: calc(100vh - 32px) !important;
        max-height: calc(100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom)) !important;
        border-radius: 12px !important;
        margin: auto !important;
    }

    .cinema-mp-header, .cinema-mp-tabs-bar { padding-left: 12px !important; padding-right: 12px !important; }
    .cinema-mp-header-left { flex-basis: 100% !important; }
    .cinema-mp-header-actions { margin-left: 0; }
    .cinema-mp-body { padding: 10px !important; }
    .cinema-mp-res-card { gap: 8px !important; padding: 10px !important; }
    .cinema-mp-transfer-btn { min-width: 84px !important; min-height: 44px !important; padding: 6px 8px !important; }

    .cinema-dialog-body {
        padding: 18px 16px 14px 16px !important;
        max-height: calc(86vh - 80px) !important;
    }

    .cinema-dialog-header {
        gap: 12px !important;
        margin-bottom: 12px !important;
    }

    .cinema-dialog-poster {
        flex: 0 0 80px !important;
        width: 80px !important;
        height: 118px !important;
    }

    .cinema-dialog-title {
        font-size: 16px !important;
        padding-right: 28px !important; /* 避开右上角关闭按钮 */
    }

    .cinema-dialog-overview {
        max-height: 80px !important; -webkit-line-clamp: 4 !important; display: -webkit-box !important; -webkit-box-orient: vertical !important; overflow: hidden !important;
        font-size: 12.5px !important;
        line-height: 1.55 !important;
    }

    /* 手机端操作栏：网格/两端对齐平铺，按钮均等分配宽度，手指易触达 */
    .cinema-dialog-footer {
        padding: 12px 14px !important;
        gap: 8px !important;
        display: flex !important;
        flex-wrap: wrap !important;
        justify-content: space-between !important;
    }

    .cinema-dialog-footer .cinema-dialog-btn {
        flex: 1 1 110px !important;
        min-width: 0 !important;
        padding: 8px 4px !important;
        font-size: 12px !important;
        justify-content: center !important;
    }

    .cinema-dialog-footer .cinema-dialog-btn svg {
        display: none !important; /* 手机端隐藏图标，突出纯文字展示，防止换行挤压 */
    }
}

/* 资源弹窗内嵌样式精细化 */
.cinema-mp-direct-badge {
    padding: 2px 6px !important;
    border-radius: 4px !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    background: rgba(16, 185, 129, 0.2) !important;
    color: #34d399 !important;
    border: 1px solid rgba(16, 185, 129, 0.45) !important;
}

.cinema-mp-cross-badge {
    padding: 2px 6px !important;
    border-radius: 4px !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    background: rgba(245, 158, 11, 0.15) !important;
    color: #fbbf24 !important;
    border: 1px solid rgba(245, 158, 11, 0.35) !important;
}
`);
