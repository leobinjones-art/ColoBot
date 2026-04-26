# ColoBot 部署教程

本文档提供三种部署方式：**Docker Compose（推荐）**、**手动部署** 和 **SQLite 轻量部署**。

---

## 环境要求

| 组件 | 最低要求 | 推荐 |
|------|----------|------|
| Node.js | 22.x | 22.x LTS |
| PostgreSQL | 16.x + pgvector | 18.x + pgvector |
| SQLite | 3.x（内置） | - |
| 内存 | 2 GB | 4 GB+ |
| 磁盘 | 10 GB | 20 GB+ |

---

## 方式一：Docker Compose（推荐）

### 1. 克隆项目

```bash
git clone https://github.com/leobinjones-art/ColoBot.git
cd colobot
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入必要的配置
```

**必须配置的项目：**

```env
# LLM API Key（至少选择一个 Provider）
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# 数据库密码（自定义强密码）
POSTGRES_PASSWORD=your_strong_password_here

# Dashboard 访问密钥（自定义）
COLOBOT_API_KEY=your_random_api_key_here
```

**可选配置：**

```env
# 飞书机器人（需要交互式卡片审批功能）
LARK_APP_ID=cli_xxxxxxxxxxxxxx
LARK_APP_SECRET=xxxxxxxxxxxxxxxx
FEISHU_APPROVER_OPEN_ID=ou_xxxxxxxx
COLOBOT_PUBLIC_URL=https://your-domain.com

# SearXNG 搜索（可选，默认内置 mock）
SEARXNG_URL=http://127.0.0.1:8080
```

### 3. 启动服务

```bash
# 启动 PostgreSQL 和 ColoBot
docker compose up -d

# 查看日志
docker compose logs -f colobot
```

### 4. 初始化数据库

```bash
# 等待 PostgreSQL 就绪后（约 5 秒），执行初始化
docker compose exec colobot npm run db:init
```

### 5. 验证部署

```bash
# 健康检查
curl http://localhost:18792/health

# 访问 Dashboard
open http://localhost:18792
```

访问 Dashboard 时需要输入 `COLOBOT_API_KEY` 中配置的密钥。

---

## 方式二：手动部署

适用于无 Docker 环境或需要深度定制的场景。

### 1. 安装 Node.js

**Ubuntu / Debian：**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**macOS：**

```bash
brew install node@22
```

**验证：**

```bash
node --version  # 应显示 v22.x.x
npm --version
```

### 2. 安装 PostgreSQL + pgvector

**Ubuntu / Debian：**

```bash
# 添加 PostgreSQL APT 源
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg

sudo apt update
sudo apt install -y postgresql-18 postgresql-18-pgvector
```

**macOS：**

```bash
brew install postgresql@18
brew install pgvector
```

**启动 PostgreSQL：**

```bash
# Linux (systemd)
sudo systemctl enable postgresql
sudo systemctl start postgresql

# macOS
brew services start postgresql@18
```

### 3. 创建数据库和用户

```bash
sudo -u postgres psql << EOF
-- 创建用户
CREATE USER colobot WITH PASSWORD 'your_strong_password';

-- 创建数据库
CREATE DATABASE colobot OWNER colobot;

-- 启用扩展
\c colobot
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE colobot TO colobot;
EOF
```

### 4. 克隆和安装依赖

```bash
git clone https://github.com/leobinjones-art/ColoBot.git
cd colobot
npm install
```

### 5. 配置环境变量

```bash
cp .env.example .env
nano .env
```

**最小配置：**

```env
# LLM
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# 数据库
DB_HOST=localhost
DB_PORT=5432
DB_NAME=colobot
DB_USER=colobot
DB_PASSWORD=your_strong_password

# Dashboard 访问密钥
COLOBOT_API_KEY=your_random_api_key
```

### 6. 初始化数据库

```bash
npm run db:init
```

### 7. 启动服务

**开发模式（带热重载）：**

```bash
npm run dev
```

**生产模式：**

```bash
npm run build
npm start
```

### 8. 验证

```bash
curl http://localhost:18792/health
# 应返回 {"ok":true,"timestamp":...}
```

