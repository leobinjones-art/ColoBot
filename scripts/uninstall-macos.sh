#!/bin/bash
# ColoBot 自卸载脚本 (macOS)
# 由 uninstall tool 生成并执行
# 警告: 此脚本会删除所有相关文件和数据

set -e

APP_NAME="ColoBot"
APP_DIR="$HOME/Applications/$APP_NAME.app"
SUPPORT_DIR="$HOME/Library/Application Support/$APP_NAME"
CACHE_DIR="$HOME/Library/Caches/$APP_NAME"
PREFS_DIR="$HOME/Library/Preferences"
LOGS_DIR="$HOME/Library/Logs/$APP_NAME"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents/com.colobot.plist"
COLOBOT_USER="$HOME/.colobot"

echo "[ColoBot Uninstall] 开始卸载..."

# 1. 停止 launchd 服务（如果存在）
if [ -f "$LAUNCH_AGENTS" ]; then
    echo "[ColoBot Uninstall] 停止 LaunchAgent..."
    launchctl unload "$LAUNCH_AGENTS" 2>/dev/null || true
    rm -f "$LAUNCH_AGENTS"
fi

# 2. 停止运行中的进程
pkill -f "colobot-server" 2>/dev/null || true
pkill -f "ColoBot" 2>/dev/null || true

# 3. 删除应用包
if [ -d "$APP_DIR" ]; then
    echo "[ColoBot Uninstall] 删除应用..."
    rm -rf "$APP_DIR"
fi

# 4. 删除用户数据目录
if [ -d "$SUPPORT_DIR" ]; then
    echo "[ColoBot Uninstall] 删除应用数据..."
    rm -rf "$SUPPORT_DIR"
fi

# 5. 删除缓存
if [ -d "$CACHE_DIR" ]; then
    echo "[ColoBot Uninstall] 清理缓存..."
    rm -rf "$CACHE_DIR"
fi

# 6. 删除配置
if [ -d "$PREFS_DIR" ]; then
    echo "[ColoBot Uninstall] 清理配置..."
    rm -f "$PREFS_DIR/com.colobot.*" 2>/dev/null || true
fi

# 7. 删除日志
if [ -d "$LOGS_DIR" ]; then
    echo "[ColoBot Uninstall] 清理日志..."
    rm -rf "$LOGS_DIR"
fi

# 8. 删除 .colobot 目录
if [ -d "$COLOBOT_USER" ]; then
    echo "[ColoBot Uninstall] 删除配置目录..."
    rm -rf "$COLOBOT_USER"
fi

# 9. 删除本脚本自身（如果还存在）
SCRIPT_PATH="$HOME/.colobot_uninstall.sh"
if [ -f "$SCRIPT_PATH" ]; then
    rm -f "$SCRIPT_PATH"
fi

echo "[ColoBot Uninstall] 卸载完成。Goodbye!"
