// ==UserScript==
// @name         Emby_Plus (Full 一体化全量版)
// @namespace    https://github.com/odomu
// @version      2.0.0
// @author       odomu
// @description  Emby 首页大图轮播 · 详情页增强 · 追剧日历与热门榜单 (一体化全量版，内置全部 Addon)
// @match        *://*/web/index.html*
// @match        *://*/web/
// @run-at       document-end
// @grant        none
// ==/UserScript==

/**
 * Emby_Plus 精简版 · 全局配置中心 (修改此处即可全局生效)
 * 其余功能由 Addons/ 下的组件提供,各自带默认值,无需在此声明
 */
const CINEMA_CONFIG = window.CINEMA_CONFIG = {
    /* 轮播大图设置 */
    autoPlay: true,                          // 是否开启大图自动轮播
    rotationDuration: 5000,                  // 轮播切片轮转间隔时间 (毫秒)
    maxSlides: 10,                           // 大图轮播最大展示条目数
    enableBannerMetadata: true,              // 海报大图丰富元数据 (IMDb/烂番茄评分、分级、规格)

    tmdbApiKey: "82dee22856e0d0ac5f767ec6fb845efc",   // 自定义 TMDB Key (留空自动启用内置公共密钥池)
    tmdbApiBase: "https://api.themoviedb.org/3",      // TMDB API 域名
    tmdbImgBase: "https://image.tmdb.org/t/p",        // TMDB 图片 CDN 域名
    /* ================= Addon 配置（由 build_full.py 从各组件的 config 声明融合） ================= */
    /* ---- 详情页 · 外链品牌 Logo ---- */
    enableLinkLogos: true,
    /* ---- 媒体库卡片彩色分级徽章 ---- */
    enableMediaRatings: true,
    /* ---- 集页面美化（详情页元数据 / 季集平铺 / 列表多选） ---- */
    enableSeasonEpisodesLayout: true,
    enableSeriesStatusBadge: true,
    /* ---- TMDB 精选影评 ---- */
    enableReviews: true,
    maxReviews: 25,
    reviewPreviewLength: 500,
    showLanguageFlags: true,
    /* ---- 详情页 · 剧照 / 同人图画廊 ---- */
    enableStagePhotos: true,
    /* ---- 详情页 · 演职人员其他作品 ---- */
    enablePersonWorks: true,
    /* ---- 全站海报评分角标 ---- */
    enableGlobalPosterRatings: true,
    /* ---- 追剧日历与热门榜单 ---- */
    calendarRequireAdmin: false,  // 追剧日历 Tab 是否仅管理员显示 (默认 false 全员可见；配置为 true 则仅管理员显示)
    chartsRequireAdmin: false,  // 热门榜单 Tab 是否仅管理员显示 (默认 false 全员可见；配置为 true 则仅管理员显示)
    chartLimit: 20,  // 榜单最大展示条目数 (1-100)
    /* ---- 详情页 · MoviePilot 联动（订阅 / 网盘资源） ---- */
    enableMoviePilot: true,
    moviePilotRequireAdmin: true,  // 默认需要管理员权限方可使用及配置 MP，允许配置为 false 放开给普通用户
    moviePilotUrl: "",  // 可在此直接配置 MoviePilot 地址
    moviePilotToken: "",  // 可在此直接配置 MoviePilot API Token
};

/* ==============================================================================
 * Part 2: 共享常量与字典配置 (Shared Constants & Dictionaries)
 * ============================================================================== */
const PUBLIC_TMDB_KEY = "82dee22856e0d0ac5f767ec6fb845efc"; // 内置公共可用 Key
const TMDB_API_BASE = CINEMA_CONFIG.tmdbApiBase || "https://api.themoviedb.org/3";
const TMDB_IMG_BASE = CINEMA_CONFIG.tmdbImgBase || "https://image.tmdb.org/t/p";

const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const weekdaysFull = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

const TMDB_LOGO = (path) => `https://image.tmdb.org/t/p/w45${path}`;

const PLATFORMS = {
    netflix: { name: "Netflix", logo: TMDB_LOGO("/rK1KljqmbvO9HQa1PBFLILWah72.png"), badgeText: "N", badgeBg: "#E50914", provider: 8 },
    max: { name: "HBO Max", logo: TMDB_LOGO("/skypuy7SXuugIQeYg0IglmzoKaS.png"), badgeText: "MAX", badgeBg: "#002BE7", provider: 1899 },
    apple: { name: "Apple TV+", logo: TMDB_LOGO("/9icYBfYFcwgCbky5VdGUIKJ4C5i.png"), badgeText: "TV+", badgeBg: "#000000", provider: 350 },
    disney: { name: "Disney+", logo: TMDB_LOGO("/5eZ872CghnHFLB1j8grszbrx0dx.png"), badgeText: "D+", badgeBg: "#0B1536", provider: 337 },
    crunchyroll: { name: "Crunchyroll", logo: TMDB_LOGO("/uFL3c4Cq8M6WoLymlC5Y8bmGytV.png"), badgeText: "CR", badgeBg: "#F47521", provider: 283 },
    amazon: { name: "Prime Video", logo: TMDB_LOGO("/gMZdpavHmxFNnLpMHwVxfqeux2g.png"), badgeText: "Prime", badgeBg: "#000511", provider: "9|119|10", network: 1024 },
    hulu: { name: "Hulu", logo: TMDB_LOGO("/44uAnmSqvA4yBOdbPWN8YgQHjWm.png"), badgeText: "H", badgeBg: "#1CE783", provider: 15 },
    peacock: { name: "Peacock", logo: TMDB_LOGO("/a1UIdq5BrkcAxnxcUhFsNbXnxeu.png"), badgeText: "P", badgeBg: "#000000", provider: "386|387" }
};

const REGIONS = [
    { code: "US", name: "美国" },
    { code: "KR", name: "韩国" },
    { code: "GB", name: "英国" },
    { code: "DE", name: "德国" },
    { code: "JP", name: "日本" }
];

const GENRE_MAP = {
    28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录", 18: "剧情",
    10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐", 9648: "悬疑",
    10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚", 10752: "战争", 37: "西部",
    10759: "动作冒险", 10762: "儿童", 10763: "新闻", 10764: "真人秀", 10765: "科幻奇幻",
    10766: "肥皂剧", 10767: "脱口秀", 10768: "战争政治"
};

const CALENDAR_COUNTRIES = {
    all: "全部", CN: "中国大陆", HK: "中国香港", TW: "中国台湾", US: "美国",
    JP: "日本", KR: "韩国", GB: "英国", FR: "法国", DE: "德国", TH: "泰国",
    IN: "印度", RU: "俄罗斯", CA: "加拿大", AU: "澳大利亚"
};

/* 纯原生极简 DOM 工具 */
const $ = (selector, context = document) => {
    if (!selector) return new DomList([]);
    if (selector instanceof DomList) return selector;
    if (selector.nodeType || selector === window || selector === document) return new DomList([selector]);
    if (Array.isArray(selector)) return new DomList(selector);
    try {
        return new DomList(Array.from(context.querySelectorAll(selector)));
    } catch (e) {
        return new DomList([]);
    }
};

class DomList {
    constructor(elements) {
        this.elements = elements.filter(Boolean);
        this.length = this.elements.length;
        for (let i = 0; i < this.elements.length; i++) {
            this[i] = this.elements[i];
        }
    }

    find(selector) {
        const found = [];
        this.elements.forEach(el => {
            if (el.querySelectorAll) {
                found.push(...el.querySelectorAll(selector));
            }
        });
        return new DomList(found);
    }

    closest(selector) {
        for (const el of this.elements) {
            const c = el.closest ? el.closest(selector) : null;
            if (c) return new DomList([c]);
        }
        return new DomList([]);
    }

    first() {
        return new DomList(this.elements[0] ? [this.elements[0]] : []);
    }

    filter(selector) {
        if (typeof selector === "string") {
            return new DomList(this.elements.filter(el => el.matches && el.matches(selector)));
        }
        return new DomList(this.elements.filter(selector));
    }

    remove() {
        this.elements.forEach(el => el.remove && el.remove());
        return this;
    }

    addClass(className) {
        const names = className.split(/\s+/).filter(Boolean);
        this.elements.forEach(el => el.classList && el.classList.add(...names));
        return this;
    }

    removeClass(className) {
        const names = className.split(/\s+/).filter(Boolean);
        this.elements.forEach(el => el.classList && el.classList.remove(...names));
        return this;
    }

    attr(name, val) {
        if (val !== undefined) {
            this.elements.forEach(el => el.setAttribute && el.setAttribute(name, val));
            return this;
        }
        return this.elements[0] && this.elements[0].getAttribute ? this.elements[0].getAttribute(name) : null;
    }

    text(val) {
        if (val !== undefined) {
            this.elements.forEach(el => el.textContent = val);
            return this;
        }
        return this.elements[0] ? this.elements[0].textContent : "";
    }

    append(content) {
        this.elements.forEach(el => {
            if (typeof content === "string") {
                el.insertAdjacentHTML("beforeend", content);
            } else if (content && content.nodeType) {
                el.appendChild(content);
            }
        });
        return this;
    }

    before(content) {
        this.elements.forEach(el => {
            if (typeof content === "string") {
                el.insertAdjacentHTML("beforebegin", content);
            } else if (content && content.nodeType) {
                el.parentNode && el.parentNode.insertBefore(content, el);
            }
        });
        return this;
    }

    css(styles) {
        this.elements.forEach(el => {
            if (el.style) {
                Object.assign(el.style, styles);
            }
        });
        return this;
    }

    on(event, selector, handler) {
        this.elements.forEach(el => {
            el.addEventListener(event, (e) => {
                const target = e.target.closest(selector);
                if (target && el.contains(target)) {
                    handler.call(target, e);
                }
            });
        });
        return this;
    }
}

