/**
 * Web 搜索工具（SearXNG）
 */
import { registerTool } from './executor.js';

export function registerTools(): void {
  registerTool('get_time', async () => {
    return new Date().toISOString();
  });

  registerTool('web_search', async (args) => {
    const { query, safe_search, time_range, categories } = args as {
      query: string;
      safe_search?: number;
      time_range?: string;
      categories?: string[];
    };
    const { searxngSearch } = await import('../../search/searxng.js');
    return searxngSearch(query, {
      safe_search: safe_search as 0 | 1 | 2 | undefined,
      time_range,
      categories,
    });
  });

  registerTool('image_search', async (args) => {
    const { query, safe_search } = args as { query: string; safe_search?: number };
    const { imageSearch } = await import('../../search/searxng.js');
    return imageSearch(query, { safe_search: safe_search as 0 | 1 | 2 | undefined });
  });

  registerTool('video_search', async (args) => {
    const { query, safe_search, time_range } = args as {
      query: string;
      safe_search?: number;
      time_range?: string;
    };
    const { videoSearch } = await import('../../search/searxng.js');
    return videoSearch(query, { safe_search: safe_search as 0 | 1 | 2 | undefined, time_range });
  });
}