---

## 方式三：SQLite 轻量部署（开发/测试）

适合开发测试环境，无需 PostgreSQL 服务。

### 1. 克隆和安装

```bash
git clone https://github.com/leobinjones-art/ColoBot.git
cd colobot
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
nano .env
```

**最小配置：**

```env
# LLM
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# 使用 SQLite（无需 PostgreSQL）
DB_TYPE=sqlite
DB_PATH=./data/colobot.db

# Dashboard 访问密钥
COLOBOT_API_KEY=your_random_api_key
```

### 3. 启动服务

```bash
npm run dev
```

### 4. 验证

```bash
curl http://localhost:18792/health
```

### SQLite 限制

| 功能 | PostgreSQL | SQLite |
|------|------------|--------|
| 向量检索 | ✅ pgvector | ❌ 降级为文本匹配 |
| 并发写入 | ✅ 高并发 | ⚠️ 单写入 |
| 生产环境 | ✅ 推荐 | ❌ 不推荐 |

---

## 配置 Systemd 服务（Linux）

将 ColoBot 配置为系统服务，开机自启。

### 1. 创建服务文件

```bash
sudo nano /etc/systemd/system/colobot.service
```

```ini
[Unit]
Description=ColoBot AI Agent Platform
After=network.target postgresql.service

[Service]
Type=simple
User=your_username
WorkingDirectory=/path/to/colobot
ExecStart=/path/to/colobot/node_modules/.bin/node colobot-server.js
Environment=NODE_ENV=production
EnvironmentFile=/path/to/colobot/.env
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 2. 启动服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable colobot
sudo systemctl start colobot

# 查看状态
sudo systemctl status colobot
```

---

## 反向代理配置

### Nginx

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:18792;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Caddy

```caddy
your-domain.com {
    reverse_proxy localhost:18792
}
```

---

## 安全配置清单

### 生产环境必做

- [ ] **修改默认密码**：将 `POSTGRES_PASSWORD`、`COLOBOT_API_KEY` 改为强密码
- [ ] **启用飞书验签**：配置 `LARK_VERIFICATION_TOKEN` 并在飞书开放平台启用事件验签
- [ ] **配置 TLS**：通过反向代理启用 HTTPS，切勿明文传输密钥
- [ ] **网络隔离**：数据库仅允许应用服务器访问，不对公网开放 5432 端口
- [ ] **API Key 保护**：不要将含真实密钥的 `.env` 提交到代码仓库

### 可选加固

- [ ] 配置防火墙，仅开放 80/443 端口
- [ ] 启用 PostgreSQL SSL 连接
- [ ] 配置 Rate Limiting（通过 Nginx/Caddy）
- [ ] 定期备份数据库

---

## 常见问题

### 数据库连接失败

```bash
# 检查 PostgreSQL 是否运行
sudo systemctl status postgresql

# 检查端口监听
ss -tlnp | grep 5432

# 测试连接
psql -h localhost -U colobot -d colobot
```

### pgvector 扩展未找到

```sql
-- 以超级用户身份执行
\c colobot
CREATE EXTENSION IF NOT EXISTS vector;
```

### 端口被占用

```bash
# 查找占用端口的进程
lsof -i :18792

# 更改端口
export COLOBOT_PORT=18793
```

### LLM API 调用失败

```bash
# 检查 API Key 是否正确
grep API_KEY .env

# 检查 Provider 配置
grep LLM_PROVIDER .env

# 查看日志中的具体错误
docker compose logs colobot  # 或 npm run dev
```

---

## 更新升级

```bash
# 拉取最新代码
git pull

# 重新安装依赖
npm install

# 重新构建（如有必要）
npm run build

# 重启服务
sudo systemctl restart colobot
# 或
docker compose restart colobot
```

---

## 目录结构参考

```
colobot/
├── docker-compose.yml    # Docker 部署配置
├── .env.example          # 环境变量模板
├── .env                  # 实际配置（不提交）
├── package.json
├── tsconfig.json
└── src/
    ├── colobot-server.ts # 主入口
    └── ...
```
