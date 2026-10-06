#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Emby OpenAPI / Swagger 接口规范文档导出工具
根据远程运行的 Emby 服务器版本，自动拉取官方 OpenAPI 3.0 / Swagger 2.0 规范，
并保存至本地项目目录供离线参考与代码生成。

用法：
  python fetch_openapi.py
  python fetch_openapi.py --server http://host:8096
"""

import os
import sys
import json
import argparse
import urllib.request
import urllib.error

DEFAULT_SERVER_URL = os.environ.get("EMBY_URL", "")
DEFAULT_TOKEN = os.environ.get("EMBY_TOKEN", "")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "docs", "api")


def get_headers(token: str) -> dict:
    headers = {
        "Accept": "application/json",
        "User-Agent": "Emby-OpenAPI-Fetcher/1.0"
    }
    if token:
        headers["X-Emby-Token"] = token
    return headers


def fetch_url(url: str, token: str) -> bytes:
    req = urllib.request.Request(url, headers=get_headers(token), method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status == 200:
                return resp.read()
            raise RuntimeError(f"请求失败，HTTP 状态码: {resp.status}")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP 错误 ({e.code}): {e.read().decode('utf-8', errors='ignore')[:200]}")
    except Exception as e:
        raise RuntimeError(f"网络或连接异常: {e}")


def main():
    parser = argparse.ArgumentParser(description="Emby OpenAPI 规范自动下载工具")
    parser.add_argument("--server", default=DEFAULT_SERVER_URL, help="Emby 服务器地址（默认取环境变量 EMBY_URL）")
    parser.add_argument("--token", default=DEFAULT_TOKEN, help="API Token（默认取环境变量 EMBY_TOKEN）")
    parser.add_argument("--output-dir", default=OUTPUT_DIR, help=f"保存目录 (默认: {OUTPUT_DIR})")
    args = parser.parse_args()

    server = args.server.rstrip("/")
    os.makedirs(args.output_dir, exist_ok=True)

    print(f"[*] 正在连接 Emby 服务器: {server}")

    # 1. 获取服务器系统版本信息
    sys_info = {}
    try:
        sys_bytes = fetch_url(f"{server}/System/Info", args.token)
        sys_info = json.loads(sys_bytes.decode("utf-8"))
        version = sys_info.get("Version", "unknown")
        server_name = sys_info.get("ServerName", "Emby")
        print(f"[✔] 成功连接服务器:「{server_name}」，版本: {version}")
    except Exception as e:
        print(f"[!] 获取系统版本信息失败: {e}，将以通用版本导出")
        version = "unknown"

    # 2. 拉取 OpenAPI 3.0 规范
    print("[*] 正在拉取 OpenAPI 3.0 规范文档 (/openapi.json)...")
    try:
        openapi_bytes = fetch_url(f"{server}/openapi.json", args.token)
        openapi_obj = json.loads(openapi_bytes.decode("utf-8"))
        paths_count = len(openapi_obj.get("paths", {}))
        
        # 写入带版本号的文件和通用文件
        ver_fn = f"emby-openapi-{version}.json" if version != "unknown" else "emby-openapi.json"
        ver_path = os.path.join(args.output_dir, ver_fn)
        latest_path = os.path.join(args.output_dir, "emby-openapi-latest.json")
        
        with open(ver_path, "w", encoding="utf-8") as f:
            json.dump(openapi_obj, f, ensure_ascii=False, indent=2)
        with open(latest_path, "w", encoding="utf-8") as f:
            json.dump(openapi_obj, f, ensure_ascii=False, indent=2)
            
        print(f"[✔] OpenAPI 3.0 规范保存成功！")
        print(f"    - 端点数: {paths_count} 个")
        print(f"    - 文件 1: {ver_path}")
        print(f"    - 文件 2: {latest_path}")
    except Exception as e:
        print(f"[✖] 拉取 OpenAPI 3.0 失败: {e}")

    # 3. 拉取 Swagger 2.0 规范
    print("[*] 正在拉取 Swagger 2.0 规范文档 (/swagger.json)...")
    try:
        swagger_bytes = fetch_url(f"{server}/swagger.json", args.token)
        swagger_obj = json.loads(swagger_bytes.decode("utf-8"))
        
        swag_ver_fn = f"emby-swagger-{version}.json" if version != "unknown" else "emby-swagger.json"
        swag_ver_path = os.path.join(args.output_dir, swag_ver_fn)
        swag_latest_path = os.path.join(args.output_dir, "emby-swagger-latest.json")
        
        with open(swag_ver_path, "w", encoding="utf-8") as f:
            json.dump(swagger_obj, f, ensure_ascii=False, indent=2)
        with open(swag_latest_path, "w", encoding="utf-8") as f:
            json.dump(swagger_obj, f, ensure_ascii=False, indent=2)
            
        print(f"[✔] Swagger 2.0 规范保存成功！")
        print(f"    - 文件 1: {swag_ver_path}")
        print(f"    - 文件 2: {swag_latest_path}")
    except Exception as e:
        print(f"[✖] 拉取 Swagger 2.0 失败: {e}")

    print("\n[✔] 全部接口文档获取完成！目录: " + os.path.abspath(args.output_dir))


if __name__ == "__main__":
    main()
