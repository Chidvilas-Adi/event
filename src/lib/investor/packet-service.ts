import { pool } from '@/lib/db';
import { LedgerService } from '@/lib/ledger/service';
import { ObserverEvidenceService, FounderEvidence } from '@/lib/observer/service';

export interface InvestorPacket {
  companyId: string;
  name: string;
  tagline: string;
  description: string;
  tier: number;
  status: string;
  team: {
    participantId: string;
    citizenCode: string;
    name: string;
    role: string;
    walletBalance: number;
  }[];
  financials: {
    cashBalanceVb: number;
    resources: {
      compute: number;
      energy: number;
      logistics: number;
      materials: number;
      data: number;
      infrastructure: number;
    };
    resourceValuationVb: number;
    totalSpvVb: number;
    baselineSpvVb: number;
    spvGrowthPercent: number;
    outstandingLoansVb: number;
  };
  commercialTraction: {
    completedDealsCount: number;
    totalRevenueVb: number;
    anchorContractExecuted: boolean;
    activeCustomerContracts: number;
  };
  capTable: {
    shareholderType: string;
    shareholderName: string;
    sharesOrPercent: number;
    rights: any;
  }[];
  crisisResilience: {
    crisesRespondedCount: number;
    disputesCount: number;
    disputesWonCount: number;
  };
  founderEvidence: FounderEvidence[];
  score: {
    commercialScore: number;
    financialScore: number;
    resilienceScore: number;
    behavioralScore: number;
    totalScore: number;
    syndicateVerdict: 'STRONG_INVEST' | 'SYNDICATE_FOLLOW_ON' | 'CONDITIONAL_HOLD' | 'PASS';
    thesisSummary: string;
  };
}

