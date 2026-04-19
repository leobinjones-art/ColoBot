#!/bin/bash
# ColoBot 自卸载脚本 (Linux)
set -e

SERVICE_NAME="colobot"
USER=$(whoami)
COLOBOT_USER="$HOME/.colobot"

echo "[ColoBot Uninstall] 开始卸载..."

# 1. 停止并禁用 systemd 服务
if systemctl is-active --user "$SERVICE_NAME" 2>/dev/null; then
    echo "[ColoBot Uninstall] 停止服务..."
    systemctl --user stop "$SERVICE_NAME" 2>/dev/null || true
fi
if systemctl is-enabled --user "$SERVICE_NAME" 2>/dev/null; then
    systemctl --user disable "$SERVICE_NAME" 2>/dev/null || true
fi

# 2. 停止运行中的进程
pkill -f "colobot-server" 2>/dev/null || true

# 3. 删除 systemd user service
rm -f "$HOME/.config/systemd/user/$SERVICE_NAME.service" 2>/dev/null || true
systemctl --user daemon-reload 2>/dev/null || true

# 4. 删除用户数据目录
if [ -d "$COLOBOT_USER" ]; then
    echo "[ColoBot Uninstall] 删除应用数据..."
    rm -rf "$COLOBOT_USER"
fi

# 5. 删除配置
rm -f "$HOME/.config/colobot/"* 2>/dev/null || true
rmdir "$HOME/.config/colobot" 2>/dev/null || true

# 6. 删除本脚本自身
SCRIPT_PATH="$HOME/.colobot_uninstall.sh"
if [ -f "$SCRIPT_PATH" ]; then
    rm -f "$SCRIPT_PATH"
fi

echo "[ColoBot Uninstall] 卸载完成。Goodbye!"