class CommonUtils {
    static sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

/* ==============================================================================
 * Part 4: 基础格式化与算法辅助工具 (Formatting & Calculation Helpers)
 * ============================================================================== */
const escapeHtml = (str) => {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

const padZero = (n) => (n < 10 ? "0" + n : "" + n);

const formatDateYMD = (d) => `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;

const getTmdbImg = (path, size = "w500") => (path ? `${TMDB_IMG_BASE}/${size}${path}` : "");

const formatBytes = (bytes, decimals = 1) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
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

function getEffectiveTmdbKey() {
    return (CINEMA_CONFIG.tmdbApiKey && CINEMA_CONFIG.tmdbApiKey.trim()) || PUBLIC_TMDB_KEY;
}

const TMDB_KEY = getEffectiveTmdbKey();

/* 简易防抖：用于高频 DOM 变更回调的合并 */
function debounce(fn, wait) {
    let timer = null;
    return function () {
        clearTimeout(timer);
        timer = setTimeout(fn, wait);
    };
}

/* ==============================================================================
 * Part 5: TMDB 网络缓存与 Emby 库内索引服务 (Data Fetching & Library Services)
 * ============================================================================== */
async function fetchWithCache(url, cacheDuration = 600000) {
    const cacheKey = "TMDB_CACHE_" + url;
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.time < cacheDuration) {
                return parsed.data;
            }
        }
    } catch (e) {
    }

    try {
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const data = await resp.json();
        try {
            localStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), data }));
        } catch (e) {
        }
        return data;
    } catch (e) {
        return null;
    }
}

let libraryTmdbMap = new Map();
let libraryTitleMap = new Map();
let libraryIndex = {
    movieIds: new Set(),
    seriesIds: new Set(),
    tmdbMap: libraryTmdbMap,
    titleMap: libraryTitleMap,
    isIndexing: false,
    lastIndexTime: 0
};

function checkInLibrary(item) {
    if (!item) return null;
    const tmdbId = String(item.id || item.tmdb_id || "");
    if (tmdbId && libraryTmdbMap && libraryTmdbMap.has(tmdbId)) {
        return libraryTmdbMap.get(tmdbId);
    }
    const t = (item.title || item.name || "").toLowerCase().trim();
    if (t && libraryTitleMap && libraryTitleMap.has(t)) {
        return libraryTitleMap.get(t);
    }
    const ot = (item.original_title || item.original_name || "").toLowerCase().trim();
    if (ot && libraryTitleMap && libraryTitleMap.has(ot)) {
        return libraryTitleMap.get(ot);
    }
    return null;
}

const seriesEpisodesCache = new Map();

async function getSeriesExistingEpisodes(seriesId) {
    if (!seriesId) return null;
    const sid = String(seriesId);
    if (seriesEpisodesCache.has(sid)) return seriesEpisodesCache.get(sid);
    try {
        const api = window.ApiClient || (window.ConnectionManager && window.ConnectionManager.currentApiClient());
        if (!api) return null;
        const userId = api.getCurrentUserId ? api.getCurrentUserId() : "";
        const url = api.getUrl ? api.getUrl(`Shows/${seriesId}/Episodes`, {
            UserId: userId,
            Fields: "ParentIndexNumber,IndexNumber"
        }) : `/Shows/${seriesId}/Episodes?UserId=${userId}`;
        const res = await (api.getJSON ? api.getJSON(url) : fetch(url).then(r => r.json()));
        const epSet = new Set();
        const seasonEpMap = new Map();
        for (const ep of (res && res.Items) || []) {
            const s = ep.ParentIndexNumber !== undefined ? ep.ParentIndexNumber : 1;
            const e = ep.IndexNumber !== undefined ? ep.IndexNumber : 0;
            if (e > 0) {
                epSet.add(`S${s}E${e}`);
                epSet.add(`E${e}`);
                if (!seasonEpMap.has(s)) seasonEpMap.set(s, new Set());
                seasonEpMap.get(s).add(e);
            }
        }
        const data = { epSet, seasonEpMap };
        seriesEpisodesCache.set(sid, data);
        return data;
    } catch (e) {
        return null;
    }
}

async function checkMissingEpisodesInfo(item, inLibId) {
    if (!item || !inLibId || item.mediaType === "movie") return null;
    const epCode = item.epCode;
    if (!epCode) return null;
    const m = epCode.match(/(?:S(\d+))?E(\d+)/i);
    if (!m) return null;
    const targetSeason = m[1] ? parseInt(m[1], 10) : 1;
    const targetEpisode = parseInt(m[2], 10);
    if (isNaN(targetEpisode) || targetEpisode <= 0) return null;

    const info = await getSeriesExistingEpisodes(inLibId);
    if (!info || !info.epSet) return null;

    const allSeasons = new Set([targetSeason]);
    for (const s of info.seasonEpMap.keys()) {
        if (typeof s === "number" && s > 0) allSeasons.add(s);
    }

    const seasonsList = [];
    let totalMissing = 0;

    Array.from(allSeasons).sort((a, b) => a - b).forEach((sNum) => {
        const existingInSeason = info.seasonEpMap.get(sNum) || new Set();
        const limit = (sNum === targetSeason) ? targetEpisode : Math.max(0, ...Array.from(existingInSeason));
        const missingInThisSeason = [];
        for (let ep = 1; ep <= limit; ep++) {
            if (!existingInSeason.has(ep) && !info.epSet.has(`S${sNum}E${ep}`) && !info.epSet.has(`E${ep}`)) {
                missingInThisSeason.push(ep);
            }
        }
        if (missingInThisSeason.length > 0) {
            totalMissing += missingInThisSeason.length;
            seasonsList.push({
                season_number: sNum,
                season_name: `第 ${sNum} 季`,
                missingEpisodes: missingInThisSeason,
                missingCount: missingInThisSeason.length
            });
        }
    });

    if (totalMissing === 0) {
        return { isMissing: false, totalMissingCount: 0, seasons: [], targetEpisode, targetSeason };
    }

    return {
        isMissing: true,
        totalMissingCount: totalMissing,
        seasons: seasonsList,
        targetEpisode,
        targetSeason
    };
}

let libraryIndexingPromise = null;

async function ensureLibraryIndex() {
    if (Date.now() - libraryIndex.lastIndexTime < 600000 && libraryTmdbMap.size > 0) {
        return { tmdbMap: libraryTmdbMap, titleMap: libraryTitleMap, ...libraryIndex };
    }
    if (libraryIndexingPromise) return libraryIndexingPromise;

    libraryIndexingPromise = (async () => {
        const cacheKey = "EMBY_LIB_INDEX_V1";
        try {
            const s = sessionStorage.getItem(cacheKey);
            if (s) {
                const parsed = JSON.parse(s);
                if (Date.now() - parsed.time < 600000) {
                    libraryTmdbMap = new Map(Object.entries(parsed.tmdbMap || {}));
                    libraryTitleMap = new Map(Object.entries(parsed.titleMap || {}));
                    libraryIndex.tmdbMap = libraryTmdbMap;
                    libraryIndex.titleMap = libraryTitleMap;
                    libraryIndex.lastIndexTime = parsed.time;
                    return { tmdbMap: libraryTmdbMap, titleMap: libraryTitleMap, ...libraryIndex };
                }
            }
        } catch (e) {
        }

        const api = window.ApiClient || (window.ConnectionManager && window.ConnectionManager.currentApiClient());
        if (!api) return { tmdbMap: libraryTmdbMap, titleMap: libraryTitleMap, ...libraryIndex };
        const userId = api.getCurrentUserId ? api.getCurrentUserId() : "";
        if (!userId) return { tmdbMap: libraryTmdbMap, titleMap: libraryTitleMap, ...libraryIndex };

        try {
            const res = await api.getItems(userId, {
                Recursive: true,
                IncludeItemTypes: "Movie,Series",
                Fields: "ProviderIds,Name,OriginalTitle",
                Limit: 10000
            });
            const tMap = {};
            const nMap = {};
            libraryIndex.movieIds.clear();
            libraryIndex.seriesIds.clear();

            for (const it of (res && res.Items) || []) {
                if (it.Type === "Movie") libraryIndex.movieIds.add(it.Id);
                else if (it.Type === "Series") libraryIndex.seriesIds.add(it.Id);

                if (it.ProviderIds && it.ProviderIds.Tmdb) {
                    tMap[String(it.ProviderIds.Tmdb)] = it.Id;
                }
                if (it.Name) {
                    nMap[it.Name.toLowerCase().trim()] = it.Id;
                }
                if (it.OriginalTitle) {
                    nMap[it.OriginalTitle.toLowerCase().trim()] = it.Id;
                }
            }
            libraryTmdbMap = new Map(Object.entries(tMap));
            libraryTitleMap = new Map(Object.entries(nMap));
            libraryIndex.tmdbMap = libraryTmdbMap;
            libraryIndex.titleMap = libraryTitleMap;
            libraryIndex.lastIndexTime = Date.now();

            try {
                sessionStorage.setItem(cacheKey, JSON.stringify({
                    time: libraryIndex.lastIndexTime,
                    tmdbMap: tMap,
                    titleMap: nMap
                }));
            } catch (e) {
            }

            return { tmdbMap: libraryTmdbMap, titleMap: libraryTitleMap, ...libraryIndex };
        } catch (e) {
            console.warn("[CinemaTab] Library index error:", e);
            return { tmdbMap: libraryTmdbMap, titleMap: libraryTitleMap, ...libraryIndex };
        } finally {
            libraryIndexingPromise = null;
        }
    })();

    return libraryIndexingPromise;
}

/* 会话级 / 本地级缓存读写：存储不可用时静默降级 */
function readSessionCache(key) {
    try {
        const data = JSON.parse(sessionStorage.getItem(key) || "null");
        return data && data.Items && data.Items.length > 0 ? data : null;
    } catch (e) {
        return null;
    }
}

function writeSessionCache(key, data) {
    try {
        if (data && data.Items && data.Items.length > 0) sessionStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
    }
}

function readLocalCache(key) {
    try {
        return JSON.parse(localStorage.getItem(key) || "null");
    } catch (e) {
        return null;
    }
}

function writeLocalCache(key, data) {
    try {
        if (data) localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
    }
}

/* ==============================================================================
 * Part 6: Tab UI 骨架屏与卡片 HTML 模板生成器 (Tab UI Templates & Builders)
 * ============================================================================== */
function heroPlaceholderHtml(extraClass = "", chipCount = 3) {
    return `<div class="cinema-calendar-hero ${extraClass} padded-left padded-right is-loading">
        <div class="cinema-calendar-hero-bg"></div>
        <div class="cinema-calendar-hero-content">
            <div class="cinema-hero-skel-title cinema-shimmer"></div>
            <div class="cinema-hero-skel-sub cinema-shimmer"></div>
            <div class="cinema-hero-skel-chips">${Array.from({length: chipCount}, () => '<div class="cinema-hero-skel-chip cinema-shimmer"></div>').join("")}</div>
            <div class="cinema-hero-skel-overview cinema-shimmer"></div>
            <div class="cinema-hero-actions">
                <div class="cinema-hero-skel-btn cinema-shimmer"></div>
                <div class="cinema-hero-skel-btn cinema-shimmer"></div>
            </div>
        </div>
    </div>`;
}

function heroContentHtml({title, subtitle, chips, overview, actions}) {
    return `<h1 class="cinema-title cinema-calendar-hero-title">${escapeHtml(title)}</h1>
        <div class="cinema-calendar-hero-subtitle">${escapeHtml(subtitle)}</div>
        ${chips.length ? `<div class="cinema-meta-row"><div class="cinema-genre-list cinema-hero-chips">${chips.map(chip => `<span class="cinema-genre-badge">${escapeHtml(chip)}</span>`).join("")}</div></div>` : ""}
        <p class="cinema-overview cinema-calendar-hero-overview">${escapeHtml(overview)}</p>
        ${actions}`;
}

function posterCardHtml(item, {
    className = "",
    meta = "",
    rank = 0,
    episodeHtml = "",
    footerHtml = "",
    removeBrokenImage = false
} = {}) {
    const title = escapeHtml(item.title || item.name || "");
    const rating = item.vote_average ? item.vote_average.toFixed(1) : "";
    const inLibId = checkInLibrary(item);
    const posterUrl = getTmdbImg(item.poster_path, "w342");
    return `<div class="card portraitCard card-hoverable ${className}" data-id="${escapeHtml(item.id)}">
        <div class="cardBox visualCardBox cardBox-bottompadded">
            <div class="cardScalable">
                <div class="cardPadder cardPadder-portrait"></div>
                <div class="cardImageContainer cardContent itemAction lazy cinema-shimmer" style="background-image: url('${posterUrl}');">
                    ${rank ? `<div class="cinema-chart-rank-badge">${rank}</div>` : ""}
                    <div class="cinema-card-badges">
                        ${rating ? `<div class="cinema-card-rating-badge">★ ${rating}</div>` : ""}
                        ${inLibId ? `<div class="cinema-card-inlibrary-badge" data-inlib-id="${escapeHtml(inLibId)}" title="已入库">已入库</div>` : ""}
                    </div>
                    ${episodeHtml ? `<div class="cinema-card-ep-overlay">${episodeHtml}</div>` : ""}
                </div>
            </div>
            <div class="cardText cardText-first cardText-first-padded" title="${title}">${title}</div>
            <div class="cardText cardText-secondary">${escapeHtml(meta)}</div>
            ${footerHtml}
        </div>
    </div>`;
}

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

/* ==============================================================================
 * Part 7: 顶栏扩展 Tab 调度框架与权限控制 (Home Tabs Framework & Lifecycle)
 * ============================================================================== */
const cinemaTabs = [];
const HOME_TABS = [
    { name: "首页", id: "home" },
    { name: "收藏夹", id: "favorites" }
];

let isCurrentUserAdmin = null;
let homeTabsManager = null;
let CinemaBaseTab = null;
let _baseTabPromise = null;

async function checkUserAdminStatus() {
    if (isCurrentUserAdmin !== null) return isCurrentUserAdmin;
    try {
        const api = window.ApiClient;
        if (!api || typeof api.getCurrentUser !== "function") return false;
        const user = await api.getCurrentUser();
        isCurrentUserAdmin = !!(user && user.Policy && user.Policy.IsAdministrator === true);
    } catch (e) {
        isCurrentUserAdmin = false;
    }
    return isCurrentUserAdmin;
}

function rebuildHomeTabs() {
    HOME_TABS.splice(1, Math.max(0, HOME_TABS.length - 2), ...cinemaTabs.map(t => ({ name: t.name, id: t.id })));
}

function ensureBaseTab() {
    if (_baseTabPromise) return _baseTabPromise;
    const modulePromise = window.Emby && typeof window.Emby.importModule === "function"
        ? window.Emby.importModule("./modules/tabbedview/basetab.js")
        : new Promise((resolve, reject) => window.require(["baseTab"], resolve, reject));
    _baseTabPromise = modulePromise.then(mod => {
        CinemaBaseTab = mod.default || mod;
        cinemaTabs.map(t => t.controller).forEach(Ctrl => {
            Object.setPrototypeOf(Ctrl.prototype, CinemaBaseTab.prototype);
        });
        return CinemaBaseTab;
    });
    return _baseTabPromise;
}

function resolveCinemaTabController(id) {
    const tab = cinemaTabs.find(t => t.id === id);
    if (!tab) return Promise.resolve(null);
    return ensureBaseTab().then(() => tab.controller);
}

function ensureHomeTabContainers(view) {
    const containers = view.querySelectorAll(".tabContent");
    if (containers.length !== 2) return;
    const favorites = containers[1];
    favorites.setAttribute("data-index", String(1 + cinemaTabs.length));
    favorites.insertAdjacentHTML("beforebegin", cinemaTabs.map((tab, index) => `
        <div is="emby-scroller" data-index="${index + 1}" data-horizontal="false"
            data-focusscroll="true" data-navcommands="card" data-forcescrollbar="true" data-bindheader="true"
            class="scrollFrameY flex flex-grow tabContent tabContent-positioned cinema-${tab.id}-tab-content">
            <div class="scrollSlider flex-grow padded-top-page sections cinema-${tab.id}-scrollslider"></div>
        </div>
    `).join(""));
}

function prepareHomeTabs(ctrl) {
    if (ctrl._cinemaTabsPrepared) return false;
    const previousTabs = ctrl._tabs;
    ensureHomeTabContainers(ctrl.view);
    if (cinemaTabs.length > 0 && previousTabs && previousTabs.length === 2) {
        const currentId = previousTabs[ctrl.currentTabIndex]?.id;
        const targetFavIndex = 1 + cinemaTabs.length;
        if (ctrl.tabControllers[1]) {
            ctrl.tabControllers[targetFavIndex] = ctrl.tabControllers[1];
            delete ctrl.tabControllers[1];
        }
        if (currentId) ctrl.currentTabIndex = HOME_TABS.findIndex(tab => tab.id === currentId);
        if (ctrl.initialTabIndex === 1) ctrl.initialTabIndex = targetFavIndex;
    }
    if (ctrl.params.tab === "calendar" || ctrl.params.tab === "charts") {
        if (ctrl.currentTabController) ctrl.currentTabController.onPause();
        ctrl.currentTabController = null;
        ctrl.currentTabIndex = HOME_TABS.findIndex(tab => tab.id === ctrl.params.tab);
    }
    if (ctrl.currentTabIndex != null) {
        ctrl.view.querySelectorAll(".tabContent").forEach(panel => {
            panel.classList.toggle("is-active", Number(panel.dataset.index) === ctrl.currentTabIndex);
        });
    }
    ctrl._tabs = HOME_TABS;
    ctrl._cinemaTabsPrepared = true;
    return true;
}

function updateCinemaTabTopOffset() {
    const view = document.querySelector(".view-home-home:not(.hide)");
    const header = document.querySelector(".skinHeader");
    if (!view || !header) return;
    const sections = Array.from(header.children).filter(el => el.classList.contains("headerSection") && el.offsetHeight);
    const bottom = sections.length ? Math.max(...sections.map(el => el.offsetTop + el.offsetHeight)) : header.offsetHeight;
    view.style.setProperty("--cinema-tab-top", Math.max(bottom, 56) + "px");
}

function resumeVisibleHomeTabs() {
    if (!homeTabsManager) return;
    const view = document.querySelector(".view-home-home:not(.hide)");
    const ctrl = view && view.controller;
    if (!ctrl) return;
    if (prepareHomeTabs(ctrl)) {
        const hadController = !!ctrl.currentTabController;
        homeTabsManager.setTabs(null);
        ctrl.setTabs();
        if (hadController) selectHomeTab(ctrl.currentTabIndex);
    }
    updateCinemaTabTopOffset();
}

function selectHomeTab(index, attempt = 0) {
    const tabsElem = typeof homeTabsManager.getTabsElement === "function" ? homeTabsManager.getTabsElement() : null;
    if (tabsElem && typeof tabsElem.selectedIndex === "function") {
        homeTabsManager.selectedTabIndex(index);
        return;
    }
    if (attempt < 12) setTimeout(() => selectHomeTab(index, attempt + 1), 50);
}

function installHomeTabs(homeModule, mainTabsModule) {
    if (cinemaTabs.length === 0) return;
    const HomeView = homeModule.default || homeModule;
    homeTabsManager = mainTabsModule.default || mainTabsModule;
    if (!HomeView.prototype._cinemaTabsHooked) {
        HomeView.prototype._cinemaTabsHooked = true;
        HomeView.prototype.getTabs = function () {
            return HOME_TABS;
        };
        const originalSetTabs = HomeView.prototype.setTabs;
        HomeView.prototype.setTabs = function () {
            prepareHomeTabs(this);
            return originalSetTabs.apply(this, arguments);
        };
        const originalLoadTab = HomeView.prototype.loadTabController;
        HomeView.prototype.loadTabController = function (id) {
            if (cinemaTabs.some(t => t.id === id)) return resolveCinemaTabController(id);
            return originalLoadTab.call(this, id);
        };
    }
    resumeVisibleHomeTabs();
}

/* 加载首页与顶栏管理器模块：ES 模块入口失败时回退 AMD 入口 */
function loadHomeModules() {
    const viaImport = window.Emby && typeof window.Emby.importModule === "function"
        ? Promise.all([
            window.Emby.importModule("./home/home.js"),
            window.Emby.importModule("./modules/maintabsmanager.js")
        ])
        : Promise.reject(new Error("Emby.importModule 不可用"));
    return viaImport.catch(() => new Promise((resolve, reject) => {
        window.require(["./home/home.js", "mainTabsManager"], (home, tabs) => resolve([home, tabs]), reject);
    }));
}

function loadHomeTabs() {
    if (cinemaTabs.length === 0) return;
    loadHomeModules()
        .then(([homeModule, mainTabsModule]) => installHomeTabs(homeModule, mainTabsModule))
        .catch(err => console.warn("[EmbyPlus] 加载顶栏模块失败：", err));
}

function startTabFramework() {
    if (cinemaTabs.length === 0) return;
    document.addEventListener("viewshow", () => {
        loadHomeTabs();
        requestAnimationFrame(resumeVisibleHomeTabs);
    });
    window.addEventListener("resize", updateCinemaTabTopOffset);
    const headerEl = document.querySelector(".skinHeader");
    if (headerEl) new ResizeObserver(updateCinemaTabTopOffset).observe(headerEl);
    loadHomeTabs();
}

function registerTab(tab) {
    if (!tab || !tab.id || typeof tab.controller !== "function") {
        console.warn("[EmbyPlus] 忽略非法 Tab：", tab);
        return;
    }
    if (cinemaTabs.some(t => t.id === tab.id)) return;
    cinemaTabs.push(tab);
    rebuildHomeTabs();
    startTabFramework();
}

/* ==============================================================================
 * Part 8: 版块标题「推荐」链接修正 (Section Title Route Fixer)
 * ============================================================================== */
const SECTION_TITLE_LINK_SELECTOR = "a.sectionTitleTextButton, a.more, a[is='emby-sectiontitle']";
const LIBRARY_ROUTE_PREFIXES = ["!/videos", "!/tv", "!/movies", "!/list", "!/items"];

/* 电影的推荐页应落到 tab=videos，剧集应落到 tab=series */
function fixSectionTitleHref(href) {
    if (!href || !href.includes("tab=suggestions")) return href;
    if (href.includes("/videos")) return href.replace("tab=suggestions", "tab=videos");
    if (href.includes("/tv")) return href.replace("tab=suggestions", "tab=series");
    return href;
}

/* ==============================================================================
 * Part 9: 大图元数据增强 (Banner Metadata Enhancement)
 * 异步补齐分级 / 片长 / 评分渠道徽章 / 烂番茄 / 音视频规格
 * ============================================================================== */
const BANNER_META_CDN = "https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo";

const BANNER_META_ICONS = {
    imdb: BANNER_META_CDN + "/IMDb_noframe.png",
    douban: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 66 22' width='66' height='22'%3E%3Cpath fill='%2300B51D' d='M3 2.5h14v2H3zm-2 3.6h18v2H1zm2 3.6h14v6.2H3zm2.2 1.8v2.6h9.6v-2.6zm-4.2 6.2h18v2H1z'/%3E%3Ctext x='44' y='16' fill='%2300B51D' text-anchor='middle' font-family='-apple-system, BlinkMacSystemFont, sans-serif' font-size='13.5' font-weight='700'%3E%E8%B1%86%E7%93%A3%3C/text%3E%3C/svg%3E",
    tmdb: BANNER_META_CDN + "/TMDB.png",
    rottenFresh: BANNER_META_CDN + "/Rotten_Tomatoes.png",
    rottenRotten: BANNER_META_CDN + "/Rotten_Tomatoes_rotten.png"
};

/* 内容分级 → 配色分组 */
const RATING_COLOR_GROUPS = {
    green: ["G", "TV-G", "TV-Y", "TV-Y7", "APPROVED", "PASSED", "CN-G", "FSK-0", "DE-0", "U", "0+"],
    yellow: ["PG", "TV-PG", "10", "12", "12+", "FSK-6", "DE-6", "6+", "PG-12"],
    orange: ["PG-13", "TV-14", "14+", "15+", "FSK-12", "DE-12", "13+"],
    redOrange: ["16+", "16", "FSK-16", "DE-16", "M16", "MA15+"],
    red: ["R", "NC-17", "TV-MA", "18+", "18", "FSK-18", "DE-18", "R18+", "KR-19", "R-18"]
};

/* 已增强条目的详情缓存，避免同一部影片重复回源 */
const bannerMetaItemCache = new Map();

function getMetadataApiClient() {
    return (typeof ApiClient !== "undefined" && ApiClient) || window.ApiClient || null;
}

function formatRuntime(ticks) {
    if (!ticks || typeof ticks !== "number") return "";
    const totalMinutes = Math.round(ticks / 600000000);
    if (totalMinutes <= 0) return "";
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return minutes + "分钟";
    return minutes > 0 ? hours + "小时" + minutes + "分" : hours + "小时";
}

function getRatingColor(text) {
    const upper = (text || "").trim().toUpperCase();
    for (const group of Object.keys(RATING_COLOR_GROUPS)) {
        if (RATING_COLOR_GROUPS[group].includes(upper)) return group;
    }
    return "grey";
}

/* 从媒体流中提取分辨率 / HDR / 音频规格徽章 */
function parseMediaSpecs(item) {
    const specs = [];
    if (!item || !Array.isArray(item.MediaStreams)) return specs;
    const video = item.MediaStreams.find(s => s.Type === "Video");
    const audio = item.MediaStreams.find(s => s.Type === "Audio");

    if (video) {
        const width = video.Width || 0;
        const height = video.Height || 0;
        const range = (video.VideoRange || "").toUpperCase();
        const extended = video.ExtendedVideoRangeType || "";
        if (width >= 3800 || height >= 2000) specs.push({cls: "spec-res", text: "4K UHD"});
        else if (width >= 1900 || height >= 1000) specs.push({cls: "spec-res", text: "1080P"});

        if (range.includes("DOVI") || range.includes("DOLBY VISION") || extended.includes("DOVI")) {
            specs.push({cls: "spec-hdr", text: "Dolby Vision"});
        } else if (range.includes("HDR")) {
            specs.push({cls: "spec-hdr", text: "HDR10"});
        }
    }

    if (audio) {
        const channels = audio.Channels || 0;
        const codec = (audio.Profile || audio.Codec || "").toUpperCase();
        if (codec.includes("ATMOS")) specs.push({cls: "spec-audio", text: "Dolby Atmos"});
        else if (channels >= 8) specs.push({cls: "spec-audio", text: "7.1 声道"});
        else if (channels >= 6) specs.push({cls: "spec-audio", text: "5.1 声道"});
    }

    return specs;
}

function buildMetaBadge(className, html) {
    const badge = document.createElement("span");
    badge.className = "cinema-rich-badge " + className;
    if (html) badge.innerHTML = html;
    return badge;
}

/* 依据 ProviderIds 选择评分渠道图标 */
function resolveScoreChannel(providerIds) {
    const ids = providerIds || {};
    if (ids.Douban || ids.douban) return {icon: BANNER_META_ICONS.douban, alt: "豆瓣", cls: "cinema-rich-douban"};
    if (ids.Imdb || ids.imdb) return {icon: BANNER_META_ICONS.imdb, alt: "IMDb", cls: "cinema-rich-imdb"};
    if (ids.Tmdb || ids.tmdb) return {icon: BANNER_META_ICONS.tmdb, alt: "TMDB", cls: "cinema-rich-tmdb"};
    return {icon: BANNER_META_ICONS.imdb, alt: "IMDb", cls: "cinema-rich-imdb"};
}

/* 单个大图切片：补齐第三方评分 / 分级 / 片长 / 音画规格 */
async function enhanceSlideMetadata(slide) {
    if (!slide || slide.getAttribute("data-rich-enhanced") === "1") return;
    const playBtn = slide.querySelector(".cinema-btn-play");
    const itemId = playBtn ? playBtn.getAttribute("data-id") : null;
    const metaRow = slide.querySelector(".cinema-meta-row");
    if (!itemId || !metaRow) return;

    slide.setAttribute("data-rich-enhanced", "1");
    const api = getMetadataApiClient();
    if (!api) return;

    let item = bannerMetaItemCache.get(itemId);
    if (!item) {
        try {
            item = await api.getItem(api.getCurrentUserId(), itemId);
        } catch (e) {
            return;
        }
        if (!item) return;
        bannerMetaItemCache.set(itemId, item);
    }

    const extra = document.createElement("div");
    extra.className = "cinema-extra-meta-badges";

    if (item.OfficialRating) {
        const badge = buildMetaBadge("cinema-rich-rating cinema-rating-" + getRatingColor(item.OfficialRating));
        badge.textContent = item.OfficialRating;
        extra.appendChild(badge);
    }

    const runtime = formatRuntime(item.RunTimeTicks);
    if (runtime) {
        const badge = buildMetaBadge("cinema-rich-runtime");
        badge.textContent = runtime;
        extra.appendChild(badge);
    }

    if (item.CommunityRating) {
        const channel = resolveScoreChannel(item.ProviderIds);
        extra.appendChild(buildMetaBadge(
            "cinema-rich-score cinema-rich-score-badge " + channel.cls,
            '<img src="' + channel.icon + '" alt="' + channel.alt + '" class="cinema-rich-score-icon" /><span>' + Number(item.CommunityRating).toFixed(1) + "</span>"
        ));
        /* 消除评分重复：移除信息行中的纯文本 ★ 评分 */
        const plainRating = metaRow.querySelector(".cinema-rating-badge");
        if (plainRating) plainRating.remove();
    }

    if (typeof item.CriticRating === "number" && item.CriticRating > 0) {
        const isFresh = item.CriticRating >= 60;
        const icon = isFresh ? BANNER_META_ICONS.rottenFresh : BANNER_META_ICONS.rottenRotten;
        extra.appendChild(buildMetaBadge(
            "cinema-rich-score cinema-rich-rt " + (isFresh ? "fresh" : "rotten"),
            '<img src="' + icon + '" alt="RT" class="cinema-rich-score-icon" /><span>' + Math.round(item.CriticRating) + "%</span>"
        ));
    }

    parseMediaSpecs(item).forEach(spec => {
        const badge = buildMetaBadge("cinema-rich-spec " + spec.cls);
        badge.textContent = spec.text;
        extra.appendChild(badge);
    });

    if (extra.children.length > 0) {
        (metaRow.querySelector(".cinema-genre-list") || metaRow).appendChild(extra);
    }
}

function scanBannerMetadata() {
    document.querySelectorAll(".cinema-slide:not([data-rich-enhanced])").forEach(enhanceSlideMetadata);
}

/* ==============================================================================
 * Part 10: CinemaHome 首页大图轮播引擎 (Cinema Home Carousel Engine)
 * ============================================================================== */
class CinemaHome {
    /* ---------------- 宿主配置与运行期状态 ---------------- */
    static config = CINEMA_CONFIG;
    static cache = {apiClient: undefined, item: new Map()};
    static flag = 0;
    static currentIndex = 0;
    static totalSlides = 0;
    static bannerInterval = null;
    static isPaused = false;
    static isTransitioning = false;
    static rotationDuration = CINEMA_CONFIG.rotationDuration || 5000;
    static loadingStartTime = 0;
    static currentScope = null;
    static coverOptions = {type: "Backdrop", maxWidth: 2560, quality: 88, adjustForPixelRatio: false};
    static thumbOptions = {type: "Primary", maxWidth: 400, quality: 82, adjustForPixelRatio: false};
    static _detailItemPromises = new Map();
    static _detailItemCache = new Map();

    /* ---------------- 生命周期 ---------------- */
    static start() {
        // 首屏防闪烁：如果是首页且尚未挂载横幅，瞬间同步挂载开屏加载动画，彻底消除 FOUC
        const isHome = !window.location.hash || window.location.hash.includes("!/home");
        if (isHome) {
            this.initLoading();
        }
        if (this.config.enableBannerMetadata) this.initBannerMetadata();
        this.initState();
        this.installRouteHooks();
        this.installSectionTitleFixer();
        this.startPageWatcher();
        // 立即执行一次页面扫描，不要等待 350ms 的第一轮 interval
        this.watchPage();
    }

    /* 清理 Emby 内置开屏动画并接管视图切换清理 */
    static initState() {
        $(".app-splash-container, .app-splash").remove();
        document.addEventListener("viewbeforeshow", (e) => {
            const path = e && e.detail && e.detail.path;
            const type = e && e.detail && e.detail.type;
            // 只有离开首页（去往非 home 视图）时才清理加载动画；在首页期间保留，交由 safeDismissLoading 平滑淡出
            if (path && path !== "/home" && type !== "home") {
                $(".cinema-loading-screen, .misty-loading, .app-splash-container, .app-splash").remove();
            }
        });
    }

    /* 路由层拦截：修正版块标题「推荐」链接 */
    static installRouteHooks() {
        try {
            window.require(["appRouter"], (mod) => {
                const appRouter = (mod && mod.default) || (Array.isArray(mod) ? mod[0] : mod);
                if (!appRouter || appRouter._cinemaRouteHooked) return;
                appRouter._cinemaRouteHooked = true;
                const originalGetRouteUrl = appRouter.getRouteUrl;
                appRouter.getRouteUrl = function (item, options) {
                    const url = originalGetRouteUrl.apply(this, arguments);
                    return typeof url === "string" ? fixSectionTitleHref(url) : url;
                };
            });
        } catch (e) {
            console.warn("[EmbyPlus] 安装 appRouter 路由拦截失败", e);
        }
    }

    /* DOM 层拦截：点击与渲染期修正已存在的版块标题链接 */
    static installSectionTitleFixer() {
        const fixAll = () => {
            document.querySelectorAll(SECTION_TITLE_LINK_SELECTOR).forEach(link => {
                const fixed = fixSectionTitleHref(link.href);
                if (fixed !== link.href) link.href = fixed;
            });
        };
        document.addEventListener("click", (e) => {
            const link = e.target.closest(SECTION_TITLE_LINK_SELECTOR);
            if (!link) return;
            const fixed = fixSectionTitleHref(link.href);
            if (fixed !== link.href) link.href = fixed;
        }, true);
        document.addEventListener("viewbeforeshow", fixAll);
        document.addEventListener("viewshow", fixAll);
        fixAll();
    }

    /* ---------------- 路由轮询调度 ---------------- */

    static getParentId() {
        const hash = window.location.hash || window.location.href;
        const qIndex = hash.indexOf("?");
        if (qIndex !== -1) {
            const params = new URLSearchParams(hash.slice(qIndex));
            const pid = params.get("parentId");
            if (pid) return pid;
        }
        if (window.Emby && window.Emby.Page && window.Emby.Page.currentParams) {
            if (window.Emby.Page.currentParams.parentId) return window.Emby.Page.currentParams.parentId;
        }
        return null;
    }

    static startPageWatcher() {
        setInterval(() => this.watchPage(), 350);
    }

    static pauseAutoPlay() {
        if (!this.bannerInterval) return;
        clearInterval(this.bannerInterval);
        this.bannerInterval = null;
    }

    static isItemPage() {
        const hash = window.location.hash;
        return hash.includes("!/item") || hash.includes("item?id=") || window.location.href.includes("/item?id=");
    }

    /* 按当前路由决定：挂载首页横幅 / 挂载媒体库横幅 / 仅暂停轮播 */
    static watchPage() {
        if (this.isItemPage()) return this.pauseAutoPlay();
        if (window.location.hash.includes("!/home")) return this.watchHomePage();
        const parentId = this.getParentId();
        const isLibraryRoute = LIBRARY_ROUTE_PREFIXES.some(prefix => window.location.hash.includes(prefix));
        if (parentId && isLibraryRoute) return this.watchLibraryPage(parentId);
        this.pauseAutoPlay();
    }

    /* 首页：幂等挂载，已存在则只补齐自动轮播，绝不重建 DOM */
    static watchHomePage() {
        if (!this.isHomeTabActive()) {
            $(".cinema-loading-screen, .misty-loading").remove();
            return this.pauseAutoPlay();
        }
        const homeView = $(".view-home-home:not(.hide) .tabContent.is-active[data-index='0']");
        if (!homeView.length || !homeView.find(".homeSectionsContainer").length) return;
        if (homeView.find(".cinema-banner").length === 0) {
            this.initLoading();
            if (this.flag === 0) this.init("home", null);
            return;
        }
        this.currentScope = "home";
        if (!this.bannerInterval && this.totalSlides > 1) {
            this.startAutoPlay();
            this.resetProgressBar();
        }
    }

    /* 媒体库分类页：按 parentId 隔离横幅作用域 */
    static watchLibraryPage(parentId) {
        $(".cinema-loading-screen").remove();
        const libView = $(".view:not(.hide)");
        if (!libView.length) return;

        /* 硬性约束：「推荐」标签页绝不渲染大图推荐海报 */
        const isSuggestionsTab = window.location.hash.includes("tab=suggestions")
            || window.location.href.includes("tab=suggestions")
            || libView.find(".headerTabs .emby-tab-button-active[data-id='suggestions']").length > 0
            || libView.find(".suggestionsTab:not(.hide)").length > 0;
        if (isSuggestionsTab) {
            this.pauseAutoPlay();
            libView.find(".cinema-banner").remove();
            libView.find(".has-cinema-banner").removeClass("has-cinema-banner");
            this.currentScope = null;
            return;
        }

        const targetSlider = libView.find(".itemsContainer").closest(".scrollSlider").first();
        if (!targetSlider || !targetSlider.length) return;

        const hasBanner = targetSlider.find(".cinema-banner").length > 0;
        if (this.flag !== 0 || (hasBanner && this.currentScope === parentId)) return;
        if (this.currentScope !== parentId) {
            libView.find(".cinema-banner").remove();
            libView.find(".has-cinema-banner").removeClass("has-cinema-banner");
        }
        this.init("library", parentId);
    }

    /* ---------------- 数据访问 ---------------- */
    static async ensureApiClient() {
        if (this.cache.apiClient === undefined) {
            this.cache.apiClient = await this.getApiClient();
        }
        return this.cache.apiClient;
    }

    static async getApiClient() {
        if (this.cache.apiClient) return this.cache.apiClient;
        if (window.ApiClient) return (this.cache.apiClient = window.ApiClient);

        /* Emby 4.9+ 模块化入口 */
        try {
            if (window.Emby && typeof window.Emby.importModule === "function") {
                const mod = await window.Emby.importModule("./modules/emby-apiclient/connectionmanager.js");
                const manager = (mod && mod.default) || mod;
                const client = manager && typeof manager.currentApiClient === "function" ? manager.currentApiClient() : null;
                if (client) return (this.cache.apiClient = client);
            }
        } catch (e) {
        }

        /* Emby 4.8 旧版 AMD 入口 */
        try {
            const mod = (await require(["connectionManager"]))[0];
            const client = mod && mod.currentApiClient ? mod.currentApiClient() : mod;
            if (client) return (this.cache.apiClient = client);
        } catch (e) {
        }

        return null;
    }

    static async fetchDetailPageItem(pageId) {
        if (!pageId) return null;
        if (this._detailItemCache.has(pageId)) {
            return this._detailItemCache.get(pageId);
        }
        if (this._detailItemPromises.has(pageId)) {
            return await this._detailItemPromises.get(pageId);
        }
        const api = getMetadataApiClient();
        if (!api) return null;
        const userId = api.getCurrentUserId ? api.getCurrentUserId() : (api._serverInfo && api._serverInfo.UserId);
        const promise = api.getItem(userId, pageId).then(item => {
            if (item) {
                this._detailItemCache.set(pageId, item);
                if (this._detailItemCache.size > 50) {
                    const firstKey = this._detailItemCache.keys().next().value;
                    this._detailItemCache.delete(firstKey);
                }
            }
            this._detailItemPromises.delete(pageId);
            return item;
        }).catch(() => {
            this._detailItemPromises.delete(pageId);
            return null;
        });
        this._detailItemPromises.set(pageId, promise);
        return await promise;
    }

    /* 媒体库查询：会话级短期缓存 */
    static async getItems(query) {
        const client = await this.ensureApiClient();
        const cacheKey = "CACHE|cinema_v1_" + (query.ParentId || "home") + "_" + client.getCurrentUserId();
        const cached = readSessionCache(cacheKey);
        if (cached) return cached;
        const data = await client.getItems(client.getCurrentUserId(), query);
        writeSessionCache(cacheKey, data);
        return data;
    }

    /* 单条目查询：本地持久缓存，未命中才回源 */
    static async getItem(itemId) {
        const cached = this.cache.item.get(itemId) || readLocalCache("CACHE|cinema_item_" + itemId);
        if (cached) return cached;
        const client = await this.ensureApiClient();
        const item = await client.getItem(client.getCurrentUserId(), itemId);
        if (item) {
            this.cache.item.set(itemId, item);
            writeLocalCache("CACHE|cinema_item_" + itemId, item);
        }
        return item;
    }

    /* ---------------- 条目导航 ---------------- */
    static showItem(id) {
        if (!id) return;
        try {
            if (window.Emby && window.Emby.Page && typeof window.Emby.Page.showItem === "function") {
                window.Emby.Page.showItem(id);
                return;
            }
        } catch (e) {
        }
        try {
            window.require(['appRouter'], (r) => {
                const router = (r && r.default) || (Array.isArray(r) ? r[0] : r);
                if (router && typeof router.showItem === "function") {
                    router.showItem(id);
                } else if (window.Emby && window.Emby.Page && typeof window.Emby.Page.showItem === "function") {
                    window.Emby.Page.showItem(id);
                }
            });
        } catch (err) {
            if (window.Emby && window.Emby.Page && typeof window.Emby.Page.showItem === "function") {
                window.Emby.Page.showItem(id);
            }
        }
    }

    /* ---------------- 图片取址 ---------------- */
    static getImageUrl(item, options) {
        const client = this.cache.apiClient;
        if (!client || !item) return "";

        const tags = item.ImageTags || {};
        const width = options.maxWidth;
        const quality = options.quality;
        const adjust = options.adjustForPixelRatio;
        const backdropTag = item.BackdropImageTags && item.BackdropImageTags[0];
        const build = (type, tag, id) => client.getImageUrl(id || item.Id, {
            type: type,
            maxWidth: width,
            tag: tag,
            quality: quality,
            adjustForPixelRatio: adjust
        });

        switch (options.type) {
            case "Thumb":
                if (tags.Thumb) return build("Thumb", tags.Thumb);
                break;
            case "Banner":
                if (tags.Banner) return build("Banner", tags.Banner);
                break;
            case "Logo":
                if (tags.Logo) return build("Logo", tags.Logo);
                break;
            case "Backdrop":
                if (backdropTag) return build("Backdrop", backdropTag);
                break;
            case "Primary":
                if (tags.Primary) return build("Primary", undefined);
                break;
        }

        /* 回退阶梯：横版剧照 → 缩略图 → 主海报 */
        if (backdropTag) return build("Backdrop", backdropTag);
        if (tags.Thumb) return build("Thumb", tags.Thumb);
        if (item.PrimaryImageItemId) return build("Primary", undefined, item.PrimaryImageItemId);
        return "";
    }

    /* ---------------- 大图元数据增强 ---------------- */
    static initBannerMetadata() {
        new MutationObserver(debounce(scanBannerMetadata, 150)).observe(document.body, {childList: true, subtree: true});
        document.addEventListener("viewshow", () => setTimeout(scanBannerMetadata, 200));
        scanBannerMetadata();
    }

    /* ---------------- 横幅渲染与行为 ---------------- */
    static async init(scope, parentId) {
        this.flag = 1;
        this.currentScope = parentId || scope;
        try {
            if (scope === "home") {
                $(".view-home-home:not(.hide)").attr("data-type", "home");
                this.initLoading();
            }
            await this.initBanner(scope, parentId);
        } catch (err) {
            console.error("CinemaHome init error", err);
        } finally {
            if (scope === "home") await this.safeDismissLoading();
            this.flag = 0;
        }
    }

    static initLoading() {
        $(".app-splash-container, .app-splash").remove();

        if ($(".cinema-loading-screen").length === 0) {
            // 同步读取上次已知的服务名，实现 0ms 瞬间挂载，彻底根除 FOUC 闪烁
            const cachedName = sessionStorage.getItem("EMBY_SERVER_NAME") || localStorage.getItem("EMBY_SERVER_NAME") || "EMBY CINEMA";
            const load = `
                <div class="cinema-loading-screen">
                    <div class="cinema-loading-card">
                        <div class="cinema-film-strip-machine">
                            <div class="cinema-reels-row">
                                <svg class="cinema-film-reel main-reel" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="32" cy="32" r="30" stroke="#d4af37" stroke-width="2.5" />
                                    <circle cx="32" cy="32" r="10" fill="#d4af37" />
                                    <circle cx="32" cy="32" r="4" fill="#0c0e14" />
                                    <circle cx="32" cy="12" r="3.5" fill="#d4af37" />
                                    <circle cx="32" cy="52" r="3.5" fill="#d4af37" />
                                    <circle cx="12" cy="32" r="3.5" fill="#d4af37" />
                                    <circle cx="52" cy="32" r="3.5" fill="#d4af37" />
                                    <circle cx="18" cy="18" r="3" fill="#d4af37" />
                                    <circle cx="46" cy="46" r="3" fill="#d4af37" />
                                    <circle cx="18" cy="46" r="3" fill="#d4af37" />
                                    <circle cx="46" cy="18" r="3" fill="#d4af37" />
                                </svg>
                                <svg class="cinema-film-reel sub-reel" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="32" cy="32" r="24" stroke="#d4af37" stroke-width="2" />
                                    <circle cx="32" cy="32" r="8" fill="#d4af37" />
                                    <circle cx="32" cy="32" r="3" fill="#0c0e14" />
                                    <circle cx="32" cy="16" r="2.5" fill="#d4af37" />
                                    <circle cx="32" cy="48" r="2.5" fill="#d4af37" />
                                    <circle cx="16" cy="32" r="2.5" fill="#d4af37" />
                                    <circle cx="48" cy="32" r="2.5" fill="#d4af37" />
                                </svg>
                            </div>
                            <div class="cinema-filmstrip-track">
                                <div class="cinema-filmstrip-roller">
                                    <div class="cinema-filmstrip-segment"></div>
                                    <div class="cinema-filmstrip-segment"></div>
                                    <div class="cinema-filmstrip-segment"></div>
                                    <div class="cinema-filmstrip-segment"></div>
                                    <div class="cinema-filmstrip-segment"></div>
                                    <div class="cinema-filmstrip-segment"></div>
                                    <div class="cinema-filmstrip-segment"></div>
                                    <div class="cinema-filmstrip-segment"></div>
                                </div>
                            </div>
                            <div class="cinema-film-strip-glow"></div>
                        </div>
                        <h1 class="cinema-loading-title">${escapeHtml(cachedName)}</h1>
                        <div class="cinema-loading-line"></div>
                        <div class="cinema-loading-subtitle">CINEMA STREAMING</div>
                    </div>
                </div>
            `;
            this.loadingStartTime = Date.now();
            (document.body ? $("body") : $(document.documentElement)).append(load);
            setTimeout(() => {
                $(".cinema-loading-title").addClass("active");
            }, 30);

            // 后台异步静默获取并更新真实服务名（不阻塞加载屏挂载）
            this.ensureApiClient().then(api => api && api.serverName ? api.serverName() : null).then(name => {
                if (name) {
                    sessionStorage.setItem("EMBY_SERVER_NAME", name);
                    localStorage.setItem("EMBY_SERVER_NAME", name);
                    $(".cinema-loading-title").text(name);
                }
            }).catch(() => {});
        }
    }

    static async safeDismissLoading() {
        const screen = $(".cinema-loading-screen, .app-splash-container, .misty-loading");
        if (!screen.length) return;
        const minDisplayTime = 600; /* 舒适停留约0.6秒，展示极简电影胶卷动效 */
        const elapsed = Date.now() - (this.loadingStartTime || Date.now());
        if (elapsed < minDisplayTime) {
            await CommonUtils.sleep(minDisplayTime - elapsed);
        }
        if (screen.length) {
            screen.addClass("fade-out");
            setTimeout(() => screen.remove(), 550);
        }
    }

    static heroActionsHtml({itemId, showPlay = true, playClass = "", detailClass = ""} = {}) {
        const itemAttr = itemId ? ` data-id="${escapeHtml(itemId)}"` : "";
        return `<div class="cinema-actions">
            ${showPlay ? `<button type="button" class="cinema-btn cinema-btn-play ${playClass}"${itemAttr}>
                <svg class="cinema-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
                <span>立即播放</span>
            </button>` : ""}
            <button type="button" class="cinema-btn cinema-btn-primary cinema-btn-detail ${detailClass}"${itemAttr}>
                <svg class="cinema-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/></svg>
                <span>查看详情</span>
            </button>
        </div>`;
    }

    static async initBanner(scope, parentId) {
        const target = document.querySelector(scope === "home"
            ? ".view-home-home:not(.hide) > .tabContent.is-active[data-index='0']"
            : ".view:not(.hide)");
        if (!target) return;
        const activeView = $(target.closest(".view"));
        const requestedRoute = window.location.hash;
        const isCurrent = () => requestedRoute === window.location.hash && target.isConnected
            && (scope !== "home" || target.classList.contains("is-active"));

        this.cache.apiClient = await this.ensureApiClient();

        const query = this.buildBannerQuery(parentId);
        let data = await this.getItems(query);
        if (!isCurrent()) return;

        /* 近四年无结果时放宽年限重试一次 */
        if ((!data || !data.Items || !data.Items.length) && query.MinPremiereDate) {
            delete query.MinPremiereDate;
            data = await this.getItems(query);
        }
        if (!data || !data.Items || !data.Items.length) return;

        const slides = this.pickBannerSlides(data.Items, parentId);
        if (slides.length === 0) return;

        this.totalSlides = slides.length;
        this.currentIndex = 0;

        /* 复用查询已返回的完整元数据，无需阻塞式二次 getItem，实现毫秒级秒开 */
        const prepared = slides.map(item => ({item: item, assets: this.buildBannerAssets(item)}));
        const slidesHtml = prepared.map((entry, index) => this.buildSlideHtml(entry.item, index, parentId, entry.assets)).join("");
        const thumbsHtml = prepared.map((entry, index) => this.buildThumbHtml(entry.item, index, entry.assets)).join("");
        const bannerHtml = `
            <div class="cinema-banner ${parentId ? "cinema-banner-library" : ""}">
                <div class="cinema-slides">${slidesHtml}</div>
                <div class="cinema-thumbnails">${thumbsHtml}</div>
            </div>
        `;
        if (!isCurrent()) return;

        if (!this.mountBanner(bannerHtml, activeView, parentId)) return;
        this.bindEvents(slides);
        this.startAutoPlay();
        this.resetProgressBar();
    }

    /* 大图查询条件 */
    static buildBannerQuery(parentId) {
        const query = {
            ImageTypes: "Backdrop",
            EnableImageTypes: "Logo,Banner,Primary,Backdrop",
            IncludeItemTypes: "Movie,Series",
            Recursive: true,
            ImageTypeLimit: 1,
            Limit: 20,
            Fields: "Overview,ProductionYear,PremiereDate,Genres,CommunityRating,RunTimeTicks,OfficialRating,Type,DateCreated,MediaSources,Status",
            SortBy: "DateCreated,PremiereDate,SortName",
            SortOrder: "Descending",
            EnableUserData: true,
            EnableTotalRecordCount: false
        };
        if (parentId) {
            query.ParentId = parentId;
            query.MinPremiereDate = (new Date().getFullYear() - 4) + "-01-01";
        }
        return query;
    }

    /* 去重过滤：优先近四年且带横版剧照的条目，不足 3 部时放宽年限补齐 */
    static pickBannerSlides(items, parentId) {
        const currentYear = new Date().getFullYear();
        const maxSlides = parentId ? 6 : 8;
        const seenIds = new Set();
        const seenNames = new Set();
        const picked = [];

        const collect = (enforceRecent) => {
            for (const item of items) {
                if (!item || !item.Id || !item.Name) continue;
                if (!item.BackdropImageTags || item.BackdropImageTags.length === 0) continue;
                if (enforceRecent && item.ProductionYear && item.ProductionYear < currentYear - 4) continue;
                const cleanName = item.Name.trim().toLowerCase();
                if (seenIds.has(item.Id) || seenNames.has(cleanName)) continue;
                seenIds.add(item.Id);
                seenNames.add(cleanName);
                picked.push(item);
                if (picked.length === maxSlides) return true;
            }
            return false;
        };

        if (!collect(true) && picked.length < 3) collect(false);
        return picked;
    }

    /* 剧集集数 / 影片体积补充徽章 */
    static describeSlideExtra(item) {
        if (item.Type === "Series") {
            const childCount = item.ChildCount || item.RecursiveItemCount;
            if (!childCount) return null;
            const ended = item.Status === "Ended" || item.Status === "Completed";
            return {cls: "cinema-ep-badge", text: ended ? `全 ${childCount} 集` : `更新至第 ${childCount} 集`};
        }
        const source = item.MediaSources && item.MediaSources[0];
        const sizeBytes = source ? source.Size : 0;
        return sizeBytes ? {cls: "cinema-size-badge", text: formatBytes(sizeBytes)} : null;
    }

    /* 切片取图：桌面横版剧照 / 胶片缩略图 / 手机竖版海报 / 标题 Logo */
    static buildBannerAssets(item) {
        const desktopBackdrop = this.getImageUrl(item, this.coverOptions)
            || this.getImageUrl(item, {type: "Primary", maxWidth: 1920, quality: 85})
            || "";
        const posterUrl = this.getImageUrl(item, {type: "Primary", maxWidth: 400, quality: 85}) || desktopBackdrop;
        const thumbUrl = this.getImageUrl(item, {type: "Thumb", maxWidth: 500, quality: 85})
            || this.getImageUrl(item, {type: "Backdrop", maxWidth: 500, quality: 85})
            || posterUrl;
        const logoUrl = item.ImageTags && item.ImageTags.Logo
            ? this.getImageUrl(item, {type: "Logo", maxWidth: 650, quality: 90})
            : "";
        return {desktopBackdrop: desktopBackdrop, posterUrl: posterUrl, thumbUrl: thumbUrl, logoUrl: logoUrl};
    }

    static buildSlideHtml(item, index, parentId, assets) {
        const name = escapeHtml(item.Name);
        const year = item.ProductionYear || (item.PremiereDate ? new Date(item.PremiereDate).getFullYear() : "");
        const rating = item.CommunityRating ? Number(item.CommunityRating).toFixed(1) : "";
        const typeText = item.Type === "Series" ? "剧集" : (item.Type === "Movie" ? "电影" : "影视");
        const extra = this.describeSlideExtra(item);

        const badges = [`<span class="cinema-genre-badge cinema-type-badge">${typeText}</span>`];
        if (year && String(year).trim()) {
            badges.push(`<span class="cinema-genre-badge cinema-year-badge">${escapeHtml(String(year).trim())}</span>`);
        }
        if (rating) {
            badges.push(`<span class="cinema-genre-badge cinema-rating-badge"><span class="cinema-star">★</span> ${rating}</span>`);
        }
        if (extra) {
            badges.push(`<span class="cinema-genre-badge ${extra.cls}">${escapeHtml(extra.text)}</span>`);
        }
        (item.Genres || []).slice(0, 3).forEach(genre => {
            badges.push(`<span class="cinema-genre-badge">${escapeHtml(genre)}</span>`);
        });

        const titleOrLogoHtml = assets.logoUrl
            ? `<div class="cinema-title-logo-wrap"><img class="cinema-title-logo" src="${assets.logoUrl}" alt="${name}" /></div>`
            : `<h1 class="cinema-title" title="${name}">${name}</h1>`;

        return `
            <div class="cinema-slide ${index === 0 ? "active" : ""}" data-index="${index}" data-id="${item.Id}">
                <div class="cinema-backdrop-wrap">
                    <img class="cinema-backdrop-img" src="${assets.desktopBackdrop}" alt="${name}" loading="${index === 0 ? "eager" : "lazy"}" decoding="async" fetchpriority="${index === 0 ? "high" : "low"}" />
                    <div class="cinema-backdrop-gradient"></div>
                </div>
                <div class="cinema-content">
                    <div class="cinema-tag">${parentId ? "最近更新" : "本周趋势"}</div>
                    ${titleOrLogoHtml}
                    <div class="cinema-meta-row cinema-genre-list">${badges.join("")}</div>
                    <p class="cinema-overview">${escapeHtml(item.Overview || "暂无简介")}</p>
                    ${this.heroActionsHtml({itemId: item.Id})}
                </div>
            </div>
        `;
    }

    /* 胶片缩略卡：纯净 16:9 横版矩形 */
    static buildThumbHtml(item, index, assets) {
        const name = escapeHtml(item.Name);
        return `
            <div class="cinema-thumb-card ${index === 0 ? "active" : ""}" data-index="${index}" data-id="${item.Id}" title="${name}">
                <picture>
                    <source media="(max-width: 1023px)" srcset="${assets.thumbUrl}">
                    <img src="${assets.posterUrl}" alt="${name}" loading="eager" decoding="async" />
                </picture>
                <div class="cinema-thumb-title">${name}</div>
                <div class="cinema-thumb-progress">
                    <div class="cinema-thumb-progress-fill"></div>
                </div>
            </div>
        `;
    }

    /* 挂载横幅：媒体库挂到视图设置条之前，首页挂到首个版块之前 */
    static mountBanner(bannerHtml, activeView, parentId) {
        if (parentId) {
            const slider = activeView.find(".itemsViewSettingsContainer").closest(".scrollSlider").first();
            if (!slider || !slider.length) return false;
            slider.addClass("has-cinema-banner");
            slider.find(".itemsViewSettingsContainer").before(bannerHtml);
            return true;
        }
        const homeSections = activeView.find(".tabContent.is-active[data-index='0'] .homeSectionsContainer");
        homeSections.closest(".scrollSlider").addClass("has-cinema-banner");
        homeSections.before(bannerHtml);
        return true;
    }

    static isHomeTabActive() {
        const hashTab = (window.location.hash.match(/[?&]tab=([^&]+)/) || [])[1];
        if (hashTab && hashTab !== "home") return false;
        return !!document.querySelector(".view-home-home:not(.hide) > .tabContent.is-active[data-index='0']");
    }

    static bindEvents(details) {
        const self = this;
        const banner = $(".cinema-banner");

        banner.on("click", ".cinema-thumb-card", function (e) {
            e.stopPropagation();
            const index = parseInt($(this).attr("data-index"), 10);
            if (!isNaN(index) && index !== self.currentIndex) {
                self.goToSlide(index);
                self.resetAutoPlay();
            }
        });

        if (window.matchMedia && window.matchMedia("(hover: hover)").matches) {
            // 仅在鼠标悬停于交互控件或缩略图列表时暂停，避免整块大图误触永久卡死轮播
            banner.on("mouseenter", ".cinema-thumbnails, .cinema-actions", () => {
                self.isPaused = true;
                banner.addClass("is-paused");
            }).on("mouseleave", ".cinema-thumbnails, .cinema-actions", () => {
                self.isPaused = false;
                banner.removeClass("is-paused");
            });
        }

        banner.on("click", ".cinema-btn-detail", function (e) {
            e.stopPropagation();
            const id = $(this).attr("data-id");
            if (id) self.showItem(id);
        });

        banner.on("click", ".cinema-btn-play", async function (e) {
            e.stopPropagation();
            const id = $(this).attr("data-id");
            if (!id) return;
            try {
                const playbackmanager = (await require(["./modules/common/playback/playbackmanager.js"]))[0];
                const detail = details.find(d => d.Id === id) || (await self.getItem(id));
                let resume = {
                    ids: [detail.Id],
                    serverId: detail.ServerId,
                    items: [detail]
                };
                if (detail.UserData && detail.UserData.PlaybackPositionTicks) {
                    resume.startPositionTicks = detail.UserData.PlaybackPositionTicks;
                }
                if (playbackmanager && playbackmanager.default) {
                    playbackmanager.default.play(resume);
                } else if (playbackmanager && playbackmanager.play) {
                    playbackmanager.play(resume);
                }
            } catch (err) {
                console.warn("[EmbyPlus] 直接播放失败，回退至详情页", err);
                self.showItem(id);
            }
        });

        document.addEventListener("visibilitychange", () => {
            self.isPaused = document.hidden;
            if (document.hidden) {
                banner.addClass("is-paused");
            } else {
                banner.removeClass("is-paused");
                self.resetProgressBar();
            }
        });
    }

    static goToSlide(index) {
        if (index < 0 || index >= this.totalSlides || index === this.currentIndex || this.isTransitioning) return;
        this.isTransitioning = true;
        setTimeout(() => {
            this.isTransitioning = false;
        }, 850);
        const prevIndex = this.currentIndex;
        this.currentIndex = index;

        const banner = $(".cinema-banner");
        const slides = banner.find(".cinema-slide");
        const prevSlide = slides.filter(`[data-index="${prevIndex}"]`);
        const newSlide = slides.filter(`[data-index="${index}"]`);

        prevSlide.removeClass("active").addClass("cinema-slide-prev");
        newSlide.removeClass("cinema-slide-prev").addClass("active");

        setTimeout(() => {
            prevSlide.removeClass("cinema-slide-prev");
        }, 850);

        banner.find(".cinema-thumb-card.active").removeClass("active");
        const activeThumb = banner.find(`.cinema-thumb-card[data-index="${index}"]`).addClass("active");

        this.resetProgressBar();

        if (activeThumb.length && window.innerWidth <= 1023) {
            try {
                const container = activeThumb.closest(".cinema-thumbnails")[0];
                if (container) {
                    const targetLeft = activeThumb[0].offsetLeft - (container.clientWidth / 2) + (activeThumb[0].clientWidth / 2);
                    container.scrollTo({left: targetLeft, behavior: "smooth"});
                }
            } catch (e) {
            }
        }
    }

    static startAutoPlay() {
        if (!this.config || !this.config.autoPlay) return;
        if (this.bannerInterval) clearInterval(this.bannerInterval);
        this.bannerInterval = setInterval(() => {
            if (!this.isPaused && !document.hidden) {
                const nextIndex = (this.currentIndex + 1) % this.totalSlides;
                this.goToSlide(nextIndex);
            }
        }, this.rotationDuration);
    }

    static resetAutoPlay() {
        if (this.bannerInterval) clearInterval(this.bannerInterval);
        this.startAutoPlay();
    }

    static resetProgressBar() {
        const banner = $(".cinema-banner");
        const allFills = banner.find(".cinema-thumb-progress-fill");
        allFills.css({"transition": "none", "width": "0%"});

        const activeFill = banner.find(".cinema-thumb-card.active .cinema-thumb-progress-fill");
        if (activeFill.length) {
            const durationSec = (this.rotationDuration / 1000).toFixed(1);
            setTimeout(() => {
                activeFill.css({
                    "transition": `width ${durationSec}s linear`,
                    "width": "100%"
                });
            }, 30);
        }
    }

}

/* ==============================================================================
 * Part 11: Addon 公共接口与宿主能力导出 (Addon Public API & Host Export)
 *
 * Addon 契约（唯一入口，Lite / Full 通用）：
 *     EmbyPlus.defineAddon(id, label, config, function (host) { ... }, style?)
 *   - id     组件唯一标识；label 组件显示名（日志用）
 *   - config 组件配置默认值：仅补齐 CINEMA_CONFIG 缺失的键，绝不覆盖用户取值
 *   - factory 组件实现：形参 host 即宿主公共接口，内部变量天然隔离在本函数作用域；纯样式组件可省略
 *   - style  可选样式文本：由宿主幂等注入；单文件版由构建脚本并入 Emby_Plus.full.css
 * ============================================================================== */
const installedAddons = new Map();

/* 组件样式幂等注入 */
function injectAddonStyle(id, css) {
    const styleId = "embyplus-addon-" + id;
    if (!css || document.getElementById(styleId)) return;
    const styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.textContent = css;
    (document.head || document.documentElement).appendChild(styleEl);
}

/* 组件装配：补齐配置默认值 → 注入样式 → 立即执行组件工厂 */
function defineAddon(id, label, config, factory, style) {
    if (!id || (typeof factory !== "function" && !style)) {
        console.warn("[EmbyPlus] 忽略非法 Addon 定义：", id);
        return;
    }
    if (installedAddons.has(id)) {
        console.warn("[EmbyPlus] Addon 已定义，跳过：" + id);
        return;
    }

    const name = label || id;
    installedAddons.set(id, {id: id, label: name});

    Object.keys(config || {}).forEach(key => {
        if (CinemaHome.config[key] === undefined) CinemaHome.config[key] = config[key];
    });
    injectAddonStyle(id, style);

    if (typeof factory !== "function") return;   /* 纯样式组件：仅注入样式 */
    try {
        factory(CinemaHome);
        console.log("[EmbyPlus] Addon 已加载：" + name + " (" + id + ")");
    } catch (err) {
        console.error("[EmbyPlus] Addon 加载失败：" + name + " (" + id + ")", err);
    }
}

/* 宿主公共能力：供 Tab / 详情页类 Addon 复用 */
Object.assign(CinemaHome, {
    /* DOM 工具 */
    $, DomList, CommonUtils,
    /* 格式化与算法 */
    escapeHtml, padZero, formatDateYMD, formatBytes, generateDatesList, debounce,
    /* TMDB 与媒体库数据服务 */
    getEffectiveTmdbKey, getTmdbImg, fetchWithCache, checkInLibrary, getSeriesExistingEpisodes,
    checkMissingEpisodesInfo, ensureLibraryIndex, checkUserAdminStatus,
    /* Tab UI 模板 */
    heroPlaceholderHtml, heroContentHtml, posterCardHtml, showTabPageState, finishTabPageState, loadingStateHtml,
    /* 共享常量字典 */
    TMDB_KEY, TMDB_API_BASE, TMDB_IMG_BASE, TMDB_LOGO, PLATFORMS, REGIONS, GENRE_MAP, CALENDAR_COUNTRIES,
    weekdays, weekdaysFull,
    /* Tab 框架与 Addon 注册表 */
    registerTab, updateCinemaTabTopOffset, HOME_TABS, defineAddon, installedAddons
});

/* 宿主全局出口：Addon 通过 window.EmbyPlus 获取宿主能力 */
window.EmbyPlus = CinemaHome;

/* 启动宿主引擎 */
CinemaHome.start();

/* 01-外链品牌Logo.js · 详情页 · 外链品牌 Logo */
EmbyPlus.defineAddon("link-logos", "详情页 · 外链品牌 Logo", null, function (host) {

    /* ---------------- 宿主能力别名 ---------------- */
    var CinemaHome = host;
    var $ = host.$;
    var DomList = host.DomList;
    var CommonUtils = host.CommonUtils;

    function initLinkLogos() {
        if (!this.config || !this.config.enableLinkLogos) return;
        const CDN = "https://cdn.jsdelivr.net/gh/v1rusnl/EmbySpotlight@main/logo";
        const ATTR = "data-cinema-logo-done";
        const DOUBAN_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 66 22' width='66' height='22'%3E%3Cpath fill='%2300B51D' d='M3 2.5h14v2H3zm-2 3.6h18v2H1zm2 3.6h14v6.2H3zm2.2 1.8v2.6h9.6v-2.6zm-4.2 6.2h18v2H1z'/%3E%3Ctext x='44' y='16' fill='%2300B51D' text-anchor='middle' font-family='-apple-system, BlinkMacSystemFont, sans-serif' font-size='13.5' font-weight='700'%3E%E8%B1%86%E7%93%A3%3C/text%3E%3C/svg%3E";

        const LOGOS = {
            "douban.com": {logo: DOUBAN_LOGO, label: "豆瓣", h: "24px"},
            "imdb.com": {logo: `${CDN}/IMDb_noframe.png`, label: "IMDb", h: "20px"},
            "themoviedb.org": {logo: `${CDN}/TMDB.png`, label: "TMDB", h: "24px"},
            "trakt.tv": {logo: `${CDN}/Trakt.png`, label: "Trakt", h: "24px"},
            "thetvdb.com": {logo: `${CDN}/tvdb.png`, label: "TheTVDB", h: "24px"}
        };

        const rtCache = new Map();
        let processing = false;
        let watchdog = null;
        let debounce = null;

        const getItemId = () => {
            const m = location.href.match(/[?&]id=(\d+)/);
            return m ? m[1] : null;
        };

        const getContainer = () => {
            const view = document.querySelector(".view-item-item:not(.hide)");
            return view?.querySelector(".linksSection .itemLinks, .itemLinks, .itemExternalLinks") || null;
        };

        const makeImg = (src, label, h) => {
            const img = document.createElement("img");
            Object.assign(img, {src, alt: label, title: label, draggable: false});
            img.style.cssText = `height:${h};width:auto;object-fit:contain;vertical-align:middle;opacity:0.88;transition:opacity 0.2s,transform 0.2s`;
            img.onmouseenter = () => {
                img.style.opacity = "1";
                img.style.transform = "scale(1.08)";
            };
            img.onmouseleave = () => {
                img.style.opacity = "0.88";
                img.style.transform = "scale(1)";
            };
            return img;
        };

        const fetchRTSlug = async (imdbId) => {
            if (!imdbId) return null;
            if (rtCache.has(imdbId)) return rtCache.get(imdbId);
            try {
                const q = `SELECT ?rtId WHERE { ?i wdt:P345 "${imdbId}". ?i wdt:P1258 ?rtId. } LIMIT 1`;
                const r = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q));
                if (!r.ok) {
                    rtCache.set(imdbId, null);
                    return null;
                }
                const data = await r.json();
                const slug = data.results?.bindings?.[0]?.rtId?.value || null;
                rtCache.set(imdbId, slug);
                return slug;
            } catch (e) {
                rtCache.set(imdbId, null);
                return null;
            }
        };

        const process = async () => {
            if (processing) return;
            processing = true;
            try {
                const c = getContainer();
                if (!c) return;

                const links = [...c.querySelectorAll(`a:not([${ATTR}])`)];
                let imdbLink = null;
                links.forEach(a => {
                    const href = (a.href || "").toLowerCase();
                    const text = (a.textContent || "").trim().toLowerCase();
                    for (const [dom, cfg] of Object.entries(LOGOS)) {
                        if (href.includes(dom) || (dom === "douban.com" && (text.includes("douban") || text.includes("豆瓣")))) {
                            a.textContent = "";
                            a.appendChild(makeImg(cfg.logo, cfg.label, cfg.h));
                            a.style.cssText += "display:inline-flex;align-items:center;padding:2px 4px;";
                            a.setAttribute(ATTR, "1");
                            if (dom === "imdb.com") imdbLink = a;
                            break;
                        }
                    }
                });

                // 清除原生在链接间插入的逗号文本节点 (解决 'Douban, ' 逗号遗留)
                [...c.childNodes].forEach(n => {
                    if (n.nodeType === 3 && /^[,\s，、]+$/.test(n.textContent)) {
                        n.textContent = "";
                    }
                });

                // 自动补齐：如果 Emby 元数据有 Douban ProviderId 但未渲染链接，自动补齐豆瓣链接
                const itemId = getItemId();
                if (itemId && !c.querySelector('a[href*="douban.com"]') && !c.querySelector('[data-cinema-douban]')) {
                    const api = window.ApiClient;
                    if (api && typeof api.getItem === "function") {
                        api.getItem(api.getCurrentUserId(), itemId).then(it => {
                            const dId = it?.ProviderIds?.Douban || it?.ProviderIds?.douban;
                            if (dId && !c.querySelector('a[href*="douban.com"]') && !c.querySelector('[data-cinema-douban]')) {
                                const da = document.createElement("a");
                                da.setAttribute("is", "emby-linkbutton");
                                da.className = "button-link button-link-color-inherit emby-button";
                                Object.assign(da, {
                                    href: `https://movie.douban.com/subject/${dId}/`,
                                    target: "_blank",
                                    rel: "noopener noreferrer",
                                    title: `豆瓣 (${dId})`
                                });
                                da.setAttribute(ATTR, "1");
                                da.setAttribute("data-cinema-douban", "1");
                                da.appendChild(makeImg(DOUBAN_LOGO, "豆瓣", "24px"));
                                da.style.cssText += "display:inline-flex;align-items:center;padding:2px 4px;";
                                c.prepend(da);
                            }
                        }).catch(() => {
                        });
                    }
                }

                if (imdbLink && !c.querySelector("[data-cinema-rt]")) {
                    const m = (imdbLink.href || "").match(/(tt\\d+)/);
                    if (m) {
                        const slug = await fetchRTSlug(m[1]);
                        if (slug && !c.querySelector("[data-cinema-rt]")) {
                            const rt = document.createElement("a");
                            rt.setAttribute("is", "emby-linkbutton");
                            rt.className = "button-link button-link-color-inherit emby-button";
                            Object.assign(rt, {
                                href: `https://www.rottentomatoes.com/${slug}`,
                                target: "_blank",
                                rel: "noopener noreferrer",
                                title: "Rotten Tomatoes"
                            });
                            rt.setAttribute(ATTR, "1");
                            rt.setAttribute("data-cinema-rt", "1");
                            rt.appendChild(makeImg(`${CDN}/rt.png`, "Rotten Tomatoes", "24px"));
                            rt.style.cssText += "display:inline-flex;align-items:center;padding:2px 4px;";
                            c.appendChild(rt);
                        }
                    }
                }
            } catch (e) {
            } finally {
                processing = false;
            }
        };

        const onNav = () => {
            if (!getItemId()) {
                if (watchdog) {
                    clearInterval(watchdog);
                    watchdog = null;
                }
                return;
            }
            clearTimeout(debounce);
            debounce = setTimeout(process, 180);
            if (!watchdog) {
                watchdog = setInterval(process, 1200);
                setTimeout(() => {
                    if (watchdog) {
                        clearInterval(watchdog);
                        watchdog = null;
                    }
                }, 8000);
            }
        };

        window.addEventListener("popstate", onNav);
        window.addEventListener("hashchange", onNav);
        document.addEventListener("viewshow", onNav);
        setTimeout(onNav, 250);
    }

    initLinkLogos.call(host);

});

