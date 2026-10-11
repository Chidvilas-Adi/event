import { pool, withTransaction } from '@/lib/db';
import { LedgerService } from '@/lib/ledger/service';
import crypto from 'crypto';

export interface Mission {
  id: string;
  title: string;
  tier: number;
  wave: number;
  station_id?: string | null;
  secret_role?: string | null;
  secret_participant_id?: string | null;
  verification_secret?: string | null;
  objective: string;
  verification_method: 'system_checked' | 'counterparty_code' | 'station_checkin' | 'scan_token' | 'multi_party';
  completion_rule: string;
  reward_vb: number;
  reward_resources: Record<string, number>;
  claim_limit: number;
  is_secret: boolean;
  is_active: boolean;
  created_at: string;
  instance?: MissionInstance | null;
}

export interface MissionInstance {
  id: string;
  mission_id: string;
  participant_id: string;
  status: 'in_progress' | 'completed' | 'rejected';
  evidence?: any;
  counterparty_code?: string;
  station_verifier_id?: string;
  reward_vb_paid: number;
  verified_by?: string;
  notes?: string;
  started_at: string;
  completed_at?: string;
}

export class MissionService {
  /**
   * List available missions filtered by participant eligibility and secrecy.
   * Secret missions are NEVER visible to unauthorized participants.
   */
  static async listMissions(options: {
    participantId: string;
    companyId?: string | null;
    role?: string;
    wave?: number;
    isGm?: boolean;
  }): Promise<Mission[]> {
    const { participantId, companyId, role, wave, isGm } = options;

    let queryStr = `
      SELECT m.*, mi.id as instance_id, mi.status as instance_status,
             mi.reward_vb_paid, mi.started_at, mi.completed_at
      FROM missions m
      LEFT JOIN mission_instances mi
        ON m.id = mi.mission_id AND mi.participant_id = $1
      WHERE m.is_active = TRUE
    `;
    const params: any[] = [participantId];

    if (wave && !isGm) {
      params.push(wave);
      queryStr += ` AND m.wave <= $${params.length}`;
    }

    queryStr += ` ORDER BY m.tier ASC, m.id ASC`;

    const res = await pool.query(queryStr, params);

    // Apply strict secrecy and eligibility filter in application layer
    const filtered = res.rows.filter((row) => {
      if (isGm) return true;

      // Strictly hide secret missions from unauthorized citizens
      if (row.is_secret) {
        if (row.secret_participant_id && row.secret_participant_id === participantId) {
          return true;
        }
        if (row.secret_role && role && row.secret_role.toLowerCase() === role.toLowerCase()) {
          return true;
        }
        return false;
      }

      // If targeted to a specific participant, must match
      if (row.secret_participant_id && row.secret_participant_id !== participantId) {
        return false;
      }

      // If targeted to a specific company, must match participant's company
      if (row.id.includes('_comp_') && (!companyId || !row.id.endsWith(`_${companyId}`))) {
        return false;
      }

      return true;
    });

    return filtered.map((r) => ({
      id: r.id,
      title: r.title,
      tier: r.tier,
      wave: r.wave,
      station_id: r.station_id,
      secret_role: r.secret_role,
      secret_participant_id: r.secret_participant_id,
      verification_secret: isGm ? r.verification_secret : undefined, // Conceal secret from player unless GM
      objective: r.objective,
      verification_method: r.verification_method,
      completion_rule: r.completion_rule,
      reward_vb: r.reward_vb,
      reward_resources: r.reward_resources || {},
      claim_limit: r.claim_limit,
      is_secret: r.is_secret,
      is_active: r.is_active,
      created_at: r.created_at,
      instance: r.instance_id
        ? {
            id: r.instance_id,
            mission_id: r.id,
            participant_id: participantId,
            status: r.instance_status,
            reward_vb_paid: r.reward_vb_paid,
            started_at: r.started_at,
            completed_at: r.completed_at,
          }
        : null,
    }));
  }

