/* ================================================================
   Emby_Plus Addon · 详情页 · 剧照 / 同人图画廊
   契约：EmbyPlus.defineAddon(id, label, config, factory, style)
   依赖：先加载宿主 Emby_Plus.js（提供 window.EmbyPlus 公共接口）
   ================================================================ */

EmbyPlus.defineAddon("stage-photos", "详情页 · 剧照 / 同人图画廊", {
    enableStagePhotos: true,
}, function (host) {

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

}, `
/* 剧照与同人图画廊排版：遵循 Emby 原生间距 */
.cinema-stagephotos-section {
    margin: 0 !important;
}
.cinema-stagephotos-scroller {
    overflow-x: auto !important;
    overflow-y: hidden !important;
    -webkit-overflow-scrolling: touch !important;
}
.cinema-stagephotos-items {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
}
.cinema-stagephoto-card {
    flex: 0 0 auto !important;
    width: clamp(220px, 28vw, 360px) !important;
    cursor: pointer !important;
}
.cinema-stagephoto-card .cardScalable {
    border-radius: 8px !important;
    overflow: hidden !important;
}
.cinema-stagephoto-card .cardImage {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    display: block !important;
}
`);
