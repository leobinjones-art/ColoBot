/**
 * SearXNG 搜索集成
 * 多模态搜索支持
 */

interface SearXNGResult {
  url: string;
  title: string;
  content: string;
  engine: string;
  category: string;
  thumbnail?: string;
  publishedDate?: string | null;
}

interface SearXNGResponse {
  query: string;
  number_of_results: number;
  results: SearXNGResult[];
  answers: string[];
  corrections: string[];
  suggestions: string[];
  infoboxes: unknown[];
}

export interface SearchOptions {
  language?: string;
  safe_search?: 0 | 1 | 2;
  time_range?: string;
  categories?: string[];
  engines?: string[];
  format?: 'json' | 'html' | 'csv' | 'rss';
}

export interface SearchResult {
  query: string;
  results: SearXNGResult[];
  answers: string[];
  suggestions: string[];
  numberOfResults: number;
}

/**
 * 执行 SearXNG 搜索
 */
export async function searxngSearch(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const baseUrl = process.env.SEARXNG_URL || 'http://127.0.0.1:8080';

  const params = new URLSearchParams({
    q: query,
    format: options.format || 'json',
  });

  if (options.language) params.set('language', options.language);
  if (options.safe_search !== undefined) params.set('safesearch', String(options.safe_search));
  if (options.time_range) params.set('time_range', options.time_range);
  if (options.categories?.length) params.set('categories', options.categories.join(','));
  if (options.engines?.length) params.set('engines', options.engines.join(','));

  const response = await fetch(`${baseUrl}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    if (response.status === 429 || response.status === 503) {
      return { query, results: [], answers: [], suggestions: [], numberOfResults: 0 };
    }
    throw new Error(`SearXNG search failed: ${response.status} ${response.statusText}`);
  }

  const data: SearXNGResponse = await response.json();

  return {
    query: data.query,
    results: data.results,
    answers: data.answers,
    suggestions: data.suggestions,
    numberOfResults: data.number_of_results,
  };
}

/**
 * 图片搜索
 */
export async function imageSearch(query: string, options: SearchOptions = {}): Promise<SearchResult> {
  return searxngSearch(query, { ...options, categories: ['images'] });
}

/**
 * 视频搜索
 */
export async function videoSearch(query: string, options: SearchOptions = {}): Promise<SearchResult> {
  return searxngSearch(query, { ...options, categories: ['videos'] });
}

/**
 * 新闻搜索
 */
export async function newsSearch(query: string, options: SearchOptions = {}): Promise<SearchResult> {
  return searxngSearch(query, { ...options, categories: ['news'] });
}

/**
 * 多模态搜索（文本+图片）
 */
export async function multimodalSearch(
  query: string,
  options: SearchOptions = {}
): Promise<{ text: SearchResult; images: SearchResult }> {
  const [text, images] = await Promise.all([
    searxngSearch(query, options),
    imageSearch(query, options),
  ]);
  return { text, images };
}
