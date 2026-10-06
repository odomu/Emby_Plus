#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""把 Emby_Plus.js 精简版宿主与 addons/*.js 合并为 Full 一体化双文件：

    scripts/build_full.py  ->  Emby_Plus.full.js  (宿主 + 全部 Addon 定义)
                               Emby_Plus.full.css (精简版 CSS + 全部 Addon 样式)

Addon 契约（唯一入口）：
    EmbyPlus.defineAddon(id, label, config, function (host) { ... }, style)

合并规则：
- addons 目录自动扫描，按文件名数字前缀排序，无需清单；
- `_` 前缀文件与 template_addon.js 视为模板，跳过；
- 剥离 UserScript 声明块与文件头说明注释；
- style 参数抽出并入 Emby_Plus.full.css，JS 侧不再重复注入；
- config 参数汇总注入 CINEMA_CONFIG（Full 侧唯一配置中心），JS 侧改传 null 避免重复声明；
- 纯样式组件（factory 为 null）不产生 JS 调用，仅保留样式。

用法：python scripts/build_full.py
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST_JS = os.path.join(ROOT, "Emby_Plus.js")
HOST_CSS = os.path.join(ROOT, "Emby_Plus.css")
ADDONS_DIR = os.path.join(ROOT, "addons")
OUT_JS = os.path.join(ROOT, "Emby_Plus.full.js")
OUT_CSS = os.path.join(ROOT, "Emby_Plus.full.css")

SKIP_FILES = {"template_addon.js"}
USERSCRIPT_BLOCK = re.compile(r"\A\s*//\s*==UserScript==.*?//\s*==/UserScript==\s*", re.S)
LEADING_DOC_BLOCK = re.compile(r"\A\s*/\*.*?\*/\s*", re.S)
DEFINE_CALL = re.compile(r"\bEmbyPlus\.defineAddon\s*\(")
HOST_CONFIG_ANCHOR = "const CINEMA_CONFIG = window.CINEMA_CONFIG = {"

FULL_BANNER = """// ==UserScript==
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
"""

CSS_BANNER = """/* ==============================================================================
 * Emby_Plus.full.css · 一体化全量样式（由 scripts/build_full.py 生成，请勿手改）
 * 基底：Emby_Plus.css（精简版宿主样式）
 * 追加：addons/*.js 中各组件的 style 声明
 * ============================================================================== */
"""


# ---------------------------------------------------------------- 通用工具
def discover_addons():
    """扫描 addons 目录，按文件名数字前缀排序返回文件名。"""
    names = [
        name for name in os.listdir(ADDONS_DIR)
        if name.endswith(".js") and not name.startswith("_") and name not in SKIP_FILES
    ]

    def sort_key(name):
        match = re.match(r"(\d+)", name)
        return (int(match.group(1)) if match else 10 ** 6, name)

    return sorted(names, key=sort_key)


def read_source(name):
    """读取 Addon 源码并剥离 UserScript 声明块与文件头说明注释。"""
    source = open(os.path.join(ADDONS_DIR, name), encoding="utf-8").read()
    source = USERSCRIPT_BLOCK.sub("", source).strip()
    return LEADING_DOC_BLOCK.sub("", source, count=1).strip()


def split_arguments(text, start):
    """从 start（defineAddon 的左括号之后）按顶层逗号切分参数。"""
    args, depth, buf, i = [], 0, "", start
    while i < len(text):
        ch = text[i]
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            if ch == ")" and depth == 0:
                args.append(buf.strip())
                return args, i
            depth -= 1
        elif ch in "\"'`":
            quote = ch
            buf += ch
            i += 1
            while i < len(text):
                buf += text[i]
                if text[i] == "\\":
                    i += 1
                    if i < len(text):
                        buf += text[i]
                    i += 1
                    continue
                if text[i] == quote:
                    i += 1
                    break
                i += 1
            continue
        elif ch == "," and depth == 0:
            args.append(buf.strip())
            buf = ""
            i += 1
            continue
        buf += ch
        i += 1
    raise ValueError("defineAddon 参数未闭合")


def unquote(text):
    return text.strip().strip("`").strip("'\"").strip()


def parse_entries(body):
    """解析 `key: value, // 注释` 片段为 [(key, value, comment)]。"""
    entries = []
    for raw in body.split("\n"):
        line = raw.strip()
        if not line:
            continue
        comment, code = "", line
        if "//" in line and "://" not in line:
            code, comment = line.split("//", 1)
            comment = comment.strip()
        for piece in code.split(","):
            piece = piece.strip()
            if ":" not in piece:
                continue
            key, value = piece.split(":", 1)
            key, value = key.strip(), value.strip()
            if re.fullmatch(r"[A-Za-z_$][\w$]*", key) and value:
                entries.append((key, value, comment))
    return entries