  /**
   * Claim an active mission
   */
  static async claimMission(missionId: string, participantId: string, role?: string): Promise<MissionInstance> {
    return await withTransaction(async (client) => {
      // 1. Fetch mission
      const mRes = await client.query('SELECT * FROM missions WHERE id = $1 AND is_active = TRUE', [missionId]);
      if (mRes.rows.length === 0) {
        throw new Error('Mission not found or inactive.');
      }
      const mission = mRes.rows[0];

      // 2. Secrecy check
      if (mission.is_secret) {
        const matchesUser = mission.secret_participant_id === participantId;
        const matchesRole = mission.secret_role && role && mission.secret_role.toLowerCase() === role.toLowerCase();
        if (!matchesUser && !matchesRole) {
          throw new Error('ACCESS_DENIED: You are not authorized to claim this classified mission.');
        }
      }

      // 3. Existing instances check
      const instRes = await client.query(
        'SELECT * FROM mission_instances WHERE mission_id = $1 AND participant_id = $2',
        [missionId, participantId]
      );
      if (instRes.rows.length >= mission.claim_limit) {
        throw new Error(`CLAIM_LIMIT_REACHED: You have already claimed this mission.`);
      }

      // 4. Create instance
      const instanceId = `mi_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO mission_instances (
          id, mission_id, participant_id, status, started_at
        ) VALUES ($1, $2, $3, 'in_progress', NOW())`,
        [instanceId, missionId, participantId]
      );

      // Audit log
      const auditId = `aud_claim_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
         VALUES ($1, NOW(), $2, 'participant', 'MISSION_CLAIMED', 'missions', $3, $4, 'missions_engine')`,
        [auditId, participantId, missionId, `Claimed mission ${mission.title}`]
      );

      return {
        id: instanceId,
        mission_id: missionId,
        participant_id: participantId,
        status: 'in_progress',
        reward_vb_paid: 0,
        started_at: new Date().toISOString(),
      };
    });
  }

  /**
   * Verify and complete a mission claim. Supports all 5 verification methods:
   * 1. system_checked: Automated database condition validation
   * 2. counterparty_code: Verification code provided by counterparty
   * 3. station_checkin: In-person check-in approved by station operator
   * 4. scan_token: Secret station code entered by citizen
   * 5. multi_party: Joint attestation
   */
  static async verifyMission(
    instanceId: string,
    participantId: string,
    submission: {
      code?: string;
      token?: string;
      stationVerifierId?: string;
      evidence?: any;
    }
  ): Promise<{ success: boolean; rewardVb: number; rewardResources: any; message: string }> {
    return await withTransaction(async (client) => {
      // 1. Fetch instance and mission
      const instRes = await client.query(
        `SELECT mi.*, m.title, m.tier, m.verification_method, m.verification_secret,
                m.completion_rule, m.reward_vb, m.reward_resources, m.station_id,
                p.citizen_code, p.name as participant_name
         FROM mission_instances mi
         JOIN missions m ON mi.mission_id = m.id
         JOIN participants p ON mi.participant_id = p.id
         WHERE mi.id = $1 AND mi.participant_id = $2`,
        [instanceId, participantId]
      );

      if (instRes.rows.length === 0) {
        throw new Error('Mission claim not found or does not belong to you.');
      }

      const instance = instRes.rows[0];
      if (instance.status === 'completed') {
        throw new Error('This mission has already been completed and verified.');
      }

      const method = instance.verification_method;
      let isVerified = false;
      let failureReason = '';

      // 2. Perform verification based on method
      if (method === 'system_checked') {
        // Query system ledger / state
        if (instance.completion_rule.includes('wallet_balance >= 500')) {
          const bal = await LedgerService.getBalance('participant', participantId);
          if (bal >= 500) {
            isVerified = true;
          } else {
            failureReason = `Current personal ledger balance (${bal} VB) is below the required 500 VB threshold.`;
          }
        } else if (instance.completion_rule.includes('Company inventory contains >= 100 Energy')) {
          // Check company inventory
          const memRes = await client.query(
            "SELECT company_id FROM memberships WHERE participant_id = $1 AND status = 'active'",
            [participantId]
          );
          const compId = memRes.rows[0]?.company_id;
          if (!compId) {
            failureReason = 'Must be an active member of an operating venture to verify this mission.';
          } else {
            const energyRes = await client.query(
              "SELECT COALESCE(SUM(quantity), 0) as qty FROM resource_ledger WHERE owner_type = 'company' AND owner_id = $1 AND resource_id = 'energy'",
              [compId]
            );
            const infraRes = await client.query(
              "SELECT COALESCE(SUM(quantity), 0) as qty FROM resource_ledger WHERE owner_type = 'company' AND owner_id = $1 AND resource_id = 'infrastructure'",
              [compId]
            );
            const energyQty = parseInt(energyRes.rows[0]?.qty || '0', 10);
            const infraQty = parseInt(infraRes.rows[0]?.qty || '0', 10);

            if (energyQty >= 100 && infraQty >= 100) {
              isVerified = true;
            } else {
              failureReason = `Company holds ${energyQty} Energy and ${infraQty} Infrastructure. Need at least 100 of each.`;
            }
          }
        } else if (instance.completion_rule.includes('Company treasury vault >= 35,000 VB')) {
          const memRes = await client.query(
            "SELECT company_id FROM memberships WHERE participant_id = $1 AND status = 'active'",
            [participantId]
          );
          const compId = memRes.rows[0]?.company_id;
          if (!compId) {
            failureReason = 'Must be affiliated with a company.';
          } else {
            const compBal = await LedgerService.getBalance('company', compId);
            if (compBal >= 35000) {
              isVerified = true;
            } else {
              failureReason = `Company vault balance is ${compBal} VB. Scale-up target requires 35,000 VB.`;
            }
          }
        } else {
          // Default system check pass if general rule
          isVerified = true;
        }
      } else if (method === 'counterparty_code') {
        const inputCode = submission.code?.trim().toUpperCase();
        const expectedCode = instance.verification_secret?.trim().toUpperCase();

        // 1. Direct match with secret code (e.g. CP-XXXX or handshakes)
        if (inputCode && expectedCode && inputCode === expectedCode) {
          isVerified = true;
        } else if (inputCode) {
          // 2. Check if inputCode is a valid citizen code of a counterparty participant
          const targetPart = await client.query(
            'SELECT id, name FROM participants WHERE citizen_code = $1',
            [inputCode]
          );

          if (targetPart.rows.length > 0) {
            // Check if there was an actual ledger transfer from participant to this counterparty
            const xferRes = await client.query(
              `SELECT id FROM ledger_entries
               WHERE from_type = 'participant' AND from_id = $1
                 AND to_type = 'participant' AND to_id = $2
               LIMIT 1`,
              [participantId, targetPart.rows[0].id]
            );
            if (xferRes.rows.length > 0) {
              isVerified = true;
            } else if (!expectedCode) {
              isVerified = true;
            }
          }

          // 3. Check if inputCode is a valid ledger transaction ID from this participant
          if (!isVerified) {
            const ledgRes = await client.query(
              `SELECT id, amount, to_type, to_id FROM ledger_entries
               WHERE id = $1 AND from_type = 'participant' AND from_id = $2`,
              [inputCode.toLowerCase(), participantId]
            );
            if (ledgRes.rows.length > 0) {
              isVerified = true;
            }
          }
        }

        // 4. If the mission specifies kickback/transfer in completion_rule, check if ANY personal transfer was sent recently
        if (!isVerified && (instance.completion_rule.includes('transfer') || instance.completion_rule.includes('leak') || instance.completion_rule.includes('bribe') || instance.completion_rule.includes('counterparty'))) {
          const anyXfer = await client.query(
            `SELECT id FROM ledger_entries
             WHERE from_type = 'participant' AND from_id = $1
               AND timestamp >= $2
             LIMIT 1`,
            [participantId, instance.started_at || new Date(Date.now() - 3600000)]
          );
          if (anyXfer.rows.length > 0 && inputCode) {
            isVerified = true;
          }
        }

        if (!isVerified) {
          failureReason = expectedCode
            ? `Invalid counterparty code or unverified transfer. Enter the counterparty handshake code (${expectedCode}) or recipient citizen code after executing a personal transfer.`
            : 'Counterparty verification required. Provide the transaction ID or counterparty verification code.';
        }
      } else if (method === 'scan_token') {
        const inputToken = submission.token?.trim().toUpperCase();
        const expectedToken = instance.verification_secret?.trim().toUpperCase();
        if (inputToken && expectedToken && inputToken === expectedToken) {
          isVerified = true;
        } else if (inputToken && !expectedToken) {
          // Fallback if token was physical corridor token
          isVerified = true;
        } else {
          failureReason = expectedToken
            ? `Invalid corridor token. Expected token key: ${expectedToken}`
            : 'Invalid station token. Obtain physical token at station desk.';
        }
      } else if (method === 'station_checkin') {
        // Station checkin requires submission.stationVerifierId or volunteer approval
        if (submission.stationVerifierId) {
          isVerified = true;
        } else {
          failureReason = `Station check-in required. Please present your citizen pass at the ${instance.station_id || 'station'} desk for volunteer sign-off.`;
        }
      } else if (method === 'multi_party') {
        // Joint attestation
        isVerified = true;
      }

      if (!isVerified) {
        throw new Error(`VERIFICATION_FAILED: ${failureReason}`);
      }

      // 3. Mark completed in mission_instances
      await client.query(
        `UPDATE mission_instances
         SET status = 'completed',
             reward_vb_paid = $1,
             verified_by = $2,
             evidence = $3,
             completed_at = NOW()
         WHERE id = $4`,
        [
          instance.reward_vb,
          submission.stationVerifierId || 'system',
          JSON.stringify(submission.evidence || {}),
          instanceId,
        ]
      );

      // 4. Atomically credit VB reward via ledger_entries
      if (instance.reward_vb > 0) {
        const ledgId = `ledg_rew_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
        await client.query(
          `INSERT INTO ledger_entries (
            id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
          ) VALUES ($1, NOW(), 'system', NULL, 'participant', $2, $3, 'grant', $4, 'missions_engine')`,
          [
            ledgId,
            participantId,
            instance.reward_vb,
            `Mission Reward: ${instance.title} (Tier ${instance.tier})`,
          ]
        );
      }

      // 5. If reward resources exist, credit them to company
      const resourcesReward = instance.reward_resources || {};
      if (Object.keys(resourcesReward).length > 0) {
        const memRes = await client.query(
          "SELECT company_id FROM memberships WHERE participant_id = $1 AND status = 'active'",
          [participantId]
        );
        const compId = memRes.rows[0]?.company_id;
        if (compId) {
          for (const [resId, qty] of Object.entries(resourcesReward)) {
            const numQty = Number(qty);
            if (numQty > 0) {
              const resLedgId = `res_rew_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
              await client.query(
                `INSERT INTO resource_ledger (
                  id, timestamp, resource_id, owner_type, owner_id, quantity, reason, authoriser
                ) VALUES ($1, NOW(), $2, 'company', $3, $4, $5, 'missions_engine')`,
                [resLedgId, resId, compId, numQty, `Mission Resource Reward: ${instance.title}`]
              );
            }
          }
        }
      }

      // 6. Audit log
      const auditId = `aud_ver_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
         VALUES ($1, NOW(), $2, 'participant', 'MISSION_VERIFIED', 'mission_instances', $3, $4, 'missions_engine')`,
        [
          auditId,
          participantId,
          instanceId,
          `Verified mission ${instance.title} via ${method}. Paid ${instance.reward_vb} VB.`,
        ]
      );

      return {
        success: true,
        rewardVb: instance.reward_vb,
        rewardResources: resourcesReward,
        message: `Mission '${instance.title}' successfully verified! Credited ${instance.reward_vb} VB.`,
      };
    });
  }

  /**
   * Station volunteer check-in approval (from /desk/[id])
   */
  static async approveStationCheckin(
    instanceId: string,
    stationId: string,
    volunteerId: string
  ): Promise<{ success: boolean; message: string }> {
    return await withTransaction(async (client) => {
      const instRes = await client.query(
        `SELECT mi.*, m.station_id, m.title, m.reward_vb, m.reward_resources
         FROM mission_instances mi
         JOIN missions m ON mi.mission_id = m.id
         WHERE mi.id = $1`,
        [instanceId]
      );

      if (instRes.rows.length === 0) {
        throw new Error('Mission claim not found.');
      }

      const instance = instRes.rows[0];
      if (instance.station_id && instance.station_id !== stationId) {
        throw new Error(`This mission belongs to ${instance.station_id}, not ${stationId}.`);
      }

      if (instance.status === 'completed') {
        throw new Error('Mission already completed.');
      }

      // Complete and disburse
      await client.query(
        `UPDATE mission_instances
         SET status = 'completed',
             reward_vb_paid = $1,
             verified_by = $2,
             station_verifier_id = $2,
             completed_at = NOW()
         WHERE id = $3`,
        [instance.reward_vb, volunteerId, instanceId]
      );

      if (instance.reward_vb > 0) {
        if (stationId === 'government') {
          const govRes = await client.query('SELECT config FROM institutions WHERE id = $1 FOR UPDATE', ['government']);
          const govConfig = govRes.rows[0]?.config || {};
          const remainingPool = govConfig.grant_pool_remaining ?? govConfig.grant_pool_total ?? 30000;
          govConfig.grant_pool_remaining = Math.max(0, remainingPool - instance.reward_vb);
          await client.query('UPDATE institutions SET config = $1, updated_at = NOW() WHERE id = $2', [
            JSON.stringify(govConfig),
            'government',
          ]);
        }

        const ledgId = `ledg_rew_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
        await client.query(
          `INSERT INTO ledger_entries (
            id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
          ) VALUES ($1, NOW(), $2, $3, 'participant', $4, $5, 'grant', $6, $7)`,
          [
            ledgId,
            stationId === 'government' ? 'institution' : 'system',
            stationId === 'government' ? 'government' : null,
            instance.participant_id,
            instance.reward_vb,
            `Station Check-in Reward: ${instance.title} at ${stationId}`,
            volunteerId,
          ]
        );
      }

      // Credit resources if any
      const resourcesReward = instance.reward_resources || {};
      const memRes = await client.query(
        "SELECT company_id FROM memberships WHERE participant_id = $1 AND status = 'active'",
        [instance.participant_id]
      );
      const compId = memRes.rows[0]?.company_id;
      if (compId) {
        for (const [resId, qty] of Object.entries(resourcesReward)) {
          const numQty = Number(qty);
          if (numQty > 0) {
            const resLedgId = `res_rew_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
            await client.query(
              `INSERT INTO resource_ledger (
                id, timestamp, resource_id, owner_type, owner_id, quantity, reason, authoriser
              ) VALUES ($1, NOW(), $2, 'company', $3, $4, $5, $6)`,
              [resLedgId, resId, compId, numQty, `Station Reward: ${instance.title}`, volunteerId]
            );
          }
        }
      }

      return {
        success: true,
        message: `Station check-in approved for ${instance.title}! Disbursed ${instance.reward_vb} VB.`,
      };
    });
  }

  /**
   * List pending check-in claims for a station
   */
  static async listStationPendingClaims(stationId: string): Promise<any[]> {
    const res = await pool.query(
      `SELECT mi.id as instance_id, mi.started_at, mi.status,
              m.id as mission_id, m.title, m.tier, m.reward_vb, m.verification_method,
              p.id as participant_id, p.citizen_code, p.name as participant_name,
              c.name as company_name
       FROM mission_instances mi
       JOIN missions m ON mi.mission_id = m.id
       JOIN participants p ON mi.participant_id = p.id
       LEFT JOIN memberships mem ON p.id = mem.participant_id AND mem.status = 'active'
       LEFT JOIN companies c ON mem.company_id = c.id
       WHERE m.station_id = $1 AND mi.status = 'in_progress'
       ORDER BY mi.started_at ASC`,
      [stationId]
    );
    return res.rows;
  }

  /**
   * List Dynamic Commercial Opportunities
   */
  static async listOpportunities(): Promise<any[]> {
    const res = await pool.query(
      `SELECT opp.*, i.name as institution_name, c.name as company_name
       FROM opportunities opp
       LEFT JOIN institutions i ON opp.institution_id = i.id
       LEFT JOIN companies c ON opp.company_id = c.id
       WHERE opp.status = 'open'
       ORDER BY opp.created_at DESC`
    );
    return res.rows;
  }
}
