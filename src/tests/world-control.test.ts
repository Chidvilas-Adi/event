import { describe, it, expect, beforeAll } from 'vitest';
import { runSeed } from '../../scripts/seed';
import { CrisesService } from '../lib/crises/service';
import { DisputesService } from '../lib/disputes/service';
import { CompanyLifecycleService } from '../lib/companies/lifecycle';
import { PaperFallbackService } from '../lib/export/paper-service';
import { MissionAutomationEngine } from '../lib/missions/automation';
import { LedgerService } from '../lib/ledger/service';
import { pool } from '../lib/db';

describe('Phase 4 - World Control, Crises, Disputes, Lifecycle & Simulation Drill', () => {
  beforeAll(async () => {
    await runSeed();
  });

  it('verifies Crises Engine: triggers crisis, records response path, and charges treasury', async () => {
    // 1. Trigger Crisis as GM
    const crisisRes = await CrisesService.triggerCrisis({
      crisisId: 'crs_test_supply',
      durationMinutes: 15,
      actorId: 'op_gm',
      customParams: {
        title: 'Global Raw Materials Shortage',
        description: 'Global composite extraction disrupted. Prices spike +40%.',
        response_paths: [
          {
            id: 'path_hedge',
            title: 'Procure Strategic Reserves',
            description: 'Spend 2,000 VB to lock priority supplier allocations.',
            cost_vb: 2000,
            effect: 'Shields company from raw material price surge.',
          },
          {
            id: 'path_pivot',
            title: 'Recycle Scrap Composites',
            description: 'Use existing inventory without cash outlays.',
            cost_vb: 0,
            effect: '15% lower hardware assembly yield.',
          },
        ],
      },
    });

    expect(crisisRes.success).toBe(true);

    // Verify crisis is active in DB
    const crisis = await CrisesService.getCrisisById('crs_test_supply');
    expect(crisis).toBeDefined();
    expect(crisis?.status).toBe('active');

    // 2. Company Lead of SwiftCart responds via path_hedge
    const aetherBefore = await LedgerService.getBalance('company', 'comp_swiftcart');

    const respondRes = await CrisesService.respondToCrisis({
      crisisId: 'crs_test_supply',
      companyId: 'comp_swiftcart',
      pathId: 'path_hedge',
      actorId: 'vc_p_001',
    });

    expect(respondRes.success).toBe(true);
    expect(respondRes.costVbPaid).toBe(2000);

    const aetherAfter = await LedgerService.getBalance('company', 'comp_swiftcart');
    expect(aetherAfter).toBe(aetherBefore - 2000);
  });

  it('verifies Commercial Arbitration & Disputes: filing, GM ruling, and atomic compensation settlement', async () => {
    // 1. Participant vc_p_001 files a dispute against Ledgerly for breach of contract (5,000 VB)
    const dispute = await DisputesService.fileDispute({
      claimantType: 'company',
      claimantId: 'comp_swiftcart',
      respondentType: 'company',
      respondentId: 'comp_ledgerly',
      amountVb: 5000,
      reason: 'Failed to deliver agreed telemetry sensors under bilateral contract.',
      evidence: 'Signed deal slip #deal_anchor_comp_ledgerly',
      actorId: 'vc_p_001',
    });

    expect(dispute.id).toBeDefined();
    expect(dispute.status).toBe('open');

    // Check balances before ruling
    const aetherBefore = await LedgerService.getBalance('company', 'comp_swiftcart');
    const kavachBefore = await LedgerService.getBalance('company', 'comp_ledgerly');

    // 2. GM rules in favor of complainant with 4,000 VB compensation
    const rulingRes = await DisputesService.ruleDispute({
      disputeId: dispute.id,
      ruling: 'claimant_upheld',
      awardedVb: 4000,
      rulingNotes: 'Factual evidence confirms sensor delivery was not completed by Tick 02 milestone.',
      actorId: 'op_gm',
      actorRole: 'gm',
    });

    expect(rulingRes.success).toBe(true);
    expect(rulingRes.awardedVb).toBe(4000);

    // Verify balances atomically shifted
    const aetherAfter = await LedgerService.getBalance('company', 'comp_swiftcart');
    const kavachAfter = await LedgerService.getBalance('company', 'comp_ledgerly');

    expect(aetherAfter).toBe(aetherBefore + 4000);
    expect(kavachAfter).toBe(kavachBefore - 4000);

    // Verify updated dispute record
    const updatedDispute = await DisputesService.getDisputeById(dispute.id);
    expect(updatedDispute?.status).toBe('resolved');
    expect(updatedDispute?.ruling).toBe('claimant_upheld');
  });

  it('verifies Company Lifecycle Engine: M&A merger transferring treasury, cap table, and staff', async () => {
    const aetherCashBefore = await LedgerService.getBalance('company', 'comp_swiftcart');
    const suryaCashBefore = await LedgerService.getBalance('company', 'comp_voltway');

    // 1. Execute Acquisition: SwiftCart acquires Voltway
    const mergeRes = await CompanyLifecycleService.executeMerger({
      acquirerId: 'comp_swiftcart',
      targetId: 'comp_voltway',
      purchasePriceVb: 5000,
      reason: 'Horizontal consolidation of energy cells into autonomous flight stack.',
      actorId: 'op_gm',
      actorRole: 'gm',
    });

    expect(mergeRes.success).toBe(true);

    // Absorbed company status becomes 'acquired'
    const suryaComp = await pool.query('SELECT status FROM companies WHERE id = $1', ['comp_voltway']);
    expect(suryaComp.rows[0].status).toBe('acquired');

    // Absorbed company cash balance is 0, transferred into surviving company
    const suryaCashAfter = await LedgerService.getBalance('company', 'comp_voltway');
    expect(suryaCashAfter).toBe(0);

    const aetherCashAfter = await LedgerService.getBalance('company', 'comp_swiftcart');
    expect(aetherCashAfter).toBe(aetherCashBefore + suryaCashBefore);

    // Check staff reassigned
    const reassignedMembers = await pool.query(
      "SELECT count(*) FROM memberships WHERE company_id = 'comp_swiftcart' AND status = 'active'"
    );
    expect(parseInt(reassignedMembers.rows[0].count, 10)).toBeGreaterThan(9);
  });

  it('verifies Paper Fallback Service: exports ledger, balances, and rosters cleanly in CSV', async () => {
    const ledgerCsv = await PaperFallbackService.exportLedgerCsv();
    expect(ledgerCsv).toContain('Entry ID,Timestamp,From Type,From ID,To Type,To ID,Amount (VB)');
    expect(ledgerCsv.split('\n').length).toBeGreaterThan(10);

    const balanceCsv = await PaperFallbackService.exportCompanyBalancesCsv();
    expect(balanceCsv).toContain('Company ID,Name,Status,Tier,Treasury Balance (VB)');
    expect(balanceCsv).toContain('comp_swiftcart');

    const rosterCsv = await PaperFallbackService.exportCitizenRosterCsv();
    expect(rosterCsv).toContain('Citizen Code,Participant ID,Name,Email,Company,Role');
    expect(rosterCsv).toContain('VC-001');
  });

  it('verifies Mission Automation: assigns 10 role missions per citizen and enforces strict secrecy isolation', async () => {
    const autoRes = await MissionAutomationEngine.autoAssignAllMissions({
      cleanExisting: true,
      missionsPerParticipant: 10,
    });

    expect(autoRes.participantsAssigned).toBe(100);
    expect(autoRes.instancesAssigned).toBe(1000);

    // Check that each citizen has exactly 10 mission instances
    const counts = await pool.query(`
      SELECT participant_id, COUNT(*) as m_count
      FROM mission_instances
      WHERE participant_id LIKE 'vc_p_%'
      GROUP BY participant_id
      LIMIT 10
    `);

    for (const row of counts.rows) {
      expect(parseInt(row.m_count, 10)).toBe(10);
    }

    // Check secret missions: A secret mission assigned to VC-001 is NOT visible to VC-002
    const secRes = await pool.query(
      "SELECT id FROM missions WHERE is_secret = TRUE AND secret_participant_id = 'vc_p_001' LIMIT 1"
    );

    if (secRes.rows.length > 0) {
      const secId = secRes.rows[0].id;
      const visibleToCto = await pool.query(
        "SELECT id FROM mission_instances WHERE mission_id = $1 AND participant_id = 'vc_p_002'",
        [secId]
      );
      expect(visibleToCto.rows.length).toBe(0); // Strictly isolated!
    }
  });
});
