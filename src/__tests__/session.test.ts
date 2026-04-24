/**
 * Session Manager 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

import { query, queryOne } from '../memory/db.js';
import { sessionManager } from '../agents/session.js';

describe('Session Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('should return null if session not found', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(null);

      const session = await sessionManager.get('agent-1', 'session-1');

      expect(session).toBeNull();
    });

    it('should return session if found', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'session-id',
        agent_id: 'agent-1',
        session_key: 'session-1',
        context: { history: [] },
        created_at: new Date(),
        updated_at: new Date(),
      });

      const session = await sessionManager.get('agent-1', 'session-1');

      expect(session).not.toBeNull();
      expect(session?.agent_id).toBe('agent-1');
    });

    it('should parse JSON context', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'session-id',
        agent_id: 'agent-1',
        session_key: 'session-1',
        context: '{"history":[]}',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const session = await sessionManager.get('agent-1', 'session-1');

      expect(session?.context).toEqual({ history: [] });
    });
  });

  describe('getOrCreate', () => {
    it('should create session if not exists', async () => {
      vi.mocked(queryOne)
        .mockResolvedValueOnce(null) // First get returns null
        .mockResolvedValueOnce({    // Second get returns created session
          id: 'new-session-id',
          agent_id: 'agent-1',
          session_key: 'session-1',
          context: {},
          created_at: new Date(),
          updated_at: new Date(),
        });

      const session = await sessionManager.getOrCreate('agent-1', 'session-1');

      expect(session.id).toBe('new-session-id');
      expect(query).toHaveBeenCalled(); // Insert was called
    });

    it('should return existing session', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'existing-session',
        agent_id: 'agent-1',
        session_key: 'session-1',
        context: {},
        created_at: new Date(),
        updated_at: new Date(),
      });

      const session = await sessionManager.getOrCreate('agent-1', 'session-1');

      expect(session.id).toBe('existing-session');
    });
  });

  describe('updateContext', () => {
    it('should update session context', async () => {
      await sessionManager.updateContext('agent-1', 'session-1', { key: 'value' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agent_sessions'),
        expect.arrayContaining(['agent-1', 'session-1'])
      );
    });
  });

  describe('appendMessage', () => {
    it('should append message to history', async () => {
      vi.mocked(queryOne)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'session-id',
          agent_id: 'agent-1',
          session_key: 'session-1',
          context: {},
          created_at: new Date(),
          updated_at: new Date(),
        });

      await sessionManager.appendMessage('agent-1', 'session-1', 'user', 'Hello');

      expect(query).toHaveBeenCalled();
    });

    it('should trim history to 20 items', async () => {
      const history = Array(25).fill({ role: 'user', content: 'test' });
      vi.mocked(queryOne)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'session-id',
          agent_id: 'agent-1',
          session_key: 'session-1',
          context: { history },
          created_at: new Date(),
          updated_at: new Date(),
        });

      await sessionManager.appendMessage('agent-1', 'session-1', 'user', 'New message');

      // Should have called update with trimmed history
      expect(query).toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('should return empty array if no session', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(null);

      const history = await sessionManager.getHistory('agent-1', 'session-1');

      expect(history).toEqual([]);
    });

    it('should return history from session', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'session-id',
        agent_id: 'agent-1',
        session_key: 'session-1',
        context: { history: [{ role: 'user', content: 'Hello' }] },
        created_at: new Date(),
        updated_at: new Date(),
      });

      const history = await sessionManager.getHistory('agent-1', 'session-1');

      expect(history).toHaveLength(1);
      expect(history[0].role).toBe('user');
    });
  });
});
