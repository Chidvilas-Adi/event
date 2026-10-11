import { pool, withTransaction } from '@/lib/db';
import { eventBus } from '@/lib/events/bus';
import { LedgerService } from '@/lib/ledger/service';
import crypto from 'crypto';

export interface CrisisPath {
  id: string;
  title: string;
  description: string;
  cost_vb: number;
  cost_resources?: Record<string, number>;
  effect: string;
  unlocks_opportunity_id?: string | null;
}

export interface Crisis {
  id: string;
  title: string;
  description: string;
  response_paths: CrisisPath[];
  hidden_opportunity?: any;
  deadline: string | null;
  status: 'inactive' | 'active' | 'resolved' | 'expired';
  triggered_at: string | null;
}

export class CrisesService {
  /**
   * List all crises with optional status filter
   */
  static async listCrises(status?: string): Promise<Crisis[]> {
    let query = 'SELECT * FROM crises';
    const params: any[] = [];
    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }
    query += ' ORDER BY triggered_at DESC NULLS LAST, id ASC';

    const res = await pool.query(query, params);
    return res.rows.map(r => ({
      ...r,
      response_paths: typeof r.response_paths === 'string' ? JSON.parse(r.response_paths) : r.response_paths,
      hidden_opportunity: typeof r.hidden_opportunity === 'string' ? JSON.parse(r.hidden_opportunity) : r.hidden_opportunity,
    }));
  }

  /**
   * Get an individual crisis by ID
   */
  static async getCrisisById(id: string): Promise<Crisis | null> {
    const res = await pool.query('SELECT * FROM crises WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      ...r,
      response_paths: typeof r.response_paths === 'string' ? JSON.parse(r.response_paths) : r.response_paths,
      hidden_opportunity: typeof r.hidden_opportunity === 'string' ? JSON.parse(r.hidden_opportunity) : r.hidden_opportunity,
    };
  }

  /**
   * Trigger a crisis (GM only)
   */
  static async triggerCrisis(opts: {
    crisisId: string;
    durationMinutes?: number;
    actorId: string;
    customParams?: {
      title?: string;
      description?: string;
      response_paths?: CrisisPath[];
      hidden_opportunity?: any;
    };
  }) {
    return await withTransaction(async (client) => {
      let crisis = await this.getCrisisById(opts.crisisId);
      const duration = opts.durationMinutes || 30;
      const deadline = new Date(Date.now() + duration * 60 * 1000);

      if (!crisis) {
        if (!opts.customParams?.title || !opts.customParams?.description) {
          throw new Error('Crisis not found and no custom definition provided.');
        }
        await client.query(
          `INSERT INTO crises (
            id, title, description, response_paths, hidden_opportunity, deadline, status, triggered_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())`,
          [
            opts.crisisId,
            opts.customParams.title,
            opts.customParams.description,
            JSON.stringify(opts.customParams.response_paths || []),
            opts.customParams.hidden_opportunity ? JSON.stringify(opts.customParams.hidden_opportunity) : null,
            deadline,
          ]
        );
      } else {
        await client.query(
          `UPDATE crises SET
            status = 'active',
            deadline = $1,
            triggered_at = NOW()
          WHERE id = $2`,
          [deadline, opts.crisisId]
        );
      }

      crisis = await this.getCrisisById(opts.crisisId);

      // Publish urgent announcement
      const annId = `ann_crisis_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      const annMsg = `🚨 CRITICAL DISTURBANCE: [${crisis?.title.toUpperCase()}] ${crisis?.description} (Resolution window: ${duration} mins)`;
      await client.query(
        `INSERT INTO announcements (id, audience, target_id, message, priority, author_id)
         VALUES ($1, 'all', NULL, $2, 'critical', $3)`,
        [annId, annMsg, opts.actorId]
      );

      // Audit log
      const auditId = `aud_crisis_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
         VALUES ($1, NOW(), $2, 'gm', 'CRISIS_TRIGGERED', 'crises', $3, $4, 'gm_crisis_engine')`,
        [auditId, opts.actorId, opts.crisisId, `Activated crisis with ${duration}m deadline`]
      );

      eventBus.broadcast('crisis_triggered', { crisisId: opts.crisisId, crisis, deadline });
      return { success: true, crisis, deadline };
    });
  }

  /**
   * Respond to a crisis with a selected response path (Company Lead)
   */
  static async respondToCrisis(opts: {
    crisisId: string;
    companyId: string;
    pathId: string;
    actorId: string;
  }) {
    return await withTransaction(async (client) => {
      // 1. Fetch crisis & lock
      const crisisRes = await client.query('SELECT * FROM crises WHERE id = $1 FOR UPDATE', [opts.crisisId]);
      if (crisisRes.rows.length === 0) {
        throw new Error('Crisis not found.');
      }
      const crisisRow = crisisRes.rows[0];
      if (crisisRow.status !== 'active') {
        throw new Error(`Crisis is not active (current status: ${crisisRow.status}).`);
      }
      if (crisisRow.deadline && new Date() > new Date(crisisRow.deadline)) {
        throw new Error('Crisis resolution deadline has expired.');
      }

      // 2. Check if already responded
      const existRes = await client.query(
        'SELECT id FROM crisis_responses WHERE crisis_id = $1 AND company_id = $2',
        [opts.crisisId, opts.companyId]
      );
      if (existRes.rows.length > 0) {
        throw new Error('Company has already committed to a response path for this crisis.');
      }

      // 3. Locate path
      const paths: CrisisPath[] = typeof crisisRow.response_paths === 'string'
        ? JSON.parse(crisisRow.response_paths)
        : crisisRow.response_paths;
      const path = paths.find(p => p.id === opts.pathId);
      if (!path) {
        throw new Error(`Selected response path "${opts.pathId}" does not exist for this crisis.`);
      }

      // 4. Validate and debit VB costs
      if (path.cost_vb > 0) {
        const balance = await LedgerService.getBalance('company', opts.companyId);
        if (balance < path.cost_vb) {
          throw new Error(`Insufficient treasury balance: company has ${balance} VB, requires ${path.cost_vb} VB.`);
        }

        const entryId = `led_crisis_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        await client.query(
          `INSERT INTO ledger_entries (
            id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
          ) VALUES ($1, NOW(), 'company', $2, 'system', 'city_reserve', $3, 'CRISIS_RESPONSE_FEE', $4, $5)`,
          [
            entryId,
            opts.companyId,
            path.cost_vb,
            `Crisis Mitigation: ${crisisRow.title} -> ${path.title}`,
            opts.actorId,
          ]
        );
      }

      // 5. Validate and debit resource costs
      if (path.cost_resources && Object.keys(path.cost_resources).length > 0) {
        for (const [resId, qty] of Object.entries(path.cost_resources)) {
          if (qty > 0) {
            const resEntryId = `res_crisis_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
            await client.query(
              `INSERT INTO resource_ledger (
                id, timestamp, resource_id, owner_type, owner_id, quantity, committed_quantity, reason, authoriser
              ) VALUES ($1, NOW(), $2, 'company', $3, $4, 0, $5, $6)`,
              [
                resEntryId,
                resId,
                opts.companyId,
                -qty, // deduction
                `Crisis Mitigation Resource Consumption: ${path.title}`,
                opts.actorId,
              ]
            );
          }
        }
      }

      // 6. Handle unlocked hidden opportunity
      let unlockedOppId = path.unlocks_opportunity_id || null;
      if (unlockedOppId && crisisRow.hidden_opportunity) {
        const hiddenOpp = typeof crisisRow.hidden_opportunity === 'string'
          ? JSON.parse(crisisRow.hidden_opportunity)
          : crisisRow.hidden_opportunity;
        
        if (hiddenOpp && hiddenOpp.id === unlockedOppId) {
          // Insert opportunity into table if not already present
          const checkOpp = await client.query('SELECT id FROM opportunities WHERE id = $1', [unlockedOppId]);
          if (checkOpp.rows.length === 0) {
            await client.query(
              `INSERT INTO opportunities (
                id, title, description, type, budget_vb, company_id, institution_id, claimant_id, visibility, terms, status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'public', $9, 'open')`,
              [
                hiddenOpp.id,
                hiddenOpp.title,
                hiddenOpp.description,
                hiddenOpp.type || 'enterprise_rfp',
                hiddenOpp.budget_vb || 2000,
                opts.companyId,
                null,
                opts.actorId,
                JSON.stringify(hiddenOpp.terms || {}),
              ]
            );
          }
        }
      }

      // 7. Record response in crisis_responses
      const respId = `cresp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await client.query(
        `INSERT INTO crisis_responses (
          id, crisis_id, company_id, selected_path_id, path_title, cost_vb_paid,
          resources_deducted, actor_id, unlocked_opportunity_id, status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'executed', $10)`,
        [
          respId,
          opts.crisisId,
          opts.companyId,
          path.id,
          path.title,
          path.cost_vb,
          JSON.stringify(path.cost_resources || {}),
          opts.actorId,
          unlockedOppId,
          `Consequence: ${path.effect}`,
        ]
      );

      // 8. Audit log
      const auditId = `aud_cresp_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
         VALUES ($1, NOW(), $2, 'company_lead', 'CRISIS_RESPONSE_COMMITTED', 'crisis_responses', $3, $4, 'crisis_engine')`,
        [auditId, opts.actorId, respId, `Chose path: ${path.title} for crisis ${crisisRow.title}`]
      );

      eventBus.broadcast('crisis_response_submitted', {
        crisisId: opts.crisisId,
        companyId: opts.companyId,
        path,
        respId,
      });

      return {
        success: true,
        responseId: respId,
        pathTitle: path.title,
        costVbPaid: path.cost_vb,
        effect: path.effect,
        unlockedOpportunityId: unlockedOppId,
      };
    });
  }

  /**
   * Get all responses for a crisis
   */
  static async getResponses(crisisId?: string) {
    let query = `
      SELECT cr.*, c.name as company_name
      FROM crisis_responses cr
      JOIN companies c ON cr.company_id = c.id
    `;
    const params: any[] = [];
    if (crisisId) {
      query += ' WHERE cr.crisis_id = $1';
      params.push(crisisId);
    }
    query += ' ORDER BY cr.responded_at DESC';
    const res = await pool.query(query, params);
    return res.rows;
  }

  /**
   * Resolve a crisis (GM only)
   */
  static async resolveCrisis(crisisId: string, actorId: string, notes?: string) {
    return await withTransaction(async (client) => {
      await client.query(
        `UPDATE crises SET status = 'resolved' WHERE id = $1`,
        [crisisId]
      );

      const auditId = `aud_cres_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
         VALUES ($1, NOW(), $2, 'gm', 'CRISIS_RESOLVED', 'crises', $3, $4, 'gm_crisis_engine')`,
        [auditId, actorId, crisisId, notes || 'Crisis marked resolved by GM']
      );

      eventBus.broadcast('crisis_resolved', { crisisId, notes });
      return { success: true };
    });
  }
}
