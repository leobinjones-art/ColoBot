/**
 * E2E Tests for ColoBot
 * 运行方式: npm run test:e2e
 */

import { WebSocket } from 'ws';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

const API_KEY = process.env.TEST_API_KEY || 'test-key-123';
const BASE_URL = 'http://localhost:18792';
const WS_URL = `ws://localhost:18792?api_key=${API_KEY}`;

interface TestAgent {
  id: string;
  name: string;
}

async function api(path: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text };
  }
}

describe('ColoBot E2E', () => {
  let agent: TestAgent;

  it('01 - health check', async () => {
    const { status, data } = await api('/health');
    expect(status).toBe(200);
    expect(data.status).toBe('ok');
  });

  it('02 - create agent', async () => {
    const { status, data } = await api('/api/agents', 'POST', {
      name: 'TestAgent',
      soul_content: JSON.stringify({ role: '测试助手', personality: '你是一个友好的AI助手。' }),
      primary_model_id: 'gpt-4o',
    });
    expect(status).toBe(201);
    expect(data.name).toBe('TestAgent');
    agent = data as TestAgent;
  });

  it('03 - list agents', async () => {
    const { status, data } = await api('/api/agents');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('04 - get agent by id', async () => {
    const { status, data } = await api(`/api/agents/${agent.id}`);
    expect(status).toBe(200);
    expect(data.id).toBe(agent.id);
  });

  it('05 - chat with agent', async () => {
    const { status, data } = await api('/api/chat', 'POST', {
      agent_id: agent.id,
      session_key: 'test-session-1',
      message: '你好，请介绍一下你自己。',
    });
    expect(status).toBe(200);
    expect(data.response).toBeDefined();
    expect(typeof data.response).toBe('string');
    console.log('[Chat Response]', data.response);
  });

  it('06 - second chat message', async () => {
    const { status, data } = await api('/api/chat', 'POST', {
      agent_id: agent.id,
      session_key: 'test-session-1',
      message: '用一句话介绍自己。',
    });
    expect(status).toBe(200);
    expect(data.response).toBeDefined();
    console.log('[Chat Response 2]', data.response);
  });

  it('07 - WebSocket chat', async () => {
    const ws = new WebSocket(`${WS_URL}&agent_id=${agent.id}&session=ws-test`);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });

    const response = await new Promise<string>((resolve, reject) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'response') {
          resolve(msg.payload.response);
          ws.close();
        }
        if (msg.type === 'error') {
          reject(new Error(msg.payload.error));
        }
      });

      ws.send(JSON.stringify({
        type: 'chat',
        payload: { message: 'WebSocket 测试消息' },
      }));
    });

    expect(response).toBeDefined();
    console.log('[WS Response]', response);
  });

  it('08 - create and execute skill', async () => {
    // 创建 skill
    const { status: _createStatus } = await api('/api/skills', 'POST', {
      name: 'EchoSkill',
      description: '回声技能',
      markdown_content: `# EchoSkill

## 触发词
echo

## 描述
简单的回声技能

## 执行工具序列
get_time
`,
      trigger_words: ['echo'],
    });

    // 通过 chat 触发 skill
    const { status, data } = await api('/api/chat', 'POST', {
      agent_id: agent.id,
      session_key: 'test-session-1',
      message: 'echo 你好',
    });

    expect(status).toBe(200);
    console.log('[Skill Response]', data.response);
  });

  it('09 - memory search', async () => {
    // 先添加一些记忆
    await api('/api/chat', 'POST', {
      agent_id: agent.id,
      session_key: 'test-session-1',
      message: '记住我的名字是测试用户。',
    });

    const { status, data } = await api('/api/memory/search', 'POST', {
      agent_id: agent.id,
      query: '名字',
    });

    expect(status).toBe(200);
    console.log('[Memory Search]', data.result);
  });

  it('10 - searxng search', async () => {
    const { status, data } = await api('/api/search', 'POST', {
      query: 'ColoBot AI agent',
    });

    expect(status).toBe(200);
    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);
    console.log('[SearXNG Search]', `Found ${data.numberOfResults} results`);
    if (data.results.length > 0) {
      console.log('[SearXNG First Result]', data.results[0].title);
    }
  });

  it('11 - cleanup agent', async () => {
    const { status } = await api(`/api/agents/${agent.id}`, 'DELETE');
    expect(status).toBe(204);
  });
});

