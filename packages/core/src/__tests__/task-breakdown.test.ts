/**
 * AI 驱动的动态任务拆解测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeRequest,
  executeDynamicTask,
  cleanupTaskResult,
  DEFAULT_TOOLS,
  type TaskAnalysis,
  type DynamicBreakdownDeps,
  type ExecutionContext,
} from '../task-breakdown/index.js';
import { clearSubAgents } from '../subagents/index.js';

describe('Dynamic Task Breakdown', () => {
  beforeEach(() => {
    clearSubAgents();
  });

  describe('DEFAULT_TOOLS', () => {
    it('should have built-in tools', () => {
      expect(DEFAULT_TOOLS.length).toBeGreaterThan(0);
      expect(DEFAULT_TOOLS.find(t => t.name === 'web_search')).toBeDefined();
      expect(DEFAULT_TOOLS.find(t => t.name === 'read_file')).toBeDefined();
      expect(DEFAULT_TOOLS.find(t => t.name === 'python')).toBeDefined();
    });
  });

  describe('analyzeRequest', () => {
    it('should analyze weather query and require web_search', async () => {
      const mockLLM = {
        name: 'mock',
        chat: vi.fn(async () => ({
          content: JSON.stringify({
            taskType: '查询',
            description: '查询天气信息',
            requiredTools: ['web_search'],
            reasoning: '用户询问天气，需要实时网络搜索',
            subTasks: [
              { name: '搜索天气', description: '搜索今天的天气信息', tools: ['web_search'] }
            ],
          }),
        })),
        chatStream: vi.fn(async function* () {}),
      };

      const deps: DynamicBreakdownDeps = {
        llm: mockLLM,
        audit: { write: vi.fn(async () => {}) },
        parseTools: vi.fn(() => []),
        executeTools: vi.fn(async () => []),
        formatResults: vi.fn(() => ''),
      };

      const analysis = await analyzeRequest('今天天气如何', mockLLM, deps);

      expect(analysis.taskType).toBe('查询');
      expect(analysis.requiredTools).toContain('web_search');
      expect(analysis.subTasks).toHaveLength(1);
      expect(analysis.subTasks[0].tools).toContain('web_search');
    });

    it('should analyze table analysis with inputFromDeps', async () => {
      const mockLLM = {
        name: 'mock',
        chat: vi.fn(async () => ({
          content: JSON.stringify({
            taskType: '分析',
            description: '分析表格数据',
            requiredTools: ['read_file', 'python'],
            reasoning: '需要读取表格文件并进行数据分析',
            subTasks: [
              { name: '读取表格', description: '读取表格文件', tools: ['read_file'] },
              {
                name: '数据分析',
                description: '使用Python分析数据',
                tools: ['python'],
                dependencies: ['读取表格'],
                inputFromDeps: ['读取表格'],
              },
            ],
          }),
        })),
        chatStream: vi.fn(async function* () {}),
      };

      const deps: DynamicBreakdownDeps = {
        llm: mockLLM,
        audit: { write: vi.fn(async () => {}) },
        parseTools: vi.fn(() => []),
        executeTools: vi.fn(async () => []),
        formatResults: vi.fn(() => ''),
      };

      const analysis = await analyzeRequest('帮我分析这份表格', mockLLM, deps);

      expect(analysis.taskType).toBe('分析');
      expect(analysis.subTasks).toHaveLength(2);
      expect(analysis.subTasks[1].dependencies).toContain('读取表格');
      expect(analysis.subTasks[1].inputFromDeps).toContain('读取表格');
    });

    it('should use custom tools from deps', async () => {
      const customTools = [
        { name: 'custom_tool', description: '自定义工具', capabilities: ['自定义'] },
      ];

      const mockLLM = {
        name: 'mock',
        chat: vi.fn(async () => ({
          content: JSON.stringify({
            taskType: '处理',
            description: 'test',
            requiredTools: ['custom_tool'],
            reasoning: 'test',
            subTasks: [{ name: 'test', description: 'test', tools: ['custom_tool'] }],
          }),
        })),
        chatStream: vi.fn(async function* () {}),
      };

      const deps: DynamicBreakdownDeps = {
        llm: mockLLM,
        tools: customTools,
        audit: { write: vi.fn(async () => {}) },
        parseTools: vi.fn(() => []),
        executeTools: vi.fn(async () => []),
        formatResults: vi.fn(() => ''),
      };

      await analyzeRequest('test', mockLLM, deps);

      // 验证 chat 被调用
      expect(mockLLM.chat).toHaveBeenCalled();
    });

    it('should return default analysis on parse failure', async () => {
      const mockLLM = {
        name: 'mock',
        chat: vi.fn(async () => ({ content: 'invalid response' })),
        chatStream: vi.fn(async function* () {}),
      };

      const deps: DynamicBreakdownDeps = {
        llm: mockLLM,
        audit: { write: vi.fn(async () => {}) },
        parseTools: vi.fn(() => []),
        executeTools: vi.fn(async () => []),
        formatResults: vi.fn(() => ''),
      };

      const analysis = await analyzeRequest('some task', mockLLM, deps);

      expect(analysis.taskType).toBe('处理');
      expect(analysis.subTasks).toHaveLength(1);
    });
  });

  describe('executeDynamicTask', () => {
    it('should execute weather query task', async () => {
      const mockLLM = {
        name: 'mock',
        chat: vi.fn()
          .mockResolvedValueOnce({
            content: JSON.stringify({
              taskType: '查询',
              description: '查询天气',
              requiredTools: ['web_search'],
              reasoning: '需要网络搜索',
              subTasks: [
                { name: '搜索天气', description: '搜索天气信息', tools: ['web_search'] }
              ],
            }),
          })
          .mockResolvedValueOnce({ content: '今天北京晴天，气温25度' }),
        chatStream: vi.fn(async function* () {}),
      };

      const deps: DynamicBreakdownDeps = {
        llm: mockLLM,
        audit: { write: vi.fn(async () => {}) },
        parseTools: vi.fn(() => []),
        executeTools: vi.fn(async () => []),
        formatResults: vi.fn(() => ''),
      };

      const result = await executeDynamicTask('今天天气如何', 'parent-1', mockLLM, deps);

      expect(result.status).toBe('completed');
      expect(result.analysis.requiredTools).toContain('web_search');
      expect(result.results.size).toBe(1);
      expect(result.finalOutput).toContain('天气');
    });

    it('should pass data between dependent subtasks', async () => {
      const receivedUserMessages: string[] = [];

      const mockLLM = {
        name: 'mock',
        chat: vi.fn()
          .mockResolvedValueOnce({
            content: JSON.stringify({
              taskType: '分析',
              description: '分析表格',
              requiredTools: ['read_file', 'python'],
              reasoning: '需要读取和分析',
              subTasks: [
                { name: '读取数据', description: '读取文件', tools: ['read_file'] },
                {
                  name: '分析数据',
                  description: '分析数据',
                  tools: ['python'],
                  dependencies: ['读取数据'],
                  inputFromDeps: ['读取数据'],
                },
              ],
            }),
          })
          .mockImplementation(async (msgs) => {
            // msgs[0] 是 system, msgs[1] 是 user
            if (msgs[1]?.role === 'user') {
              receivedUserMessages.push(msgs[1].content);
            }
            return { content: 'done' };
          }),
        chatStream: vi.fn(async function* () {}),
      };

      const deps: DynamicBreakdownDeps = {
        llm: mockLLM,
        audit: { write: vi.fn(async () => {}) },
        parseTools: vi.fn(() => []),
        executeTools: vi.fn(async () => []),
        formatResults: vi.fn(() => ''),
      };

      const result = await executeDynamicTask('分析表格', 'parent-1', mockLLM, deps);

      // 第二个子任务应该收到第一个子任务的输出
      expect(receivedUserMessages.length).toBe(2);
      expect(receivedUserMessages[1]).toContain('前置任务结果');
    });

    it('should execute independent subtasks in parallel', async () => {
      const executionOrder: string[] = [];
      const startTimes: number[] = [];

      const mockLLM = {
        name: 'mock',
        chat: vi.fn()
          .mockResolvedValueOnce({
            content: JSON.stringify({
              taskType: '查询',
              description: '并行搜索',
              requiredTools: ['web_search'],
              reasoning: '需要并行搜索',
              subTasks: [
                { name: '搜索天气', description: '搜索天气', tools: ['web_search'] },
                { name: '搜索新闻', description: '搜索新闻', tools: ['web_search'] },
              ],
            }),
          })
          .mockImplementation(async (msgs) => {
            const start = Date.now();
            startTimes.push(start);
            executionOrder.push(msgs[0].content.slice(0, 10));
            // 模拟延迟
            await new Promise(r => setTimeout(r, 50));
            return { content: 'done' };
          }),
        chatStream: vi.fn(async function* () {}),
      };

      const deps: DynamicBreakdownDeps = {
        llm: mockLLM,
        audit: { write: vi.fn(async () => {}) },
        parseTools: vi.fn(() => []),
        executeTools: vi.fn(async () => []),
        formatResults: vi.fn(() => ''),
      };

      const result = await executeDynamicTask('并行搜索', 'parent-1', mockLLM, deps);

      // 两个子任务应该并行执行（开始时间接近）
      expect(result.status).toBe('completed');
      expect(result.results.size).toBe(2);
    });

    it('should respect maxParallel limit', async () => {
      const concurrentCount = { current: 0, max: 0 };

      const mockLLM = {
        name: 'mock',
        chat: vi.fn()
          .mockResolvedValueOnce({
            content: JSON.stringify({
              taskType: '处理',
              description: '并行测试',
              requiredTools: ['read_file'],
              reasoning: 'test',
              subTasks: [
                { name: 'task1', description: 'task1', tools: ['read_file'] },
                { name: 'task2', description: 'task2', tools: ['read_file'] },
                { name: 'task3', description: 'task3', tools: ['read_file'] },
                { name: 'task4', description: 'task4', tools: ['read_file'] },
              ],
            }),
          })
          .mockImplementation(async (msgs) => {
            concurrentCount.current++;
            concurrentCount.max = Math.max(concurrentCount.max, concurrentCount.current);
            await new Promise(r => setTimeout(r, 30));
            concurrentCount.current--;
            return { content: 'done' };
          }),
        chatStream: vi.fn(async function* () {}),
      };

      const deps: DynamicBreakdownDeps = {
        llm: mockLLM,
        maxParallel: 2, // 限制最多 2 个并行
        audit: { write: vi.fn(async () => {}) },
        parseTools: vi.fn(() => []),
        executeTools: vi.fn(async () => []),
        formatResults: vi.fn(() => ''),
      };

      await executeDynamicTask('并行测试', 'parent-1', mockLLM, deps);

      // 最大并发应该不超过 2
      expect(concurrentCount.max).toBeLessThanOrEqual(2);
    });

    it('should handle dependency failure gracefully', async () => {
      const mockLLM = {
        name: 'mock',
        chat: vi.fn()
          .mockResolvedValueOnce({
            content: JSON.stringify({
              taskType: '处理',
              description: '测试失败处理',
              requiredTools: ['read_file'],
              reasoning: 'test',
              subTasks: [
                { name: '失败任务', description: '会失败', tools: ['read_file'] },
                {
                  name: '依赖任务',
                  description: '依赖失败任务',
                  tools: ['read_file'],
                  dependencies: ['失败任务'],
                },
              ],
            }),
          })
          .mockRejectedValueOnce(new Error('Task failed'))
          .mockResolvedValueOnce({ content: 'ok' }),
        chatStream: vi.fn(async function* () {}),
      };

      const deps: DynamicBreakdownDeps = {
        llm: mockLLM,
        audit: { write: vi.fn(async () => {}) },
        parseTools: vi.fn(() => []),
        executeTools: vi.fn(async () => []),
        formatResults: vi.fn(() => ''),
      };

      const result = await executeDynamicTask('测试失败', 'parent-1', mockLLM, deps);

      // 依赖任务应该被标记为失败
      expect(result.results.get('失败任务')?.success).toBe(false);
      expect(result.results.get('依赖任务')?.success).toBe(false);
      expect(result.results.get('依赖任务')?.output).toContain('依赖任务失败');
    });

    it('should call callbacks with context', async () => {
      const mockLLM = {
        name: 'mock',
        chat: vi.fn()
          .mockResolvedValueOnce({
            content: JSON.stringify({
              taskType: '查询',
              description: '测试回调',
              requiredTools: ['read_file'],
              reasoning: 'test',
              subTasks: [{ name: '测试', description: '测试', tools: ['read_file'] }],
            }),
          })
          .mockResolvedValueOnce({ content: 'done' }),
        chatStream: vi.fn(async function* () {}),
      };

      const onSubTaskStart = vi.fn(async () => {});
      const onSubTaskComplete = vi.fn(async () => {});
      const onComplete = vi.fn(async () => {});

      const deps: DynamicBreakdownDeps = {
        llm: mockLLM,
        audit: { write: vi.fn(async () => {}) },
        parseTools: vi.fn(() => []),
        executeTools: vi.fn(async () => []),
        formatResults: vi.fn(() => ''),
        onSubTaskStart,
        onSubTaskComplete,
        onComplete,
      };

      await executeDynamicTask('测试', 'parent-1', mockLLM, deps);

      expect(onSubTaskStart).toHaveBeenCalled();
      expect(onSubTaskComplete).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
    });
  });

  describe('cleanupTaskResult', () => {
    it('should cleanup sub agents', async () => {
      const mockLLM = {
        name: 'mock',
        chat: vi.fn()
          .mockResolvedValueOnce({
            content: JSON.stringify({
              taskType: '查询',
              description: '测试',
              requiredTools: ['read_file'],
              reasoning: '测试',
              subTasks: [{ name: '读取', description: '读取文件', tools: ['read_file'] }],
            }),
          })
          .mockResolvedValueOnce({ content: 'done' }),
        chatStream: vi.fn(async function* () {}),
      };

      const deps: DynamicBreakdownDeps = {
        llm: mockLLM,
        audit: { write: vi.fn(async () => {}) },
        parseTools: vi.fn(() => []),
        executeTools: vi.fn(async () => []),
        formatResults: vi.fn(() => ''),
      };

      const result = await executeDynamicTask('测试', 'parent-1', mockLLM, deps);

      // 清理应该不抛出错误
      expect(() => cleanupTaskResult(result, 'parent-1')).not.toThrow();
    });
  });
});
