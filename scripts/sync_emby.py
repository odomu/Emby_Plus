#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Emby CustomCssJS 一键同步脚本
功能：
  1. 默认行为（安全更新）：仅更新远程服务端【已有模块】的对应内容。
     如果本地存在远程没有的单体文件（例如实验性文件、备份文件），默认跳过并提示，
     杜绝因本地误放文件导致远程配置被意外污染。
  2. 显式新建模式（--allow-new）：当确实需要在远程新增插件模块时，
     传入此参数，本地多出的 .js/.css 会被作为新条目追加推送到服务器。
  3. 调用 Emby 官方 Plugin Configuration API 实时热更新推送（204 成功），无需重启 Docker。
  4. 支持反向拉取（--pull）与空跑预检（--dry-run）。

用法：
  python sync_emby.py                   # 仅更新远程已存在的模块（默认安全模式）
  python sync_emby.py --allow-new       # 允许推送本地新增的模块到服务器
  python sync_emby.py --dry-run         # 仅检查差异，不发送写请求
  python sync_emby.py --pull            # 从服务器反向拉取最新配置到本地
"""

import os
import sys
import json
import argparse
import datetime
import urllib.request
import urllib.error

# ==================== 默认配置 ====================
# 全部来自环境变量，脚本内不保存任何服务器地址 / Token 等隐私信息
DEFAULT_SERVER_URL = os.environ.get("EMBY_URL", "")
DEFAULT_TOKEN = os.environ.get("EMBY_TOKEN", "")
DEFAULT_PLUGIN_ID = os.environ.get("EMBY_CUSTOMCSSJS_PLUGIN_ID", "")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
JSON_SNAPSHOT = os.path.join(SCRIPT_DIR, "plugin-config.snapshot.json")
# Emby_Plus 布局：精简版 JS/CSS 在根目录，功能组件在 addons/
LITE_JS = os.path.join(ROOT_DIR, "Emby_Plus.js")
LITE_CSS = os.path.join(ROOT_DIR, "Emby_Plus.css")
ADDONS_DIR = os.path.join(ROOT_DIR, "addons")
EXTRA_DIR = os.path.join(ROOT_DIR, "extra")


def get_headers(token: str) -> dict:
    return {
        "X-Emby-Token": token,
        "Content-Type": "application/json; charset=utf-8",
        "Accept": "application/json"
    }


def fetch_remote_config(server_url: str, token: str, plugin_id: str) -> dict:
    """从服务端 API 读取当前的完整插件配置对象"""
    url = f"{server_url.rstrip('/')}/Plugins/{plugin_id}/Configuration"
    req = urllib.request.Request(url, headers=get_headers(token), method="GET")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                data = resp.read().decode("utf-8")
                return json.loads(data)
            raise RuntimeError(f"获取配置失败，HTTP 状态码: {resp.status}")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP 错误 ({e.code}): {e.read().decode('utf-8', errors='ignore')[:200]}")
    except Exception as e:
        raise RuntimeError(f"网络或请求异常: {e}")


def push_remote_config(server_url: str, token: str, plugin_id: str, cfg: dict) -> bool:
    """向服务端 API 推送配置对象，热生效（无需重启容器）"""
    url = f"{server_url.rstrip('/')}/Plugins/{plugin_id}/Configuration"
    payload = json.dumps(cfg, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers=get_headers(token), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status in (200, 204):
                return True
            print(f"⚠️ 推送返回非预期状态码: {resp.status}")
            return False
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"推送配置失败 HTTP ({e.code}): {e.read().decode('utf-8', errors='ignore')[:300]}")
    except Exception as e:
        raise RuntimeError(f"推送配置异常: {e}")


def pull_and_export(server_url: str, token: str, plugin_id: str):
    """反向拉取服务器配置并拆分写回本地"""
    print(f"[*] 正在从服务器 {server_url} 拉取最新配置...")
    cfg = fetch_remote_config(server_url, token, plugin_id)

    os.makedirs(ADDONS_DIR, exist_ok=True)

    with open(JSON_SNAPSHOT, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    print(f"[+] 写入完整快照: {JSON_SNAPSHOT}")

    for item in cfg.get("customjs", []):
        name = item.get("name", "").strip()
        if not name:
            continue
        path = LITE_JS if name == "Emby_Plus" else os.path.join(ADDONS_DIR, f"{name}.js")
        with open(path, "w", encoding="utf-8") as f:
            f.write(item.get("content", ""))
        print(f"  - 导出 JS: {name}.js")

    for item in cfg.get("customcss", []):
        name = item.get("name", "").strip()
        if not name:
            continue
        path = LITE_CSS if name == "Emby_Plus" else os.path.join(ADDONS_DIR, f"{name}.css")
        with open(path, "w", encoding="utf-8") as f:
            f.write(item.get("content", ""))
        print(f"  - 导出 CSS: {name}.css")

    print("[✔] 服务端配置已成功全量反向同步至本地！")


def is_auto_updated(item: dict) -> bool:
    """判断模块是否自带更新源：带 updateUrl 或 autoUpdate=true 的条目由 Emby 插件自身维护，本地不覆盖。"""
    if str(item.get("updateUrl", "")).strip():
        return True
    return str(item.get("autoUpdate", "")).strip().lower() in ("true", "1", "yes", "on")


def push_local_changes(server_url: str, token: str, plugin_id: str, allow_new: bool = False, dry_run: bool = False):
    """
    读取本地拆分的文件，合并到配置中并推送服务端。
    默认规则：
      - 仅更新远程服务端已存在的模块条目。
      - 远程不存在的文件默认跳过，提示需要传入 --allow-new 才能新增。
    """
    print(f"[*] 正在从服务器 {server_url} 读取当前基础配置...")
    cfg = fetch_remote_config(server_url, token, plugin_id)

    changed_items = []
    skipped_new_items = []
    skipped_auto_items = []
    added_new_items = []

    # 1. 扫描 JS 模块
    remote_js_map = {item.get("name", "").strip(): item for item in cfg.get("customjs", []) if item.get("name")}
    local_js_files = {}
    if os.path.isfile(LITE_JS):
        local_js_files["Emby_Plus"] = LITE_JS
    if os.path.isdir(ADDONS_DIR):
        for f in sorted(os.listdir(ADDONS_DIR)):
            if f.endswith(".js") and not f.startswith("_"):
                local_js_files[os.path.splitext(f)[0].strip()] = os.path.join(ADDONS_DIR, f)
    if os.path.isdir(EXTRA_DIR):
        for f in sorted(os.listdir(EXTRA_DIR)):
            if f.endswith(".js") and not f.startswith("_"):
                local_js_files[os.path.splitext(f)[0].strip()] = os.path.join(EXTRA_DIR, f)
    # 1.1 更新已有 JS
    for name, item in remote_js_map.items():
        if name in local_js_files:
            if is_auto_updated(item):
                skipped_auto_items.append(f"自动更新模块 JS: {name}")
                continue
            with open(local_js_files[name], "r", encoding="utf-8") as f:
                local_content = f.read()
            if local_content != item.get("content", ""):
                old_len = len(item.get("content", ""))
                new_len = len(local_content)
                item["content"] = local_content
                changed_items.append((f"更新 JS: {name}", old_len, new_len))

    # 1.2 检查远程未收录的本地 JS 文件
    for name, file_path in local_js_files.items():
        if name not in remote_js_map:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            if allow_new:
                now_str = datetime.datetime.now().strftime("%Y/%m/%d %H:%M:%S")
                new_item = {
                    "name": name,
                    "description": "",
                    "content": content,
                    "date": now_str,
                    "state": "off",          # 默认新建后置为 off，安全由用户在后台或显式开启
                    "autoUpdate": "false"
                }
                cfg.setdefault("customjs", []).append(new_item)
                added_new_items.append((f"新建 JS: {name}", len(content)))
            else:
                skipped_new_items.append((f"本地多出 JS: {name}.js", len(content)))

    # 2. 扫描 CSS 模块
    remote_css_map = {item.get("name", "").strip(): item for item in cfg.get("customcss", []) if item.get("name")}
    local_css_files = {}
    if os.path.isfile(LITE_CSS):
        local_css_files["Emby_Plus"] = LITE_CSS

    # 2.1 更新已有 CSS
    for name, item in remote_css_map.items():
        if name in local_css_files:
            if is_auto_updated(item):
                skipped_auto_items.append(f"自动更新模块 CSS: {name}")
                continue
            with open(local_css_files[name], "r", encoding="utf-8") as f:
                local_content = f.read()
            if local_content != item.get("content", ""):
                old_len = len(item.get("content", ""))
                new_len = len(local_content)
                item["content"] = local_content
                changed_items.append((f"更新 CSS: {name}", old_len, new_len))

    # 2.2 检查远程未收录的本地 CSS 文件
    for name, file_path in local_css_files.items():
        if name not in remote_css_map:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            if allow_new:
                now_str = datetime.datetime.now().strftime("%Y/%m/%d %H:%M:%S")
                new_item = {
                    "name": name,
                    "description": "",
                    "content": content,
                    "date": now_str,
                    "state": "off",
                    "autoUpdate": "false"
                }
                cfg.setdefault("customcss", []).append(new_item)
                added_new_items.append((f"新建 CSS: {name}", len(content)))
            else:
                skipped_new_items.append((f"本地多出 CSS: {name}.css", len(content)))

    # 提示被安全跳过的本地新增文件
    if skipped_auto_items:
        print("\n[ℹ] 以下模块自带更新源（updateUrl / autoUpdate），已跳过本地覆盖：")
        for tag in skipped_auto_items:
            print(f"  - {tag}")

    if skipped_new_items:
        print("\n[ℹ] 远程暂无以下模块，已安全跳过（默认不推送未收录的新增文件）：")
        for tag, length in skipped_new_items:
            print(f"  - {tag} ({length} 字符)")
        print("  💡 提示: 如果确实需要在远程新建这些条目，请附加 `--allow-new` 参数运行。\n")

    if not changed_items and not added_new_items:
        print("[ℹ] 远程已收录的文件与本地完全一致，没有需要推送的更新。")
        return

    if changed_items:
        print(f"[*] 检测到 {len(changed_items)} 处已有模块更新:")
        for tag, old_len, new_len in changed_items:
            print(f"  - {tag} (字符数: {old_len} -> {new_len})")

    if added_new_items:
        print(f"[+] 检测到 {len(added_new_items)} 处新模块将被追加到远程配置中 (--allow-new 生效):")
        for tag, length in added_new_items:
            print(f"  + {tag} (字符数: {length})")

    if dry_run:
        print("\n[!] 当前处于 --dry-run 模式，跳过实际网络写操作。")
        return

    print("\n[*] 正在通过 Emby Plugin Configuration API 推送更新...")
    success = push_remote_config(server_url, token, plugin_id, cfg)
    if success:
        print("[✔] 热更新推送成功！HTTP 状态 204，服务端内存已实时生效（无需重启 Docker）。")
        # 更新本地快照
        with open(JSON_SNAPSHOT, "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
        print(f"[+] 已同步刷新本地快照: {JSON_SNAPSHOT}")
    else:
        print("[✖] 推送失败，请检查上方日志。")


def main():
    parser = argparse.ArgumentParser(description="Emby CustomCssJS 配置热更新一键同步工具")
    parser.add_argument("--server", default=DEFAULT_SERVER_URL, help="Emby 服务器地址（默认取环境变量 EMBY_URL）")
    parser.add_argument("--token", default=DEFAULT_TOKEN, help="管理员 API Token（默认取环境变量 EMBY_TOKEN）")
    parser.add_argument("--plugin-id", default=DEFAULT_PLUGIN_ID, help="CustomCssJS 插件 ID（默认取环境变量 EMBY_CUSTOMCSSJS_PLUGIN_ID）")
    parser.add_argument("--allow-new", action="store_true", help="允许向远程新增本地多出的模块条目（默认只更新远程已有项）")
    parser.add_argument("--pull", action="store_true", help="反向拉取：从服务端下载最新配置覆盖本地")
    parser.add_argument("--dry-run", action="store_true", help="空跑检查差异，不向服务器发送写操作")

    args = parser.parse_args()

    try:
        if args.pull:
            pull_and_export(args.server, args.token, args.plugin_id)
        else:
            push_local_changes(args.server, args.token, args.plugin_id, allow_new=args.allow_new, dry_run=args.dry_run)
    except Exception as e:
        print(f"\n[ERROR] 运行出错: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