describe('ColoBot E2E - Approval Commands', () => {
  let agent: TestAgent;

  beforeAll(async () => {
    const { data } = await api('/api/agents', 'POST', {
      name: 'ApprovalTestAgent',
      soul_content: JSON.stringify({ role: '审批测试助手' }),
      primary_model_id: 'gpt-4o',
    });
    agent = data as TestAgent;
  });

  afterAll(async () => {
    if (agent?.id) {
      await api(`/api/agents/${agent.id}`, 'DELETE');
    }
  });

  it('lists pending approvals via chat command', async () => {
    const { status, data } = await api('/api/chat', 'POST', {
      agent_id: agent.id,
      session_key: 'approval-test-session',
      message: '/approvals',
    });
    expect(status).toBe(200);
    expect(data.response).toBeDefined();
  });

  it('shows help for approval command', async () => {
    const { status, data } = await api('/api/chat', 'POST', {
      agent_id: agent.id,
      session_key: 'approval-test-session',
      message: '/help',
    });
    expect(status).toBe(200);
    expect(data.response).toContain('审批');
  });
});

describe('ColoBot E2E - User Profile', () => {
  let agent: TestAgent;

  beforeAll(async () => {
    const { data } = await api('/api/agents', 'POST', {
      name: 'ProfileTestAgent',
      soul_content: JSON.stringify({ role: '画像测试助手' }),
      primary_model_id: 'gpt-4o',
    });
    agent = data as TestAgent;
  });

  afterAll(async () => {
    if (agent?.id) {
      await api(`/api/agents/${agent.id}`, 'DELETE');
    }
  });

  it('gets empty profile initially', async () => {
    const { status, data } = await api(`/api/profile/${agent.id}`);
    expect(status).toBe(200);
    expect(data).toBeNull();
  });

  it('creates user profile', async () => {
    const { status, data } = await api(`/api/profile/${agent.id}`, 'POST', {
      name: '测试用户',
      role: 'developer',
      expertise_level: 'intermediate',
      skills: ['TypeScript', 'Python'],
    });
    expect(status).toBe(200);
    expect(data.name).toBe('测试用户');
    expect(data.role).toBe('developer');
  });

  it('gets user profile after creation', async () => {
    const { status, data } = await api(`/api/profile/${agent.id}`);
    expect(status).toBe(200);
    expect(data.name).toBe('测试用户');
  });

  it('updates user profile', async () => {
    const { status, data } = await api(`/api/profile/${agent.id}`, 'POST', {
      goals: ['学习AI', '完成项目'],
    });
    expect(status).toBe(200);
    expect(data.goals).toContain('学习AI');
  });

  it('deletes user profile', async () => {
    const { status } = await api(`/api/profile/${agent.id}`, 'DELETE');
    expect(status).toBe(204);
  });
});

describe('ColoBot E2E - Security', () => {
  let agent: TestAgent;

  beforeAll(async () => {
    const { data } = await api('/api/agents', 'POST', {
      name: 'SecurityTestAgent',
      soul_content: JSON.stringify({ role: '安全测试助手' }),
      primary_model_id: 'gpt-4o',
    });
    agent = data as TestAgent;
  });

  afterAll(async () => {
    if (agent?.id) {
      await api(`/api/agents/${agent.id}`, 'DELETE');
    }
  });

  it('gets trust status', async () => {
    const { status, data } = await api('/api/security/trust-status');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('gets poisoning attempts', async () => {
    const { status, data } = await api('/api/security/poisoning-attempts');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('gets write audit log', async () => {
    const { status, data } = await api('/api/security/write-audit');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });
});

describe('ColoBot E2E - Knowledge', () => {
  it('lists knowledge base', async () => {
    const { status, data } = await api('/api/knowledge');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('adds knowledge entry', async () => {
    const { status, data } = await api('/api/knowledge', 'POST', {
      category: 'concept',
      name: 'TestConcept',
      content: '这是一个测试概念',
    });
    expect(status).toBe(201);
    expect(data.name).toBe('TestConcept');
  });

  it('searches knowledge', async () => {
    const { status, data } = await api('/api/knowledge/search', 'POST', {
      query: '测试',
    });
    expect(status).toBe(200);
    expect(data.results).toBeDefined();
  });

  it('deletes knowledge entry', async () => {
    const { status } = await api('/api/knowledge/concept/TestConcept', 'DELETE');
    expect(status).toBe(204);
  });
});
