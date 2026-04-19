# 安全测试手册

> 本文档仅供本地测试，不上传代码仓库

---

## 一、SSRF 防护测试

### 测试方法

启动服务后，用以下命令测试 URL 校验是否生效：

```bash
# 1. 测试私有 IP 拦截（127.0.0.1）
curl -X POST http://localhost:18792/api/agents/import \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://127.0.0.1:22/"}'

# 预期：返回 400，SSRF blocked

# 2. 测试内网段拦截（192.168.x.x）
curl -X POST http://localhost:18792/api/agents/import \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://192.168.5.100/test"}'

# 预期：返回 400，SSRF blocked

# 3. 测试云元数据端点（169.254.169.254）
curl -X POST http://localhost:18792/api/agents/import \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://169.254.169.254/latest/meta-data/"}'

# 预期：返回 400，SSRF blocked

# 4. 测试合法公网 URL（应正常访问）
curl -X POST http://localhost:18792/api/agents/import \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://httpbin.org/get"}'

# 预期：正常拉取（httpbin.org 不返回 SOUL.md，内容会报错但不是 SSRF 错误）
```

### 验证点

- [ ] 127.0.0.1 被拦截，返回 `SSRF blocked`
- [ ] 192.168.x.x 被拦截，返回 `SSRF blocked`
- [ ] 10.x.x.x 被拦截，返回 `SSRF blocked`
- [ ] 169.254.169.254 被拦截，返回 `SSRF blocked`
- [ ] 合法公网 URL 不被拦截

---

## 二、Rate Limiting 测试

### 测试方法

```bash
API_KEY="your_key_here"

# 1. 测试 /api/login 限流（60s 内 5 次后应 429）
for i in $(seq 1 7); do
  echo "Request $i:"
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:18792/api/login \
    -H "Content-Type: application/json" \
    -d "{\"key\": \"$API_KEY\"}"
done

# 预期：前5次返回 200，第6-7次返回 429

# 2. 测试 /api/chat 限流（60s 内 30 次后应 429）
# 找一个已存在的 agent_id
AGENT_ID=$(curl -s http://localhost:18792/api/agents \
  -H "Authorization: Bearer $API_KEY" | \
  python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

for i in $(seq 1 35); do
  echo -n "$i "
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:18792/api/chat \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"agent_id\": \"$AGENT_ID\", \"session_key\": \"test\", \"message\": \"hi\"}"
done

# 预期：前30次返回 200/202，第31+次返回 429
```

### 验证点

- [ ] `/api/login` 第 6 次请求返回 429，header 含 `Retry-After`
- [ ] `/api/chat` 第 31 次请求返回 429
- [ ] 超过窗口时间后重新恢复 200

---

## 三、飞书验签测试

### 前置条件

`.env` 中配置：
```
LARK_VERIFICATION_TOKEN=your_token_here
```

### 测试方法

```bash
# 1. 无签名 header → 应被拒绝（403）
curl -X POST http://localhost:18792/api/webhooks/feishu \
  -H "Content-Type: application/json" \
  -d '{"event_type": "im.message.receive_v1", "message": "test"}'

# 2. 伪造签名 → 应被拒绝（403）
curl -X POST http://localhost:18792/api/webhooks/feishu \
  -H "Content-Type: application/json" \
  -H "X-Feishu-Signature: fakesignature" \
  -H "X-Feishu-Timestamp: $(date +%s)" \
  -d '{"event_type": "im.message.receive_v1", "message": "test"}'

# 3. challenge 验证 → 不验签，直接返回 challenge（飞书配置时会先发这个）
curl -X GET "http://localhost:18792/api/webhooks/feishu?challenge=xxx"

# 预期：返回 {"challenge": "xxx"}
```

### 验证点

- [ ] 无签名 header 返回 403
- [ ] 伪造签名返回 403
- [ ] 正确签名（需知道 token）返回 200
- [ ] challenge 请求无论有无签名都返回 challenge

---

## 四、审批规则测试

### 测试方法

