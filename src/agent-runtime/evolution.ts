/**
 * Soul 自进化 - Agent 灵魂自我更新
 */

import { query, queryOne } from '../memory/db.js';
import { agentRegistry } from '../agents/registry.js';

interface SoulProposal {
  id: string;
  agent_id: string;
  soul_diff: string;
  proposed_soul: string;
  reason: string;
  status: string;
  created_at: Date;
  decided_at: Date | null;
  approver: string | null;
}

/**
 * 提案 Soul 更新
 */
export async function proposeSoulUpdate(
  agentId: string,
  soulDiff: string,
  proposedSoul: string,
  reason: string
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO soul_proposals (id, agent_id, soul_diff, proposed_soul, reason, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')`,
    [id, agentId, soulDiff, proposedSoul, reason]
  );

  // 创建审批请求
  await query(
    `INSERT INTO approval_requests
      (agent_id, requester, action_type, target_resource, description, payload, status, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)`,
    [
      agentId,
      'system',
      'update',
      `soul_update:${id}`,
      reason,
      JSON.stringify({ proposal_id: id, soul_diff: soulDiff }),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ]
  );

  return { id };
}

/**
 * 应用审批通过的 Soul 更新
 */
export async function applySoulProposal(proposalId: string, approver: string): Promise<void> {
  const proposal = await queryOne<{
    id: string;
    agent_id: string;
    proposed_soul: string;
  }>('SELECT * FROM soul_proposals WHERE id = $1', [proposalId]);

  if (!proposal) throw new Error(`Soul proposal not found: ${proposalId}`);

  // 更新 agent soul_content
  await agentRegistry.updateSoul(proposal.agent_id, proposal.proposed_soul);

  // 更新 proposal 状态
  await query(
    `UPDATE soul_proposals SET status = 'applied', decided_at = NOW(), approver = $1 WHERE id = $2`,
    [approver, proposalId]
  );

  console.log(`[SoulEvolution] Applied proposal ${proposalId} to agent ${proposal.agent_id}`);
}

/**
 * 列出 Soul 提案
 */
export async function listSoulProposals(agentId?: string, status?: string): Promise<SoulProposal[]> {
  let sql = 'SELECT * FROM soul_proposals WHERE 1=1';
  const params: unknown[] = [];
  let i = 1;

  if (agentId) {
    sql += ` AND agent_id = $${i++}`;
    params.push(agentId);
  }
  if (status) {
    sql += ` AND status = $${i++}`;
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';

  return query<SoulProposal>(sql, params);
}
