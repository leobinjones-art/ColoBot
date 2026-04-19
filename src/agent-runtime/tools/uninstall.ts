/**
 * 危险工具：uninstall - 自卸载 ColoBot
 */

import { registerTool } from './executor.js';
import fs from 'fs';
import { exec } from 'child_process';
import path from 'path';
import os from 'os';

const CONFIRM_TOKEN = 'CONFIRM-UNINSTALL';
const SCRIPT_PATH_MACOS = 'uninstall-macos.sh';
const SCRIPT_PATH_LINUX = 'uninstall-linux.sh';

function isConfirmed(message: string): boolean {
  return message.includes(CONFIRM_TOKEN);
}

function getUninstallScriptName(): string {
  const platform = os.platform();
  if (platform === 'darwin') return SCRIPT_PATH_MACOS;
  if (platform === 'linux') return SCRIPT_PATH_LINUX;
  throw new Error(`Unsupported platform: ${platform}`);
}

function getUninstallScriptPath(): string {
  const scriptDir = path.join(os.homedir(), '.colobot');
  const scriptName = getUninstallScriptName();
  return path.join(scriptDir, scriptName);
}

function writeScript(): string {
  const scriptDir = path.join(os.homedir(), '.colobot');
  const scriptName = getUninstallScriptName();
  const destPath = path.join(scriptDir, scriptName);

  // 确保目录存在
  fs.mkdirSync(scriptDir, { recursive: true });

  // 读取 embedded 脚本（通过 import.meta.url）
  // 实际脚本内容直接写入文件
  const platform = os.platform();
  const scriptContent = platform === 'darwin' ? MACOS_SCRIPT : LINUX_SCRIPT;

  fs.writeFileSync(destPath, scriptContent, 'utf-8');
  fs.chmodSync(destPath, 0o755);
  return destPath;
}

function triggerUninstall(): void {
  const scriptPath = writeScript();

  // nohup 执行，保证服务端退出后脚本继续运行
  const cmd = `nohup "${scriptPath}" > /dev/null 2>&1 &`;
  exec(cmd, { cwd: os.homedir() });
}

function register() {
  registerTool('uninstall', async (args) => {
    const { message } = args as { message: string };

    if (!isConfirmed(message)) {
      return {
        ok: false,
        triggered: false,
        message: 'Uninstall not confirmed.',
      };
    }

    triggerUninstall();

    return {
      ok: true,
      triggered: true,
      message: 'ColoBot uninstallation started. Goodbye!',
    };
  });
}

export function registerTools(): void {
  register();
}

const MACOS_SCRIPT = `#!/bin/bash
set -e
APP_NAME="ColoBot"
APP_DIR="$HOME/Applications/$APP_NAME.app"
SUPPORT_DIR="$HOME/Library/Application Support/$APP_NAME"
CACHE_DIR="$HOME/Library/Caches/$APP_NAME"
PREFS_DIR="$HOME/Library/Preferences"
LOGS_DIR="$HOME/Library/Logs/$APP_NAME"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents/com.colobot.plist"
COLOBOT_USER="$HOME/.colobot"
SCRIPT_PATH="$HOME/.colobot/uninstall-macos.sh"

echo "[ColoBot Uninstall] 开始卸载..."

# 停止 launchd 服务
if [ -f "$LAUNCH_AGENTS" ]; then
    launchctl unload "$LAUNCH_AGENTS" 2>/dev/null || true
    rm -f "$LAUNCH_AGENTS"
fi

# 停止进程
pkill -f "colobot-server" 2>/dev/null || true

# 删除应用和数据
[ -d "$APP_DIR" ] && rm -rf "$APP_DIR"
[ -d "$SUPPORT_DIR" ] && rm -rf "$SUPPORT_DIR"
[ -d "$CACHE_DIR" ] && rm -rf "$CACHE_DIR"
rm -f "$PREFS_DIR/com.colobot."* 2>/dev/null || true
[ -d "$LOGS_DIR" ] && rm -rf "$LOGS_DIR"
[ -d "$COLOBOT_USER" ] && rm -rf "$COLOBOT_USER"

# 删除本脚本
[ -f "$SCRIPT_PATH" ] && rm -f "$SCRIPT_PATH"
rmdir "$HOME/.colobot" 2>/dev/null || true

echo "[ColoBot Uninstall] 卸载完成。"
`;

const LINUX_SCRIPT = `#!/bin/bash
set -e
SERVICE_NAME="colobot"
COLOBOT_USER="$HOME/.colobot"
SCRIPT_PATH="$HOME/.colobot/uninstall-linux.sh"

echo "[ColoBot Uninstall] 开始卸载..."

systemctl --user stop "$SERVICE_NAME" 2>/dev/null || true
systemctl --user disable "$SERVICE_NAME" 2>/dev/null || true
rm -f "$HOME/.config/systemd/user/$SERVICE_NAME.service" 2>/dev/null || true
pkill -f "colobot-server" 2>/dev/null || true
[ -d "$COLOBOT_USER" ] && rm -rf "$COLOBOT_USER"
rm -f "$HOME/.config/colobot/"* 2>/dev/null || true
rmdir "$HOME/.config/colobot" 2>/dev/null || true
[ -f "$SCRIPT_PATH" ] && rm -f "$SCRIPT_PATH"

echo "[ColoBot Uninstall] 卸载完成。"
`;
