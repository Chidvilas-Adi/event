import { pool, withTransaction } from '@/lib/db';
import { eventBus } from '@/lib/events/bus';
import { LedgerService } from '@/lib/ledger/service';
import crypto from 'crypto';

export interface Dispute {
  id: string;
  deal_id: string | null;
  claimant_type: 'participant' | 'company';
  claimant_id: string;
  respondent_type: 'participant' | 'company';
  respondent_id: string;
  amount_vb: number;
  reason: string;
  evidence: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  ruling: 'claimant_upheld' | 'claimant_dismissed' | 'compromise' | null;
  awarded_vb: number;
  ruling_notes: string | null;
  ruled_by: string | null;
  created_at: string;
  resolved_at: string | null;
  claimant_name?: string;
  respondent_name?: string;
}

export class DisputesService {
  /**
   * File a new commercial dispute
   */
  static async fileDispute(opts: {
    dealId?: string | null;
    claimantType: 'participant' | 'company';
    claimantId: string;
    respondentType: 'participant' | 'company';
    respondentId: string;
    amountVb: number;
    reason: string;
    evidence?: string;
    actorId: string;
  }): Promise<Dispute> {
    if (!opts.reason || opts.reason.trim().length === 0) {
      throw new Error('Dispute reason is required.');
    }
    if (opts.amountVb < 0) {
      throw new Error('Dispute amount cannot be negative.');
    }

    return await withTransaction(async (client) => {
      const disputeId = `disp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

      await client.query(
        `INSERT INTO disputes (
          id, deal_id, claimant_type, claimant_id, respondent_type, respondent_id,
          amount_vb, reason, evidence, status, ruling, awarded_vb, ruling_notes, ruled_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open', NULL, 0, NULL, NULL)`,
        [
          disputeId,
          opts.dealId || null,
          opts.claimantType,
          opts.claimantId,
          opts.respondentType,
          opts.respondentId,
          opts.amountVb,
          opts.reason,
          opts.evidence || null,
        ]
      );

      // Audit log
      const auditId = `aud_disp_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
         VALUES ($1, NOW(), $2, 'participant', 'COMMERCIAL_DISPUTE_FILED', 'disputes', $3, $4, 'disputes_service')`,
        [auditId, opts.actorId, disputeId, opts.reason]
      );

      eventBus.broadcast('dispute_filed', { disputeId, claimantId: opts.claimantId, respondentId: opts.respondentId, amountVb: opts.amountVb });

      const res = await client.query('SELECT * FROM disputes WHERE id = $1', [disputeId]);
      return res.rows[0];
    });
  }

  /**
   * List disputes with optional filtering
   */
  static async listDisputes(filters?: {
    status?: string;
    claimantId?: string;
    respondentId?: string;
  }): Promise<Dispute[]> {
    let query = `
      SELECT d.*,
        CASE
          WHEN d.claimant_type = 'company' THEN (SELECT name FROM companies WHERE id = d.claimant_id)
          ELSE (SELECT name FROM participants WHERE id = d.claimant_id)
        END as claimant_name,
        CASE
          WHEN d.respondent_type = 'company' THEN (SELECT name FROM companies WHERE id = d.respondent_id)
          ELSE (SELECT name FROM participants WHERE id = d.respondent_id)
        END as respondent_name
      FROM disputes d
    `;

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (filters?.status) {
      params.push(filters.status);
      whereClauses.push(`d.status = $${params.length}`);
    }

    if (filters?.claimantId) {
      params.push(filters.claimantId);
      whereClauses.push(`d.claimant_id = $${params.length}`);
    }

    if (filters?.respondentId) {
      params.push(filters.respondentId);
      whereClauses.push(`d.respondent_id = $${params.length}`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ' ORDER BY d.created_at DESC';

    const res = await pool.query(query, params);
    return res.rows;
  }

  /**
   * Get dispute by ID
   */
  static async getDisputeById(id: string): Promise<Dispute | null> {
    const res = await pool.query(
      `SELECT d.*,
        CASE
          WHEN d.claimant_type = 'company' THEN (SELECT name FROM companies WHERE id = d.claimant_id)
          ELSE (SELECT name FROM participants WHERE id = d.claimant_id)
        END as claimant_name,
        CASE
          WHEN d.respondent_type = 'company' THEN (SELECT name FROM companies WHERE id = d.respondent_id)
          ELSE (SELECT name FROM participants WHERE id = d.respondent_id)
        END as respondent_name
      FROM disputes d
      WHERE d.id = $1`,
      [id]
    );

    return res.rows[0] || null;
  }

  /**
   * Arbitrate and rule on a dispute (GM / Tech Admin only)
   */
  static async ruleDispute(opts: {
    disputeId: string;
    ruling: 'claimant_upheld' | 'claimant_dismissed' | 'compromise';
    awardedVb?: number;
    rulingNotes: string;
    actorId: string;
    actorRole: string;
  }) {
    if (opts.actorRole !== 'gm' && opts.actorRole !== 'admin') {
      throw new Error('FORBIDDEN: Only Game Master or Tech Admin can issue binding arbitration rulings.');
    }
    if (!opts.rulingNotes || opts.rulingNotes.trim().length === 0) {
      throw new Error('A written rationale is required for arbitration rulings.');
    }

    return await withTransaction(async (client) => {
      const dispRes = await client.query('SELECT * FROM disputes WHERE id = $1 FOR UPDATE', [opts.disputeId]);
      if (dispRes.rows.length === 0) {
        throw new Error('Dispute not found.');
      }
      const dispute = dispRes.rows[0];

      if (dispute.status !== 'open') {
        throw new Error(`Dispute is already resolved (status: ${dispute.status}).`);
      }

      let awardedVb = 0;
      if (opts.ruling === 'claimant_upheld') {
        awardedVb = opts.awardedVb !== undefined ? opts.awardedVb : dispute.amount_vb;
      } else if (opts.ruling === 'compromise') {
        awardedVb = opts.awardedVb !== undefined ? opts.awardedVb : Math.round(dispute.amount_vb / 2);
      } else {
        awardedVb = 0;
      }

      // If funds are awarded, execute append-only compensatory ledger transfer
      if (awardedVb > 0) {
        const respBalance = await LedgerService.getBalance(dispute.respondent_type, dispute.respondent_id);
        const entryId = `led_disp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

        if (respBalance >= awardedVb) {
          // Standard compensatory transfer from respondent
          await client.query(
            `INSERT INTO ledger_entries (
              id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
            ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, 'DISPUTE_ARBITRATION_AWARD', $7, $8)`,
            [
              entryId,
              dispute.respondent_type,
              dispute.respondent_id,
              dispute.claimant_type,
              dispute.claimant_id,
              awardedVb,
              `Arbitration Award: ${opts.rulingNotes} (Dispute #${dispute.id})`,
              opts.actorId,
            ]
          );
        } else {
          // Insolvent or distressed respondent: transfer available balance, remainder from city settlement reserve
          const payableFromResp = Math.max(0, respBalance);
          const deficit = awardedVb - payableFromResp;

          if (payableFromResp > 0) {
            await client.query(
              `INSERT INTO ledger_entries (
                id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
              ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, 'DISPUTE_ARBITRATION_AWARD', $7, $8)`,
              [
                entryId,
                dispute.respondent_type,
                dispute.respondent_id,
                dispute.claimant_type,
                dispute.claimant_id,
                payableFromResp,
                `Arbitration Award (Liquidation Share): ${opts.rulingNotes}`,
                opts.actorId,
              ]
            );
          }

          if (deficit > 0) {
            const bailEntryId = `led_disp_bail_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
            await client.query(
              `INSERT INTO ledger_entries (
                id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
              ) VALUES ($1, NOW(), 'system', 'city_reserve', $2, $3, $4, 'DISPUTE_ARBITRATION_AWARD', $5, $6)`,
              [
                bailEntryId,
                dispute.claimant_type,
                dispute.claimant_id,
                deficit,
                `Arbitration Settlement Reserve Indemnity: ${opts.rulingNotes}`,
                opts.actorId,
              ]
            );
          }
        }
      }

      // Update dispute record
      const finalStatus = opts.ruling === 'claimant_dismissed' ? 'dismissed' : 'resolved';
      await client.query(
        `UPDATE disputes SET
          status = $1,
          ruling = $2,
          awarded_vb = $3,
          ruling_notes = $4,
          ruled_by = $5,
          resolved_at = NOW()
        WHERE id = $6`,
        [
          finalStatus,
          opts.ruling,
          awardedVb,
          opts.rulingNotes,
          opts.actorId,
          opts.disputeId,
        ]
      );

      // Audit log
      const auditId = `aud_disp_rule_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
         VALUES ($1, NOW(), $2, $3, 'DISPUTE_ARBITRATION_RULED', 'disputes', $4, $5, 'arbitration_console')`,
        [
          auditId,
          opts.actorId,
          opts.actorRole,
          opts.disputeId,
          `Ruling: ${opts.ruling}, Awarded: ${awardedVb} VB. Notes: ${opts.rulingNotes}`,
        ]
      );

      eventBus.broadcast('dispute_resolved', {
        disputeId: opts.disputeId,
        ruling: opts.ruling,
        awardedVb,
        ruledBy: opts.actorId,
      });

      return {
        success: true,
        disputeId: opts.disputeId,
        ruling: opts.ruling,
        awardedVb,
        status: finalStatus,
      };
    });
  }
}
