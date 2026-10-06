/* ================================================================
   Emby_Plus Addon · 详情页 · 外链品牌 Logo
   契约：EmbyPlus.defineAddon(id, label, config, factory, style)
   依赖：先加载宿主 Emby_Plus.js（提供 window.EmbyPlus 公共接口）
   ================================================================ */

EmbyPlus.defineAddon("link-logos", "详情页 · 外链品牌 Logo", {
    enableLinkLogos: true,
}, function (host) {

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

}, `
/* 详情页外链与分级徽章 */
.itemLinks, .itemExternalLinks {
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    flex-wrap: wrap !important;
    margin-top: 6px !important;
}
.itemLinks a[is="emby-linkbutton"],
.itemExternalLinks a {
    display: inline-flex !important;
    align-items: center !important;
    padding: 2px 4px !important;
}
`);
