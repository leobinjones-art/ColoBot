/**
 * 知识库工具
 */
import { registerTool } from './executor.js';
import { addKnowledge, searchKnowledge, listKnowledge } from '../../services/knowledge.js';

export function registerTools(): void {
  registerTool('add_knowledge', async (args) => {
    const { category, name, content, variables, related } = args as {
      category: string;
      name: string;
      content: string;
      variables?: string[];
      related?: string[];
    };
    if (!['concept', 'template', 'rule'].includes(category)) {
      throw new Error('category must be concept, template, or rule');
    }
    const entry = await addKnowledge({
      category: category as 'concept' | 'template' | 'rule',
      name,
      content,
      variables,
      related,
    });
    return { ok: true, id: entry.id, name: entry.name, category: entry.category };
  });

  registerTool('search_knowledge', async (args) => {
    const { query: queryText, category } = args as {
      query: string;
      category?: string;
    };
    const results = await searchKnowledge(queryText, category as any);
    return {
      count: results.length,
      entries: results.map(e => ({
        category: e.category,
        name: e.name,
        content: e.content,
        variables: e.variables,
        related: e.related,
      })),
    };
  });

  registerTool('list_knowledge', async (args) => {
    const { category } = args as { category?: string };
    const entries = await listKnowledge(category as any);
    return {
      count: entries.length,
      entries: entries.map(e => ({
        category: e.category,
        name: e.name,
        content: e.content,
        variables: e.variables,
        related: e.related,
      })),
    };
  });
}
