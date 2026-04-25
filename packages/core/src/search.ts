/**
 * SearXNG 搜索集成
 */

export interface SearchOptions {
  language?: string;
  safe_search?: 0 | 1 | 2;
  time_range?: string;
  categories?: string[];
  engines?: string[];
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

let baseUrl = 'http://127.0.0.1:8080';

/**
 * 配置搜索服务
 */
export function configureSearch(url: string): void {
  baseUrl = url;
}

/**
 * 执行搜索
 */
export async function search(
  queryText: string,
  options: SearchOptions = {}
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
      results: data.results,
      answers: data.answers,
      suggestions: data.suggestions,
      numberOfResults: data.number_of_results,
    };
  } catch (e) {
    console.error('[Search] Error:', e);
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