/* 02-卡片分级徽章.js · 媒体库卡片彩色分级徽章 */
EmbyPlus.defineAddon("media-ratings", "媒体库卡片彩色分级徽章", null, function (host) {

    /* ---------------- 宿主能力别名 ---------------- */
    var CinemaHome = host;
    var $ = host.$;
    var DomList = host.DomList;
    var CommonUtils = host.CommonUtils;

    function initMediaRatings() {
        if (!this.config || !this.config.enableMediaRatings) return;
        const GROUPS = {
            green: ["AR-ATP", "AU-C", "AU-G", "AU-P", "P", "AT-0", "BE-KT", "BR-L", "C8", "CA-C", "CA-C8", "CA-G", "C", "CH-0", "CN-G", "CZ-U", "DK-A", "FI-S", "FR-U", "DE-0", "FSK-0", "GR-K", "HU-KN", "IN-U", "U", "ID-SU", "IE-G", "G", "IL-G", "IT-T", "JP-G", "KR-ALL", "MY-U", "MX-AA", "NL-AL", "NZ-G", "NO-6", "NO-A", "PH-G", "PL-B/O", "PT-M/4", "RU-0+", "SG-G", "ZA-A", "ES-APTA", "SE-BTL", "TH-G", "TR-G", "GB-U", "UK-U", "APPROVED", "PASSED", "TV-G", "TV-Y", "TV-Y7", "VN-P"],
            yellow: ["AR-13", "AU-PG", "PG", "AT-6", "BE-6", "BR-12", "CA-PG", "CH-6", "CZ-12", "DK-7", "FI-K-7", "FR-10", "FR--10", "DE-6", "FSK-6", "GR-K-12", "HU-6", "IN-UA", "IN-UA-7", "IN-U/A 7+", "IN-UA-13", "IN-U/A 13+", "IN-UA-16", "IN-U/A 16+", "ID-BO", "IE-PG", "IE-12", "IE-12A", "12A", "IL-PG", "IT-VM6", "JP-PG12", "KR-12", "MY-P13", "MX-A", "NL-6", "NZ-PG", "NO-9", "NO-12", "PH-PG", "PL-7", "PT-M/6", "RU-6+", "SG-PG", "ZA-PG", "ES-7", "SE-7", "TH-PG13", "TR-PG", "GB-PG", "GB-12", "GB-12A", "UK-PG", "UK-12", "UK-12A", "12", "TV-PG", "GP", "10"],
            orange: ["AR-16", "AU-M", "M", "AT-10", "BE-9", "BR-14", "14+", "CA-14+", "CA-13+", "CH-10", "CN-PG-13", "CZ-15", "DK-11", "FI-K-12", "FR-12", "FR--12", "DE-12", "FSK-12", "GR-K-15", "HU-12", "ID-13+", "IE-15A", "15A", "IL-14", "IT-VM14", "JP-R15+", "KR-15", "MX-B", "NL-9", "NZ-M", "NO-15", "PH-PG-13", "PL-12", "PT-M/12", "RU-12+", "SG-PG13", "ZA-10-12PG", "ES-12", "SE-11", "TH-15", "TR-12", "GB-15", "UK-15", "15", "PG-13", "TV-14", "VN-T13", "-12"],
            redOrange: ["MA15+", "AU-MA15+", "AT-14", "BE-12", "BR-16", "CA-16+", "CH-14", "FI-K-16", "FR-16", "FR--16", "DE-16", "FSK-16", "HU-16", "ID-17+", "IE-16", "IL-16", "MX-B15", "NL-12", "NZ-R13", "PH-R-16", "PL-15", "PT-M/16", "RU-16+", "SG-NC16", "ZA-13", "ES-16", "SE-15", "TR-15", "VN-T16", "16+", "MA 15+", "16", "-16", "M16"],
            red: ["AR-18", "AU-R18+", "R18+", "AT-16", "BE-16", "BR-18", "18+", "CA-18+", "CH-16", "CN-R", "CZ-18", "DK-15", "FI-K-18", "FR-18", "FR--18", "DE-18", "FSK-18", "GR-K-17", "HU-18", "IN-A", "ID-21+", "IE-18", "18", "IL-18", "IT-VM18", "JP-R18+", "KR-19", "KR-R", "MY-18", "MX-C", "NL-16", "NZ-R15", "NZ-R16", "NO-18", "PH-R-18", "PL-18", "PT-M/18", "RU-18+", "SG-M18", "ZA-16", "ES-18", "TH-18", "TR-18", "GB-18", "UK-18", "R", "TV-MA"],
            pink: ["AU-X18+", "X18+", "CH-18", "MX-D", "NZ-R18", "SG-R21", "ZA-18", "TH-20", "GB-R18", "UK-R18", "R18", "NC-17", "X"],
            purple: ["IN-S"],
            blue: ["EXEMPT", "EDUCATIONAL", "INFORMATIONAL"],
            grey: ["UNRATED", "NOT RATED", "NR", "UR", "NONE"]
        };

        const MAP = {};
        Object.entries(GROUPS).forEach(([group, list]) => {
            list.forEach(r => {
                MAP[r.toUpperCase()] = group;
            });
        });

        const process = () => {
            document.querySelectorAll(".mediaInfoItem:not([data-rating-group])").forEach(el => {
                const text = (el.textContent || "").trim().toUpperCase();
                if (!text) return;
                const group = MAP[text];
                if (group) el.setAttribute("data-rating-group", group);
            });
        };

        process();
        let timer = null;
        const observer = new MutationObserver(() => {
            clearTimeout(timer);
            timer = setTimeout(process, 120);
        });
        observer.observe(document.body, {childList: true, subtree: true});
        document.addEventListener("viewshow", () => setTimeout(process, 150));
    }

    initMediaRatings.call(host);

});

