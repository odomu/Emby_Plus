/* ================================================================
   Emby_Plus Addon · 追剧日历与热门榜单
   契约：EmbyPlus.defineAddon(id, label, config, factory, style)
   依赖：先加载宿主 Emby_Plus.js（提供 window.EmbyPlus 公共接口）
   ================================================================ */

EmbyPlus.defineAddon("calendar-charts-tab", "追剧日历与热门榜单", {
    calendarRequireAdmin: false,  // 追剧日历 Tab 是否仅管理员显示 (默认 false 全员可见；配置为 true 则仅管理员显示)
    chartsRequireAdmin: false,  // 热门榜单 Tab 是否仅管理员显示 (默认 false 全员可见；配置为 true 则仅管理员显示)
    chartLimit: 20,             // 榜单最大展示条目数 (1-100)
}, function (host) {

    /* 配置统一取自宿主 CINEMA_CONFIG */
    const CONFIG = host.config;

    // 宿主共享变量映射
    const escapeHtml = host.escapeHtml || (s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
    const TMDB_API_BASE = host.TMDB_API_BASE;
    const TMDB_KEY = host.getEffectiveTmdbKey ? host.getEffectiveTmdbKey() : (host.TMDB_KEY || "");
    const TMDB_LOGO = host.TMDB_LOGO;
    const TMDB_IMG_BASE = host.TMDB_IMG_BASE;
    const getTmdbImg = host.getTmdbImg;
    const fetchWithCache = host.fetchWithCache;
    const checkInLibrary = host.checkInLibrary;
    const checkMissingEpisodesInfo = host.checkMissingEpisodesInfo;
    const ensureLibraryIndex = host.ensureLibraryIndex;
    const updateCinemaTabTopOffset = host.updateCinemaTabTopOffset;
    const padZero = host.padZero;
    const formatDateYMD = host.formatDateYMD;
    const weekdays = host.weekdays;
    const weekdaysFull = host.weekdaysFull;
    const CinemaHome = window.CinemaHome || host;
    const showDetailDialog = (...args) => (typeof window.showDetailDialog === 'function' ? window.showDetailDialog(...args) : console.warn('[CinemaCalendar] showDetailDialog 未就绪'));

    const PLATFORMS = {
        netflix: {
            name: "Netflix",
            logo: TMDB_LOGO("/rK1KljqmbvO9HQa1PBFLILWah72.png"),
            badgeText: "N",
            badgeBg: "#E50914",
            provider: 8,
            network: 213
        },
        hbo: {
            name: "HBO Max",
            logo: TMDB_LOGO("/skypuy7SXuugIQeYg0IglmzoKaS.png"),
            badgeText: "HBO",
            badgeBg: "linear-gradient(135deg, #9900ff, #5000cc)",
            provider: "1899|384|49",
            network: 49
        },
        appletv: {
            name: "Apple TV+",
            logo: TMDB_LOGO("/9icYBfYFcwgCbky5VdGUIKJ4C5i.png"),
            badgeText: "tv+",
            badgeBg: "#222222",
            provider: "350|2",
            network: 2552
        },
        disney: {
            name: "Disney+",
            logo: TMDB_LOGO("/5eZ872CghnHFLB1j8grszbrx0dx.png"),
            badgeText: "Disney+",
            badgeBg: "#0f1c3f",
            provider: 337,
            network: 2739
        },
        crunchyroll: {
            name: "Crunchyroll",
            logo: TMDB_LOGO("/uFL3c4Cq8M6WoLymlC5Y8bmGytV.png"),
            badgeText: "CR",
            badgeBg: "#F47521",
            provider: "283|1968|2327"
        },
        amazon: {
            name: "Prime Video",
            logo: TMDB_LOGO("/gMZdpavHmxFNnLpMHwVxfqeux2g.png"),
            badgeText: "Prime",
            badgeBg: "#000511",
            provider: "9|119|10",
            network: 1024
        },
        hulu: {
            name: "Hulu",
            logo: TMDB_LOGO("/44uAnmSqvA4yBOdbPWN8YgQHjWm.png"),
            badgeText: "H",
            badgeBg: "#1CE783",
            provider: 15
        },
        peacock: {
            name: "Peacock",
            logo: TMDB_LOGO("/a1UIdq5BrkcAxnxcUhFsNbXnxeu.png"),
            badgeText: "P",
            badgeBg: "#000000",
            provider: "386|387"
        }
    };

    const REGIONS = [
        {code: "US", name: "美国"},
        {code: "KR", name: "韩国"},
        {code: "GB", name: "英国"},
        {code: "DE", name: "德国"},
        {code: "JP", name: "日本"}
    ];

    const GENRE_MAP = {
        28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录", 18: "剧情",
        10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐", 9648: "悬疑",
        10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚", 10752: "战争", 37: "西部",
        10759: "动作冒险", 10762: "儿童", 10763: "新闻", 10764: "真人秀", 10765: "科幻奇幻",
        10766: "肥皂剧", 10767: "脱口秀", 10768: "战争政治"
    };

    const generateDatesList = (days = 30) => {
        const list = [];
        const now = new Date();
        for (let i = 0; i < days; i++) {
            const d = new Date(now.getTime() + i * 86400000);
            const ymd = formatDateYMD(d);
            let label = `${d.getMonth() + 1}/${d.getDate()}`;
            if (i === 0) label = "今天";
            else if (i === 1) label = "明天";
            list.push({
                date: ymd,
                label,
                weekday: weekdays[d.getDay()],
                weekdayFull: weekdaysFull[d.getDay()],
                month: d.getMonth() + 1,
                day: d.getDate(),
                index: i
            });
        }
        return list;
    };

    let CinemaBaseTab = null;
    const CALENDAR_COUNTRIES = {
        all: "全部", CN: "中国大陆", HK: "中国香港", TW: "中国台湾", US: "美国",
        JP: "日本", KR: "韩国", GB: "英国", FR: "法国", DE: "德国", TH: "泰国",
        IN: "印度", RU: "俄罗斯", CA: "加拿大", AU: "澳大利亚"
    };

    /* CalendarTabController */
    function CalendarTabController(view, params, options) {
        CinemaBaseTab.call(this, view, params, options);
        this.slider = view.querySelector(".scrollSlider") || view;
        this.datesList = generateDatesList(30);
        this.selectedDateIndex = 0;
        this.activeFilter = "all";
        this.activeCountry = "all";
        this.dateItemsCache = new Map();
        this.dateCounts = new Map();
        this.isRendered = false;
    }

    CalendarTabController.prototype.onResume = function (options) {
        CinemaBaseTab.prototype.onResume.call(this, options);
        updateCinemaTabTopOffset();
        const TMDB_KEY = host.getEffectiveTmdbKey ? host.getEffectiveTmdbKey() : (host.TMDB_KEY || "");
        if (!TMDB_KEY) {
            if (!this.isRendered) {
                this.renderBase();
                this.isRendered = true;
            }
            return;
        }
        if (!this.isRendered) {
            this.renderBase();
            this.isRendered = true;
        }
        const dateKey = `${this.activeCountry}:${this.datesList[this.selectedDateIndex].date}`;
        this.loadDateData(this.selectedDateIndex);
        ensureLibraryIndex().then(() => {
            if (!this.paused && this.isRendered) {
                const cached = this.dateItemsCache.get(dateKey);
                if (cached) this.renderSchedule(cached, this.datesList[this.selectedDateIndex]);
            }
        });
        this.prefetchAllDates();
        if (this._dateStripObserver) this._dateStripObserver.observe(this.slider.querySelector(".cinema-date-strip"));
        if (this._updateNavState) this._updateNavState();
    };

    CalendarTabController.prototype.onPause = function () {
        if (this._dateStripObserver) this._dateStripObserver.disconnect();
        CinemaBaseTab.prototype.onPause.call(this);
    };
    CalendarTabController.prototype.destroy = function () {
        this.dateItemsCache.clear();
        if (this.epCache) this.epCache.clear();
        if (this._dateStripObserver) this._dateStripObserver.disconnect();
        CinemaBaseTab.prototype.destroy.call(this);
    };

    // 异步获取剧集的真实排期集数 (优先读取 TMDB next_episode_to_air 或 last_episode_to_air)

    function renderCalendarEpisode(item) {
        const label = item.mediaType === "movie" ? "今日上映" : (item.epCode || (item.episode ? `E${padZero(item.episode)}` : "更新中"));
        const time = /^\d{1,2}:\d{2}$/.test(item.airTime || "") ? item.airTime : "";
        return `<span>${escapeHtml(label)}</span>${time ? `<span class="cinema-ep-clock">${escapeHtml(time)}</span>` : ""}`;
    }

    CalendarTabController.prototype.fetchTvEpisodeInfo = async function (tvId) {
        if (!tvId) return null;
        const cacheKey = "TV_EP_" + tvId;
        if (this.epCache && this.epCache.has(cacheKey)) return this.epCache.get(cacheKey);
        try {
            const url = `${TMDB_API_BASE}/tv/${tvId}?api_key=${TMDB_KEY}&language=zh-CN`;
            const data = await fetchWithCache(url, 86400000); // 集数元数据缓存 24 小时
            if (data) {
                const ep = data.next_episode_to_air || data.last_episode_to_air;
                if (ep && typeof ep.episode_number === "number") {
                    const s = typeof ep.season_number === "number" && ep.season_number > 0 ? `S${padZero(ep.season_number)}` : "";
                    const e = `E${padZero(ep.episode_number)}`;
                    const code = s ? `${s}${e}` : e;
                    const res = {epCode: code, epName: ep.name || ""};
                    if (!this.epCache) this.epCache = new Map();
                    this.epCache.set(cacheKey, res);
                    return res;
                }
            }
        } catch (e) {
        }
        return null;
    };

    function heroPlaceholderHtml(extraClass = "", chipCount = 3) {
        return `<div class="cinema-calendar-hero ${extraClass} padded-left padded-right is-loading">
                <div class="cinema-calendar-hero-bg"></div>
                <div class="cinema-calendar-hero-content">
                    <div class="cinema-hero-skel-title cinema-shimmer"></div>
                    <div class="cinema-hero-skel-sub cinema-shimmer"></div>
                    <div class="cinema-hero-skel-chips">${Array.from({length: chipCount}, () => '<div class="cinema-hero-skel-chip cinema-shimmer"></div>').join("")}</div>
                    <div class="cinema-hero-skel-overview cinema-shimmer"></div>
                    <div class="cinema-hero-skel-btn cinema-shimmer"></div>
                </div>
            </div>`;
    }

    function heroContentHtml({title, subtitle, chips, overview, actions}) {
        return `<h1 class="cinema-title cinema-calendar-hero-title">${escapeHtml(title)}</h1>
                <div class="cinema-sub-title cinema-calendar-hero-sub">${escapeHtml(subtitle)}</div>
                ${chips.length ? `<div class="cinema-meta-row"><div class="cinema-genre-list cinema-hero-chips">${chips.map(chip => `<span class="cinema-genre-badge">${escapeHtml(chip)}</span>`).join("")}</div></div>` : ""}
                <p class="cinema-overview cinema-calendar-hero-overview">${escapeHtml(overview)}</p>
                ${actions}`;
    }

    // 仅共享结构；日历缺集检查、榜单跳转等交互仍由各控制器处理。
    function posterCardHtml(item, {
        className,
        meta,
        rank = 0,
        episodeHtml = "",
        footerHtml = "",
        removeBrokenImage = false
    }) {
        const title = escapeHtml(item.title || item.name);
        const rating = item.vote_average ? item.vote_average.toFixed(1) : "暂无";
        const inLibId = checkInLibrary(item);
        const imageError = removeBrokenImage ? ` onerror="const c=this.closest('.cinema-calendar-card');if(c)c.remove();"` : "";
        return `<div class="card portraitCard ${className}" data-id="${escapeHtml(item.id)}">
                <div class="cardBox cardBox-bottompadded">
                    <button type="button" class="cardContent cardContent-button cardImageContainer cardPadder-portrait cinema-card-poster-container" aria-label="${rank ? `第 ${rank} 名：` : ""}${title}">
                        <img class="cardImage cinema-card-poster-img" src="${getTmdbImg(item.poster_path, "w342")}" loading="lazy" alt="${title}" referrerpolicy="no-referrer"${imageError} />
                        <div class="cinema-card-badges">
                            <div class="cinema-card-rating-badge">★ ${rating}</div>
                            ${inLibId ? `<div class="cinema-card-inlibrary-badge" data-inlib-id="${escapeHtml(inLibId)}" title="已入库">已入库</div>` : ""}
                        </div>
                        ${rank ? `<div class="cinema-chart-rank-badge">${rank}</div>` : ""}
                        ${episodeHtml ? `<div class="cinema-card-ep-overlay">${episodeHtml}</div>` : ""}
                    </button>
                    <div class="cardText cardText-first cardText-first-padded" title="${title}">${title}</div>
                    <div class="cardText cardText-secondary">${escapeHtml(meta)}</div>
                    ${footerHtml}
                </div>
            </div>`;
    }

    CalendarTabController.prototype.renderBase = function () {
        const slider = this.slider;
        const TMDB_KEY = host.getEffectiveTmdbKey ? host.getEffectiveTmdbKey() : (host.TMDB_KEY || "");
        if (!TMDB_KEY) {
            slider.innerHTML = `
                <div class="cinema-key-notice" style="min-height: calc(100vh - var(--cinema-tab-top, 56px) - 120px); justify-content: center;">
                    <div class="cinema-key-notice-icon">🔑</div>
                    <div class="cinema-key-notice-title">未配置 TMDB API Key</div>
                    <div class="cinema-key-notice-desc">追剧日历需要 TMDB 访问权限以拉取放送数据，请在配置中填写 tmdbApiKey。</div>
                </div>
            `;
            return;
        }
        slider.innerHTML = `
            ${heroPlaceholderHtml()}
            <div class="cinema-tab-body padded-left padded-right">
                <div class="cinema-calendar-filter-row" role="group" aria-label="日历分类筛选">
                    <span class="cinema-charts-group-label">分类:</span>
                    <div class="cinema-filter-pills">
                        <button type="button" class="cinema-pill-btn is-active" data-filter="all">全部</button>
                        <button type="button" class="cinema-pill-btn" data-filter="movie">电影</button>
                        <button type="button" class="cinema-pill-btn" data-filter="tv">剧集</button>
                        <button type="button" class="cinema-pill-btn" data-filter="anime">番剧</button>
                    </div>
                </div>
                <div class="cinema-calendar-filter-row cinema-country-row" role="group" aria-label="国家或地区">
                    <span class="cinema-charts-group-label">国家:</span>
                    <div class="cinema-filter-pills cinema-country-tabs" role="tablist" aria-label="日历国家筛选">
                        ${Object.entries(CALENDAR_COUNTRIES).map(([code, name]) => `<button type="button" role="tab" aria-selected="${code === this.activeCountry}" class="cinema-pill-btn${code === this.activeCountry ? " is-active" : ""}" data-country="${code}">${name}</button>`).join("")}
                    </div>
                </div>

				<div class="cinema-date-strip-wrapper">
					<button type="button" class="cinema-date-nav cinema-date-nav-left" title="向前滚动" aria-label="向前滚动">
						<i class="md-icon">chevron_left</i>
					</button>
					<div class="cinema-date-strip"></div>
					<button type="button" class="cinema-date-nav cinema-date-nav-right" title="向后滚动" aria-label="向后滚动">
						<i class="md-icon">chevron_right</i>
					</button>
				</div>

				<div class="itemsContainer vertical-wrap cinema-calendar-cards"></div>
				</div>
			`;

        this.bindEvents();
        this.renderDateStrip();
        showTabPageState(slider, "正在加载日历...");
    };

    CalendarTabController.prototype.bindEvents = function () {
        const slider = this.slider;

        slider.querySelectorAll("[data-filter]").forEach((btn) => {
            btn.addEventListener("click", () => {
                slider.querySelectorAll("[data-filter]").forEach(b => b.classList.remove("is-active"));
                btn.classList.add("is-active");
                this.activeFilter = btn.getAttribute("data-filter");
                this.updateDisplayedCards();
                this.renderDateStrip();
            });
        });
        slider.querySelectorAll("[data-country]").forEach(btn => {
            btn.addEventListener("click", () => {
                const country = btn.dataset.country;
                if (country === this.activeCountry) return;
                this.activeCountry = country;
                slider.querySelectorAll("[data-country]").forEach(tab => {
                    const active = tab.dataset.country === country;
                    tab.classList.toggle("is-active", active);
                    tab.setAttribute("aria-selected", String(active));
                });
                this.renderDateStrip();
                this.loadDateData(this.selectedDateIndex);
                this.prefetchAllDates();
            });
        });

        const strip = slider.querySelector(".cinema-date-strip");
        const navLeft = slider.querySelector(".cinema-date-nav-left");
        const navRight = slider.querySelector(".cinema-date-nav-right");
        const scrollStrip = (dir) => {
            if (!strip) return;
            strip.scrollBy({left: dir * Math.max(strip.clientWidth * 0.85, 200), behavior: "smooth"});
        };
        if (navLeft) navLeft.addEventListener("click", () => scrollStrip(-1));
        if (navRight) navRight.addEventListener("click", () => scrollStrip(1));
        if (strip) {
            const updateNavState = () => {
                if (this.paused || !this.view?.isConnected || !this.view.classList.contains("is-active")) return;
                const maxScroll = strip.scrollWidth - strip.clientWidth;
                if (navLeft) navLeft.classList.toggle("is-hidden", strip.scrollLeft <= 2);
                if (navRight) navRight.classList.toggle("is-hidden", strip.scrollLeft >= maxScroll - 2);
            };
            strip.addEventListener("scroll", updateNavState, {passive: true});
            this._dateStripObserver = new ResizeObserver(updateNavState);
            this._updateNavState = updateNavState;
        }

    };

    CalendarTabController.prototype.renderDateStrip = function () {
        const container = this.slider.querySelector(".cinema-date-strip");
        if (!container) return;
        container.innerHTML = this.datesList.map((d, idx) => {
            const counts = this.dateCounts.get(`${this.activeCountry}:${d.date}`);
            const countText = counts ? `${(counts[this.activeFilter] || 0)}部` : "...";
            const activeClass = idx === this.selectedDateIndex ? " is-active" : "";
            return `
					<button type="button" class="cinema-date-pill${activeClass}" data-date-idx="${idx}">
						<span class="cinema-date-pill-label">${d.label}</span>
						<span class="cinema-date-pill-sub">${d.weekday} · ${countText}</span>
					</button>
				`;
        }).join("");

        container.querySelectorAll(".cinema-date-pill").forEach((pill) => {
            pill.addEventListener("click", () => {
                const idx = parseInt(pill.getAttribute("data-date-idx"), 10);
                this.selectDate(idx);
            });
        });
        if (this._updateNavState) this._updateNavState();
    };

    CalendarTabController.prototype.selectDate = function (idx) {
        if (idx < 0 || idx >= this.datesList.length) return;
        this.selectedDateIndex = idx;

        const container = this.slider.querySelector(".cinema-date-strip");
        if (container) {
            container.querySelectorAll(".cinema-date-pill").forEach((pill, i) => {
                pill.classList.toggle("is-active", i === idx);
            });
            const activePill = container.querySelector(`.cinema-date-pill[data-date-idx="${idx}"]`);
            if (activePill && activePill.scrollIntoView) {
                activePill.scrollIntoView({behavior: "smooth", inline: "center", block: "nearest"});
            }
        }

        this.loadDateData(idx);
    };

    CalendarTabController.prototype.loadDateData = async function (idx, silent, country = this.activeCountry) {
        if (this.paused || !this.view.isConnected) return null;
        const dateObj = this.datesList[idx];
        const dateStr = dateObj.date;
        const cacheKey = `${country}:${dateStr}`;
        const countryQuery = country === "all" ? "" : `&with_origin_country=${country}`;
        const cardsContainer = silent ? null : this.slider.querySelector(".cinema-calendar-cards");
        if (!silent && this.slider.classList.contains("cinema-tab-loading")) showTabPageState(this.slider, "正在加载日历...");

        if (this.dateItemsCache.has(cacheKey)) {
            const cached = this.dateItemsCache.get(cacheKey);
            if (!silent && country === this.activeCountry && idx === this.selectedDateIndex) this.renderSchedule(cached, dateObj);
            return cached;
        }

        if (cardsContainer) {
            cardsContainer.innerHTML = loadingStateHtml();
        }

        const TMDB_KEY = host.getEffectiveTmdbKey ? host.getEffectiveTmdbKey() : (host.TMDB_KEY || "");
        if (!TMDB_KEY) {
            finishTabPageState(this.slider);
            const heroWrap = this.slider.querySelector(".cinema-calendar-hero");
            if (heroWrap) heroWrap.remove();
            if (cardsContainer) {
                cardsContainer.innerHTML = `
                    <div class="cinema-key-notice" style="grid-column: 1 / -1; width: 100%;">
                        <div class="cinema-key-notice-icon">🔑</div>
                        <div class="cinema-key-notice-title">未配置 TMDB API Key</div>
                        <div class="cinema-key-notice-desc">追剧日历需要 TMDB 访问权限以拉取全球放送数据，请在插件配置中填写 tmdbApiKey。</div>
                    </div>
                `;
            }
            return null;
        }

        const tvUrl = `${TMDB_API_BASE}/discover/tv?api_key=${TMDB_KEY}&language=zh-CN&air_date.gte=${dateStr}&air_date.lte=${dateStr}&sort_by=popularity.desc${countryQuery}`;

        const movieUrl = `${TMDB_API_BASE}/discover/movie?api_key=${TMDB_KEY}&language=zh-CN&primary_release_date.gte=${dateStr}&primary_release_date.lte=${dateStr}&sort_by=popularity.desc${countryQuery}`;

        const animeUrl1 = `${TMDB_API_BASE}/discover/tv?api_key=${TMDB_KEY}&language=zh-CN&air_date.gte=${dateStr}&air_date.lte=${dateStr}&with_genres=16&sort_by=popularity.desc${countryQuery}`;

        const animeUrl2 = `${TMDB_API_BASE}/discover/tv?api_key=${TMDB_KEY}&language=zh-CN&air_date.gte=${dateStr}&air_date.lte=${dateStr}&with_origin_country=${country === "all" ? "JP" : country}&sort_by=popularity.desc`;

        const [tvData, movieData, animeData1, animeData2] = await Promise.all([
            fetchWithCache(tvUrl),
            fetchWithCache(movieUrl),
            fetchWithCache(animeUrl1),
            fetchWithCache(animeUrl2)
        ]);
        if (![tvData, movieData, animeData1, animeData2].some(data => Array.isArray(data?.results))) {
            if (!silent && country === this.activeCountry && idx === this.selectedDateIndex) {
                showTabPageState(this.slider, "日历加载失败，请检查网络或 TMDB 服务后重试。", () => this.loadDateData(this.selectedDateIndex));
            }
            return null;
        }

        const rawTv = [
            ...((tvData && tvData.results) || []),
            ...((animeData1 && animeData1.results) || []),
            ...((animeData2 && animeData2.results) || [])
        ];

        const seenTv = new Set();
        const uniqueTv = [];
        for (const r of rawTv) {
            if (!seenTv.has(r.id)) {
                seenTv.add(r.id);
                uniqueTv.push(r);
            }
        }

        const rawMovie = (movieData && movieData.results) || [];

        const isAnimeItem = (r) => {
            const g = r.genre_ids || [];
            // 严格判定：番剧必须属于动画分类 (genre 16)，真人日剧 (如《青与碧》、《女友的朋友》) 属于普通剧集
            return g.includes(16);
        };

        const normalizedTv = uniqueTv.map(r => {
            const name = r.name || r.original_name;
            const isAnime = isAnimeItem(r);
            const network = (r.origin_country && r.origin_country[0]) || (r.original_language === "en" ? "TV Series" : (isAnime ? "Anime" : "Series"));

            return {
                id: r.id,
                title: name,
                original_title: r.original_name,
                poster_path: r.poster_path,
                backdrop_path: r.backdrop_path,
                release_date: r.first_air_date,
                vote_average: r.vote_average ? Number(r.vote_average.toFixed(1)) : 7.0,
                overview: r.overview,
                genre_ids: r.genre_ids || [],
                popularity: r.popularity || 0,
                mediaType: "tv",
                isAnime,
                network,
                epCode: "",
                epName: "",
                airTime: "更新中",
                isPremiere: false,
                isFinale: false
            };
        });

        const normalizedMovie = rawMovie.map(r => ({
            id: r.id,
            title: r.title || r.original_title,
            original_title: r.original_title,
            poster_path: r.poster_path,
            backdrop_path: r.backdrop_path,
            release_date: r.release_date || dateStr,
            vote_average: r.vote_average || 6.5,
            overview: r.overview,
            genre_ids: r.genre_ids || [],
            popularity: (r.popularity || 0) + 100,
            mediaType: "movie",
            isAnime: Boolean(r.genre_ids && r.genre_ids.includes(16))
        }));

        const animeList = normalizedTv.filter(i => i.isAnime);
        const regularTvList = normalizedTv.filter(i => !i.isAnime);

        const combinedAll = [...normalizedMovie, ...normalizedTv].sort((a, b) => b.popularity - a.popularity);

        const dataBundle = {
            all: combinedAll,
            movie: normalizedMovie,
            tv: regularTvList,
            anime: animeList,
            counts: {
                all: combinedAll.length,
                movie: normalizedMovie.length,
                tv: regularTvList.length,
                anime: animeList.length
            }
        };

        this.dateItemsCache.set(cacheKey, dataBundle);
        this.dateCounts.set(cacheKey, dataBundle.counts);

        if (!silent && country === this.activeCountry && idx === this.selectedDateIndex) {

            const pill = this.slider.querySelector(`.cinema-date-pill[data-date-idx="${idx}"] .cinema-date-pill-sub`);
            if (pill) pill.textContent = `${dateObj.weekday} · ${(dataBundle.counts[this.activeFilter] || 0)}部`;
            this.renderSchedule(dataBundle, dateObj);
        }
        return dataBundle;
    };

    CalendarTabController.prototype.prefetchAllDates = async function () {
        const country = this.activeCountry;
        if (this._prefetching === country) return;
        this._prefetching = country;
        const total = this.datesList.length;

        const phase = async (from, to) => {
            let next = from;
            const worker = async () => {
                while (next < to && this.activeCountry === country && !this.paused && this.view.isConnected) {
                    const idx = next++;
                    try {
                        await this.loadDateData(idx, true, country);
                    } catch (e) {
                    }
                }
            };
            await Promise.all(Array.from({length: 4}, worker));
        };

        const refreshUi = () => {
            if (!this.isRendered || this.activeCountry !== country) return;
            this.renderDateStrip();
        };

        try {
            await phase(0, Math.min(12, total));
        } catch (e) {
        }
        refreshUi();

        await new Promise((r) => setTimeout(r, 2500));
        try {
            await phase(12, total);
        } catch (e) {
        }
        if (this._prefetching === country) this._prefetching = null;
        refreshUi();
    };

    CalendarTabController.prototype.renderSchedule = function (bundle, dateObj) {

        const featured = bundle.movie.find(it => (it.title || "").includes("诈死游戏")) ||
            bundle.all.find(it => it.backdrop_path && it.overview && it.overview.length > 20) ||
            bundle.all[0];

        const heroWrap = this.slider.querySelector(".cinema-calendar-hero");
        if (heroWrap) heroWrap.classList.toggle("hide", !featured);
        if (heroWrap && featured) {
            heroWrap.classList.remove("is-loading");
            const bgUrl = getTmdbImg(featured.backdrop_path, "w1280") || getTmdbImg(featured.poster_path, "w500");
            const heroBg = heroWrap.querySelector(".cinema-calendar-hero-bg");
            if (heroBg) heroBg.style.backgroundImage = bgUrl ? `url('${bgUrl}')` : "none";

            const year = (featured.release_date || "").slice(0, 4);
            const isMovie = featured.mediaType === "movie";
            const typeText = isMovie ? "电影" : (featured.isAnime ? "番剧" : "剧集");
            const chips = [];
            chips.push(typeText);
            if (year) chips.push(year);
            if (featured.vote_average && featured.vote_average > 0) chips.push("★ " + featured.vote_average.toFixed(1));
            (featured.genre_ids || []).slice(0, 3).forEach((gid) => {
                const g = GENRE_MAP[gid];
                if (g) chips.push(g);
            });
            if (featured.network) chips.push(featured.network);

            const featInLibId = checkInLibrary(featured);
            const contentEl = heroWrap.querySelector(".cinema-calendar-hero-content");
            if (contentEl) {
                contentEl.innerHTML = heroContentHtml({
                    title: featured.title,
                    subtitle: `${featured.original_title || featured.title}${year ? ` · ${year}` : ""}`,
                    chips,
                    overview: featured.overview || "暂无详细剧情简介。",
                    actions: CinemaHome.heroActionsHtml({
                        showPlay: !!featInLibId,
                        playClass: "cinema-hero-play-btn",
                        detailClass: "cinema-hero-action-btn"
                    })
                });

                const playBtn = contentEl.querySelector(".cinema-hero-play-btn");
                if (playBtn) {
                    playBtn.addEventListener("click", () => {
                        if (featInLibId) CinemaHome.showItem(featInLibId);
                    });
                }
                const actionBtn = contentEl.querySelector(".cinema-hero-action-btn");
                if (actionBtn) {
                    actionBtn.addEventListener("click", () => {
                        showDetailDialog(featured, featInLibId, null);
                    });
                }
            }
        }
        this.updateDisplayedCards();
        finishTabPageState(this.slider);
    };

    CalendarTabController.prototype.updateDisplayedCards = function () {
        const dateObj = this.datesList[this.selectedDateIndex];
        const bundle = this.dateItemsCache.get(`${this.activeCountry}:${dateObj.date}`);
        const cardsContainer = this.slider.querySelector(".cinema-calendar-cards");
        if (!cardsContainer || !bundle) return;

        let items = (bundle.all || []).filter(it => Boolean(it.poster_path || it.backdrop_path));
        if (this.activeFilter === "movie") items = (bundle.movie || []).filter(it => Boolean(it.poster_path || it.backdrop_path));
        else if (this.activeFilter === "tv") items = (bundle.tv || []).filter(it => Boolean(it.poster_path || it.backdrop_path));
        else if (this.activeFilter === "anime") items = (bundle.anime || []).filter(it => Boolean(it.poster_path || it.backdrop_path));

        if (!items || items.length === 0) {
            cardsContainer.innerHTML = '<div style="padding: 60px 0; text-align: center; color: rgba(255,255,255,0.4); width: 100%;">当前分类今日暂无排期更新</div>';
            return;
        }

        cardsContainer.innerHTML = items.map(it => {
            const year = (it.release_date || it.first_air_date || "").slice(0, 4);
            const typeText = it.mediaType === "movie" ? "电影" : (it.isAnime ? "番剧" : "剧集");
            const network = it.network ? ` · ${it.network}` : "";
            const metaLine = `${year ? `${year} · ` : ""}${typeText}${network}`;

            let premiereTag = "";
            if (it.isPremiere) {
                premiereTag = `<div class="cinema-card-premiere-tag">▶ 季首播</div>`;
            } else if (it.isFinale) {
                premiereTag = `<div class="cinema-card-premiere-tag" style="color:#e50914;">▶ 季终</div>`;
            }

            return posterCardHtml(it, {
                className: "cinema-calendar-card",
                meta: metaLine,
                episodeHtml: renderCalendarEpisode(it),
                footerHtml: premiereTag,
                removeBrokenImage: true
            });
        }).join("");

        cardsContainer.querySelectorAll(".card").forEach(card => {
            card.addEventListener("click", async () => {
                const id = card.getAttribute("data-id");
                const it = items.find(x => String(x.id) === String(id));
                if (!it) return;
                const inLibId = checkInLibrary(it);
                if (inLibId) {
                    // 如果尚未拉取最新集数信息，先异步拉取以确保季数和集数判定准确
                    if (!it.epCode && it.mediaType !== "movie") {
                        const epInfo = await this.fetchTvEpisodeInfo(it.id);
                        if (epInfo && epInfo.epCode) {
                            it.epCode = epInfo.epCode;
                            if (epInfo.epName) it.epName = epInfo.epName;
                        }
                    }

                    // 检查是否缺少集数（包括历史缺集与当前季更新集）
                    const missingInfo = await checkMissingEpisodesInfo(it, inLibId);
                    // 仅当明确确认媒体库已完整入库当前更新季且无任何缺集时，才直达原生详情页
                    if (missingInfo && !missingInfo.isMissing && missingInfo.isCurrentSeasonInLibrary !== false) {
                        CinemaHome.showItem(inLibId);
                    } else {
                        // 缺少集数、当前季未入库（如仅入库第1季而更新第2季）或未确认完整入库时，打开详情弹窗展示缺集、转存/订阅
                        showDetailDialog(it, inLibId, missingInfo);
                    }
                } else {
                    showDetailDialog(it, null, null);
                }
            });
        });

        // 异步并发拉取真实集数 (SxxExx) 并动态检查缺集数量，实时将右上角徽章更新为缺失数量
        const tvItemsToFetch = items.filter(it => it.mediaType !== "movie").slice(0, 50);
        if (tvItemsToFetch.length > 0) {
            Promise.all(tvItemsToFetch.map(async (tvIt) => {
                let epCode = tvIt.epCode;
                if (!epCode) {
                    const epInfo = await this.fetchTvEpisodeInfo(tvIt.id);
                    if (epInfo && epInfo.epCode) {
                        tvIt.epCode = epCode = epInfo.epCode;
                        const card = cardsContainer.querySelector(`.cinema-calendar-card[data-id="${tvIt.id}"]`);
                        if (card) {
                            const epOverlay = card.querySelector(".cinema-card-ep-overlay");
                            if (epOverlay) {
                                epOverlay.innerHTML = renderCalendarEpisode(tvIt);
                            }
                        }
                    }
                }

                // 针对已入库剧集，实时核算缺失集数并更新右上角状态角标。
                const inLibId = checkInLibrary(tvIt);
                if (inLibId) {
                    const missingInfo = await checkMissingEpisodesInfo(tvIt, inLibId);
                    const card = cardsContainer.querySelector(`.cinema-calendar-card[data-id="${tvIt.id}"]`);
                    if (card) {
                        let badge = card.querySelector(".cinema-card-inlibrary-badge");
                        if (!badge) {
                            badge = document.createElement("div");
                            badge.className = "cinema-card-inlibrary-badge";
                            card.querySelector(".cinema-card-badges")?.appendChild(badge);
                        }
                        if (missingInfo && missingInfo.isMissing) {
                            badge.className = "cinema-card-inlibrary-badge is-missing";
                            if (missingInfo.isCurrentSeasonInLibrary === false) {
                                badge.textContent = `缺S${missingInfo.targetSeason}`;
                                const seasonsText = missingInfo.existingSeasons && missingInfo.existingSeasons.length > 0
                                    ? `第 ${missingInfo.existingSeasons.join("、")} 季`
                                    : "其他季";
                                badge.title = `已入库${seasonsText}，但第 ${missingInfo.targetSeason} 季未入库（缺 ${missingInfo.totalMissingCount} 集）`;
                            } else {
                                badge.textContent = `缺${missingInfo.totalMissingCount}集`;
                                badge.title = `已入库，但缺少 ${missingInfo.totalMissingCount} 集未更新`;
                            }
                        } else {
                            badge.className = "cinema-card-inlibrary-badge";
                            badge.textContent = "已入库";
                            badge.title = "已完整入库";
                        }
                    }
                }
            })).catch(() => {
            });
        }
    };

    /* ChartsTabController */
    function ChartsTabController(view, params, options) {
        CinemaBaseTab.call(this, view, params, options);
        this.slider = view.querySelector(".scrollSlider") || view;
        this.platform = "netflix";
        this.type = "tv";
        this.region = "US";
        this.period = "month";
        this.isRendered = false;
        this.chartsCache = new Map();
    }

    ChartsTabController.prototype.onResume = function (options) {
        CinemaBaseTab.prototype.onResume.call(this, options);
        updateCinemaTabTopOffset();
        const TMDB_KEY = host.getEffectiveTmdbKey ? host.getEffectiveTmdbKey() : (host.TMDB_KEY || "");
        if (!TMDB_KEY) {
            if (!this.isRendered) {
                this.renderBase();
                this.isRendered = true;
            }
            return;
        }
        if (!this.isRendered) {
            this.renderBase();
            this.isRendered = true;
        }
        ensureLibraryIndex().then(() => {
            if (!this.paused) this.fetchAndRenderCharts();
        });
    };

    ChartsTabController.prototype.onPause = function () {
        CinemaBaseTab.prototype.onPause.call(this);
    };
    ChartsTabController.prototype.destroy = function () {
        this.chartsCache.clear();
        CinemaBaseTab.prototype.destroy.call(this);
    };

    ChartsTabController.prototype.renderBase = function () {
        const slider = this.slider;
        const TMDB_KEY = host.getEffectiveTmdbKey ? host.getEffectiveTmdbKey() : (host.TMDB_KEY || "");
        if (!TMDB_KEY) {
            slider.innerHTML = `
                    <div class="cinema-key-notice" style="min-height: calc(100vh - var(--cinema-tab-top, 56px) - 120px); justify-content: center;">
                        <div class="cinema-key-notice-icon">🔑</div>
                        <div class="cinema-key-notice-title">未配置 TMDB API Key</div>
                        <div class="cinema-key-notice-desc">热门榜单需要 TMDB 访问权限以拉取平台热播数据，请在配置中填写 tmdbApiKey。</div>
                    </div>
                `;
            return;
        }
        slider.innerHTML = `
				<div class="cinema-charts-spotlight-container"></div>

				<div class="cinema-tab-body padded-left padded-right">
				<div class="cinema-charts-filter-row">
					<!-- 第一行：榜单 / 平台切换 -->
					<div class="cinema-charts-filter-line cinema-charts-line-platform">
						<span class="cinema-charts-group-label">榜单:</span>
                        <div class="cinema-filter-pills cinema-charts-filter-group cinema-group-platform"></div>
					</div>
                    <!-- 类型 / 地区 / 周期：手机端每组独立一行 -->
					<div class="cinema-charts-filter-line cinema-charts-line-sub">
                        <div class="cinema-calendar-filter-row">
                            <span class="cinema-charts-group-label">类型:</span>
                            <div class="cinema-filter-pills cinema-charts-filter-group cinema-group-type">
                                <button type="button" class="cinema-charts-btn is-active" data-type="tv">剧集</button>
                                <button type="button" class="cinema-charts-btn" data-type="movie">电影</button>
                            </div>
                        </div>
                        <div class="cinema-calendar-filter-row">
                            <span class="cinema-charts-group-label">地区:</span>
                            <div class="cinema-filter-pills cinema-charts-filter-group cinema-group-region"></div>
                        </div>
                        <div class="cinema-calendar-filter-row">
                            <span class="cinema-charts-group-label">周期:</span>
                            <div class="cinema-filter-pills cinema-charts-filter-group cinema-group-period">
                                <button type="button" class="cinema-charts-btn is-active" data-period="month">本月</button>
                                <button type="button" class="cinema-charts-btn" data-period="year">今年</button>
                                <button type="button" class="cinema-charts-btn" data-period="all">全部</button>
                            </div>
                        </div>
					</div>
				</div>

				<div class="cinema-charts-rank-section">
					<div class="cinema-charts-rank-header">
                        <div class="cinema-charts-rank-header-title"></div>
						<div class="cinema-charts-rank-header-sub">榜单会随所选地区重新排序</div>
					</div>
					<div class="itemsContainer vertical-wrap cinema-charts-rank-grid"></div>
				</div>
				</div>
			`;

        this.renderFilterPills();
        this.bindEvents();
        showTabPageState(slider, "正在加载榜单...");
    };

    ChartsTabController.prototype.renderFilterPills = function () {
        const slider = this.slider;

        const platformGroup = slider.querySelector(".cinema-group-platform");
        if (platformGroup) {
            platformGroup.innerHTML = Object.keys(PLATFORMS).map(k => {
                const p = PLATFORMS[k];
                const activeClass = k === this.platform ? " is-active" : "";
                const iconHtml = p.logo
                    ? `<img class="cinema-platform-logo" src="${p.logo}" alt="${p.name}" loading="lazy" referrerpolicy="no-referrer" />`
                    : "";
                return `
						<button type="button" class="cinema-charts-btn${activeClass}" data-platform="${k}" title="${p.name}">
							${iconHtml}
							<span>${p.name}</span>
						</button>
					`;
            }).join("");
        }

        const regionGroup = slider.querySelector(".cinema-group-region");
        if (regionGroup) {
            REGIONS.forEach(r => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = `cinema-charts-btn${r.code === this.region ? " is-active" : ""}`;
                btn.setAttribute("data-region", r.code);
                btn.textContent = r.name;
                regionGroup.appendChild(btn);
            });
        }
    };

    ChartsTabController.prototype.bindEvents = function () {
        for (const field of ["platform", "type", "region", "period"]) {
            const buttons = this.slider.querySelectorAll(`.cinema-group-${field} .cinema-charts-btn`);
            buttons.forEach(button => {
                button.addEventListener("click", () => {
                    buttons.forEach(other => other.classList.toggle("is-active", other === button));
                    this[field] = button.dataset[field];
                    this.fetchAndRenderCharts();
                });
            });
        }
    };

    ChartsTabController.prototype.fetchAndRenderCharts = async function () {
        if (this.paused || !this.view.isConnected) return;
        const slider = this.slider;
        if (slider.classList.contains("cinema-tab-loading")) showTabPageState(slider, "正在加载榜单...");
        const TMDB_KEY = host.getEffectiveTmdbKey ? host.getEffectiveTmdbKey() : (host.TMDB_KEY || "");
        if (!TMDB_KEY) {
            finishTabPageState(slider);
            const spotlightContainer = slider.querySelector(".cinema-charts-spotlight-container");
            if (spotlightContainer) spotlightContainer.innerHTML = "";
            const rankGrid = slider.querySelector(".cinema-charts-rank-grid");
            if (rankGrid) {
                rankGrid.innerHTML = `
                    <div class="cinema-key-notice" style="grid-column: 1 / -1; width: 100%;">
                        <div class="cinema-key-notice-icon">🔑</div>
                        <div class="cinema-key-notice-title">未配置 TMDB API Key</div>
                        <div class="cinema-key-notice-desc">热门榜单需要 TMDB 访问权限以拉取平台热播数据，请在插件配置中填写 tmdbApiKey。</div>
                    </div>
                `;
            }
            return;
        }

        const pInfo = PLATFORMS[this.platform] || PLATFORMS.netflix;
        const rInfo = REGIONS.find(r => r.code === this.region) || REGIONS[0];
        const typeName = this.type === "tv" ? "剧集" : "电影";
        const limit = Math.max(1, Math.min(100, parseInt(CONFIG.chartLimit, 10) || 20));
        const renderVersion = this.renderVersion = (this.renderVersion || 0) + 1;

        const cacheKey = `CHARTS_${this.platform}_${this.type}_${this.region}_${this.period}_${limit}`;
        const spotlightContainer = slider.querySelector(".cinema-charts-spotlight-container");
        const rankGrid = slider.querySelector(".cinema-charts-rank-grid");

        let items = null;
        let requestFailed = false;
        if (this.chartsCache.has(cacheKey)) {
            items = this.chartsCache.get(cacheKey);
        } else {
            if (spotlightContainer) {
                spotlightContainer.innerHTML = heroPlaceholderHtml("cinema-charts-hero", 2);
            }
            if (rankGrid) rankGrid.innerHTML = loadingStateHtml();
            const rankSectionEl = slider.querySelector(".cinema-charts-rank-section");
            if (rankSectionEl) rankSectionEl.classList.add("is-loading");

            const endpoint = this.type === "tv" ? "discover/tv" : "discover/movie";
            const dateField = this.type === "tv" ? "first_air_date" : "primary_release_date";

            const today = new Date();
            const pad2 = (n) => (n < 10 ? "0" + n : "" + n);
            const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
            const todayStr = ymd(today);
            const yearStart = `${today.getFullYear()}-01-01`;
            const monthStart = ymd(new Date(today.getTime() - 30 * 86400000));

            const periodStart = this.period === "month" ? monthStart : (this.period === "year" ? yearStart : null);

            const buildUrl = (start) => {
                const dp = start ? `&${dateField}.gte=${start}&${dateField}.lte=${todayStr}` : "";
                return `${TMDB_API_BASE}/${endpoint}?api_key=${TMDB_KEY}&language=zh-CN&watch_region=${this.region}&with_watch_providers=${pInfo.provider}&sort_by=popularity.desc&vote_count.gte=5${dp}`;
            };
            const buildNetworkUrl = (start) => {
                const dp = start ? `&${dateField}.gte=${start}&${dateField}.lte=${todayStr}` : "";
                return `${TMDB_API_BASE}/${endpoint}?api_key=${TMDB_KEY}&language=zh-CN&with_networks=${pInfo.network}&sort_by=popularity.desc&vote_count.gte=5${dp}`;
            };

            let items2 = [];
            const tryFetch = async (url) => {
                const results = [];
                for (let page = 1; page <= Math.ceil(limit / 20); page++) {
                    if (this.paused || renderVersion !== this.renderVersion) break;
                    const data = await fetchWithCache(`${url}&page=${page}`);
                    if (!data || !Array.isArray(data.results)) {
                        requestFailed = true;
                        break;
                    }
                    if (!data.results.length) break;
                    results.push(...data.results);
                    if (results.length >= limit || page >= data.total_pages) break;
                }
                return results.slice(0, limit);
            };

            items2 = await tryFetch(buildUrl(periodStart));

            if (!requestFailed && items2.length < 5 && periodStart !== yearStart) items2 = await tryFetch(buildUrl(yearStart));

            if (!requestFailed && items2.length < 5) items2 = await tryFetch(buildUrl(null));

            if (!requestFailed && items2.length < 5 && pInfo.network) {
                items2 = await tryFetch(buildNetworkUrl(periodStart));
                if (!requestFailed && items2.length < 5 && periodStart !== yearStart) items2 = await tryFetch(buildNetworkUrl(yearStart));
                if (!requestFailed && items2.length < 5) items2 = await tryFetch(buildNetworkUrl(null));
            }

            items = items2;
            if (!requestFailed && !this.paused && renderVersion === this.renderVersion) this.chartsCache.set(cacheKey, items);
        }
        if (this.paused || renderVersion !== this.renderVersion) return;
        if (requestFailed) {
            showTabPageState(slider, "榜单加载失败，请检查网络或 TMDB 服务后重试。", () => this.fetchAndRenderCharts());
            return;
        }

        if (!items || items.length === 0) {
            if (spotlightContainer) spotlightContainer.innerHTML = '<div style="padding: 60px; text-align: center; color: rgba(255,255,255,0.4);">当前平台与地区暂无对应热门内容</div>';
            if (rankGrid) rankGrid.innerHTML = "";
            finishTabPageState(slider);
            return;
        }

        const rankSectionEl2 = slider.querySelector(".cinema-charts-rank-section");
        if (rankSectionEl2) rankSectionEl2.classList.remove("is-loading");

        const topItem = items[0];
        const otherItems = items.slice(1, limit);
        const rankHeader = slider.querySelector(".cinema-charts-rank-header");
        rankHeader.classList.toggle("hide", otherItems.length === 0);
        rankHeader.querySelector(".cinema-charts-rank-header-title").textContent = `第 2–${Math.min(items.length, limit)} 名`;

        if (spotlightContainer && topItem) {
            const title = topItem.title || topItem.name;
            const year = (topItem.release_date || topItem.first_air_date || "").slice(0, 4);
            const rating = topItem.vote_average ? topItem.vote_average.toFixed(1) : "暂无";
            const overview = topItem.overview || "暂无剧集简介。";

            const topInLibId = checkInLibrary(topItem);

            const spotChips = [];
            spotChips.push(typeName);
            if (year) spotChips.push(year);
            if (rating && rating !== "暂无") spotChips.push("★ " + rating);
            (Array.isArray(topItem.genre_ids) ? topItem.genre_ids : []).slice(0, 3).forEach((gid) => {
                const g = GENRE_MAP[gid];
                if (g) spotChips.push(g);
            });

            const heroBgUrl = getTmdbImg(topItem.backdrop_path, "w1280") || getTmdbImg(topItem.poster_path, "w780");

            spotlightContainer.innerHTML = `
					<div class="cinema-calendar-hero cinema-charts-hero padded-left padded-right">
						<div class="cinema-calendar-hero-bg" style="${heroBgUrl ? `background-image: url('${heroBgUrl}');` : ''}"></div>
						<div class="cinema-calendar-hero-content">
                            ${heroContentHtml({
                title,
                subtitle: `${topItem.original_title || topItem.original_name || title}${year ? ` · ${year}` : ""} · ${pInfo.name} ${rInfo.name}第 1 名`,
                chips: spotChips,
                overview,
                actions: CinemaHome.heroActionsHtml({
                    showPlay: !!topInLibId,
                    playClass: "cinema-spotlight-play-btn",
                    detailClass: "cinema-spotlight-btn"
                })
            })}
						</div>
					</div>
				`;

            const playBtn = spotlightContainer.querySelector(".cinema-spotlight-play-btn");
            if (playBtn) {
                playBtn.addEventListener("click", () => {
                    CinemaHome.showItem(topInLibId);
                });
            }

            const btn = spotlightContainer.querySelector(".cinema-spotlight-btn");
            if (btn) {
                btn.addEventListener("click", () => {
                    if (topInLibId) {
                        CinemaHome.showItem(topInLibId);
                    } else {
                        showDetailDialog({
                            ...topItem,
                            mediaType: this.type
                        });
                    }
                });
            }
        }

        if (rankGrid) {
            rankGrid.innerHTML = otherItems.map((it, idx) => {
                const year = (it.release_date || it.first_air_date || "").slice(0, 4);
                return posterCardHtml(it, {
                    className: "cinema-chart-rank-card",
                    meta: `${year ? `${year} · ` : ""}${typeName}`,
                    rank: idx + 2
                });
            }).join("");

            rankGrid.querySelectorAll(".cinema-chart-rank-card").forEach(card => {
                card.addEventListener("click", () => {
                    const id = card.getAttribute("data-id");
                    const it = otherItems.find(x => String(x.id) === String(id));
                    if (!it) return;
                    const inLibId = checkInLibrary(it);
                    if (inLibId) {
                        CinemaHome.showItem(inLibId);
                    } else {
                        showDetailDialog({
                            ...it,
                            mediaType: this.type
                        });
                    }
                });
            });
        }
        finishTabPageState(slider);
    };

    /* Tab 集成与生命周期 */

    const HOME_TABS = [
        {name: "首页", id: "home"},
        {name: "日历", id: "calendar"},
        {name: "榜单", id: "charts"},
        {name: "收藏夹", id: "favorites"}
    ];

    function showTabPageState(slider, text, retry = null) {
        slider.classList.add("cinema-tab-loading");
        slider.setAttribute("aria-busy", String(!retry));
        let state = slider.querySelector(":scope > .cinema-tab-page-state");
        if (!state) {
            state = document.createElement("div");
            state.className = "cinema-tab-page-state";
            slider.prepend(state);
        }
        state.setAttribute("role", retry ? "alert" : "status");
        state.innerHTML = `${retry ? "" : '<div class="cinema-spinner" aria-hidden="true"></div>'}<div>${escapeHtml(text)}</div>${retry ? '<button type="button" class="emby-button raised button-submit">重试</button>' : ""}`;
        if (retry) state.querySelector("button").addEventListener("click", retry);
    }

    function finishTabPageState(slider) {
        slider.classList.remove("cinema-tab-loading");
        slider.setAttribute("aria-busy", "false");
        slider.querySelector(":scope > .cinema-tab-page-state")?.remove();
    }

    function loadingStateHtml() {
        return Array.from({length: 8}, () => `
                <div class="card portraitCard" aria-hidden="true">
                    <div class="cardBox cardBox-bottompadded">
                        <div class="cardContent cardImageContainer cardPadder-portrait cinema-shimmer"></div>
                        <div class="cardText cardText-first-padded cinema-skel-name cinema-shimmer"></div>
                        <div class="cardText cardText-secondary cinema-skel-meta cinema-shimmer"></div>
                    </div>
                </div>
            `).join("");
    }

    let _baseTabPromise = null;

    function ensureBaseTab() {
        if (_baseTabPromise) return _baseTabPromise;
        const modulePromise = window.Emby && typeof window.Emby.importModule === "function"
            ? window.Emby.importModule("./modules/tabbedview/basetab.js")
            : new Promise((resolve, reject) => window.require(["baseTab"], resolve, reject));
        _baseTabPromise = modulePromise.then(mod => {
            CinemaBaseTab = mod.default || mod;
            [CalendarTabController, ChartsTabController].forEach(Ctrl => {
                Object.setPrototypeOf(Ctrl.prototype, CinemaBaseTab.prototype);
            });
            return CinemaBaseTab;
        });
        return _baseTabPromise;
    }

    // 注册双 Tab 到 EmbyPlus 宿主

    ensureBaseTab();
    if (!CONFIG.calendarRequireAdmin) {
        host.registerTab({id: 'calendar', name: '日历', controller: CalendarTabController});
    }
    if (!CONFIG.chartsRequireAdmin) {
        host.registerTab({id: 'charts', name: '榜单', controller: ChartsTabController});
    }
    if (CONFIG.calendarRequireAdmin || CONFIG.chartsRequireAdmin) {
        if (host.checkUserAdminStatus) {
            host.checkUserAdminStatus().then(isAdmin => {
                if (isAdmin) {
                    if (CONFIG.calendarRequireAdmin) {
                        host.registerTab({id: 'calendar', name: '日历', controller: CalendarTabController});
                    }
                    if (CONFIG.chartsRequireAdmin) {
                        host.registerTab({id: 'charts', name: '榜单', controller: ChartsTabController});
                    }
                }
            });
        }
    }

}, `
/* ================== TMDB Key 未配置极简原生空状态 (无边框、无阴影、完全融合背景) ================== */
.cinema-key-notice {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 48px 20px !important;
    margin: 0 auto !important;
    width: 100% !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    text-align: center !important;
    box-sizing: border-box !important;
}

.cinema-key-notice-icon {
    font-size: 36px !important;
    line-height: 1 !important;
    margin-bottom: 10px !important;
    opacity: 0.3 !important;
    filter: grayscale(1) !important;
}

.cinema-key-notice-title {
    font-size: 14.5px !important;
    font-weight: 500 !important;
    color: rgba(255, 255, 255, 0.55) !important;
    margin: 0 0 6px 0 !important;
    letter-spacing: 0.2px !important;
}

.cinema-key-notice-desc {
    font-size: 12.5px !important;
    line-height: 1.5 !important;
    color: rgba(255, 255, 255, 0.35) !important;
    margin: 0 !important;
}

.cinema-key-notice-icon {
    font-size: 32px !important;
    line-height: 1 !important;
    margin-bottom: 8px !important;
    opacity: 0.8 !important;
}

.cinema-key-notice-title {
    font-size: 15px !important;
    font-weight: 600 !important;
    color: rgba(255, 255, 255, 0.9) !important;
    margin: 0 0 6px 0 !important;
}

.cinema-key-notice-desc {
    font-size: 12.5px !important;
    line-height: 1.5 !important;
    color: rgba(255, 255, 255, 0.5) !important;
    margin: 0 !important;
}

/* 弹窗右上角悬浮圆形关闭按钮 (绝对定位在右上角，绝不撑开顶部) */
.cinema-dialog-corner-close {
    position: absolute !important;
    top: 14px !important;
    right: 14px !important;
    width: 32px !important;
    height: 32px !important;
    border-radius: 50% !important;
    background: rgba(0, 0, 0, 0.55) !important;
    border: 1px solid rgba(255, 255, 255, 0.22) !important;
    color: rgba(255, 255, 255, 0.85) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    cursor: pointer !important;
    z-index: 50 !important;
    padding: 0 !important;
    margin: 0 !important;
    outline: none !important;
    box-sizing: border-box !important;
    transition: all 0.2s ease !important;
    backdrop-filter: blur(8px) !important;
    -webkit-backdrop-filter: blur(8px) !important;
}

.cinema-dialog-corner-close:hover {
    background: rgba(255, 255, 255, 0.22) !important;
    color: #ffffff !important;
    transform: scale(1.08) !important;
}

.cinema-dialog-corner-close svg {
    width: 16px !important;
    height: 16px !important;
    fill: currentColor !important;
    pointer-events: none !important;
}

/* ==========================================================================
   【追剧日历】与【热门榜单】Tab 原生 Emby 页面排版与样式规范 (重构优化版)
   ========================================================================== */

/* Tab 内容根容器 */
.cinema-calendar-tab-content,
.cinema-charts-tab-content {
    /* 保持页面背景可见（不再整页纯黑） */
    background: transparent !important;
    overflow-x: hidden !important;
}

/* 占满页面宽度，无多余死角边距 */
.cinema-calendar-scrollslider,
.cinema-charts-scrollslider {
    /* 仅顶部区域渐隐压暗：Hero 底部无缝过渡，下方仍保留页面背景 */
    background: linear-gradient(180deg,
        #0b0d12 0%,
        rgba(11, 13, 18, 0.96) 420px,
        rgba(11, 13, 18, 0.7) 640px,
        rgba(11, 13, 18, 0.3) 860px,
        rgba(11, 13, 18, 0) 1080px) !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    padding-top: var(--cinema-tab-top, 150px) !important;
    padding-bottom: 80px !important;
    box-sizing: border-box !important;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
}

/* 原生内容内边距只作用于正文；Hero 自身全宽，不再用百分比负边距补偿。 */
.cinema-tab-body {
    box-sizing: border-box;
    min-width: 0;
}

.cinema-tab-loading {
    padding-bottom: 0 !important;
}
.cinema-tab-loading > :not(.cinema-tab-page-state),
.cinema-calendar-hero.hide {
    display: none !important;
}
.cinema-tab-page-state {
    min-height: calc(100vh - var(--cinema-tab-top, 56px));
    min-height: calc(100dvh - var(--cinema-tab-top, 56px));
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 16px;
    padding: 24px;
    box-sizing: border-box;
    text-align: center;
    color: rgba(255, 255, 255, 0.8);
}

/* ================== 追剧日历 Hero Banner（与首页大图完全一致的风格） ================== */
.cinema-calendar-hero {
    position: relative !important;
    width: auto !important;
    /* 顶部上提，横向保持原生页面边界。 */
    margin-left: 0 !important;
    margin-right: 0 !important;
    margin-top: calc(-1 * var(--cinema-tab-top, 0px)) !important;
    min-height: 340px !important;
    max-height: 560px !important;
    border-radius: 0 !important;
    overflow: hidden !important;
    margin-bottom: 8px !important;
    background: none !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: flex-end !important;
    /* 横向使用原生 padded-left / padded-right，顶栏高度仅控制纵向。 */
    padding-top: calc(var(--cinema-tab-top, 0px) + 4px) !important;
    padding-bottom: 16px !important;
    box-sizing: border-box !important;
    box-shadow: none !important;
    border: none !important;
}

/* Hero 背景层：底部做淡出遮罩，使海报自然融入页面背景（与首页一致） */
.cinema-calendar-hero-bg {
    position: absolute !important;
    inset: 0 !important;
    z-index: 0 !important;
    background-size: cover !important;
    background-position: center center !important;
    background-repeat: no-repeat !important;
    pointer-events: none !important;
}

/* 与首页大图一致的融合渐变（含顶部暗化，使背景与顶栏无缝衔接） */
.cinema-calendar-hero::before {
    content: '' !important;
    position: absolute !important;
    inset: 0 !important;
    background:
        linear-gradient(90deg,
            rgba(10, 12, 16, 0.94) 0%,
            rgba(10, 12, 16, 0.82) 22%,
            rgba(10, 12, 16, 0.48) 45%,
            rgba(10, 12, 16, 0.15) 70%,
            transparent 100%),

        linear-gradient(180deg,
            rgba(0, 0, 0, 0.65) 0%,
            transparent 20%),
        linear-gradient(0deg,
            #0b0d12 0%,
            rgba(11, 13, 18, 0.94) 4%,
            rgba(11, 13, 18, 0.6) 11%,
            rgba(11, 13, 18, 0) 30%) !important;
    pointer-events: none !important;
    z-index: 1 !important;
}

.cinema-calendar-hero-content {
    position: relative !important;
    z-index: 2 !important;
    max-width: 680px !important;
}

/* 去掉 h1 默认 margin-top，消除海报上方多余间距 */
.cinema-calendar-hero .cinema-title,
.cinema-charts-hero .cinema-title {
    margin-top: 0 !important;
}

/* 副标题（原名 · 年份） */
.cinema-sub-title {
    font-size: 13px !important;
    font-weight: 500 !important;
    color: rgba(255, 255, 255, 0.62) !important;
    letter-spacing: 0.4px !important;
    margin: 0 0 10px 0 !important;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.85) !important;
}

.cinema-btn-gold {
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    background: #f5a623 !important;
    color: #141414 !important;
    font-weight: 700 !important;
    border-radius: 8px !important;
    padding: 8px 18px !important;
    font-size: 14px !important;
    border: none !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    box-shadow: 0 4px 14px rgba(245, 166, 35, 0.4) !important;
}

.cinema-btn-gold:hover {
    background: #ffb738 !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 20px rgba(245, 166, 35, 0.6) !important;
}

/* Hero 元数据胶囊容器：复用首页 .cinema-genre-list / .cinema-genre-badge 样式 */
.cinema-hero-chips {
    display: inline-flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    gap: 6px !important;
}

.cinema-btn-green {
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    background: #52B54B !important;
    color: #ffffff !important;
    font-weight: 700 !important;
    border-radius: 8px !important;
    padding: 8px 18px !important;
    font-size: 14px !important;
    border: none !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    box-shadow: 0 4px 14px rgba(82, 181, 75, 0.4) !important;
}

.cinema-btn-green:hover {
    background: #5dc955 !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 20px rgba(82, 181, 75, 0.6) !important;
}

/* ================== 日历头部与筛选器 ================== */
.cinema-calendar-filter-row {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    min-width: 0;
    margin-bottom: 8px;
}

.cinema-country-row {
    margin-bottom: 12px;
}

.cinema-filter-pills {
    display: inline-flex !important;
    align-items: center;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: thin;
    background: rgba(255, 255, 255, 0.06) !important;
    padding: 3px !important;
    border-radius: 8px !important;
    gap: 4px !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
}

.cinema-calendar-filter-row .cinema-pill-btn,
.cinema-charts-btn {
    border: none !important;
    background: transparent !important;
    color: rgba(255, 255, 255, 0.7) !important;
    padding: 6px 14px !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    font-family: inherit !important;
    line-height: 16px !important;
    height: 28px !important;
    min-width: 0 !important;
    margin: 0 !important;
    box-sizing: border-box !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 4px !important;
    flex: 0 0 auto;
    white-space: nowrap;
    border-radius: 6px !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
}

.cinema-calendar-filter-row .cinema-pill-btn:hover,
.cinema-charts-btn:hover {
    color: #ffffff !important;
    background: rgba(255, 255, 255, 0.1) !important;
}

.cinema-calendar-filter-row .cinema-pill-btn.is-active,
.cinema-charts-btn.is-active {
    background: #f5a623 !important;
    color: #141414 !important;
    font-weight: 700 !important;
    box-shadow: 0 2px 8px rgba(245, 166, 35, 0.3) !important;
}

/* ================== 横向日期选择条 ================== */
.cinema-date-strip-wrapper {
    position: relative !important;
    width: 100% !important;
    margin-bottom: 20px !important;
}

.cinema-date-strip {
    display: flex !important;
    overflow-x: auto !important;
    gap: 8px !important;
    padding: 4px 2px 6px 2px !important;
    /* 隐藏横向滚动条（仍可滚动/触摸滑动） */
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
}

.cinema-date-strip::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
}

.cinema-date-pill {
    flex: 0 0 auto !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    min-width: 96px !important;
    padding: 8px 12px !important;
    border-radius: 8px !important;
    background: rgba(255, 255, 255, 0.05) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    color: rgba(255, 255, 255, 0.85) !important;
    cursor: pointer !important;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

.cinema-date-pill:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2) !important;
    transform: translateY(-2px) !important;
}

.cinema-date-pill.is-active {
    background: #f5a623 !important;
    border-color: #f5a623 !important;
    color: #141414 !important;
    box-shadow: 0 4px 16px rgba(245, 166, 35, 0.35) !important;
    transform: translateY(-2px) !important;
}

.cinema-date-pill-label {
    font-size: 14px !important;
    font-weight: 700 !important;
    margin-bottom: 2px !important;
}

.cinema-date-pill-sub {
    font-size: 11px !important;
    opacity: 0.8 !important;
    white-space: nowrap !important;
}

/* ================== 日期条 Emby 风格左右滚动按钮 ================== */
.cinema-date-strip-wrapper {
    position: relative !important;
}

.cinema-date-nav {
    position: absolute !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    z-index: 5 !important;
    width: 34px !important;
    height: 34px !important;
    min-width: 34px !important;
    padding: 0 !important;
    border-radius: 50% !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: rgba(40, 40, 40, 0.86) !important;
    border: 1px solid rgba(255, 255, 255, 0.14) !important;
    color: #ffffff !important;
    cursor: pointer !important;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5) !important;
    backdrop-filter: blur(10px) !important;
    -webkit-backdrop-filter: blur(10px) !important;
    transition: opacity 0.2s ease, background 0.2s ease, transform 0.2s ease !important;
}

.cinema-date-nav:hover {
    background: rgba(60, 60, 60, 0.96) !important;
    transform: translateY(-50%) scale(1.08) !important;
}

.cinema-date-nav.is-hidden {
    opacity: 0 !important;
    pointer-events: none !important;
}

.cinema-date-nav-left {
    left: -6px !important;
}

.cinema-date-nav-right {
    right: -6px !important;
}

.cinema-date-nav .md-icon {
    font-size: 22px !important;
    line-height: 1 !important;
}

/* 日历与榜单使用原生 vertical-wrap / portraitCard 响应式列宽及 cardBox 间距。 */
.cinema-calendar-cards {
    min-width: 0;
    margin-top: 16px;
}

.cinema-chart-rank-card {
    cursor: pointer;
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.cinema-chart-rank-card:hover {
    transform: translateY(-4px) !important;
}

.cinema-card-poster-container {
    position: relative !important;
    width: 100% !important;
    border-radius: 8px !important;
    overflow: hidden !important;
    background-color: #1a1a1a !important;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5) !important;
    transition: transform 0.25s ease, box-shadow 0.25s ease !important;
}

.cinema-calendar-card:hover .cinema-card-poster-container,
.cinema-chart-rank-card:hover .cinema-card-poster-container {
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.7), 0 0 0 2px rgba(255, 255, 255, 0.25) !important;
}

.cinema-card-poster-img {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    display: block !important;
    border-radius: 8px !important;
    background-color: #1e1e1e !important;
}

/* 评分与入库状态保持同一顶边，窄卡片也不换行。 */
.cinema-card-badges {
    position: absolute;
    top: 6px;
    left: 6px;
    right: 6px;
    display: flex;
    flex-wrap: nowrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 4px;
    z-index: 5;
}
.cinema-card-poster-container .cinema-card-badges > .cinema-card-rating-badge,
.cinema-card-poster-container .cinema-card-badges > .cinema-card-inlibrary-badge {
    position: static !important;
    display: block !important;
    min-width: 0 !important;
    max-width: 100%;
    margin: 0 !important;
    padding: 2px 5px !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    box-sizing: border-box;
    font-size: 11px !important;
    line-height: 14px !important;
    letter-spacing: 0 !important;
    white-space: nowrap !important;
    overflow: hidden;
    text-overflow: ellipsis;
}
.cinema-card-badges > .cinema-card-rating-badge {
    flex: 0 0 auto;
}
.cinema-card-poster-container .cinema-card-badges > .cinema-card-inlibrary-badge {
    flex: 0 1 auto;
    margin-left: auto !important;
}

.cinema-card-rating-badge {
    position: absolute !important;
    left: 8px !important;
    top: 8px !important;
    bottom: auto !important;
    background: rgba(0, 0, 0, 0.75) !important;
    backdrop-filter: blur(8px) !important;
    -webkit-backdrop-filter: blur(8px) !important;
    border-radius: 4px !important;
    padding: 2px 7px !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    color: #ffffff !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px !important;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.6) !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    z-index: 2 !important;
}

/* 入库状态角标 (Emby 签名绿) */
.cinema-card-inlibrary-badge {
    position: absolute !important;
    top: 8px !important;
    right: 8px !important;
    background: #52B54B !important;
    color: #ffffff !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    padding: 2px 7px !important;
    border-radius: 4px !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 3px !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6) !important;
    z-index: 5 !important;
}

/* 海报底部渐变，让图片与卡片背景自然融合，消除割裂感 */
.cinema-card-poster-container::after {
    content: "" !important;
    position: absolute !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    height: 52% !important;
    background: linear-gradient(0deg, rgba(0, 0, 0, 0.92) 0%, rgba(0, 0, 0, 0.55) 42%, rgba(0, 0, 0, 0) 100%) !important;
    pointer-events: none !important;
    z-index: 1 !important;
    border-radius: 0 0 8px 8px !important;
}

/* 更新信息：海报内部下方居中显示 */
.cinema-card-ep-overlay {
    position: absolute !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 8px !important;
    z-index: 3 !important;
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 6px !important;
    padding: 0 8px !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    color: #ffffff !important;
    text-align: center !important;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.95) !important;
    white-space: normal !important;
    overflow-wrap: anywhere;
    box-sizing: border-box !important;
    pointer-events: none !important;
}
.cinema-card-ep-overlay > span {
    flex: 0 0 auto;
    max-width: 100%;
}

.cinema-ep-clock {
    color: rgba(255, 255, 255, 0.4) !important;
    font-size: 11px !important;
}

.cinema-card-premiere-tag {
    font-size: 11px !important;
    font-weight: 700 !important;
    color: #f5a623 !important;
    display: flex !important;
    align-items: center !important;
    gap: 4px !important;
    margin-top: 2px !important;
}

/* ================== 热门榜单 (Charts) 筛选条 ================== */
.cinema-charts-filter-row {
    display: flex !important;
    flex-direction: column !important;
    gap: 12px !important;
    margin-bottom: 24px !important;
    padding: 0 !important;
    background: transparent !important;
    border-radius: 0 !important;
    border: none !important;
}

.cinema-charts-filter-line {
    display: flex !important;
    align-items: center !important;
    gap: 4px !important;
    flex-wrap: wrap !important;
    width: 100% !important;
}

/* 第一行：榜单平台切换 */
.cinema-charts-line-platform {
    flex-wrap: nowrap !important;
    align-items: flex-start !important;
    padding-bottom: 0 !important;
    border-bottom: none !important;
}
.cinema-charts-line-platform > .cinema-group-platform {
    flex: 0 1 auto;
    min-width: 0;
    flex-wrap: nowrap !important;
    overflow-x: auto;
    scrollbar-width: thin;
}
.cinema-charts-line-platform > .cinema-charts-group-label {
    padding-top: 6px;
}

/* 桌面端并排筛选，手机端按组分行；按钮共用日历样式。 */
.cinema-charts-line-sub {
    justify-content: flex-start !important;
    gap: 12px !important;
    flex-wrap: nowrap !important;
    overflow-x: auto;
    scrollbar-width: thin;
}
.cinema-charts-line-sub > .cinema-calendar-filter-row {
    width: auto;
    flex: 0 0 auto;
    margin-bottom: 0;
}

.cinema-charts-filter-group {
    display: inline-flex !important;
    flex: 0 0 auto;
    flex-wrap: nowrap !important;
    align-items: center !important;
}

/* 平台真实 logo */
.cinema-platform-logo {
    width: 16px !important;
    height: 16px !important;
    min-width: 16px !important;
    border-radius: 4px !important;
    object-fit: cover !important;
    display: block !important;
    flex: 0 0 auto !important;
}

.cinema-charts-filter-right {
    display: inline-flex !important;
    align-items: center !important;
    gap: 10px !important;
    flex-wrap: wrap !important;
    margin-left: auto !important;
}

.cinema-charts-group-label {
    font-size: 12px !important;
    color: rgba(255, 255, 255, 0.45) !important;
    margin-right: 0 !important;
    flex: 0 0 auto;
    white-space: nowrap;
}

/* ================== 统一加载态（Emby 风格旋转环） ================== */
.cinema-loading-state {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 14px !important;
    width: 100% !important;
    padding: 56px 20px !important;
    box-sizing: border-box !important;
}

.cinema-spinner {
    width: 34px !important;
    height: 34px !important;
    border-radius: 50% !important;
    border: 3px solid rgba(255, 255, 255, 0.16) !important;
    border-top-color: #00a4dc !important;
    animation: cinemaSpin 0.8s linear infinite !important;
}

@keyframes cinemaSpin {
    to { transform: rotate(360deg); }
}

.cinema-loading-text {
    font-size: 13px !important;
    color: rgba(255, 255, 255, 0.55) !important;
    letter-spacing: 0.3px !important;
}

/* 加载中隐藏排名标题，避免与加载态并排错位 */
.cinema-charts-rank-section.is-loading .cinema-charts-rank-header {
    display: none !important;
}

/* ================== 榜单 #1 满屏 Hero（与日历/首页一致） ================== */
/* 榜单 Hero 同样置于页面最顶部，满屏 + 上提至顶栏下（与日历/首页一致） */
.cinema-charts-hero {
    margin-bottom: 24px !important;
}

.cinema-charts-hero .cinema-calendar-hero-content {
    max-width: 760px !important;
}

.cinema-charts-hero-badges {
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    flex-wrap: wrap !important;
    margin-bottom: 12px !important;
}

.cinema-charts-hero-rank {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    min-width: 36px !important;
    height: 36px !important;
    padding: 0 12px !important;
    font-size: 19px !important;
    font-weight: 800 !important;
    color: #ffffff !important;
    background: linear-gradient(135deg, #ff2d55 0%, #c8102e 100%) !important;
    border: 1px solid rgba(255, 255, 255, 0.28) !important;
    border-radius: 10px !important;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.55) !important;
}

.cinema-charts-hero-src {
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    padding: 5px 12px !important;
    border-radius: 999px !important;
    background: rgba(229, 9, 20, 0.16) !important;
    border: 1px solid rgba(229, 9, 20, 0.42) !important;
    color: #ff9a9a !important;
    font-size: 12.5px !important;
    font-weight: 700 !important;
    letter-spacing: 0.3px !important;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8) !important;
}

.cinema-charts-hero-inlib {
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px !important;
    padding: 5px 11px !important;
    border-radius: 999px !important;
    background: rgba(82, 181, 75, 0.9) !important;
    color: #ffffff !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45) !important;
}

.cinema-charts-hero-loading {
    min-height: 260px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: rgba(255, 255, 255, 0.03) !important;
    border-radius: 14px !important;
}

/* 旧卡片风格保留（如需回退），但不再默认使用 */
/* ================== 榜单 Spotlight #1 大卡片 ================== */
.cinema-charts-spotlight-card {
    position: relative !important;
    width: 100% !important;
    background: #191b21 !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    border-radius: 14px !important;
    overflow: hidden !important;
    padding: 26px 28px !important;
    box-sizing: border-box !important;
    display: flex !important;
    gap: 28px !important;
    align-items: center !important;
    margin-bottom: 30px !important;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55) !important;
}

/* #1 排名徽章（榜单大卡片） */
.cinema-charts-spotlight-rank {
    position: absolute !important;
    top: 10px !important;
    left: 10px !important;
    min-width: 34px !important;
    height: 34px !important;
    padding: 0 10px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 18px !important;
    font-weight: 800 !important;
    color: #ffffff !important;
    background: linear-gradient(135deg, #ff2d55 0%, #c8102e 100%) !important;
    border: 1px solid rgba(255, 255, 255, 0.24) !important;
    border-radius: 9px !important;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.6) !important;
    z-index: 4 !important;
}

/* 榜单大卡片：来源徽章胶囊 */
.cinema-charts-spotlight-badge {
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    padding: 3px 10px !important;
    border-radius: 999px !important;
    background: rgba(229, 9, 20, 0.14) !important;
    border: 1px solid rgba(229, 9, 20, 0.38) !important;
    color: #ff8a8a !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    letter-spacing: 0.3px !important;
    margin-bottom: 10px !important;
    width: fit-content !important;
}

.cinema-charts-spotlight-crown {
    font-size: 13px !important;
    line-height: 1 !important;
}

.cinema-charts-spotlight-actions {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    flex-wrap: wrap !important;
}

.cinema-charts-spotlight-poster-wrap {
    position: relative !important;
    flex: 0 0 180px !important;
    width: 180px !important;
    aspect-ratio: 2 / 3 !important;
    border-radius: 10px !important;
    overflow: hidden !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6) !important;
}

.cinema-charts-spotlight-poster-img {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    display: block !important;
}

/* 与日历/首页一致的海报效果：底部渐变融入背景 */
.cinema-charts-spotlight-poster-wrap::after {
    content: "" !important;
    position: absolute !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    height: 46% !important;
    background: linear-gradient(0deg, rgba(0, 0, 0, 0.88) 0%, rgba(0, 0, 0, 0.4) 45%, rgba(0, 0, 0, 0) 100%) !important;
    pointer-events: none !important;
    z-index: 1 !important;
    border-radius: 0 0 10px 10px !important;
}

.cinema-charts-spotlight-info {
    flex: 1 !important;
    min-width: 0 !important;
}

.cinema-charts-spotlight-badge {
    font-size: 13px !important;
    font-weight: 700 !important;
    color: #e50914 !important;
    margin-bottom: 6px !important;
}

/* 榜单大图 Hero 统一继承日历标准海报排版 */

/* ================== 榜单排名卡片 ================== */
.cinema-charts-rank-header {
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    margin-bottom: 16px !important;
}
.cinema-charts-rank-header.hide {
    display: none !important;
}

.cinema-charts-rank-header-title {
    font-size: 18px !important;
    font-weight: 800 !important;
    color: #ffffff !important;
}

.cinema-charts-rank-header-sub {
    font-size: 12px !important;
    color: rgba(255, 255, 255, 0.45) !important;
}

.cinema-charts-rank-grid {
    min-width: 0;
}

.cinema-chart-rank-badge {
    position: absolute !important;
    top: auto !important;
    left: 8px !important;
    bottom: 8px !important;
    min-width: 0 !important;
    width: auto !important;
    height: auto !important;
    padding: 0 !important;
    background: none !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    display: block !important;
    color: #ffffff !important;
    font-size: 34px !important;
    font-weight: 900 !important;
    line-height: 0.9 !important;
    letter-spacing: -0.045em !important;
    font-family: "Arial Black", Impact, "Segoe UI", system-ui, sans-serif !important;
    font-style: italic !important;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.95), 0 1px 3px rgba(0, 0, 0, 0.95) !important;
    -webkit-text-stroke: 0 !important;
    z-index: 3 !important;
    pointer-events: none !important;
}

/* 顶部压暗层：保证评分与入库状态的可读性。 */
.cinema-chart-rank-card .cinema-card-poster-container::before {
    content: "" !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    height: 40% !important;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.22) 55%, rgba(0, 0, 0, 0) 100%) !important;
    pointer-events: none !important;
    z-index: 1 !important;
    border-radius: 8px 8px 0 0 !important;
}

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

/* ================== 移动端与平板响应式完美适配 ================== */
@media (max-width: 768px) {
    .cinema-calendar-scrollslider,
    .cinema-charts-scrollslider {
        padding-bottom: 90px !important;
    }
    .cinema-charts-spotlight-card {
        flex-direction: column !important;
        align-items: flex-start !important;
        padding: 16px !important;
        gap: 16px !important;
    }
    .cinema-charts-spotlight-poster-wrap {
        width: min(62%, 230px) !important;
        flex: 0 0 auto !important;
        height: auto !important;
        align-self: center !important;
        margin-bottom: 4px !important;
    }
    .cinema-charts-spotlight-info {
        width: 100% !important;
    }
    /* 移动端缩小角标，避免排名徽章与「已入库」重叠 */
    .cinema-charts-spotlight-poster-wrap .cinema-charts-spotlight-rank {
        min-width: 26px !important;
        height: 26px !important;
        padding: 0 7px !important;
        font-size: 14px !important;
        border-radius: 7px !important;
        top: 6px !important;
        left: 6px !important;
    }
    .cinema-charts-spotlight-poster-wrap .cinema-card-inlibrary-badge {
        font-size: 10px !important;
        padding: 2px 5px !important;
        gap: 2px !important;
        top: 6px !important;
        right: 6px !important;
    }
    .cinema-charts-spotlight-poster-wrap .cinema-card-inlibrary-badge .md-icon {
        font-size: 11px !important;
    }
    .cinema-charts-spotlight-title {
        font-size: 22px !important;
    }
    .cinema-calendar-hero {
        padding-top: calc(var(--cinema-tab-top, 0px) + 2px) !important;
        padding-bottom: 12px !important;
        min-height: 300px !important;
        max-height: 420px !important;
        margin-bottom: 8px !important;
        border-radius: 0 !important;
    }
    .cinema-calendar-filter-row .cinema-pill-btn,
    .cinema-charts-btn {
        padding: 6px 8px !important;
        font-size: 12px !important;
    }
    .cinema-charts-filter-row {
        justify-content: flex-start !important;
    }
    .cinema-charts-line-sub {
        flex-direction: column;
        align-items: stretch !important;
        overflow-x: visible;
    }
    .cinema-charts-line-sub > .cinema-calendar-filter-row {
        width: 100%;
    }
    .cinema-charts-filter-group {
        flex: 0 1 auto;
    }
    .cinema-calendar-hero .cinema-title {
        font-size: 24px !important;
    }
    .cinema-calendar-hero .cinema-overview {
        -webkit-line-clamp: 3 !important;
        font-size: 12px !important;
        line-height: 1.5 !important;
        margin-bottom: 12px !important;
    }
    .cinema-card-badges {
        top: 4px;
        left: 4px;
        right: 4px;
        gap: 2px;
    }
    .cinema-card-poster-container .cinema-card-badges > .cinema-card-rating-badge,
    .cinema-card-poster-container .cinema-card-badges > .cinema-card-inlibrary-badge {
        font-size: 10px !important;
        padding: 2px 3px !important;
    }
    .cinema-chart-rank-badge {
        font-size: 28px !important;
    }
}

/* 桌面端顶部 Tab 间距优化：仅在桌面屏幕(>=66em)微调 Tab 上边距，移动端完全保持原生 */
/* 桌面端 Tab 垂直对齐微调 */
@media all and (min-width: 66em) {
    .headerTop-withSectionTabs .headerMiddle.sectionTabs {
        margin-top: 0 !important;
    }
}
`);
