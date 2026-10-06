/* ================================================================
   Emby_Plus Addon 模板
   ----------------------------------------------------------------
   1. 复制本文件并重命名为「编号-功能名.js」放入 addons/
   2. 只改 4 处：id / label / config / 工厂函数实现（style 按需填写）
   3. 组件实现全部写在工厂函数内，内部变量天然隔离，无需 IIFE
   4. 依赖：先加载宿主 Emby_Plus.js（提供 window.EmbyPlus 公共接口）
   5. 单文件版：运行 python scripts/build_full.py，脚本会把 style 并入
      Emby_Plus.full.css、config 汇总进 CINEMA_CONFIG，无需手工处理
   ================================================================ */

EmbyPlus.defineAddon("my-feature", "我的扩展功能", {
    enableMyFeature: true,
}, function (host) {

    /* ---------------- 宿主公共接口 ---------------- */
    const $ = host.$;                       // 极简 DOM 工具
    const DomList = host.DomList;
    const escapeHtml = host.escapeHtml;
    const config = host.config;             // 全局配置中心 CINEMA_CONFIG

    /* ---------------- 组件实现 ---------------- */
    function scan() {
        if (config.enableMyFeature === false) return;
        // 详情页 id：location.href.match(/[?&]id=([A-Za-z0-9]+)/)
        // 详情页条目：await host.fetchDetailPageItem(id)
        // 视图事件：document.addEventListener("viewbeforeshow" | "viewshow", scan)
        console.info("[EmbyPlus] 我的扩展功能 已加载");
    }

    scan();
}, `
/* 组件样式：由宿主在精简版下幂等注入，单文件版并入 Emby_Plus.full.css */
.my-feature-badge {
    display: inline-flex;
    align-items: center;
}
`);
