#!/bin/bash
# ColoBot 部署脚本 - Manjaro Linux
set -e

echo "=== 1. 安装 Node.js 25 ==="
# 使用 Arch 的 Node.js（Node 25 可能需要从 AUR 或 nvm）
# 先试试 Node.js 22（最新稳定版）
sudo pacman -Sy --noconfirm nodejs npm

echo "=== 2. 安装 PostgreSQL ==="
sudo pacman -Sy --noconfirm postgresql

echo "=== 3. 初始化 PostgreSQL ==="
# 检查是否已初始化
if [ ! -d "/var/lib/postgres/data"]; then
  sudo -u postgres initdb -D /var/lib/postgres/data
fi

echo "=== 4. 启动 PostgreSQL ==="
sudo systemctl enable postgresql
sudo systemctl start postgresql

# 等待启动
sleep 3

echo "=== 5. 创建数据库和用户 ==="
sudo -u postgres psql -c "CREATE USER colobot WITH PASSWORD 'colo123';" 2>/dev/null || echo "用户已存在"
sudo -u postgres psql -c "CREATE DATABASE colobot OWNER colobot;" 2>/dev/null || echo "数据库已存在"
sudo -u postgres psql -d colobot -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" 2>/dev/null || echo "pgcrypto 已存在"
sudo -u postgres psql -d colobot -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || echo "vector 已存在"

echo "=== 6. 创建应用目录 ==="
mkdir -p /home/bing/colobot
cd /home/bing/colobot

echo "=== 7. 配置 pg_hba.conf 允许局域网 ==="
# 添加局域网访问权限
PG_HBA="/var/lib/postgres/data/pg_hba.conf"
if ! grep -q "host.*all.*all.*192.168" "$PG_HBA" 2>/dev/null; then
  echo "host all all 192.168.0.0/16 md5" | sudo tee -a "$PG_HBA" > /dev/null
  sudo systemctl restart postgresql
fi

echo "=== 8. 配置 PostgreSQL 监听所有地址 ==="
PG_CONF="/var/lib/postgres/data/postgresql.conf"
if ! grep -q "listen_addresses" "$PG_CONF" 2>/dev/null; then
  echo "listen_addresses = '*'" | sudo tee -a "$PG_CONF" > /dev/null
  sudo systemctl restart postgresql
fi

echo "=== 部署完成 ==="
echo "数据库: colobot@localhost:5432"
echo "用户: colobot / colo123"
echo ""
echo "下一步: 上传代码并设置环境变量"
