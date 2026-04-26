/**
 * 网络搜索工具
 */

import type { ToolContext } from '@colobot/types';
import { toolRegistry } from './registry.js';
import { search, imageSearch, videoSearch, academicSearch } from '../search.js';

async function webSearch(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const { query, max_results } = args as { query: string; max_results?: number };
  if (!query) throw new Error('query is required');

  const response = await search(query, { maxResults: max_results || 10 });
  const results = response.results.map(r => ({
    title: r.title,
    url: r.url,
    snippet: r.content.slice(0, 200),
  }));
  return JSON.stringify(results, null, 2);
}

async function imageSearchTool(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const { query, max_results } = args as { query: string; max_results?: number };
  if (!query) throw new Error('query is required');

  const response = await imageSearch(query, { maxResults: max_results || 10 });
  return JSON.stringify(response.results, null, 2);
}

async function videoSearchTool(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const { query, max_results } = args as { query: string; max_results?: number };
  if (!query) throw new Error('query is required');

  const response = await videoSearch(query, { maxResults: max_results || 10 });
  return JSON.stringify(response.results, null, 2);
}

async function academicSearchTool(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const { query, max_results } = args as { query: string; max_results?: number };
  if (!query) throw new Error('query is required');

  const response = await academicSearch(query, { maxResults: max_results || 10 });
  return JSON.stringify(response.results, null, 2);
}

async function getTime(_args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  return new Date().toISOString();
}

export function registerSearchTools(): void {
  toolRegistry.register({
    name: 'web_search',
    description: 'Search the web for information',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        max_results: { type: 'number', description: 'Maximum number of results (default: 10)' },
      },
      required: ['query'],
    },
    execute: webSearch,
  });

  toolRegistry.register({
    name: 'image_search',
    description: 'Search for images on the web',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        max_results: { type: 'number', description: 'Maximum number of results' },
      },
      required: ['query'],
    },
    execute: imageSearchTool,
  });

  toolRegistry.register({
    name: 'video_search',
    description: 'Search for videos on the web',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        max_results: { type: 'number', description: 'Maximum number of results' },
      },
      required: ['query'],
    },
    execute: videoSearchTool,
  });

  toolRegistry.register({
    name: 'academic_search',
    description: 'Search for academic papers and scholarly articles',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        max_results: { type: 'number', description: 'Maximum number of results' },
      },
      required: ['query'],
    },
    execute: academicSearchTool,
  });

  toolRegistry.register({
    name: 'get_time',
    description: 'Get current date and time in ISO format',
    parameters: { type: 'object', properties: {} },
    execute: getTime,
  });
}
