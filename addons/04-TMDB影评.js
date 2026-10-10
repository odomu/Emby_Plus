/* ================================================================
   Emby_Plus Addon · TMDB 精选影评
   契约：EmbyPlus.defineAddon(id, label, config, factory, style)
   依赖：先加载宿主 Emby_Plus.js（提供 window.EmbyPlus 公共接口）
   ================================================================ */

EmbyPlus.defineAddon("tmdb-reviews", "TMDB 精选影评", {
    enableReviews: true,
    maxReviews: 25,
    reviewPreviewLength: 500,
    showLanguageFlags: true,
}, function (host) {

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

/* ================================================================
   模块 11：TMDB 精选影评折叠板块与剧照同人图画廊
   ================================================================ */
/* TMDB 精选影评版块 */
/* TMDB 精选影评版块：遵循 Emby 原生 verticalSection 间距规范 */
.emby-reviews-section {
    margin: 0 !important;
    width: 100% !important;
    box-sizing: border-box !important;
}
.emby-reviews-title-wrap {
    cursor: pointer !important;
    user-select: none !important;
}
.emby-reviews-expand-icon {
    font-size: 1.5em !important;
    color: rgba(255, 255, 255, 0.6) !important;
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.emby-reviews-section.collapsed .emby-reviews-expand-icon {
    transform: rotate(-90deg) !important;
}
.emby-reviews-section.collapsed .emby-reviews-items-container,
.emby-reviews-section.collapsed .emby-reviews-pagination {
    display: none !important;
}
.emby-reviews-items-container {
    display: flex !important;
    flex-direction: column !important;
    gap: 12px !important;
    margin-top: 10px !important;
    box-sizing: border-box !important;
}
.emby-review-card {
    background: rgba(255, 255, 255, 0.05) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    border-radius: 10px !important;
    padding: 1.2em 1.4em !important;
    margin-inline: min(.74em, max(.38em, 1.06vw)) !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 10px !important;
    box-sizing: border-box !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    transition: background 0.25s ease, border-color 0.25s ease !important;
}
.emby-review-card:hover {
    background: rgba(255, 255, 255, 0.08) !important;
    border-color: rgba(255, 255, 255, 0.16) !important;
}
.emby-review-header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    flex-wrap: wrap !important;
    gap: 8px !important;
}
.emby-review-author-info {
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
}
.emby-review-avatar {
    width: 36px !important;
    height: 36px !important;
    border-radius: 50% !important;
    object-fit: cover !important;
    background: rgba(255, 255, 255, 0.1) !important;
    flex-shrink: 0 !important;
}
.emby-review-author-name {
    font-weight: 600 !important;
    color: #ffffff !important;
    font-size: 1.05em !important;
}
.emby-review-date {
    font-size: 0.85em !important;
    color: rgba(255, 255, 255, 0.5) !important;
    margin-left: 6px !important;
}
.emby-review-rating-badge {
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px !important;
    background: rgba(245, 197, 24, 0.18) !important;
    color: #f5c518 !important;
    border: 1px solid rgba(245, 197, 24, 0.35) !important;
    padding: 2px 8px !important;
    border-radius: 6px !important;
    font-size: 0.9em !important;
    font-weight: 700 !important;
}
.emby-review-flag {
    width: 18px !important;
    height: 13px !important;
    object-fit: cover !important;
    border-radius: 2px !important;
    vertical-align: middle !important;
}
.emby-review-content {
    line-height: 1.68 !important;
    color: #d1d5db !important;
    font-size: 0.95em !important;
    word-break: break-word !important;
}
.emby-review-toggle {
    color: #14aadf !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    margin-left: 6px !important;
    text-decoration: underline !important;
    display: inline-block !important;
}
.emby-review-toggle:hover {
    color: #48c6ef !important;
}
/* 影评分页导航栏规范：默认展示5条，支持翻页操作 */
.emby-reviews-pagination {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 16px !important;
    margin-top: 14px !important;
    margin-bottom: 8px !important;
    user-select: none !important;
}
.emby-review-page-btn {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 6px !important;
    height: 32px !important;
    padding: 0 14px !important;
    background: rgba(255, 255, 255, 0.08) !important;
    border: 1px solid rgba(255, 255, 255, 0.16) !important;
    border-radius: 9999px !important;
    color: #ffffff !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
}
.emby-review-page-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.18) !important;
    border-color: rgba(255, 255, 255, 0.35) !important;
    transform: translateY(-1px) !important;
}
.emby-review-page-btn:disabled {
    opacity: 0.35 !important;
    cursor: not-allowed !important;
    pointer-events: none !important;
}
.emby-review-page-info {
    font-size: 12px !important;
    color: rgba(255, 255, 255, 0.65) !important;
    font-weight: 600 !important;
}
`);
