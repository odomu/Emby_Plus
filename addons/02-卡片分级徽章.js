/* ================================================================
   Emby_Plus Addon · 媒体库卡片彩色分级徽章
   契约：EmbyPlus.defineAddon(id, label, config, factory, style)
   依赖：先加载宿主 Emby_Plus.js（提供 window.EmbyPlus 公共接口）
   ================================================================ */

EmbyPlus.defineAddon("media-ratings", "媒体库卡片彩色分级徽章", {
    enableMediaRatings: true,
}, function (host) {

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

}, `
.mediaInfoItem[data-rating-group] {
    color: #ffffff !important;
    text-align: center !important;
    text-transform: uppercase !important;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8) !important;
    border-radius: 4px !important;
    border: 1px solid rgba(255, 255, 255, 0.25) !important;
    padding: 1px 6px !important;
    min-width: 20px !important;
    line-height: 1.25 !important;
    font-size: 0.86em !important;
    font-weight: 700 !important;
    display: inline-block !important;
    vertical-align: middle !important;
    transition: transform 0.2s ease, box-shadow 0.2s ease !important;
}
.mediaInfoItem[data-rating-group]:hover {
    transform: scale(1.06) !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35) !important;
}
.mediaInfoItem[data-rating-group="green"]     { background-color: #2E7D32 !important; border-color: rgba(76, 175, 80, 0.4) !important; }
.mediaInfoItem[data-rating-group="yellow"]    { background-color: #C69214 !important; border-color: rgba(255, 193, 7, 0.4) !important; }
.mediaInfoItem[data-rating-group="orange"]    { background-color: #E65100 !important; border-color: rgba(255, 152, 0, 0.4) !important; }
.mediaInfoItem[data-rating-group="redOrange"] { background-color: #D32F2F !important; border-color: rgba(244, 67, 54, 0.4) !important; }
.mediaInfoItem[data-rating-group="red"]       { background-color: #8B0000 !important; border-color: rgba(204, 34, 34, 0.4) !important; }
.mediaInfoItem[data-rating-group="pink"]      { background-color: #880E4F !important; border-color: rgba(194, 24, 91, 0.4) !important; }
.mediaInfoItem[data-rating-group="purple"]    { background-color: #6A1B9A !important; border-color: rgba(137, 83, 170, 0.4) !important; }
.mediaInfoItem[data-rating-group="blue"]      { background-color: #1565C0 !important; border-color: rgba(33, 150, 243, 0.4) !important; }
.mediaInfoItem[data-rating-group="grey"]      { background-color: #546E7A !important; border-color: rgba(158, 158, 158, 0.4) !important; }
`);
