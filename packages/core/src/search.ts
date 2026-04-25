/**
 * 搜索模块 - 支持多种搜索引擎
 */

export interface SearchOptions {
  language?: string;
  safe_search?: 0 | 1 | 2;
  time_range?: string;
  categories?: string[];
  engines?: string[];
  maxResults?: number;
}

export interface SearchResult {
  url: string;
  title: string;
  content: string;
  engine: string;
  category: string;
  thumbnail?: string;
  publishedDate?: string | null;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  answers: string[];
  suggestions: string[];
  numberOfResults: number;
}

export interface AcademicPaper {
  title: string;
  url: string;
  abstract: string;
  source: string;
  publishedDate?: string | null;
}

// ── 搜索配置 ──────────────────────────────────────────────

interface SearchConfig {
  engine: 'searxng' | 'duckduckgo' | 'google' | 'bing';
  baseUrl: string;
  apiKey?: string;
  cx?: string;
  maxResults: number;
  timeout: number;
}

let searchConfig: SearchConfig = {
  engine: 'searxng',
  baseUrl: 'http://127.0.0.1:8080',
  maxResults: 10,
  timeout: 30000,
};

/**
 * 配置搜索服务
 */
export function configureSearch(config: Partial<SearchConfig>): void {
  searchConfig = { ...searchConfig, ...config };
}

/**
 * 获取搜索配置
 */
export function getSearchConfig(): SearchConfig {
  return { ...searchConfig };
}

/**
 * 执行搜索
 */
export async function search(
  queryText: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const maxResults = options.maxResults ?? searchConfig.maxResults;

  // 根据引擎选择搜索方式
  switch (searchConfig.engine) {
    case 'duckduckgo':
      return searchDuckDuckGo(queryText, maxResults);
    case 'google':
      return searchGoogle(queryText, maxResults);
    case 'bing':
      return searchBing(queryText, maxResults);
    case 'searxng':
    default:
      return searchSearXNG(queryText, options, maxResults);
  }
}

/**
 * SearXNG 搜索
 */
async function searchSearXNG(
  queryText: string,
  options: SearchOptions,
  maxResults: number
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: queryText,
    format: 'json',
  });

  if (options.language) params.set('language', options.language);
  if (options.safe_search !== undefined) params.set('safesearch', String(options.safe_search));
  if (options.time_range) params.set('time_range', options.time_range);
  if (options.categories?.length) params.set('categories', options.categories.join(','));
  if (options.engines?.length) params.set('engines', options.engines.join(','));

  try {
    const response = await fetch(`${searchConfig.baseUrl}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      if (response.status === 429 || response.status === 503) {
        return { query: queryText, results: [], answers: [], suggestions: [], numberOfResults: 0 };
      }
      throw new Error(`Search failed: ${response.status}`);
    }

    const data = await response.json() as {
      query: string;
      results: SearchResult[];
      answers: string[];
      suggestions: string[];
      number_of_results: number;
    };

    return {
      query: data.query,
      results: data.results.slice(0, maxResults),
      answers: data.answers,
      suggestions: data.suggestions,
      numberOfResults: data.number_of_results,
    };
  } catch (e) {
    console.error('[Search] SearXNG Error:', e);
    return { query: queryText, results: [], answers: [], suggestions: [], numberOfResults: 0 };
  }
}

/**
 * DuckDuckGo 搜索 (使用 DuckDuckGo HTML)
 */
async function searchDuckDuckGo(
  queryText: string,
  maxResults: number
): Promise<SearchResponse> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(queryText)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ColoBot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo search failed: ${response.status}`);
    }

    const html = await response.text();
    const results = parseDuckDuckGoResults(html, maxResults);

    return {
      query: queryText,
      results,
      answers: [],
      suggestions: [],
      numberOfResults: results.length,
    };
  } catch (e) {
    console.error('[Search] DuckDuckGo Error:', e);
    return { query: queryText, results: [], answers: [], suggestions: [], numberOfResults: 0 };
  }
}

/**
 * 解析 DuckDuckGo 结果
 */
function parseDuckDuckGoResults(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];
  const regex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  let match;

  while ((match = regex.exec(html)) !== null && results.length < maxResults) {
    let url = match[1];
    const title = match[2].trim();

    // DuckDuckGo 使用重定向 URL
    if (url.startsWith('//duckduckgo.com/l/?uddg=')) {
      url = decodeURIComponent(url.replace('//duckduckgo.com/l/?uddg=', '').split('&')[0]);
    }

    results.push({
      url,
      title,
      content: '',
      engine: 'duckduckgo',
      category: 'general',
    });
  }

  return results;
}

