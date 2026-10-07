// ==UserScript==
// @name         Emby_Plus
// @namespace    https://github.com/odomu
// @version      1.0.0
// @author       odomu
// @description  Emby 首页大图轮播与详情页增强套件（精简版宿主，需配合 addons/ 组件）
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

    let targetSeason = 1;
    let targetEpisode = 0;
    if (typeof item.season_number === "number" && item.season_number > 0) {
        targetSeason = item.season_number;
    } else if (typeof item.season === "number" && item.season > 0) {
        targetSeason = item.season;
    }

    const epCode = item.epCode || "";
    const m = epCode.match(/(?:S(\d+))?E(\d+)/i);
    if (m) {
        if (m[1]) targetSeason = parseInt(m[1], 10);
        targetEpisode = parseInt(m[2], 10);
    } else if (typeof item.episode_number === "number" && item.episode_number > 0) {
        targetEpisode = item.episode_number;
    } else if (typeof item.episode === "number" && item.episode > 0) {
        targetEpisode = item.episode;
    }

    if (isNaN(targetEpisode) || targetEpisode <= 0) return null;

    const info = await getSeriesExistingEpisodes(inLibId);
    if (!info || !info.epSet || !info.seasonEpMap) return null;

    // 检查媒体库中是否真正存在当前日历更新的这一季（避免仅入库第一季时把第二季误判为已入库）
    const targetSeasonEpisodes = info.seasonEpMap.get(targetSeason) || new Set();
    const isCurrentSeasonInLibrary = targetSeasonEpisodes.size > 0;

    const existingSeasons = Array.from(info.seasonEpMap.keys())
        .filter(s => typeof s === "number" && s > 0 && (info.seasonEpMap.get(s)?.size || 0) > 0)
        .sort((a, b) => a - b);

    const allSeasons = new Set([targetSeason, ...existingSeasons]);

    const seasonsList = [];
    let totalMissing = 0;

    Array.from(allSeasons).sort((a, b) => a - b).forEach((sNum) => {
        const existingInSeason = info.seasonEpMap.get(sNum) || new Set();
        const maxInSeason = existingInSeason.size > 0 ? Math.max(...Array.from(existingInSeason)) : 0;
        const limit = (sNum === targetSeason) ? Math.max(targetEpisode, maxInSeason) : maxInSeason;
        const missingInThisSeason = [];
        for (let ep = 1; ep <= limit; ep++) {
            // 严格按当前季核算集数：只有在仅有单季且为第1季时才允许无前缀 E${ep} 回退，防止不同季之间串集误判
            const allowFallbackNoSeason = (info.seasonEpMap.size <= 1 && sNum === 1);
            const exists = existingInSeason.has(ep) ||
                info.epSet.has(`S${sNum}E${ep}`) ||
                (allowFallbackNoSeason && info.epSet.has(`E${ep}`));
            if (!exists) {
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

    const isMissing = totalMissing > 0 || !isCurrentSeasonInLibrary;

    return {
        isMissing,
        totalMissingCount: totalMissing,
        seasons: seasonsList,
        targetEpisode,
        targetSeason,
        isCurrentSeasonInLibrary,
        existingSeasons
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