/* 03-集页面美化.js · 集页面美化（详情页元数据 / 季集平铺 / 列表多选） */
EmbyPlus.defineAddon("season-page", "集页面美化（详情页元数据 / 季集平铺 / 列表多选）", null, function (host) {

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

});

/* 04-TMDB影评.js · TMDB 精选影评 */
EmbyPlus.defineAddon("tmdb-reviews", "TMDB 精选影评", null, function (host) {

    /* ---------------- 宿主能力别名（保持原实现写法不变） ---------------- */
    var CinemaHome = host;
    var CINEMA_CONFIG = host.config;
    var $ = host.$;
    var DomList = host.DomList;
    var CommonUtils = host.CommonUtils;

    function initTmdbReviews() {
        if (window.CINEMA_CONFIG && window.CINEMA_CONFIG.enableReviews === false) return;

        const getApiKey = () => (host.getEffectiveTmdbKey && host.getEffectiveTmdbKey()) || (window.CINEMA_CONFIG && window.CINEMA_CONFIG.tmdbApiKey && window.CINEMA_CONFIG.tmdbApiKey.trim()) || "";
        const MAX_REVIEWS = this.config.maxReviews || 25;
        const REVIEW_PREVIEW_LENGTH = this.config.reviewPreviewLength || 500;
        /* 手机端折叠长度取一半，避免影评卡片过高 */
        const reviewPreviewLength = () => (window.matchMedia && window.matchMedia("(max-width: 41.99em)").matches)
            ? Math.max(80, Math.round(REVIEW_PREVIEW_LENGTH / 2))
            : REVIEW_PREVIEW_LENGTH;
        const SHOW_LANGUAGE_FLAGS = this.config.showLanguageFlags !== false;

        const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239ca3af'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

        const LANGUAGE_TO_COUNTRY = {
            'zh': 'cn', 'zh-CN': 'cn', 'zh-TW': 'tw', 'zh-HK': 'hk',
            'en': 'us', 'en-US': 'us', 'en-GB': 'gb', 'en-AU': 'au', 'en-CA': 'ca',
            'ja': 'jp', 'ja-JP': 'jp', 'ko': 'kr', 'ko-KR': 'kr',
            'de': 'de', 'de-DE': 'de', 'fr': 'fr', 'fr-FR': 'fr',
            'es': 'es', 'es-ES': 'es', 'it': 'it', 'it-IT': 'it',
            'ru': 'ru', 'ru-RU': 'ru', 'pt': 'pt', 'pt-BR': 'br'
        };

        let lastProcessedId = null;

        function getLanguageFlagHtml(langCode) {
            if (!langCode || !SHOW_LANGUAGE_FLAGS) return "";
            const base = langCode.split("-")[0].toLowerCase();
            const country = LANGUAGE_TO_COUNTRY[langCode] || LANGUAGE_TO_COUNTRY[base];
            if (country) {
                return `<img class="emby-review-flag" src="https://flagcdn.com/w40/${country}.png" alt="${country}" loading="lazy" />`;
            }
            return "🌐";
        }

        async function fetchReviews(tmdbId, mediaType) {
            const key = getApiKey();
            if (!key) return null; // 返回 null 表示未配置 Key
            const type = mediaType === "tv" ? "tv" : "movie";
            const url = `https://api.themoviedb.org/3/${type}/${tmdbId}/reviews?api_key=${key}&page=1`;

            try {
                const resp = await fetch(url);
                if (!resp.ok) return [];
                const data = await resp.json();
                const list = data.results || [];
                return list.slice(0, MAX_REVIEWS);
            } catch (e) {
                return [];
            }
        }

        function parseAvatarUrl(path) {
            if (!path) return DEFAULT_AVATAR;
            if (path.startsWith("/http")) return path.substring(1);
            if (path.startsWith("http")) return path;
            return `https://image.tmdb.org/t/p/w185${path}`;
        }

        function formatDate(dateStr) {
            if (!dateStr) return "";
            try {
                return dateStr.split("T")[0];
            } catch (e) {
                return dateStr;
            }
        }

        function createReviewCard(review) {
            const card = document.createElement("div");
            card.className = "emby-review-card";

            const author = review.author || "匿名影评人";
            const avatar = parseAvatarUrl(review.author_details?.avatar_path);
            const rating = review.author_details?.rating;
            const date = formatDate(review.created_at);
            const flag = getLanguageFlagHtml(review.author_details?.language || "en");
            const rawContent = (review.content || "").trim();

            const ratingHtml = rating ? `<span class="emby-review-rating-badge">★ ${rating}/10</span>` : "";

            const header = document.createElement("div");
            header.className = "emby-review-header";
            header.innerHTML = `
				<div class="emby-review-author-info">
					<img src="${avatar}" class="emby-review-avatar" onerror="this.onerror=null; this.src='${DEFAULT_AVATAR}';" />
					<div>
						<span class="emby-review-author-name">${author}</span>
						<span class="emby-review-date">${date}</span>
					</div>
					${flag}
				</div>
				${ratingHtml}
			`;
            card.appendChild(header);

            const body = document.createElement("div");
            body.className = "emby-review-content";

            const previewLength = reviewPreviewLength();
            if (rawContent.length > previewLength) {
                const shortText = rawContent.substring(0, previewLength);
                const fullText = rawContent;
                let isExpanded = false;

                body.textContent = shortText + "... ";
                const toggleBtn = document.createElement("span");
                toggleBtn.className = "emby-review-toggle";
                toggleBtn.textContent = "展开阅读全文";
                toggleBtn.onclick = (e) => {
                    e.stopPropagation();
                    isExpanded = !isExpanded;
                    body.textContent = isExpanded ? fullText + " " : shortText + "... ";
                    toggleBtn.textContent = isExpanded ? "收起长评" : "展开阅读全文";
                    body.appendChild(toggleBtn);
                };
                body.appendChild(toggleBtn);
            } else {
                body.textContent = rawContent;
            }

            card.appendChild(body);
            return card;
        }

        function mountReviewsSection(contextPage, reviews) {
            contextPage.querySelectorAll(".emby-reviews-section").forEach(el => el.remove());
            if (reviews === null) {
                // 未配置 TMDB Key，纯净提示
                const section = document.createElement("div");
                section.className = "verticalSection verticalSection-cards emby-reviews-section";
                section.innerHTML = `
                    <h2 class="sectionTitle sectionTitle-cards padded-left padded-left-page padded-right">精选影评</h2>
                    <div class="padded-left padded-left-page padded-right">
                        <div class="cinema-key-notice" style="margin: 10px 0;">
                            <div class="cinema-key-notice-icon">🔑</div>
                            <div class="cinema-key-notice-title">未配置 TMDB API Key</div>
                            <div class="cinema-key-notice-desc">影视详情页精选影评需要 TMDB 访问权限，请在插件配置中填写 tmdbApiKey。</div>
                        </div>
                    </div>
                `;
                const peopleSection = contextPage.querySelector(".peopleSection");
                if (peopleSection) {
                    peopleSection.before(section);
                    return;
                }
                const overview = contextPage.querySelector(".overview-container, .overview-text");
                if (overview) {
                    overview.after(section);
                    return;
                }
                contextPage.appendChild(section);
                return;
            }
            if (!reviews || !reviews.length) return;

            const section = document.createElement("div");
            section.className = "verticalSection verticalSection-cards emby-reviews-section";

            const savedExpanded = localStorage.getItem("emby-reviews-expanded");
            const isExpanded = savedExpanded === null ? true : savedExpanded === "true";
            if (!isExpanded) {
                section.classList.add("collapsed");
            }

            const count = reviews.length;

            const titleH2 = document.createElement("h2");
            titleH2.className = "sectionTitle sectionTitle-cards padded-left padded-left-page padded-right emby-reviews-title-wrap";
            titleH2.style.cssText = "cursor: pointer; user-select: none;";
            titleH2.innerHTML = `精选影评 (${count}) <i class="md-icon emby-reviews-expand-icon" style="font-size: 1.15em; vertical-align: middle; margin-left: 6px;">expand_more</i>`;
            titleH2.onclick = () => {
                const currentlyCollapsed = section.classList.toggle("collapsed");
                localStorage.setItem("emby-reviews-expanded", (!currentlyCollapsed).toString());
            };
            section.appendChild(titleH2);

            const itemsContainer = document.createElement("div");
            itemsContainer.className = "emby-reviews-items-container padded-left padded-left-page padded-right";

            const PAGE_SIZE = 5;
            let currentPage = 1;
            const totalPages = Math.ceil(reviews.length / PAGE_SIZE);

            const paginationBar = document.createElement("div");
            paginationBar.className = "emby-reviews-pagination padded-left padded-left-page padded-right";

            function updatePaginationBar() {
                paginationBar.innerHTML = "";
                if (totalPages <= 1) {
                    paginationBar.style.display = "none";
                    return;
                }
                paginationBar.style.display = "flex";

                const prevBtn = document.createElement("button");
                prevBtn.className = "emby-review-page-btn emby-review-page-prev";
                prevBtn.innerHTML = `<i class="md-icon" style="font-size: 1.2em; vertical-align: middle;">chevron_left</i> 上一页`;
                prevBtn.disabled = currentPage === 1;
                prevBtn.onclick = () => {
                    if (currentPage > 1) {
                        renderPage(currentPage - 1);
                        section.scrollIntoView({behavior: "smooth", block: "nearest"});
                    }
                };
                paginationBar.appendChild(prevBtn);

                const pageInfo = document.createElement("div");
                pageInfo.className = "emby-review-page-info";
                pageInfo.textContent = `第 ${currentPage} / ${totalPages} 页 (${reviews.length} 条影评)`;
                paginationBar.appendChild(pageInfo);

                const nextBtn = document.createElement("button");
                nextBtn.className = "emby-review-page-btn emby-review-page-next";
                nextBtn.innerHTML = `下一页 <i class="md-icon" style="font-size: 1.2em; vertical-align: middle;">chevron_right</i>`;
                nextBtn.disabled = currentPage === totalPages;
                nextBtn.onclick = () => {
                    if (currentPage < totalPages) {
                        renderPage(currentPage + 1);
                        section.scrollIntoView({behavior: "smooth", block: "nearest"});
                    }
                };
                paginationBar.appendChild(nextBtn);
            }

            function renderPage(page) {
                currentPage = page;
                itemsContainer.innerHTML = "";
                const start = (page - 1) * PAGE_SIZE;
                const end = start + PAGE_SIZE;
                const pageReviews = reviews.slice(start, end);
                pageReviews.forEach(r => {
                    itemsContainer.appendChild(createReviewCard(r));
                });
                updatePaginationBar();
            }

            renderPage(1);
            section.appendChild(itemsContainer);
            section.appendChild(paginationBar);
            const peopleSection = contextPage.querySelector(".peopleSection");
            if (peopleSection) {
                peopleSection.before(section);
                return;
            }
            const overview = contextPage.querySelector(".overview-container, .overview-text");
            if (overview) {
                overview.after(section);
                return;
            }
            contextPage.appendChild(section);
        }

        async function resolveTmdbInfo(contextPage) {
            const tmdbLink = contextPage.querySelector('a[href*="themoviedb.org/movie/"], a[href*="themoviedb.org/tv/"]');
            if (tmdbLink && tmdbLink.href) {
                const m = tmdbLink.href.match(/themoviedb\.org\/(movie|tv)\/(\d+)/);
                if (m) return {mediaType: m[1], tmdbId: m[2]};
            }

            const idMatch = location.href.match(/[?&]id=([A-Za-z0-9]+)/);
            if (idMatch) {
                try {
                    const item = await (window.ApiClient ? window.ApiClient.getItem(window.ApiClient.getCurrentUserId(), idMatch[1]) : null);
                    if (item && item.ProviderIds && item.ProviderIds.Tmdb) {
                        const type = (item.Type === "Series" || item.Type === "Season" || item.Type === "Episode") ? "tv" : "movie";
                        return {mediaType: type, tmdbId: item.ProviderIds.Tmdb};
                    }
                } catch (e) {
                }
            }
            return null;
        }

        async function processPage() {
            if (window.CINEMA_CONFIG && window.CINEMA_CONFIG.enableReviews === false) return;
            const activePage = document.querySelector(".view-item-item:not(.hide)");
            if (!activePage) return;

            const idMatch = location.href.match(/[?&]id=([A-Za-z0-9]+)/);
            const pageId = idMatch ? idMatch[1] : null;
            if (!pageId || (lastProcessedId === pageId && activePage.querySelector(".emby-reviews-section"))) {
                return;
            }

            const info = await resolveTmdbInfo(activePage);
            if (!info) return;

            lastProcessedId = pageId;
            const reviews = await fetchReviews(info.tmdbId, info.mediaType);
            mountReviewsSection(activePage, reviews);
        }

        let timer = null;
        const onNav = () => {
            clearTimeout(timer);
            timer = setTimeout(processPage, 350);
        };

        window.addEventListener("popstate", onNav);
        window.addEventListener("hashchange", onNav);
        document.addEventListener("viewshow", onNav);
        setTimeout(processPage, 800);
    }

    initTmdbReviews.call(host);

});