export class InvestorPacketService {
  /**
   * Generate an Investor Day Packet for an individual company
   */
  static async generatePacketForCompany(companyId: string): Promise<InvestorPacket> {
    const compRes = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
    if (compRes.rows.length === 0) {
      throw new Error(`Company "${companyId}" not found.`);
    }
    const company = compRes.rows[0];

    // 1. Team Members
    const teamRes = await pool.query(`
      SELECT p.id, p.citizen_code, p.name, m.role,
        COALESCE((
          SELECT SUM(CASE WHEN to_type = 'participant' AND to_id = p.id THEN amount WHEN from_type = 'participant' AND from_id = p.id THEN -amount ELSE 0 END)
          FROM ledger_entries
        ), 0) as wallet_balance
      FROM memberships m
      JOIN participants p ON m.participant_id = p.id
      WHERE m.company_id = $1 AND m.status = 'active'
      ORDER BY m.id ASC
    `, [companyId]);

    const team = teamRes.rows.map((r) => ({
      participantId: r.id,
      citizenCode: r.citizen_code,
      name: r.name,
      role: r.role,
      walletBalance: parseInt(r.wallet_balance, 10) || 0,
    }));

    // 2. Financials
    const cashBalance = await LedgerService.getBalance('company', companyId);

    const resTotals = await pool.query(`
      SELECT resource_id, SUM(quantity) as net_qty
      FROM resource_ledger
      WHERE owner_type = 'company' AND owner_id = $1
      GROUP BY resource_id
    `, [companyId]);

    const resMap: Record<string, number> = {};
    for (const r of resTotals.rows) {
      resMap[r.resource_id] = parseInt(r.net_qty, 10) || 0;
    }

    const compute = resMap['compute'] || 0;
    const energy = resMap['energy'] || 0;
    const logistics = resMap['logistics'] || 0;
    const materials = resMap['materials'] || 0;
    const data = resMap['data'] || 0;
    const infra = resMap['infrastructure'] || 0;

    // Base market values: Compute (25), Energy (15), Logistics (20), Materials (20), Data (20), Infra (25)
    const resourceValuation = (compute * 25) + (energy * 15) + (logistics * 20) + (materials * 20) + (data * 20) + (infra * 25);
    const totalSpv = cashBalance + resourceValuation;
    const baselineSpv = 28000;
    const growthPercent = Number((((totalSpv - baselineSpv) / baselineSpv) * 100).toFixed(1));

    // Loans outstanding
    const loansRes = await pool.query(
      "SELECT COALESCE(SUM(principal), 0) as loan_total FROM loans WHERE company_id = $1 AND status = 'active'",
      [companyId]
    );
    const outstandingLoans = parseInt(loansRes.rows[0]?.loan_total, 10) || 0;

    // 3. Commercial Traction
    const dealsRes = await pool.query(`
      SELECT d.* FROM deals d
      WHERE (d.sender_id = $1 OR d.recipient_id = $1) AND d.status = 'accepted'
    `, [companyId]);

    const completedDealsCount = dealsRes.rows.length;
    let totalRevenue = 0;
    let anchorExecuted = false;

    for (const d of dealsRes.rows) {
      const terms = typeof d.terms === 'string' ? JSON.parse(d.terms) : d.terms;
      const price = terms?.price_vb || terms?.total_price_vb || 0;
      if (d.recipient_id === companyId) {
        totalRevenue += price;
      }
      if (d.id.includes('anchor')) {
        anchorExecuted = true;
      }
    }

    // 4. Cap Table
    const capRes = await pool.query(`
      SELECT ct.*,
        CASE
          WHEN ct.shareholder_type = 'founder' OR ct.shareholder_type = 'employee' THEN (SELECT name FROM participants WHERE id = ct.shareholder_id)
          ELSE ct.shareholder_id
        END as shareholder_name
      FROM cap_table ct
      WHERE ct.company_id = $1
      ORDER BY ct.shares_or_percent DESC
    `, [companyId]);

    const capTable = capRes.rows.map((r) => ({
      shareholderType: r.shareholder_type,
      shareholderName: r.shareholder_name || r.shareholder_id,
      sharesOrPercent: parseFloat(r.shares_or_percent),
      rights: typeof r.rights === 'string' ? JSON.parse(r.rights) : r.rights,
    }));

    // 5. Crisis & Disputes
    const crisisRes = await pool.query(
      'SELECT count(*) as count FROM crisis_responses WHERE company_id = $1',
      [companyId]
    );
    const crisesRespondedCount = parseInt(crisisRes.rows[0]?.count, 10) || 0;

    const disputesRes = await pool.query(
      'SELECT count(*) as count, count(CASE WHEN status = \'resolved\' AND (ruling = \'claimant_upheld\' AND claimant_id = $1) THEN 1 END) as won FROM disputes WHERE claimant_id = $1 OR respondent_id = $1',
      [companyId]
    );
    const disputesCount = parseInt(disputesRes.rows[0]?.count, 10) || 0;
    const disputesWonCount = parseInt(disputesRes.rows[0]?.won, 10) || 0;

    // 6. Observer Evidence from Founder Ledger
    const evidence = await ObserverEvidenceService.listEvidence({ companyId });

    // 7. Synthetic Scoring & Recommendation
    let commScore = Math.min(25, 10 + (completedDealsCount * 3) + (anchorExecuted ? 5 : 0));
    let finScore = Math.min(25, Math.max(5, Math.round((totalSpv / baselineSpv) * 15)));
    let resScore = Math.min(25, 12 + (crisesRespondedCount * 5) - (outstandingLoans > 15000 ? 5 : 0));

    // Behavioral score from evidence
    let behavScore = 15;
    for (const ev of evidence) {
      if (ev.rating === 'exemplary') behavScore += 3;
      if (ev.rating === 'prudent') behavScore += 2;
      if (ev.rating === 'concerning') behavScore -= 3;
      if (ev.rating === 'adversarial') behavScore -= 5;
    }
    behavScore = Math.min(25, Math.max(5, behavScore));

    const totalScore = commScore + finScore + resScore + behavScore;

    let syndicateVerdict: InvestorPacket['score']['syndicateVerdict'] = 'CONDITIONAL_HOLD';
    let thesisSummary = '';

    if (totalScore >= 80) {
      syndicateVerdict = 'STRONG_INVEST';
      thesisSummary = 'Top-quartile economic velocity, disciplined treasury allocation, and proven founder integrity under macro stress.';
    } else if (totalScore >= 65) {
      syndicateVerdict = 'SYNDICATE_FOLLOW_ON';
      thesisSummary = 'Healthy commercial traction and viable SPV growth; recommended for syndicate participation with milestone vesting.';
    } else if (totalScore >= 45) {
      syndicateVerdict = 'CONDITIONAL_HOLD';
      thesisSummary = 'Moderate operational progress; requires debt restructuring and enhanced governance oversight prior to term sheet.';
    } else {
      syndicateVerdict = 'PASS';
      thesisSummary = 'Distressed unit economics, unresolved disputes, or critical resource depletion.';
    }

    return {
      companyId,
      name: company.name,
      tagline: company.tagline,
      description: company.description,
      tier: company.tier,
      status: company.status,
      team,
      financials: {
        cashBalanceVb: cashBalance,
        resources: { compute, energy, logistics, materials, data, infrastructure: infra },
        resourceValuationVb: resourceValuation,
        totalSpvVb: totalSpv,
        baselineSpvVb: baselineSpv,
        spvGrowthPercent: growthPercent,
        outstandingLoansVb: outstandingLoans,
      },
      commercialTraction: {
        completedDealsCount,
        totalRevenueVb: totalRevenue,
        anchorContractExecuted: anchorExecuted,
        activeCustomerContracts: completedDealsCount,
      },
      capTable,
      crisisResilience: {
        crisesRespondedCount,
        disputesCount,
        disputesWonCount,
      },
      founderEvidence: evidence,
      score: {
        commercialScore: commScore,
        financialScore: finScore,
        resilienceScore: resScore,
        behavioralScore: behavScore,
        totalScore,
        syndicateVerdict,
        thesisSummary,
      },
    };
  }

  /**
   * Generate complete investor packets for all 10 companies
   */
  static async generateAllPackets(): Promise<InvestorPacket[]> {
    const compRes = await pool.query('SELECT id FROM companies ORDER BY tier ASC, name ASC');
    const packets: InvestorPacket[] = [];
    for (const row of compRes.rows) {
      const p = await this.generatePacketForCompany(row.id);
      packets.push(p);
    }
    return packets;
  }
}
