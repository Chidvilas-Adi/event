import { pool, withTransaction } from '@/lib/db';
import { eventBus } from '@/lib/events/bus';
import { LedgerService } from '@/lib/ledger/service';
import crypto from 'crypto';

export interface LifecycleEvent {
  id: string;
  company_id: string;
  event_type: 'status_change' | 'merger' | 'acquisition' | 'spinout' | 'liquidation';
  from_status: string | null;
  to_status: string | null;
  counterparty_company_id: string | null;
  actor_id: string;
  details: any;
  reason: string;
  created_at: string;
}

export class CompanyLifecycleService {
  /**
   * Change company operational status (operating, growth, distressed, failed, etc.)
   */
  static async changeStatus(opts: {
    companyId: string;
    newStatus: 'operating' | 'growth' | 'distressed' | 'failed' | 'acquired' | 'merged' | 'spun_out';
    reason: string;
    actorId: string;
    actorRole: string;
  }) {
    if (opts.actorRole !== 'gm' && opts.actorRole !== 'admin') {
      throw new Error('FORBIDDEN: Only Game Master or Tech Admin can directly alter company lifecycle status.');
    }

    return await withTransaction(async (client) => {
      const compRes = await client.query('SELECT * FROM companies WHERE id = $1 FOR UPDATE', [opts.companyId]);
      if (compRes.rows.length === 0) {
        throw new Error('Company not found.');
      }
      const prev = compRes.rows[0];

      await client.query('UPDATE companies SET status = $1 WHERE id = $2', [opts.newStatus, opts.companyId]);

      const eventId = `clife_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await client.query(
        `INSERT INTO company_lifecycle_events (
          id, company_id, event_type, from_status, to_status, counterparty_company_id, actor_id, details, reason
        ) VALUES ($1, $2, 'status_change', $3, $4, NULL, $5, $6, $7)`,
        [
          eventId,
          opts.companyId,
          prev.status,
          opts.newStatus,
          opts.actorId,
          JSON.stringify({ previous: prev.status, updated: opts.newStatus }),
          opts.reason,
        ]
      );

      // Audit log
      const auditId = `aud_clife_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
         VALUES ($1, NOW(), $2, $3, 'COMPANY_STATUS_TRANSITION', 'companies', $4, $5, 'lifecycle_service')`,
        [auditId, opts.actorId, opts.actorRole, opts.companyId, `Transitioned from ${prev.status} to ${opts.newStatus}: ${opts.reason}`]
      );

      eventBus.broadcast('company_status_changed', { companyId: opts.companyId, fromStatus: prev.status, toStatus: opts.newStatus });

      return { success: true, companyId: opts.companyId, fromStatus: prev.status, toStatus: opts.newStatus };
    });
  }

  /**
   * Execute M&A (Acquisition or Merger):
   * Acquirer absorbs Target company: treasury vault and resources consolidated,
   * employees reassigned, target status updated to 'acquired'.
   */
  static async executeMerger(opts: {
    acquirerId: string;
    targetId: string;
    purchasePriceVb?: number;
    terms?: any;
    reason: string;
    actorId: string;
    actorRole: string;
  }) {
    if (opts.acquirerId === opts.targetId) {
      throw new Error('A company cannot merge with itself.');
    }

    return await withTransaction(async (client) => {
      // 1. Fetch and lock both companies
      const acqRes = await client.query('SELECT * FROM companies WHERE id = $1 FOR UPDATE', [opts.acquirerId]);
      const tgtRes = await client.query('SELECT * FROM companies WHERE id = $1 FOR UPDATE', [opts.targetId]);

      if (acqRes.rows.length === 0) throw new Error(`Acquiring company "${opts.acquirerId}" not found.`);
      if (tgtRes.rows.length === 0) throw new Error(`Target company "${opts.targetId}" not found.`);

      const acquirer = acqRes.rows[0];
      const target = tgtRes.rows[0];

      if (target.status === 'acquired' || target.status === 'failed') {
        throw new Error(`Target company is already in "${target.status}" status.`);
      }

      const purchasePrice = opts.purchasePriceVb || 0;

      // 2. Pay purchase price from Acquirer to Target if specified
      if (purchasePrice > 0) {
        const acqBal = await LedgerService.getBalance('company', opts.acquirerId);
        if (acqBal < purchasePrice) {
          throw new Error(`Acquiring company has insufficient funds (${acqBal} VB vs ${purchasePrice} VB required).`);
        }
        const payEntryId = `led_ma_pay_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        await client.query(
          `INSERT INTO ledger_entries (
            id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
          ) VALUES ($1, NOW(), 'company', $2, 'company', $3, $4, 'MERGER_ACQUISITION_PAYMENT', $5, $6)`,
          [payEntryId, opts.acquirerId, opts.targetId, purchasePrice, `Acquisition purchase consideration for ${target.name}`, opts.actorId]
        );
      }

      // 3. Consolidate Target's remaining treasury vault into Acquirer
      const balRes = await client.query(
        `SELECT COALESCE(SUM(
          CASE
            WHEN to_type = 'company' AND to_id = $1 THEN amount
            WHEN from_type = 'company' AND from_id = $1 THEN -amount
            ELSE 0
          END
        ), 0) as balance FROM ledger_entries`,
        [opts.targetId]
      );
      const targetBalance = parseInt(balRes.rows[0].balance, 10) || 0;

      if (targetBalance > 0) {
        const consolEntryId = `led_ma_con_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        await client.query(
          `INSERT INTO ledger_entries (
            id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
          ) VALUES ($1, NOW(), 'company', $2, 'company', $3, $4, 'MERGER_VAULT_CONSOLIDATION', $5, $6)`,
          [consolEntryId, opts.targetId, opts.acquirerId, targetBalance, `Consolidation of treasury reserves upon M&A absorption by ${acquirer.name}`, opts.actorId]
        );
      }

      // 4. Consolidate Target's resource inventory
      const resTotals = await client.query(`
        SELECT resource_id, SUM(quantity) as net_qty
        FROM resource_ledger
        WHERE owner_type = 'company' AND owner_id = $1
        GROUP BY resource_id
        HAVING SUM(quantity) > 0
      `, [opts.targetId]);

      for (const r of resTotals.rows) {
        const qty = parseInt(r.net_qty, 10);
        if (qty > 0) {
          const resOutId = `res_ma_out_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
          const resInId = `res_ma_in_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;

          await client.query(
            `INSERT INTO resource_ledger (id, timestamp, resource_id, owner_type, owner_id, quantity, reason, authoriser)
             VALUES ($1, NOW(), $2, 'company', $3, $4, $5, $6)`,
            [resOutId, r.resource_id, opts.targetId, -qty, `M&A inventory surrender to ${acquirer.name}`, opts.actorId]
          );

          await client.query(
            `INSERT INTO resource_ledger (id, timestamp, resource_id, owner_type, owner_id, quantity, reason, authoriser)
             VALUES ($1, NOW(), $2, 'company', $3, $4, $5, $6)`,
            [resInId, r.resource_id, opts.acquirerId, qty, `M&A inventory absorption from ${target.name}`, opts.actorId]
          );
        }
      }

      // 5. Transfer Target's active employees to Acquirer
      await client.query(
        `UPDATE memberships SET company_id = $1 WHERE company_id = $2 AND status = 'active'`,
        [opts.acquirerId, opts.targetId]
      );

      // 6. Update Target company status to 'acquired'
      await client.query(`UPDATE companies SET status = 'acquired' WHERE id = $1`, [opts.targetId]);

      // 7. Record lifecycle event
      const eventId = `clife_ma_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await client.query(
        `INSERT INTO company_lifecycle_events (
          id, company_id, event_type, from_status, to_status, counterparty_company_id, actor_id, details, reason
        ) VALUES ($1, $2, 'acquisition', $3, 'acquired', $4, $5, $6, $7)`,
        [
          eventId,
          opts.targetId,
          target.status,
          opts.acquirerId,
          opts.actorId,
          JSON.stringify({ purchasePrice, consolidatedVb: targetBalance, terms: opts.terms }),
          opts.reason,
        ]
      );

      // 8. Audit log
      const auditId = `aud_ma_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
         VALUES ($1, NOW(), $2, $3, 'COMPANY_MERGER_ACQUISITION_EXECUTED', 'companies', $4, $5, 'lifecycle_service')`,
        [auditId, opts.actorId, opts.actorRole, opts.targetId, `Acquired by ${acquirer.name} (${opts.acquirerId}): ${opts.reason}`]
      );

      eventBus.broadcast('company_merged', {
        acquirerId: opts.acquirerId,
        targetId: opts.targetId,
        purchasePrice,
        consolidatedVb: targetBalance,
      });

      return {
        success: true,
        acquirerId: opts.acquirerId,
        targetId: opts.targetId,
        consolidatedVb: targetBalance,
        purchasePrice,
      };
    });
  }

  /**
   * Execute Spin-Out (Incorporating a new venture from a parent company):
   * Allocates seed capital, sets up initial cap table, creates company record.
   */
  static async executeSpinout(opts: {
    parentCompanyId: string;
    founderParticipantId: string;
    newCompanyName: string;
    tagline?: string;
    description?: string;
    startingCapitalVb: number;
    equityTerms?: { parentPercent: number; founderPercent: number };
    actorId: string;
    actorRole: string;
  }) {
    if (!opts.newCompanyName || opts.newCompanyName.trim().length === 0) {
      throw new Error('New company name is required.');
    }
    if (opts.startingCapitalVb < 1000) {
      throw new Error('Minimum spin-out seed capital stake is 1,000 VB.');
    }

    return await withTransaction(async (client) => {
      // 1. Verify parent company balance
      const parentBal = await LedgerService.getBalance('company', opts.parentCompanyId);
      if (parentBal < opts.startingCapitalVb) {
        throw new Error(`Parent company has insufficient capital (${parentBal} VB vs ${opts.startingCapitalVb} VB required).`);
      }

      // 2. Create new company
      const newCompId = `comp_spin_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO companies (id, name, tagline, description, status, tier, is_hidden)
         VALUES ($1, $2, $3, $4, 'operating', 1, FALSE)`,
        [
          newCompId,
          opts.newCompanyName,
          opts.tagline || 'Spun out venture',
          opts.description || `Spun out division of parent company ${opts.parentCompanyId}`,
        ]
      );

      // 3. Transfer seed capital
      const seedEntryId = `led_spin_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await client.query(
        `INSERT INTO ledger_entries (
          id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
        ) VALUES ($1, NOW(), 'company', $2, 'company', $3, $4, 'SPINOUT_SEED_CAPITAL', $5, $6)`,
        [seedEntryId, opts.parentCompanyId, newCompId, opts.startingCapitalVb, `Seed capital allocation for spin-out venture ${opts.newCompanyName}`, opts.actorId]
      );

      // 4. Create initial Cap Table
      const parentEquity = opts.equityTerms?.parentPercent || 25.0;
      const founderEquity = opts.equityTerms?.founderPercent || 75.0;

      const capParentId = `cap_p_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      const capFounderId = `cap_f_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;

      await client.query(
        `INSERT INTO cap_table (id, company_id, shareholder_type, shareholder_id, shares_or_percent, rights)
         VALUES ($1, $2, 'company', $3, $4, '{"parent_incubator": true}')`,
        [capParentId, newCompId, opts.parentCompanyId, parentEquity]
      );

      await client.query(
        `INSERT INTO cap_table (id, company_id, shareholder_type, shareholder_id, shares_or_percent, rights)
         VALUES ($1, $2, 'participant', $3, $4, '{"founding_common": true}')`,
        [capFounderId, newCompId, opts.founderParticipantId, founderEquity]
      );

      // 5. Assign founder membership
      const membId = `memb_spin_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO memberships (id, participant_id, company_id, role, status)
         VALUES ($1, $2, $3, 'founder', 'active')`,
        [membId, opts.founderParticipantId, newCompId]
      );

      // 6. Record lifecycle event
      const eventId = `clife_spin_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await client.query(
        `INSERT INTO company_lifecycle_events (
          id, company_id, event_type, from_status, to_status, counterparty_company_id, actor_id, details, reason
        ) VALUES ($1, $2, 'spinout', NULL, 'operating', $3, $4, $5, $6)`,
        [
          eventId,
          newCompId,
          opts.parentCompanyId,
          opts.actorId,
          JSON.stringify({ parentEquity, founderEquity, seedCapital: opts.startingCapitalVb }),
          `Spin-out incorporation from ${opts.parentCompanyId}`,
        ]
      );

      // 7. Audit log
      const auditId = `aud_spin_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
         VALUES ($1, NOW(), $2, $3, 'COMPANY_SPINOUT_INCORPORATED', 'companies', $4, $5, 'lifecycle_service')`,
        [auditId, opts.actorId, opts.actorRole, newCompId, `Spun out from ${opts.parentCompanyId} with ${opts.startingCapitalVb} VB`]
      );

      eventBus.broadcast('company_spun_out', {
        newCompanyId: newCompId,
        newCompanyName: opts.newCompanyName,
        parentCompanyId: opts.parentCompanyId,
        startingCapitalVb: opts.startingCapitalVb,
      });

      return {
        success: true,
        newCompanyId: newCompId,
        newCompanyName: opts.newCompanyName,
        startingCapitalVb: opts.startingCapitalVb,
      };
    });
  }

  /**
   * Execute Liquidation / Bankruptcy failure:
   * Company status set to 'failed' (never deleted; history is kept),
   * open pending deals canceled, remaining resources surrendered.
   */
  static async executeLiquidation(opts: {
    companyId: string;
    reason: string;
    actorId: string;
    actorRole: string;
  }) {
    if (opts.actorRole !== 'gm' && opts.actorRole !== 'admin') {
      throw new Error('FORBIDDEN: Only Game Master or Tech Admin can enforce company insolvency liquidation.');
    }

    return await withTransaction(async (client) => {
      const compRes = await client.query('SELECT * FROM companies WHERE id = $1 FOR UPDATE', [opts.companyId]);
      if (compRes.rows.length === 0) throw new Error('Company not found.');
      const comp = compRes.rows[0];

      // 1. Update company status to 'failed' (Failure is a state change, never a deletion!)
      await client.query(`UPDATE companies SET status = 'failed' WHERE id = $1`, [opts.companyId]);

      // 2. Cancel open deals
      await client.query(
        `UPDATE deals SET status = 'cancelled', rejection_reason = 'Company entered insolvency liquidation'
         WHERE (sender_id = $1 OR recipient_id = $1) AND status IN ('pending', 'draft')`,
        [opts.companyId]
      );

      // 3. Mark outstanding loans in default
      await client.query(
        `UPDATE loans SET status = 'defaulted' WHERE company_id = $1 AND status = 'active'`,
        [opts.companyId]
      );

      // 4. Record lifecycle event
      const eventId = `clife_liq_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await client.query(
        `INSERT INTO company_lifecycle_events (
          id, company_id, event_type, from_status, to_status, counterparty_company_id, actor_id, details, reason
        ) VALUES ($1, $2, 'liquidation', $3, 'failed', NULL, $4, $5, $6)`,
        [eventId, opts.companyId, comp.status, opts.actorId, JSON.stringify({ liquidatedAt: new Date() }), opts.reason]
      );

      // 5. Audit log
      const auditId = `aud_liq_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
         VALUES ($1, NOW(), $2, $3, 'COMPANY_INSOLVENCY_LIQUIDATED', 'companies', $4, $5, 'lifecycle_service')`,
        [auditId, opts.actorId, opts.actorRole, opts.companyId, `Liquidated: ${opts.reason}`]
      );

      eventBus.broadcast('company_liquidated', { companyId: opts.companyId, reason: opts.reason });

      return { success: true, companyId: opts.companyId, newStatus: 'failed' };
    });
  }

  /**
   * Get lifecycle history
   */
  static async getHistory(companyId?: string) {
    let query = `
      SELECT cle.*, c.name as company_name, cp.name as counterparty_name
      FROM company_lifecycle_events cle
      JOIN companies c ON cle.company_id = c.id
      LEFT JOIN companies cp ON cle.counterparty_company_id = cp.id
    `;
    const params: any[] = [];
    if (companyId) {
      query += ' WHERE cle.company_id = $1';
      params.push(companyId);
    }
    query += ' ORDER BY cle.created_at DESC';
    const res = await pool.query(query, params);
    return res.rows;
  }
}