def parse_addon(name):
    """解析单个 Addon 的 defineAddon 声明。"""
    source = read_source(name)
    call = DEFINE_CALL.search(source)
    if not call:
        raise SystemExit("[FAIL] %s 未找到 EmbyPlus.defineAddon 声明" % name)
    args, _ = split_arguments(source, call.end())
    if len(args) < 4:
        raise SystemExit("[FAIL] %s defineAddon 参数不足（应为 id, label, config, factory, style）" % name)

    addon = {
        "name": name,
        "id": unquote(args[0]),
        "label": unquote(args[1]),
        "config": args[2].strip(),
        "factory": args[3].strip(),
        "style": unquote(args[4]) if len(args) > 4 else "",
        "prefix": source[:call.start()].strip(),
    }
    addon["entries"] = [] if addon["config"] in ("", "{}", "null") else parse_entries(addon["config"].strip("{}"))
    addon["style_only"] = addon["factory"] in ("", "null")
    return addon


# ---------------------------------------------------------------- 输出拼装
def render_config_section(per_addon, claimed):
    lines = ["", "    /* ================= Addon 配置（由 build_full.py 从各组件的 config 声明融合） ================= */"]
    for addon in per_addon:
        own = [e for e in addon["entries"] if e[0] not in claimed]
        if not own:
            continue
        lines.append("    /* ---- %s ---- */" % addon["label"])
        for key, value, comment in own:
            claimed.add(key)
            lines.append("    %s: %s,%s" % (key, value, ("  // " + comment) if comment else ""))
    return "\n".join(lines) + "\n"


def inject_config(bundle_js, section):
    """把 Addon 配置段落注入 full.js 的 CINEMA_CONFIG 字面量。"""
    anchor = bundle_js.index(HOST_CONFIG_ANCHOR)
    close = bundle_js.index("\n};", anchor)
    return bundle_js[:close] + section.rstrip("\n") + bundle_js[close:]


def render_addon_js(addon):
    """生成 Full 侧组件声明：config 收敛到 CINEMA_CONFIG，因此改传 null。"""
    if addon["style_only"]:
        return ""
    factory = re.sub(r"\n(?:[ \t]*\n)+", "\n\n", addon["factory"])
    return 'EmbyPlus.defineAddon("%s", "%s", null, %s);' % (addon["id"], addon["label"], factory)


def check_braces(css, label):
    delta = css.count("{") - css.count("}")
    if delta != 0:
        raise SystemExit("[FAIL] %s 花括号不平衡：%+d" % (label, delta))


def main():
    host_js = open(HOST_JS, encoding="utf-8").read()
    host_body = host_js[host_js.index("/**\n * Emby_Plus"):].rstrip()
    base_css = open(HOST_CSS, encoding="utf-8").read().rstrip()
    check_braces(base_css, "Emby_Plus.css")

    addons = [parse_addon(name) for name in discover_addons()]

    ids = [addon["id"] for addon in addons]
    if len(set(ids)) != len(ids):
        raise SystemExit("[FAIL] Addon id 重复：%s" % "、".join(sorted(ids)))

    claimed = set()
    config_section = render_config_section(addons, claimed)

    js_chunks = [FULL_BANNER.rstrip(), inject_config(host_body, config_section)]
    css_chunks = [CSS_BANNER.rstrip(), base_css]
    addon_chunks = []

    for addon in addons:
        body = render_addon_js(addon)
        if body:
            addon_chunks.append("/* %s · %s */\n%s" % (addon["name"], addon["label"], body))
        else:
            addon_chunks.append("/* %s · %s：纯样式组件，样式已并入 Emby_Plus.full.css */" % (addon["name"], addon["label"]))
        if not addon["style"]:
            print("[WARN] %s 未提供 style 参数" % addon["name"])
            continue
        check_braces(addon["style"], addon["name"])
        css_chunks.append("%s\n   Addon: %s\n%s */\n%s" % ("/* " + "=" * 74, addon["name"], "=" * 74, addon["style"]))

    js_chunks.append("\n\n".join(addon_chunks))
    full_js = "\n\n".join(js_chunks) + "\n"
    full_css = "\n\n".join(css_chunks) + "\n"

    declared = len(re.findall(r"^EmbyPlus\.defineAddon\(", full_js, re.M))
    expected = len([a for a in addons if not a["style_only"]])
    if declared != expected:
        raise SystemExit("[FAIL] Full JS 组件声明数量异常：%d ≠ %d" % (declared, expected))
    addon_js = "\n\n".join(addon_chunks)
    if "(function () {" in addon_js:
        raise SystemExit("[FAIL] 组件区不应出现 IIFE 包裹")
    if "createElement('style')" in addon_js or 'createElement("style")' in addon_js:
        raise SystemExit("[FAIL] 组件区不应残留样式注入代码")

    check_braces(full_css, "Emby_Plus.full.css")
    open(OUT_JS, "w", encoding="utf-8", newline="\n").write(full_js)
    open(OUT_CSS, "w", encoding="utf-8", newline="\n").write(full_css)

    print("已合并 %d 个 Addon：%s" % (len(addons), "、".join(a["id"] for a in addons)))
    print("融合配置项 %d 个：%s" % (len(claimed), "、".join(sorted(claimed))))
    print("Emby_Plus.full.js  -> %d 字符，%d 行" % (len(full_js), full_js.count("\n") + 1))
    print("Emby_Plus.full.css -> %d 字符，%d 行" % (len(full_css), full_css.count("\n") + 1))


if __name__ == "__main__":
    main()
