/**
 * Soul Evolution 模块测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

// Mock agent registry
vi.mock('../agents/registry.js', () => ({
  agentRegistry: {
    updateSoul: vi.fn(async () => {}),
  },
}));

import { query, queryOne } from '../memory/db.js';
import { agentRegistry } from '../agents/registry.js';
import {
  proposeSoulUpdate,
  applySoulProposal,
  listSoulProposals,
} from '../agent-runtime/evolution.js';

describe('Soul Evolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('proposeSoulUpdate', () => {
    it('should create a soul proposal', async () => {
      const result = await proposeSoulUpdate(
        'agent-1',
        '+ Added new skill: code review',
        'Updated soul content...',
        'Learned new capability from conversation'
      );

      expect(result.id).toBeDefined();
      expect(query).toHaveBeenCalled();
    });

    it('should create approval request for the proposal', async () => {
      await proposeSoulUpdate(
        'agent-1',
        '+ Added skill',
        'New soul',
        'Reason'
      );

      // Should have called query twice (proposal + approval)
      expect(query).toHaveBeenCalledTimes(2);
    });
  });

  describe('applySoulProposal', () => {
    it('should apply approved proposal', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'proposal-1',
        agent_id: 'agent-1',
        proposed_soul: 'Updated soul content',
      });

      await applySoulProposal('proposal-1', 'user-1');

      expect(agentRegistry.updateSoul).toHaveBeenCalledWith('agent-1', 'Updated soul content');
      expect(query).toHaveBeenCalled();
    });

    it('should throw if proposal not found', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(null);

      await expect(applySoulProposal('non-existent', 'user-1')).rejects.toThrow('Soul proposal not found');
    });
  });

  describe('listSoulProposals', () => {
    it('should list all proposals', async () => {
      vi.mocked(query).mockResolvedValueOnce([
        { id: 'p1', agent_id: 'a1', soul_diff: 'diff', proposed_soul: 'soul', reason: 'r', status: 'pending', created_at: new Date(), decided_at: null, approver: null },
        { id: 'p2', agent_id: 'a1', soul_diff: 'diff2', proposed_soul: 'soul2', reason: 'r2', status: 'applied', created_at: new Date(), decided_at: new Date(), approver: 'user-1' },
      ]);

      const proposals = await listSoulProposals();

      expect(proposals).toHaveLength(2);
    });

    it('should filter by agent_id', async () => {
      await listSoulProposals('agent-1');

      const call = vi.mocked(query).mock.calls[0];
      expect(call[0]).toContain('agent_id = $');
      expect(call[1]).toContain('agent-1');
    });

    it('should filter by status', async () => {
      await listSoulProposals(undefined, 'pending');

      const call = vi.mocked(query).mock.calls[0];
      expect(call[0]).toContain('status = $');
      expect(call[1]).toContain('pending');
    });
  });
});
