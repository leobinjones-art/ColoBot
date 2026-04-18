/**
 * MiniMax 搜索工具
 * - minimax_search: 官方搜索（coding-plan-search）
 */
import { registerTool } from './executor.js';
import { getMinimaxApiKey, getOpenAIApiKey } from '../../services/settings-cache.js';

export function registerTools(): void {
  /**
   * MiniMax 搜索（coding-plan-search）
   * POST https://api.minimaxi.com/v1/coding_plan/search
   *
   * 支持 Google 高级搜索语法
   */
  registerTool('minimax_search', async (args) => {
    const apiKey = getMinimaxApiKey();
    if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

    const { q } = args as { q: string };

    if (!q) throw new Error('q (query) is required');

    const res = await fetch('https://api.minimaxi.com/v1/coding_plan/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`MiniMax search error: ${res.status} ${err}`);
    }

    const data = await res.json() as {
      organic?: Array<{ title: string; link: string; snippet: string; date?: string }>;
      base_resp?: { status_code: number; status_msg: string };
    };

    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(`MiniMax search failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
    }

    return {
      results: (data.organic ?? []).map(r => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet,
        date: r.date,
      })),
    };
  });
}