/* 05-剧照画廊.js · 详情页 · 剧照 / 同人图画廊 */
EmbyPlus.defineAddon("stage-photos", "详情页 · 剧照 / 同人图画廊", null, function (host) {

    /* ---------------- 宿主能力别名 ---------------- */
    var CinemaHome = host;
    var $ = host.$;
    var DomList = host.DomList;
    var CommonUtils = host.CommonUtils;

    function initStagePhotos() {
        if (!this.config || !this.config.enableStagePhotos) return;

        let lastPhotoItemId = null;

        async function renderStagePhotos(contextPage) {
            const idMatch = location.href.match(/[?&]id=([A-Za-z0-9]+)/);
            const pageId = idMatch ? idMatch[1] : null;
            if (!pageId || (lastPhotoItemId === pageId && contextPage.querySelector(".cinema-stagephotos-section"))) {
                return;
            }

            const getApi = () => (typeof ApiClient !== "undefined" && ApiClient) || window.ApiClient || null;
            const api = getApi();
            if (!api) return;
            let item = null;
            try {
                item = await CinemaHome.fetchDetailPageItem(pageId);
            } catch (e) {
                return;
            }
            if (!item || !item.BackdropImageTags || !item.BackdropImageTags.length) {
                contextPage.querySelectorAll(".cinema-stagephotos-section").forEach(el => el.remove());
                return;
            }

            lastPhotoItemId = pageId;
            contextPage.querySelectorAll(".cinema-stagephotos-section").forEach(el => el.remove());

            const count = item.BackdropImageTags.length;
            const section = document.createElement("div");
            section.className = "verticalSection verticalSection-cards cinema-stagephotos-section";

            let cardsHtml = "";
            item.BackdropImageTags.forEach((tag, idx) => {
                const imgUrl = api.getImageUrl(item.Id, {
                    type: "Backdrop",
                    index: idx,
                    tag: tag,
                    maxWidth: 1280,
                    quality: 85
                });
                cardsHtml += `
					<div class="card backdropCard card-horiz backdropCard-horiz card-hoverable focusable cinema-stagephoto-card" data-index="${idx}">
						<div class="cardBox cardBox-touchzoom cardBox-bottompadded">
							<div class="cardScalable cardPadder-backdrop">
								<div class="cardContent cardImageContainer cardContent-shadow cardContent-bg-black">
									<img draggable="false" src="${imgUrl}" alt="剧照 ${idx + 1}" loading="lazy" decoding="async" class="cardImage" />
								</div>
							</div>
						</div>
					</div>
				`;
            });

            section.innerHTML = `
				<h2 class="sectionTitle sectionTitle-cards padded-left padded-left-page padded-right">剧照 (${count})</h2>
				<div is="emby-scroller" class="emby-scroller padded-top-focusscale padded-bottom-focusscale padded-left padded-left-page padded-right cinema-stagephotos-scroller" data-mousewheel="false" data-horizontal="true">
					<div is="emby-itemscontainer" class="scrollSlider focuscontainer-x itemsContainer focusable cinema-stagephotos-items">
						${cardsHtml}
					</div>
				</div>
			`;
            section.addEventListener("click", (e) => {
                const card = e.target.closest(".cinema-stagephoto-card");
                if (card) {
                    e.preventDefault();
                    e.stopPropagation();
                    const img = card.querySelector("img");
                    if (img && img.src) {
                        // 调用原生 dialog 组件预览图片
                        const html = `
							<div class="cinema-stagephoto-preview-wrap" style="display: flex; justify-content: center; align-items: center; max-height: 85vh; overflow: hidden; padding: 4px; box-sizing: border-box;">
								<img src="${img.src}" style="max-width: 100%; max-height: 80vh; object-fit: contain; border-radius: 8px; box-shadow: 0 12px 36px rgba(0, 0, 0, 0.85);" alt="剧照预览" />
							</div>
						`;
                        try {
                            window.require(["dialog"], (d) => {
                                const dialog = (d && d.default) || (Array.isArray(d) ? d[0] : d);
                                if (dialog) {
                                    dialog({
                                        title: "剧照预览",
                                        html: html,
                                        buttons: [{name: "关闭"}]
                                    });
                                }
                            });
                        } catch (err) {
                        }
                    }
                }
            });

            const peopleSection = contextPage.querySelector(".peopleSection");
            if (peopleSection) {
                peopleSection.after(section);
            } else {
                const addContent = contextPage.querySelector(".details-additionalContent") || contextPage;
                addContent.appendChild(section);
            }
        }

        let timer = null;
        const onNav = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                const activePage = document.querySelector(".view-item-item:not(.hide)") || document.querySelector(".itemView:not(.hide)");
                if (activePage) renderStagePhotos(activePage);
            }, 350);
        };

        window.addEventListener("popstate", onNav);
        window.addEventListener("hashchange", onNav);
        document.addEventListener("viewshow", onNav);
        setTimeout(onNav, 800);
    }

    initStagePhotos.call(host);

});