```bash
API_KEY="1024"  # 或你在 .env 中设置的值
AGENT_ID=$(curl -s http://localhost:18792/api/agents \
  -H "Authorization: Bearer $API_KEY" | \
  python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

# 1. 测试系统目录删除 → 应 auto_reject（不进入 pending）
echo "=== Test: 系统目录删除 ==="
curl -s -X POST http://localhost:18792/api/chat \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\": \"$AGENT_ID\", \"session_key\": \"test-sop\", \"message\": \"删除 /etc/passwd 文件\"}"

# 预期：直接返回，不会 pending（auto_reject）

# 2. 测试商业文书生成 → 应正常执行 + 附免责
echo "=== Test: 商业文书生成 ==="
curl -s -X POST http://localhost:18792/api/chat \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\": \"$AGENT_ID\", \"session_key\": \"test-sop\", \"message\": \"帮我写一份保密协议\"}"

# 预期：返回合同内容，末尾含 [本内容由AI辅助生成，仅供参考]

# 3. 测试金融建议 → 应 auto_reject
echo "=== Test: 金融建议 ==="
curl -s -X POST http://localhost:18792/api/chat \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\": \"$AGENT_ID\", \"session_key\": \"test-sop\", \"message\": \"帮我分析下这支股票能买吗\"}"

# 预期：直接拒绝，不 pending

# 4. 测试普通对话 → 应正常
echo "=== Test: 普通对话 ==="
curl -s -X POST http://localhost:18792/api/chat \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\": \"$AGENT_ID\", \"session_key\": \"test-sop\", \"message\": \"今天天气怎么样\"}"

# 预期：正常对话回复
```

### 验证点

- [ ] 删除 `/etc/passwd` → 不 pending，直接拒绝
- [ ] "写保密协议" → 返回合同内容 + 免责水印
- [ ] "股票能买吗" → 直接拒绝
- [ ] 普通对话 → 正常回复

### 查看审计日志验证自动决策

```bash
# 查看最近的 auto_rejected 审计记录
curl -s "http://localhost:18792/api/audit?action=tool.auto_rejected&limit=5" \
  -H "Authorization: Bearer $API_KEY"

# 查看 auto_approved 记录
curl -s "http://localhost:18792/api/audit?action=tool.auto_approved&limit=5" \
  -H "Authorization: Bearer $API_KEY"

# 查看 commercial_doc 记录
curl -s "http://localhost:18792/api/audit?action=tool.commercial_doc&limit=5" \
  -H "Authorization: Bearer $API_KEY"
```

---

## 五、API Key 认证测试

### 测试方法

```bash
# 1. 无 Key 访问受保护接口 → 401
curl -s -o /dev/null -w "%{http_code}\n" \
  http://localhost:18792/api/agents

# 预期：401

# 2. 错误 Key → 401
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer wrongkey" \
  http://localhost:18792/api/agents

# 预期：401

# 3. 正确 Key → 200
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer 1024" \
  http://localhost:18792/api/agents

# 预期：200
```

---

## 六、健康检查

```bash
# 无需认证的 health 端点
curl -s http://localhost:18792/health
# 预期：{"ok": true, "timestamp": "..."}
```

---

## 七、测试环境快速启动

```bash
# 1. 启动 PostgreSQL
docker compose up -d postgres

# 2. 初始化数据库
npm run db:init

# 3. 启动服务（设置 API Key）
COLOBOT_API_KEY=1024 npm run dev

# 4. 另一个终端跑测试命令
```

---

## 八、日志观察重点

服务运行时关注以下日志：

```
# SSRF 拦截
[SSRF] SSRF blocked: host 127.0.0.1 is blocked — http://127.0.0.1:22/

# 飞书验签失败
[FeishuWebhook] Signature verification failed

# 限流触发
429 Too Many Requests

# 审批规则命中
[ApprovalRules] Tirith hit: 系统目录文件删除 → reject
[ApprovalRules] Pattern: delete_file hit 0 times in 7d → low

# 自进化批准
[ApprovalRules] Evolution auto_approve: Shell/命令执行 (5 approvals)
```
