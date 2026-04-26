import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteStore } from '../adapters/sqlite-store.js';
import { existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('SQLiteStore', () => {
  let store: SQLiteStore;
  const dbPath = join(tmpdir(), `colobot-test-${Date.now()}.db`);

  beforeEach(() => {
    store = new SQLiteStore({ path: dbPath });
  });

  afterEach(() => {
    store.close();
    if (existsSync(dbPath)) {
      rmSync(dbPath);
    }
  });

  it('should create database file', () => {
    expect(existsSync(dbPath)).toBe(true);
  });

  it('should append and get history', async () => {
    await store.append('agent1', 'session1', 'user', 'Hello');
    await store.append('agent1', 'session1', 'assistant', 'Hi there!');

    const history = await store.getHistory('agent1', 'session1');
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(history[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
  });

  it('should clear history', async () => {
    await store.append('agent1', 'session1', 'user', 'Hello');
    await store.clear('agent1', 'session1');

    const history = await store.getHistory('agent1', 'session1');
    expect(history).toHaveLength(0);
  });

  it('should separate sessions', async () => {
    await store.append('agent1', 'session1', 'user', 'Hello 1');
    await store.append('agent1', 'session2', 'user', 'Hello 2');

    const history1 = await store.getHistory('agent1', 'session1');
    const history2 = await store.getHistory('agent1', 'session2');

    expect(history1).toHaveLength(1);
    expect(history1[0].content).toBe('Hello 1');
    expect(history2).toHaveLength(1);
    expect(history2[0].content).toBe('Hello 2');
  });

  it('should add and search memory', async () => {
    await store.addMemory('agent1', 'Python is a programming language');
    await store.addMemory('agent1', 'JavaScript is also a programming language');
    await store.addMemory('agent1', 'Apples are fruits');

    const results = await store.searchMemory('agent1', 'programming');
    expect(results.length).toBe(2);
  });

  it('should handle JSON content', async () => {
    const jsonContent = { text: 'Hello', metadata: { count: 1 } };
    await store.append('agent1', 'session1', 'user', jsonContent);

    const history = await store.getHistory('agent1', 'session1');
    expect(history[0].content).toBe(JSON.stringify(jsonContent));
  });
});
