import { pool } from '@/lib/db';
import { LedgerService } from '@/lib/ledger/service';

export interface EconomyAnalytics {
  m0MoneySupplyVb: number;
  totalGrantsIssuedVb: number;
  totalBurnsFinesVb: number;
  activeCirculatingVb: number;
  zeroSumBalanced: boolean;
  transactionsCount: number;
  totalTransferVolumeVb: number;
  giniCoefficient: number;
  companiesCount: number;
  citizensCount: number;
  companyWealthDistribution: {
    companyId: string;
    name: string;
    treasuryVb: number;
    resourceValuationVb: number;
    spvVb: number;
    shareOfWealthPercent: number;
  }[];
  resourceTotals: {
    resourceId: string;
    name: string;
    totalStockHeld: number;
    basePriceVb: number;
    nominalValuationVb: number;
  }[];
  missionsProgress: {
    totalMissions: number;
    totalInstances: number;
    completedInstances: number;
    completionRatePercent: number;
    totalRewardsDistributedVb: number;
  };
  disputesMetrics: {
    totalDisputesFiled: number;
    resolvedDisputes: number;
    totalAwardedVb: number;
  };
}

export class EconomyAnalyticsService {
  /**
   * Calculate full macroeconomic analytics and wealth distribution telemetry
   */
  static async getEconomyAnalytics(): Promise<EconomyAnalytics> {
    // 1. Ledger Aggregates
    const ledRes = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN from_type = 'system' THEN amount ELSE 0 END), 0) as total_grants,
        COALESCE(SUM(CASE WHEN to_type = 'system' THEN amount ELSE 0 END), 0) as total_burns,
        COALESCE(SUM(CASE WHEN from_type != 'system' AND to_type != 'system' THEN amount ELSE 0 END), 0) as transfer_volume,
        COUNT(*) as total_tx_count
      FROM ledger_entries
    `);

    const totalGrants = parseInt(ledRes.rows[0].total_grants, 10) || 0;
    const totalBurns = parseInt(ledRes.rows[0].total_burns, 10) || 0;
    const circulating = totalGrants - totalBurns;
    const transferVolume = parseInt(ledRes.rows[0].transfer_volume, 10) || 0;
    const txCount = parseInt(ledRes.rows[0].total_tx_count, 10) || 0;

    // 2. Company Balances & SPVs
    const compRes = await pool.query('SELECT id, name FROM companies ORDER BY name ASC');
    const compWealth: EconomyAnalytics['companyWealthDistribution'] = [];
    let totalEconomySpv = 0;

    for (const c of compRes.rows) {
      const bal = await LedgerService.getBalance('company', c.id);

      const resTotals = await pool.query(`
        SELECT resource_id, SUM(quantity) as net_qty
        FROM resource_ledger
        WHERE owner_type = 'company' AND owner_id = $1
        GROUP BY resource_id
      `, [c.id]);

      let resVal = 0;
      const basePrices: Record<string, number> = { compute: 25, energy: 15, logistics: 20, materials: 20, data: 20, infrastructure: 25 };
      for (const r of resTotals.rows) {
        const qty = parseInt(r.net_qty, 10) || 0;
        const bp = basePrices[r.resource_id] || 20;
        resVal += qty * bp;
      }

      const spv = bal + resVal;
      totalEconomySpv += spv;

      compWealth.push({
        companyId: c.id,
        name: c.name,
        treasuryVb: bal,
        resourceValuationVb: resVal,
        spvVb: spv,
        shareOfWealthPercent: 0, // Calculated after total
      });
    }

    if (totalEconomySpv > 0) {
      for (const cw of compWealth) {
        cw.shareOfWealthPercent = Number(((cw.spvVb / totalEconomySpv) * 100).toFixed(1));
      }
    }

    // Sort descending by SPV
    compWealth.sort((a, b) => b.spvVb - a.spvVb);

    // 3. Gini Coefficient Calculation (from company SPVs)
    const spvValues = compWealth.map(cw => cw.spvVb).sort((a, b) => a - b);
    const n = spvValues.length;
    let gini = 0;
    if (n > 0 && totalEconomySpv > 0) {
      let cumulativeSum = 0;
      for (let i = 0; i < n; i++) {
        cumulativeSum += (i + 1) * spvValues[i];
      }
      gini = ((2 * cumulativeSum) / (n * totalEconomySpv)) - ((n + 1) / n);
      gini = Math.max(0, Math.min(1, Number(gini.toFixed(3))));
    }

    // 4. Resource Aggregates
    const resourcesList = [
      { id: 'compute', name: 'Compute Units', price: 25 },
      { id: 'energy', name: 'Clean Energy', price: 15 },
      { id: 'logistics', name: 'Logistics Slots', price: 20 },
      { id: 'materials', name: 'Raw Materials', price: 20 },
      { id: 'data', name: 'Market Data', price: 20 },
      { id: 'infrastructure', name: 'Infra Modules', price: 25 },
    ];

    const resourceTotals: EconomyAnalytics['resourceTotals'] = [];
    for (const r of resourcesList) {
      const qRes = await pool.query(
        'SELECT COALESCE(SUM(quantity), 0) as total FROM resource_ledger WHERE resource_id = $1',
        [r.id]
      );
      const stock = parseInt(qRes.rows[0]?.total, 10) || 0;
      resourceTotals.push({
        resourceId: r.id,
        name: r.name,
        totalStockHeld: stock,
        basePriceVb: r.price,
        nominalValuationVb: stock * r.price,
      });
    }

    // 5. Missions Metrics
    const msnRes = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM missions WHERE is_active = TRUE) as total_m,
        (SELECT COUNT(*) FROM mission_instances) as total_inst,
        (SELECT COUNT(*) FROM mission_instances WHERE status = 'completed') as comp_inst,
        (SELECT COALESCE(SUM(reward_vb_paid), 0) FROM mission_instances) as rewards_paid
    `);

    const totalM = parseInt(msnRes.rows[0].total_m, 10) || 0;
    const totalInst = parseInt(msnRes.rows[0].total_inst, 10) || 0;
    const compInst = parseInt(msnRes.rows[0].comp_inst, 10) || 0;
    const rewardsPaid = parseInt(msnRes.rows[0].rewards_paid, 10) || 0;
    const msnRate = totalInst > 0 ? Number(((compInst / totalInst) * 100).toFixed(1)) : 0;

    // 6. Disputes Metrics
    const dispRes = await pool.query(`
      SELECT
        COUNT(*) as total_disp,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_disp,
        COALESCE(SUM(awarded_vb), 0) as total_awarded
      FROM disputes
    `);

    const totalDisp = parseInt(dispRes.rows[0].total_disp, 10) || 0;
    const resolvedDisp = parseInt(dispRes.rows[0].resolved_disp, 10) || 0;
    const totalAwarded = parseInt(dispRes.rows[0].total_awarded, 10) || 0;

    return {
      m0MoneySupplyVb: circulating,
      totalGrantsIssuedVb: totalGrants,
      totalBurnsFinesVb: totalBurns,
      activeCirculatingVb: circulating,
      zeroSumBalanced: totalGrants >= circulating,
      transactionsCount: txCount,
      totalTransferVolumeVb: transferVolume,
      giniCoefficient: gini,
      companiesCount: compRes.rows.length,
      citizensCount: 100,
      companyWealthDistribution: compWealth,
      resourceTotals,
      missionsProgress: {
        totalMissions: totalM,
        totalInstances: totalInst,
        completedInstances: compInst,
        completionRatePercent: msnRate,
        totalRewardsDistributedVb: rewardsPaid,
      },
      disputesMetrics: {
        totalDisputesFiled: totalDisp,
        resolvedDisputes: resolvedDisp,
        totalAwardedVb: totalAwarded,
      },
    };
  }
}
