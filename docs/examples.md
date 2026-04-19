# ColoBot 使用示例

本文档提供了ColoBot的常见使用场景和代码示例。

## 目录

- [快速开始](#快速开始)
- [智能体管理](#智能体管理)
- [对话交互](#对话交互)
- [Skill开发](#skill开发)
- [知识库管理](#知识库管理)
- [审批流程](#审批流程)
- [WebSocket实时通信](#websocket实时通信)
- [集成示例](#集成示例)

---

## 快速开始

### 环境准备

```bash
# 克隆项目
git clone https://github.com/leobinjones-art/ColoBot.git
cd colobot

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入必要的配置

# 启动数据库
docker compose up -d postgres

# 初始化数据库
npm run db:init

# 启动服务
npm run dev
```

### 基础配置

```bash
# .env 文件示例
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-xxx
COLOBOT_API_KEY=your-secure-api-key
COLOBOT_PORT=18792
```

---

## 智能体管理

### 创建智能体

#### 使用curl

```bash
curl -X POST http://localhost:18792/api/agents \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "代码助手",
    "soul_content": "你是一个专业的软件开发助手，擅长代码审查、重构和最佳实践建议。",
    "primary_model_id": "openai:gpt-4o-mini",
    "fallback_model_id": "anthropic:claude-sonnet",
    "temperature": 0.7,
    "max_tokens": 4096
  }'
```

#### 使用JavaScript

```javascript
const createAgent = async () => {
  const response = await fetch('http://localhost:18792/api/agents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: '代码助手',
      soul_content: '你是一个专业的软件开发助手',
      primary_model_id: 'openai:gpt-4o-mini',
      temperature: 0.7
    })
  });

  const agent = await response.json();
  console.log('Created agent:', agent.id);
  return agent;
};
```

#### 使用Python

```python
import requests

def create_agent():
    response = requests.post(
        'http://localhost:18792/api/agents',
        headers={
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json'
        },
        json={
            'name': '代码助手',
            'soul_content': '你是一个专业的软件开发助手',
            'primary_model_id': 'openai:gpt-4o-mini',
            'temperature': 0.7
        }
    )
    
    agent = response.json()
    print(f'Created agent: {agent["id"]}')
    return agent
```

### 列出所有智能体

```bash
curl http://localhost:18792/api/agents \
  -H "Authorization: Bearer $API_KEY"
```

### 删除智能体

```bash
curl -X DELETE http://localhost:18792/api/agents/agent-123 \
  -H "Authorization: Bearer $API_KEY"
```

---

## 对话交互

### 简单对话

```bash
curl -X POST http://localhost:18792/api/chat \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent-123",
    "message": "请帮我写一个TypeScript函数，实现数组去重"
  }'
```

### 流式对话

```javascript
const streamChat = async (agentId, message) => {
  const response = await fetch('http://localhost:18792/api/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      agent_id: agentId,
      message: message,
      stream: true
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    process.stdout.write(chunk);
  }
};

// 使用示例
streamChat('agent-123', '请写一篇关于TypeScript的文章');
```

### 多轮对话

```javascript
const multiTurnChat = async () => {
  const agentId = 'agent-123';
  const sessionKey = 'session-' + Date.now();

  // 第一轮
  const response1 = await fetch('http://localhost:18792/api/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      agent_id: agentId,
      session_key: sessionKey,
      message: '我想学习TypeScript'
    })
  });
  console.log('Response 1:', await response1.json());

  // 第二轮（使用相同的session_key）
  const response2 = await fetch('http://localhost:18792/api/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      agent_id: agentId,
      session_key: sessionKey,
      message: '请推荐一些学习资源'
    })
  });
  console.log('Response 2:', await response2.json());
};
```

---

## Skill开发

### Skill定义格式

```markdown
# Skill名称

## 描述
Skill的详细描述

## 触发词
keyword1, keyword2, 关键词

## 功能
Skill的具体功能说明

## 执行工具序列
- tool_name_1
- tool_name_2

## 实现
\`\`\`javascript
// Skill的具体实现代码
function execute(context) {
  // 实现逻辑
  return result;
}
\`\`\`
```

### 创建代码审查Skill

```bash
curl -X POST http://localhost:18792/api/skills \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "代码审查",
    "description": "自动审查代码质量，提供改进建议",
    "markdown_content": "# 代码审查\n\n## 功能\n自动审查代码质量\n\n## 触发词\nreview, 代码审查, 审查代码\n\n## 实现\n分析代码并提供改进建议",
    "trigger_words": ["review", "代码审查"],
    "enabled": true
  }'
```

### 创建文档生成Skill

```javascript
const createDocSkill = async () => {
  const skillContent = `# API文档生成器

## 描述
根据代码自动生成API文档

## 触发词
generate docs, 生成文档, 文档生成

## 功能
分析代码注释和类型定义，自动生成API文档

## 实现
\`\`\`javascript
function generateDocs(code) {
  // 解析代码注释
  // 提取类型定义
  // 生成Markdown文档
  return documentation;
}
\`\`\`
`;

  const response = await fetch('http://localhost:18792/api/skills', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'API文档生成器',
      description: '根据代码自动生成API文档',
      markdown_content: skillContent,
      trigger_words: ['generate docs', '生成文档'],
      enabled: true
    })
  });

  return response.json();
};
```

---

## 知识库管理

### 添加知识条目

```bash
# 添加概念知识
curl -X POST http://localhost:18792/api/knowledge \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "concept",
    "name": "微服务架构",
    "content": "微服务架构是一种将应用程序构建为一组小型、独立部署的服务的方法。每个服务运行在自己的进程中，并通过轻量级机制（通常是HTTP API）进行通信。",
    "variables": ["service_name", "port", "database"],
    "related": ["docker", "kubernetes", "api-gateway"]
  }'
```

### 批量导入知识

```javascript
const importKnowledge = async () => {
  const entries = [
    {
      category: 'concept',
      name: 'Docker容器化',
      content: 'Docker是一种容器化技术，可以将应用程序及其依赖打包到一个可移植的容器中。'
    },
    {
      category: 'template',
      name: 'Dockerfile模板',
      content: 'FROM node:18-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nEXPOSE 3000\nCMD ["npm", "start"]',
      variables: ['port', 'node_version']
    },
    {
      category: 'rule',
      name: '代码审查规则',
      content: '所有代码变更必须经过至少一人审查才能合并到主分支。'
    }
  ];

  const response = await fetch('http://localhost:18792/api/knowledge/import', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ entries })
  });

  return response.json();
};
```

### 搜索知识

```bash
curl -X POST http://localhost:18792/api/knowledge/search \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "如何部署微服务",
    "category": "concept"
  }'