/* 06-演职人员作品.js · 详情页 · 演职人员其他作品 */
EmbyPlus.defineAddon("person-works", "详情页 · 演职人员其他作品", null, function (host) {

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

});

/* 07-海报评分角标.js · 全站海报评分角标 */
EmbyPlus.defineAddon("poster-ratings", "全站海报评分角标", null, function (host) {

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

});

/* 08-播放器美化.js · 播放器美化（控制台 / 进度条 / 播放页横版卡片）：纯样式组件，样式已并入 Emby_Plus.full.css */

/* 09-追剧日历与热门榜单.js · 追剧日历与热门榜单 */
EmbyPlus.defineAddon("calendar-charts-tab", "追剧日历与热门榜单", null, function (host) {

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
                    // 检查是否缺少集数（包括历史缺集与当天更新集）
                    const missingInfo = await checkMissingEpisodesInfo(it, inLibId);
                    if (missingInfo && missingInfo.isMissing) {
                        // 缺少集数：打开弹窗展示完整缺集列表、转存与一键进入剧集
                        showDetailDialog(it, inLibId, missingInfo);
                    } else {
                        // 完整入库无缺集：直达原生详情页
                        CinemaHome.showItem(inLibId);
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
                            badge.textContent = `缺${missingInfo.totalMissingCount}集`;
                            badge.title = `已入库，但缺少 ${missingInfo.totalMissingCount} 集未更新`;
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

});

/* 10-MoviePilot联动.js · 详情页 · MoviePilot 联动（订阅 / 网盘资源） */
EmbyPlus.defineAddon("moviepilot", "详情页 · MoviePilot 联动（订阅 / 网盘资源）", null, function (host) {

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
									${inLibId ? (missingInfo && missingInfo.isMissing ? `<span class="cinema-dialog-chip cinema-dialog-chip-gold" style="color:#f59e0b!important;border-color:rgba(245,158,11,0.35)!important;background:rgba(245,158,11,0.15)!important;">已入库 (共缺 ${missingInfo.totalMissingCount} 集)</span>` : `<span class="cinema-dialog-chip" style="color:#10b981;border-color:rgba(16,185,129,0.3);background:rgba(16,185,129,0.1);">✓ 完整入库</span>`) : ""}
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

});
