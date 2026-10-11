import { describe, it, expect, beforeAll } from 'vitest';
import { runSeed } from '../../scripts/seed';
import { MissionService } from '../lib/missions/service';
import { LedgerService } from '../lib/ledger/service';
import { pool } from '../lib/db';

describe('Phase 3 - Missions, Opportunities & Verification Engine', () => {
  beforeAll(async () => {
    await runSeed();
  });

  it('verifies 10-tier mission library exists and is loaded with all 5 verification methods', async () => {
    const res = await pool.query('SELECT tier, verification_method, wave, is_secret FROM missions ORDER BY tier ASC');
    expect(res.rows.length).toBeGreaterThanOrEqual(14); // 10 tiered + 4 secret missions

    const tiers = new Set(res.rows.map((r) => r.tier));
    for (let t = 1; t <= 10; t++) {
      expect(tiers.has(t)).toBe(true);
    }

    const methods = new Set(res.rows.map((r) => r.verification_method));
    expect(methods.has('system_checked')).toBe(true);
    expect(methods.has('counterparty_code')).toBe(true);
    expect(methods.has('station_checkin')).toBe(true);
    expect(methods.has('scan_token')).toBe(true);
    expect(methods.has('multi_party')).toBe(true);
  });

  it('enforces strict secrecy: Secret missions are invisible to unauthorized roles/participants', async () => {
    // 1. Participant vc_p_001 is Founder & CEO of Aether
    const founderMissions = await MissionService.listMissions({
      participantId: 'vc_p_001',
      role: 'Founder & CEO',
      wave: 3,
      isGm: false,
    });

    const founderSecret = founderMissions.find((m) => m.id === 'msn_sec_founder');
    const ctoSecretInFounder = founderMissions.find((m) => m.id === 'msn_sec_cto');
    const freeSecretInFounder = founderMissions.find((m) => m.id === 'msn_sec_free');

    expect(founderSecret).toBeDefined();
    expect(ctoSecretInFounder).toBeUndefined(); // Strictly hidden!
    expect(freeSecretInFounder).toBeUndefined(); // Strictly hidden!

    // 2. Participant vc_p_002 is Co-Founder & CTO of Aether
    const ctoMissions = await MissionService.listMissions({
      participantId: 'vc_p_002',
      role: 'Co-Founder & CTO',
      wave: 3,
      isGm: false,
    });

    const ctoSecret = ctoMissions.find((m) => m.id === 'msn_sec_cto');
    const founderSecretInCto = ctoMissions.find((m) => m.id === 'msn_sec_founder');

    expect(ctoSecret).toBeDefined();
    expect(founderSecretInCto).toBeUndefined(); // Strictly hidden from CTO!

    // 3. GM sees all secret missions
    const gmMissions = await MissionService.listMissions({
      participantId: 'op_gm',
      wave: 3,
      isGm: true,
    });
    const gmSecrets = gmMissions.filter((m) => m.is_secret);
    expect(gmSecrets.length).toBe(4);
  });

  it('claims mission and enforces claim limit per citizen', async () => {
    const participantId = 'vc_p_010';
    const missionId = 'msn_t1';

    // Claim Tier 1 mission
    const instance = await MissionService.claimMission(missionId, participantId);
    expect(instance.id).toBeDefined();
    expect(instance.status).toBe('in_progress');

    // Attempting to claim again should fail (claim_limit = 1)
    await expect(
      MissionService.claimMission(missionId, participantId)
    ).rejects.toThrow(/CLAIM_LIMIT_REACHED/);
  });

  it('Method 1: system_checked automated verification disburses rewards atomically via ledger', async () => {
    const participantId = 'vc_p_010';
    const initialBalance = await LedgerService.getBalance('participant', participantId);
    expect(initialBalance).toBe(500); // 500 VB staking allowance

    // Fetch claimed instance for msn_t1
    const instRes = await pool.query(
      "SELECT id FROM mission_instances WHERE mission_id = 'msn_t1' AND participant_id = $1",
      [participantId]
    );
    const instanceId = instRes.rows[0].id;

    // Verify system_checked mission (rule: wallet_balance >= 500)
    const result = await MissionService.verifyMission(instanceId, participantId, {});
    expect(result.success).toBe(true);
    expect(result.rewardVb).toBe(250);

    // Verify personal balance updated in append-only ledger
    const newBalance = await LedgerService.getBalance('participant', participantId);
    expect(newBalance).toBe(initialBalance + 250); // 750 VB
  });

  it('Method 2: counterparty_code validates secret and rejects invalid codes', async () => {
    const participantId = 'vc_p_011';
    const instance = await MissionService.claimMission('msn_t3', participantId);

    // Invalid code fails
    await expect(
      MissionService.verifyMission(instance.id, participantId, { code: 'WRONG-CODE-000' })
    ).rejects.toThrow(/VERIFICATION_FAILED/);

    // Valid code succeeds
    const result = await MissionService.verifyMission(instance.id, participantId, {
      code: 'CUST-ANCHOR-2026',
    });
    expect(result.success).toBe(true);
    expect(result.rewardVb).toBe(1500);

    const balance = await LedgerService.getBalance('participant', participantId);
    expect(balance).toBe(500 + 1500); // 2000 VB
  });

  it('Method 3: scan_token validates physical station token code', async () => {
    const participantId = 'vc_p_012';
    const instance = await MissionService.claimMission('msn_t4', participantId);

    // Invalid token fails
    await expect(
      MissionService.verifyMission(instance.id, participantId, { token: 'INVALID-TOKEN' })
    ).rejects.toThrow(/VERIFICATION_FAILED/);

    // Valid station corridor token succeeds
    const result = await MissionService.verifyMission(instance.id, participantId, {
      token: 'LOG-CORRIDOR-90',
    });
    expect(result.success).toBe(true);
    expect(result.rewardVb).toBe(800);
    expect(result.rewardResources.logistics).toBe(15);
  });

  it('Method 4: station_checkin approved by volunteer at station desk', async () => {
    const participantId = 'vc_p_013';
    const instance = await MissionService.claimMission('msn_t2', participantId);

    // Direct user verification fails because station volunteer approval is required
    await expect(
      MissionService.verifyMission(instance.id, participantId, {})
    ).rejects.toThrow(/Station check-in required/);

    // Station volunteer approves check-in from /desk/supplier
    const approveResult = await MissionService.approveStationCheckin(
      instance.id,
      'supplier',
      'op_supplier'
    );
    expect(approveResult.success).toBe(true);

    const balance = await LedgerService.getBalance('participant', participantId);
    expect(balance).toBe(500 + 500); // 1000 VB
  });

  it('verifies dynamic commercial opportunities exist with procurement budgets', async () => {
    const opps = await MissionService.listOpportunities();
    expect(opps.length).toBeGreaterThanOrEqual(5);

    const rfp = opps.find((o) => o.type === 'enterprise_rfp');
    const tender = opps.find((o) => o.type === 'govt_tender');
    const syndicate = opps.find((o) => o.type === 'syndicate_round');
    const freelance = opps.find((o) => o.type === 'freelance_gig');

    expect(rfp).toBeDefined();
    expect(tender).toBeDefined();
    expect(syndicate).toBeDefined();
    expect(freelance).toBeDefined();

    expect(rfp.budget_vb).toBeGreaterThanOrEqual(10000);
    expect(syndicate.budget_vb).toBeGreaterThanOrEqual(40000);
  });
});
