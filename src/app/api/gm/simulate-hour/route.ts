import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { pool, withTransaction } from '@/lib/db';
import { CrisesService } from '@/lib/crises/service';
import { DisputesService } from '@/lib/disputes/service';
import { CompanyLifecycleService } from '@/lib/companies/lifecycle';
import { LedgerService } from '@/lib/ledger/service';
import { eventBus } from '@/lib/events/bus';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Game Master or Tech Admin can run the simulation hour.' }, { status: 403 });
  }

  const logs: { step: number; title: string; detail: string; timestamp: string; success: boolean }[] = [];

  function recordStep(step: number, title: string, detail: string, success: boolean = true) {
    logs.push({ step, title, detail, timestamp: new Date().toISOString(), success });
  }

  try {
    // STEP 1: Advance Clock & Open Simulation Hour (Tick 2)
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE world_state SET
          current_tick = current_tick + 1,
          clock_seconds = (current_tick + 1) * 1800,
          is_paused = FALSE,
          is_frozen = FALSE,
          freeze_reason = NULL,
          updated_at = NOW()
        WHERE id = 'default'`
      );

      const tickRes = await client.query('SELECT current_tick FROM world_state WHERE id = $1', ['default']);
      const currentTick = tickRes.rows[0].current_tick;

      await client.query(
        'INSERT INTO ticks (tick_number, started_at, reason, advanced_by) VALUES ($1, NOW(), $2, $3)',
        [currentTick, 'Simulation Hour Automated Kickoff', user.userId]
      );

      recordStep(1, 'Advance Clock to Tick ' + currentTick, `Clock advanced to tick ${currentTick} (simulation hour began).`);
    });

    // STEP 2: Macro Market Disturbance (Price Volatility Event)
    const eventId = `evt_sim_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    await pool.query(
      `INSERT INTO events (id, title, description, impact_config, is_active, triggered_at)
       VALUES ($1, 'Compute Grid Surcharge Surge', 'Global high-performance compute demand spikes base price by 40%.', $2, TRUE, NOW())`,
      [eventId, JSON.stringify({ resource: 'compute', factor: 1.4, price_spike: 40 })]
    );
    await pool.query('UPDATE resources SET base_price = GREATEST(1, ROUND(base_price * 1.4)) WHERE id = $1', ['compute']);
    recordStep(2, 'Macro Price Shock Injected', 'Compute base price spiked by +40% across city exchanges.');

    // STEP 3: Unlock Wave 2 Missions
    await pool.query('UPDATE missions SET is_active = TRUE WHERE wave = 2');
    recordStep(3, 'Wave 2 Missions Released', 'Unlocked Wave 2 tier library opportunities for participants.');

    // STEP 4: Trigger Active Crisis (Blackout Substation Failure)
    const crisisId = 'crisis_blackout_01';
    await CrisesService.triggerCrisis({
      crisisId,
      durationMinutes: 30,
      actorId: user.userId,
    });
    recordStep(4, 'Crisis Injected: Substation Transformer Failure', 'Triggered 30-minute response countdown with multi-choice paths.');

    // STEP 5: Company Response Commitment
    // SwiftCart commits to Path 1: Autonomous Solar Microgrid (pays 1500 VB, unlocks surplus tender)
    const crisisResp = await CrisesService.respondToCrisis({
      crisisId,
      companyId: 'comp_swiftcart',
      pathId: 'path_solar_microgrid',
      actorId: 'VC-001',
    });
    recordStep(5, 'Company Crisis Response Executed', `SwiftCart responded with "${crisisResp.pathTitle}" paying ${crisisResp.costVbPaid} VB.`);

    // STEP 6: Commercial Dispute Filing & Arbitration Ruling
    const dispRes = await pool.query("SELECT id FROM disputes WHERE status = 'open' LIMIT 1");
    let targetDisputeId = dispRes.rows[0]?.id;

    if (!targetDisputeId) {
      const newDisp = await DisputesService.fileDispute({
        claimantType: 'participant',
        claimantId: 'vc_p_014',
        respondentType: 'company',
        respondentId: 'comp_voltway',
        amountVb: 350,
        reason: 'Failed delivery of sensor batch on physical transaction slip #014',
        evidence: 'Counterparty slip present, delivery lapsed.',
        actorId: 'vc_p_014',
      });
      targetDisputeId = newDisp.id;
    }

    const rulingRes = await DisputesService.ruleDispute({
      disputeId: targetDisputeId,
      ruling: 'claimant_upheld',
      awardedVb: 350,
      rulingNotes: 'Audited physical pad delivery slip confirms contract breach. Full restitution awarded.',
      actorId: user.userId,
      actorRole: user.role,
    });
    recordStep(6, 'Commercial Dispute Arbitrated', `Dispute #${targetDisputeId} ruled "${rulingRes.ruling}". Compensatory transfer of ${rulingRes.awardedVb} VB executed.`);

    // STEP 7: Corporate M&A Consolidation
    // SwiftCart acquires Voltway
    const maRes = await CompanyLifecycleService.executeMerger({
      acquirerId: 'comp_swiftcart',
      targetId: 'comp_voltway',
      purchasePriceVb: 5000,
      reason: 'Strategic delivery and electric fleet consolidation',
      actorId: user.userId,
      actorRole: user.role,
    });
    recordStep(7, 'M&A Consolidation Executed', `SwiftCart acquired Voltway. Consolidating ${maRes.consolidatedVb} VB and resource inventory.`);

    // STEP 8: Emergency City Freeze
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE world_state SET
          is_frozen = TRUE,
          freeze_reason = 'Phase 4 Validation Drill Completed. City locked for final evaluation.',
          updated_at = NOW()
        WHERE id = 'default'`
      );
      recordStep(8, 'Emergency City Freeze Imposed', 'City state frozen. Normal transactions and writes locked.');
    });

    // STEP 9: Mathematical Zero-Sum Ledger Integrity Audit
    const auditRes = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN to_id IS NOT NULL THEN amount ELSE 0 END), 0) as total_credits,
        COALESCE(SUM(CASE WHEN from_id IS NOT NULL THEN amount ELSE 0 END), 0) as total_debits,
        COUNT(*) as total_entries
      FROM ledger_entries
    `);

    const totalCredits = parseInt(auditRes.rows[0].total_credits, 10);
    const totalDebits = parseInt(auditRes.rows[0].total_debits, 10);
    const discrepancy = Math.abs(totalCredits - totalDebits);

    // Verify view balances match credits - debits
    const viewRes = await pool.query('SELECT SUM(balance) as sum_balances FROM v_entity_balances');
    const sumBalances = parseInt(viewRes.rows[0].sum_balances || 0, 10);

    recordStep(
      9,
      'Zero-Discrepancy Ledger Audit',
      `Audit Complete: ${auditRes.rows[0].total_entries} entries. Total Credits: ${totalCredits} VB, Total Debits: ${totalDebits} VB. Discrepancy: ${discrepancy} VB. View Balance Sum: ${sumBalances} VB.`,
      discrepancy === 0
    );

    eventBus.broadcast('simulation_hour_completed', { logs, discrepancy });

    return NextResponse.json({
      success: true,
      simulationHour: '1 Hour Scripted Event Complete',
      discrepancy,
      totalEntries: auditRes.rows[0].total_entries,
      totalCredits,
      totalDebits,
      isFrozen: true,
      logs,
    });
  } catch (err: any) {
    recordStep(logs.length + 1, 'Simulation Execution Exception', err.message || 'Error occurred', false);
    return NextResponse.json({
      success: false,
      error: err.message,
      logs,
    }, { status: 500 });
  }
}