/**
 * Google 搜索 (需要 API Key)
 */
async function searchGoogle(
  queryText: string,
  maxResults: number
): Promise<SearchResponse> {
  if (!searchConfig.apiKey || !searchConfig.cx) {
    console.error('[Search] Google requires apiKey and cx');
    return { query: queryText, results: [], answers: [], suggestions: [], numberOfResults: 0 };
  }

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${searchConfig.apiKey}&cx=${searchConfig.cx}&q=${encodeURIComponent(queryText)}&num=${maxResults}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google search failed: ${response.status}`);
    }

    const data = await response.json() as { items?: Array<{ link: string; title: string; snippet: string }> };

    const results: SearchResult[] = (data.items || []).map(item => ({
      url: item.link,
      title: item.title,
      content: item.snippet || '',
      engine: 'google',
      category: 'general',
    }));

    return {
      query: queryText,
      results,
      answers: [],
      suggestions: [],
      numberOfResults: results.length,
    };
  } catch (e) {
    console.error('[Search] Google Error:', e);
    return { query: queryText, results: [], answers: [], suggestions: [], numberOfResults: 0 };
  }
}

/**
 * Bing 搜索 (需要 API Key)
 */
async function searchBing(
  queryText: string,
  maxResults: number
): Promise<SearchResponse> {
  if (!searchConfig.apiKey) {
    console.error('[Search] Bing requires apiKey');
    return { query: queryText, results: [], answers: [], suggestions: [], numberOfResults: 0 };
  }

  try {
    const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(queryText)}&count=${maxResults}`;
    const response = await fetch(url, {
      headers: {
        'Ocp-Apim-Subscription-Key': searchConfig.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Bing search failed: ${response.status}`);
    }

    const data = await response.json() as {
      webPages?: { value: Array<{ url: string; name: string; snippet: string }> }
    };

    const results: SearchResult[] = (data.webPages?.value || []).map(item => ({
      url: item.url,
      title: item.name,
      content: item.snippet || '',
      engine: 'bing',
      category: 'general',
    }));

    return {
      query: queryText,
      results,
      answers: [],
      suggestions: [],
      numberOfResults: results.length,
    };
  } catch (e) {
    console.error('[Search] Bing Error:', e);
    return { query: queryText, results: [], answers: [], suggestions: [], numberOfResults: 0 };
  }
}

/**
 * 图片搜索
 */
export async function imageSearch(queryText: string, options: SearchOptions = {}): Promise<SearchResponse> {
  return search(queryText, { ...options, categories: ['images'] });
}

/**
 * 视频搜索
 */
export async function videoSearch(queryText: string, options: SearchOptions = {}): Promise<SearchResponse> {
  return search(queryText, { ...options, categories: ['videos'] });
}

/**
 * 新闻搜索
 */
export async function newsSearch(queryText: string, options: SearchOptions = {}): Promise<SearchResponse> {
  return search(queryText, { ...options, categories: ['news'] });
}

/**
 * 多模态搜索
 */
export async function multimodalSearch(
  queryText: string,
  options: SearchOptions = {}
): Promise<{ text: SearchResponse; images: SearchResponse }> {
  const [text, images] = await Promise.all([
    search(queryText, options),
    imageSearch(queryText, options),
  ]);
  return { text, images };
}

/**
 * 学术文献搜索
 */
export async function academicSearch(
  queryText: string,
  options: SearchOptions = {}
): Promise<SearchResponse & { papers: AcademicPaper[] }> {
  try {
    const result = await search(queryText, {
      ...options,
      engines: ['google scholar', 'arxiv', 'pubmed', 'semantic scholar'],
    });

    const papers: AcademicPaper[] = result.results.map(r => ({
      title: r.title,
      url: r.url,
      abstract: r.content,
      source: r.engine,
      publishedDate: r.publishedDate,
    }));

    return { ...result, papers };
  } catch (e) {
    console.error('[AcademicSearch] Error:', e);
    return {
      query: queryText,
      results: [],
      answers: [],
      suggestions: [],
      numberOfResults: 0,
      papers: [],
    };
  }
}
