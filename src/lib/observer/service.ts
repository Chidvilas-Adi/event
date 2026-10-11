import { pool, withTransaction } from '@/lib/db';
import crypto from 'crypto';

export interface FounderEvidence {
  id: string;
  participant_id: string;
  participant_name?: string;
  company_id?: string | null;
  company_name?: string | null;
  observer_id: string;
  trait_category: 'stress_leadership' | 'negotiation_integrity' | 'capital_discipline' | 'crisis_resilience' | 'team_cohesion' | 'commercial_velocity';
  rating: 'exemplary' | 'prudent' | 'neutral' | 'concerning' | 'adversarial';
  notes: string;
  incident_citation?: string | null;
  evidence_timestamp: string;
}

export class ObserverEvidenceService {
  /**
   * Log qualitative founder behavioural evidence (Observer & GM only)
   */
  static async recordEvidence(opts: {
    participantId: string;
    companyId?: string | null;
    observerId: string;
    traitCategory: FounderEvidence['trait_category'];
    rating: FounderEvidence['rating'];
    notes: string;
    incidentCitation?: string;
  }): Promise<FounderEvidence> {
    if (!opts.notes || opts.notes.trim().length === 0) {
      throw new Error('Qualitative notes are required for founder evidence.');
    }

    return await withTransaction(async (client) => {
      const evidenceId = `evid_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

      // Resolve company if not provided
      let companyId = opts.companyId;
      if (!companyId) {
        const memRes = await client.query(
          "SELECT company_id FROM memberships WHERE participant_id = $1 AND status = 'active' LIMIT 1",
          [opts.participantId]
        );
        companyId = memRes.rows[0]?.company_id || null;
      }

      await client.query(
        `INSERT INTO founder_evidence (
          id, participant_id, company_id, observer_id, trait_category, rating, notes, incident_citation, evidence_timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          evidenceId,
          opts.participantId,
          companyId,
          opts.observerId,
          opts.traitCategory,
          opts.rating || 'neutral',
          opts.notes.trim(),
          opts.incidentCitation?.trim() || null,
        ]
      );

      // Audit log
      const auditId = `aud_evid_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
         VALUES ($1, NOW(), $2, 'observer', 'FOUNDER_EVIDENCE_RECORDED', 'founder_evidence', $3, $4, 'observer_console')`,
        [auditId, opts.observerId, evidenceId, `Logged ${opts.rating} observation for ${opts.participantId}`]
      );

      const res = await client.query(
        `SELECT fe.*, p.name as participant_name, c.name as company_name
         FROM founder_evidence fe
         JOIN participants p ON fe.participant_id = p.id
         LEFT JOIN companies c ON fe.company_id = c.id
         WHERE fe.id = $1`,
        [evidenceId]
      );

      return res.rows[0];
    });
  }

  /**
   * List evidence records filtered by company or participant
   */
  static async listEvidence(filters: {
    companyId?: string;
    participantId?: string;
    traitCategory?: string;
  } = {}): Promise<FounderEvidence[]> {
    let query = `
      SELECT fe.*, p.name as participant_name, c.name as company_name
      FROM founder_evidence fe
      JOIN participants p ON fe.participant_id = p.id
      LEFT JOIN companies c ON fe.company_id = c.id
    `;
    const where: string[] = [];
    const params: any[] = [];

    if (filters.companyId) {
      params.push(filters.companyId);
      where.push(`fe.company_id = $${params.length}`);
    }
    if (filters.participantId) {
      params.push(filters.participantId);
      where.push(`fe.participant_id = $${params.length}`);
    }
    if (filters.traitCategory) {
      params.push(filters.traitCategory);
      where.push(`fe.trait_category = $${params.length}`);
    }

    if (where.length > 0) {
      query += ` WHERE ${where.join(' AND ')}`;
    }

    query += ' ORDER BY fe.evidence_timestamp DESC';

    const res = await pool.query(query, params);
    return res.rows;
  }
}
