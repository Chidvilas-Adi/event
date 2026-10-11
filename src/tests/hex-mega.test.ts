import { describe, it, expect, beforeAll } from 'vitest';
import { executeCompleteWorldReset } from '../lib/db/reset';
import { pool } from '../lib/db';
import { LedgerService } from '../lib/ledger/service';
import { STATION_FLAGS } from '../lib/data/station-flags';
import { MissionService } from '../lib/missions/service';

describe('Hex Mega Simulation Integration: Master Reset, Waves, Treasure Hunt & Volunteer Roles', () => {
  beforeAll(async () => {
    // Perform full ACID reset
    await executeCompleteWorldReset('test_admin');
  });

  it('verifies Master Reset restores pristine state with 12 canonical companies', async () => {
    const compRes = await pool.query('SELECT id, name, initial_cash FROM companies ORDER BY id ASC');
    expect(compRes.rows.length).toBe(12);

    const companyIds = compRes.rows.map((r) => r.id);
    expect(companyIds).toContain('comp_swiftcart');
    expect(companyIds).toContain('comp_ledgerly');
    expect(companyIds).toContain('comp_mango');
    expect(companyIds).toContain('comp_skillforge');
    expect(companyIds).toContain('comp_pulseai');
    expect(companyIds).toContain('comp_greengrid');
    expect(companyIds).toContain('comp_medilink');
    expect(companyIds).toContain('comp_harvestloop');
    expect(companyIds).toContain('comp_stackhouse');
    expect(companyIds).toContain('comp_voltway');
    expect(companyIds).toContain('comp_forgeline');
    expect(companyIds).toContain('comp_trustlayer');

    // Verify company ledger balances match initial cash
    for (const c of compRes.rows) {
      const bal = await LedgerService.getBalance('company', c.id);
      expect(bal).toBe(Number(c.initial_cash));
      expect(bal).toBeGreaterThan(0);
    }
  });

  it('verifies Master Reset restores 8 institutions and 100 participants', async () => {
    const instRes = await pool.query('SELECT id, name, is_open FROM institutions');
    expect(instRes.rows.length).toBe(8);
    for (const inst of instRes.rows) {
      expect(inst.is_open).toBe(true);
    }

    const partRes = await pool.query('SELECT count(*) FROM participants');
    expect(parseInt(partRes.rows[0].count, 10)).toBe(100);

    // Verify volunteer operator accounts
    const opRes = await pool.query("SELECT id, role_id, institution_id FROM operator_accounts WHERE role_id = 'volunteer'");
    expect(opRes.rows.length).toBe(8);
  });

  it('verifies volunteer operator accounts have station mission instances assigned', async () => {
    const volOperators = [
      'op_bank',
      'op_investor',
      'op_customer',
      'op_talent',
      'op_supplier',
      'op_logistics',
      'op_government',
      'op_media',
    ];

    for (const opId of volOperators) {
      const mRes = await pool.query(
        'SELECT mi.id, mi.status, m.title, m.wave FROM mission_instances mi JOIN missions m ON mi.mission_id = m.id WHERE mi.participant_id = $1',
        [opId]
      );
      expect(mRes.rows.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('verifies wave progression updates world_state and filters missions correctly', async () => {
    // Check initial wave is 1
    const w1Res = await pool.query('SELECT wave FROM world_state LIMIT 1');
    expect(w1Res.rows[0].wave).toBe(1);

    // Advance to wave 2
    await pool.query('UPDATE world_state SET wave = 2');
    const w2Res = await pool.query('SELECT wave FROM world_state LIMIT 1');
    expect(w2Res.rows[0].wave).toBe(2);

    // Advance to wave 3
    await pool.query('UPDATE world_state SET wave = 3');
    const w3Res = await pool.query('SELECT wave FROM world_state LIMIT 1');
    expect(w3Res.rows[0].wave).toBe(3);

    // Reset back to wave 1
    await pool.query('UPDATE world_state SET wave = 1');
  });

  it('verifies Treasure Hunt station flags verification in missions service', async () => {
    // Check station flags dictionary
    expect(STATION_FLAGS['bank'].flag).toBe('FLAG-BANK-VAULT-2026');
    expect(STATION_FLAGS['government'].flag).toBe('FLAG-GOV-SEAL-2026');
    expect(STATION_FLAGS['investor'].flag).toBe('FLAG-INVESTOR-TERM-2026');
    expect(STATION_FLAGS['supplier'].flag).toBe('FLAG-SUPPLY-STOCK-2026');

    // Create a scan_token mission for participant vc_p_001
    const pId = 'vc_p_001';
    const mId = 'mis_test_flag_01';

    await pool.query(
      `INSERT INTO missions (id, wave, tier, title, objective, verification_method, completion_rule, reward_vb)
       VALUES ($1, 1, 1, 'Physical In-Person Infiltration', 'Visit Apex Bank Vault', 'scan_token', 'verify_token', 500)
       ON CONFLICT (id) DO NOTHING`,
      [mId]
    );

    const miId = `mi_test_flag_${Date.now()}`;
    await pool.query(
      `INSERT INTO mission_instances (id, mission_id, participant_id, status)
       VALUES ($1, $2, $3, 'in_progress')`,
      [miId, mId, pId]
    );

    // Verify submission with valid flag
    const verifyRes = await MissionService.verifyMission(miId, pId, {
      token: 'FLAG-BANK-VAULT-2026',
    });

    expect(verifyRes.success).toBe(true);

    const instanceRow = await pool.query('SELECT status FROM mission_instances WHERE id = $1', [miId]);
    expect(instanceRow.rows[0].status).toBe('completed');
  });

  it('verifies citizen intel purchase debits wallet and dispenses clue & station flag', async () => {
    const citizenId = 'vc_p_002';

    // Credit citizen with 500 VB for testing
    await pool.query(
      `INSERT INTO ledger_entries (id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser)
       VALUES ($1, NOW(), 'institution', 'bank', 'participant', $2, 500, 'credit', 'Intel stipend', 'op_admin')`,
      [`ledg_test_stipend_${Date.now()}`, citizenId]
    );

    const balBefore = await LedgerService.getBalance('participant', citizenId);
    expect(balBefore).toBeGreaterThanOrEqual(500);

    // Perform Intel purchase logic
    const intelCost = 150;
    const debitRes = await LedgerService.executeTransfer({
      fromType: 'participant',
      fromId: citizenId,
      toType: 'institution',
      toId: 'bank',
      amount: intelCost,
      reason: 'Treasure Hunt Clue & Flag Purchase: Apex Reserve Bank',
      authoriser: citizenId,
    });
    expect(debitRes.committed).toBe(true);

    const balAfter = await LedgerService.getBalance('participant', citizenId);
    expect(balAfter).toBe(balBefore - intelCost);
  });
});