```

---

## 审批流程

### 查看待审批请求

```bash
curl http://localhost:18792/api/approvals \
  -H "Authorization: Bearer $API_KEY"
```

### 审批通过

```bash
curl -X POST http://localhost:18792/api/approvals/approval-123/approve \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "result": {
      "approved": true,
      "reason": "操作安全，符合规范"
    }
  }'
```

### 审批拒绝

```bash
curl -X POST http://localhost:18792/api/approvals/approval-123/reject \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "操作风险过高，需要进一步评估"
  }'
```

---

## WebSocket实时通信

### 建立连接

```javascript
const connectWebSocket = () => {
  const ws = new WebSocket(
    `ws://localhost:18792?agent_id=agent-123&session_key=session-abc&api_key=${API_KEY}`
  );

  ws.onopen = () => {
    console.log('WebSocket连接已建立');
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'response':
        console.log('收到响应:', message.payload.content);
        break;
      case 'chunk':
        process.stdout.write(message.payload.content);
        break;
      case 'done':
        console.log('\n对话完成');
        break;
      case 'error':
        console.error('错误:', message.payload.error);
        break;
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket错误:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket连接已关闭');
  };

  return ws;
};
```

### 发送消息

```javascript
const sendMessage = (ws, message) => {
  ws.send(JSON.stringify({
    type: 'chat',
    payload: {
      message: message
    }
  }));
};

