import { describe, it, expect, beforeAll } from 'vitest';
import { runSeed } from '../../scripts/seed';
import { PolicyEngine } from '../lib/auth/policy';
import { UserSession } from '../lib/auth/session';
import { ObserverEvidenceService } from '../lib/observer/service';
import { InvestorPacketService } from '../lib/investor/packet-service';
import { EconomyAnalyticsService } from '../lib/analytics/service';
import { pool } from '../lib/db';

describe('Phase 5 - Security Hardening, Observer Ledger, Investor Packets & Macroeconomic Invariants', () => {
  beforeAll(async () => {
    await runSeed();
  });

  const citizenA: UserSession = {
    userId: 'vc_p_001',
    role: 'participant',
    name: 'Aarav Sharma',
    companyId: 'comp_swiftcart',
    isElevated: false,
  };

  const citizenB: UserSession = {
    userId: 'vc_p_011',
    role: 'participant',
    name: 'Diya Rao',
    companyId: 'comp_ledgerly',
    isElevated: false,
  };

  const founderUser: UserSession = {
    userId: 'vc_p_001',
    role: 'company_lead',
    name: 'Aarav Sharma',
    companyId: 'comp_swiftcart',
    isElevated: false,
  };

  const observerUser: UserSession = {
    userId: 'op_observer',
    role: 'observer',
    name: 'Ecosystem Scout',
    isElevated: true,
  };

  const gmUser: UserSession = {
    userId: 'op_gm',
    role: 'gm',
    name: 'Game Master',
    isElevated: true,
  };

  it('enforces least-privilege role boundaries and prevents citizen privilege escalation', () => {
    // Ordinary citizen cannot perform GM administrative actions
    expect(PolicyEngine.can(citizenA, 'GM_GRANT_VB')).toBe(false);
    expect(PolicyEngine.can(citizenA, 'FREEZE_WORLD')).toBe(false);
    expect(PolicyEngine.can(citizenA, 'CONTROL_WORLD_CLOCK')).toBe(false);
    expect(PolicyEngine.can(citizenA, 'VIEW_ANY_WALLET')).toBe(false);

    // Citizen cannot view private data of another company
    expect(PolicyEngine.can(citizenA, 'VIEW_COMPANY_PRIVATE', { companyId: 'comp_ledgerly' })).toBe(false);

    // Citizen CAN view own company private data
    expect(PolicyEngine.can(citizenA, 'VIEW_COMPANY_PRIVATE', { companyId: 'comp_swiftcart' })).toBe(true);

    // GM has unrestricted access
    expect(PolicyEngine.can(gmUser, 'GM_GRANT_VB')).toBe(true);
    expect(PolicyEngine.can(gmUser, 'FREEZE_WORLD')).toBe(true);
    expect(PolicyEngine.can(gmUser, 'CONTROL_WORLD_CLOCK')).toBe(true);
  });

  it('guarantees secret mission confidentiality and cross-citizen isolation', async () => {
    // Plant a secret espionage mission for Citizen B
    const secretMissionData = {
      id: 'msn_sec_leak_01',
      title: 'Intercept Defense IP Specification',
      is_secret: true,
      recipient_id: citizenB.userId,
      company_id: 'comp_ledgerly',
      gm_notes: 'Planted corporate espionage leak probe',
      hidden_opportunity: { bonus_vb: 3000 },
    };

    // Filtered view for Citizen A (rival company) must completely conceal the secret mission
    const citizenAView = PolicyEngine.filterObject(secretMissionData, 'mission', citizenA);
    expect(Object.keys(citizenAView).length).toBe(0);

    // Filtered view for Citizen B (recipient) sees title but GM internal notes are scrubbed
    const recipientView = PolicyEngine.filterObject(secretMissionData, 'mission', citizenB);
    expect(recipientView.title).toBe('Intercept Defense IP Specification');
    expect(recipientView.gm_notes).toBeUndefined();
    expect(recipientView.hidden_opportunity).toBeUndefined();

    // GM sees full unredacted payload
    const gmView = PolicyEngine.filterObject(secretMissionData, 'mission', gmUser);
    expect(gmView.gm_notes).toBe('Planted corporate espionage leak probe');
    expect(gmView.hidden_opportunity).toBeDefined();
  });

  it('validates Observer Evidence Service: records behavioral citations and audits entries', async () => {
    // 1. Observer records qualitative evidence for founder
    const evidence = await ObserverEvidenceService.recordEvidence({
      participantId: citizenA.userId,
      companyId: 'comp_swiftcart',
      observerId: observerUser.userId,
      traitCategory: 'stress_leadership',
      rating: 'exemplary',
      notes: 'Demonstrated exceptional calm and transparent communication during composite supply crisis.',
      incidentCitation: 'CRISIS_SUPPLY_CHAIN_TICK_12',
    });

    expect(evidence.id).toBeDefined();
    expect(evidence.participant_id).toBe(citizenA.userId);
    expect(evidence.company_id).toBe('comp_swiftcart');
    expect(evidence.rating).toBe('exemplary');
    expect(evidence.notes).toContain('exceptional calm');

    // 2. Query evidence list filtered by company
    const companyEvidence = await ObserverEvidenceService.listEvidence({ companyId: 'comp_swiftcart' });
    expect(companyEvidence.length).toBeGreaterThanOrEqual(1);
    const recorded = companyEvidence.find((e) => e.id === evidence.id);
    expect(recorded).toBeDefined();
    expect(recorded?.participant_name).toBeDefined();

    // 3. Verify audit log entry was written
    const auditRes = await pool.query(
      "SELECT * FROM audit_log WHERE object_id = $1 AND action = 'FOUNDER_EVIDENCE_RECORDED'",
      [evidence.id]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].actor_id).toBe(observerUser.userId);
  });

  it('validates Investor Day Packets Engine: computes SPV, ratings, cap tables for all 12 ventures', async () => {
    const packets = await InvestorPacketService.generateAllPackets();
    expect(packets.length).toBe(12);

    for (const pkt of packets) {
      expect(pkt.companyId).toMatch(/^comp_/);
      expect(pkt.name.length).toBeGreaterThan(0);
      expect(pkt.team.length).toBeGreaterThan(0);
      expect(pkt.financials.cashBalanceVb).toBeGreaterThan(0);
      expect(pkt.financials.totalSpvVb).toBeGreaterThanOrEqual(pkt.financials.cashBalanceVb);
      expect(pkt.capTable.length).toBeGreaterThan(0);
      expect(['STRONG_INVEST', 'SYNDICATE_FOLLOW_ON', 'CONDITIONAL_HOLD', 'PASS']).toContain(
        pkt.score.syndicateVerdict
      );
      expect(pkt.score.totalScore).toBeGreaterThanOrEqual(0);
      expect(pkt.score.thesisSummary.length).toBeGreaterThan(0);
    }
  });

  it('validates Macroeconomic Telemetry: ensures M0 conservation and Gini coefficient boundaries', async () => {
    const analytics = await EconomyAnalyticsService.getEconomyAnalytics();

    expect(analytics.companiesCount).toBe(12);
    expect(analytics.m0MoneySupplyVb).toBeGreaterThan(0);
    expect(analytics.totalGrantsIssuedVb).toBeGreaterThanOrEqual(analytics.m0MoneySupplyVb);
    expect(analytics.zeroSumBalanced).toBe(true);
    expect(analytics.companyWealthDistribution.length).toBe(12);

    // Gini coefficient must strictly be between 0 (perfect equality) and 1 (perfect inequality)
    expect(analytics.giniCoefficient).toBeGreaterThanOrEqual(0);
    expect(analytics.giniCoefficient).toBeLessThanOrEqual(1);

    // Total wealth share should sum to ~100%
    const totalShare = analytics.companyWealthDistribution.reduce((sum, c) => sum + c.shareOfWealthPercent, 0);
    expect(totalShare).toBeGreaterThanOrEqual(98);
    expect(totalShare).toBeLessThanOrEqual(102);
  });

  it('enforces database trigger immutability: forbids direct UPDATE or DELETE on ledger and audit logs', async () => {
    // 1. Attempt UPDATE on ledger_entries -> must be rejected by Postgres trigger
    const entryRes = await pool.query('SELECT id FROM ledger_entries LIMIT 1');
    const entryId = entryRes.rows[0].id;

    await expect(
      pool.query('UPDATE ledger_entries SET amount = 999999 WHERE id = $1', [entryId])
    ).rejects.toThrow(/strictly append-only/i);

    // 2. Attempt DELETE on ledger_entries -> must be rejected by Postgres trigger
    await expect(
      pool.query('DELETE FROM ledger_entries WHERE id = $1', [entryId])
    ).rejects.toThrow(/strictly append-only/i);

    // 3. Attempt UPDATE on audit_log -> must be rejected by Postgres trigger
    const auditRes = await pool.query('SELECT id FROM audit_log LIMIT 1');
    const auditId = auditRes.rows[0].id;

    await expect(
      pool.query("UPDATE audit_log SET reason = 'tampered' WHERE id = $1", [auditId])
    ).rejects.toThrow(/strictly append-only/i);

    // 4. Attempt DELETE on audit_log -> must be rejected by Postgres trigger
    await expect(
      pool.query('DELETE FROM audit_log WHERE id = $1', [auditId])
    ).rejects.toThrow(/strictly append-only/i);
  });
});