// 使用示例
const ws = connectWebSocket();
setTimeout(() => {
  sendMessage(ws, '你好，请介绍一下你自己');
}, 1000);
```

### 完整的聊天客户端

```javascript
class ColoBotClient {
  constructor(agentId, apiKey) {
    this.agentId = agentId;
    this.apiKey = apiKey;
    this.ws = null;
  }

  connect(sessionKey = 'default') {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(
        `ws://localhost:18792?agent_id=${this.agentId}&session_key=${sessionKey}&api_key=${this.apiKey}`
      );

      this.ws.onopen = () => resolve();
      this.ws.onerror = (error) => reject(error);
    });
  }

  chat(message) {
    return new Promise((resolve) => {
      let fullResponse = '';

      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        
        if (msg.type === 'chunk') {
          fullResponse += msg.payload.content;
        } else if (msg.type === 'done') {
          resolve(fullResponse);
        }
      };

      this.ws.send(JSON.stringify({
        type: 'chat',
        payload: { message }
      }));
    });
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// 使用示例
async function main() {
  const client = new ColoBotClient('agent-123', 'your-api-key');
  await client.connect();
  
  const response = await client.chat('你好');
  console.log('Response:', response);
  
  client.close();
}
```

---

## 集成示例

### Express.js集成

```javascript
import express from 'express';

const app = express();
app.use(express.json());

const COLOBOT_URL = 'http://localhost:18792';
const API_KEY = process.env.COLOBOT_API_KEY;

// 代理聊天请求
app.post('/api/chat', async (req, res) => {
  try {
    const response = await fetch(`${COLOBOT_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Next.js集成

```typescript
// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';

const COLOBOT_URL = process.env.COLOBOT_URL || 'http://localhost:18792';
const API_KEY = process.env.COLOBOT_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${COLOBOT_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Python Flask集成

```python
from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

COLOBOT_URL = 'http://localhost:18792'
API_KEY = 'your-api-key'

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        response = requests.post(
            f'{COLOBOT_URL}/api/chat',
            headers={
                'Authorization': f'Bearer {API_KEY}',
                'Content-Type': 'application/json'
            },
            json=request.json
        )
        return jsonify(response.json())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=3000)
```

---

## 最佳实践

### 1. 错误处理

始终进行适当的错误处理：

```javascript
async function safeApiCall(url, options) {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}
```

### 2. 重试机制

实现重试机制处理临时故障：

```javascript
async function retryApiCall(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await safeApiCall(url, options);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

### 3. 会话管理

使用有意义的会话键：

```javascript
// 为不同用户创建不同会话
const sessionKey = `user-${userId}-session`;

// 为不同任务创建不同会话
const taskSessionKey = `task-${taskId}-session`;
```

### 4. 资源清理

及时清理不再使用的资源：

```javascript
// 删除不再使用的智能体
await fetch(`/api/agents/${agentId}`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${API_KEY}` }
});

// 关闭WebSocket连接
ws.close();
```

---

## 故障排除

### 常见问题

1. **认证失败**
   - 检查API密钥是否正确
   - 确认Authorization头格式正确

2. **连接超时**
   - 检查服务是否正常运行
   - 确认网络连接正常

3. **WebSocket断开**
   - 检查网络稳定性
   - 实现自动重连机制

### 调试技巧

```javascript
// 启用详细日志
const DEBUG = true;

async function debugApiCall(url, options) {
  if (DEBUG) {
    console.log('Request:', {
      url,
      method: options.method,
      headers: options.headers,
      body: options.body
    });
  }
  
  const response = await fetch(url, options);
  
  if (DEBUG) {
    console.log('Response:', {
      status: response.status,
      headers: response.headers
    });
  }
  
  return response;
}
```

---

## 更多资源

- [API参考文档](./api-reference.md)
- [架构设计](../README.md#核心设计)
- [贡献指南](../CONTRIBUTING.md)
- [安全策略](../SECURITY.md)