import { pool, withTransaction } from '@/lib/db';
import { LedgerService } from '@/lib/ledger/service';
import crypto from 'crypto';

export class PaperFallbackService {
  /**
   * Export all append-only ledger entries in CSV
   */
  static async exportLedgerCsv(): Promise<string> {
    const res = await pool.query(
      `SELECT id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser, idempotency_key
       FROM ledger_entries
       ORDER BY timestamp ASC`
    );

    let csv = 'Entry ID,Timestamp,From Type,From ID,To Type,To ID,Amount (VB),Type,Reason,Authoriser,Idempotency Key\n';
    for (const r of res.rows) {
      csv += `"${r.id}","${r.timestamp.toISOString()}","${r.from_type || ''}","${r.from_id || ''}","${r.to_type || ''}","${r.to_id || ''}",${r.amount},"${r.type}","${(r.reason || '').replace(/"/g, '""')}","${r.authoriser}","${r.idempotency_key || ''}"\n`;
    }
    return csv;
  }

  /**
   * Export company balances, resources, and status in CSV
   */
  static async exportCompanyBalancesCsv(): Promise<string> {
    const compRes = await pool.query('SELECT id, name, tagline, status, tier FROM companies ORDER BY tier, name');
    let csv = 'Company ID,Name,Status,Tier,Treasury Balance (VB),Compute,Energy,Logistics,Materials,Data,Infra,SPV Estimate (VB)\n';

    for (const c of compRes.rows) {
      const balance = await LedgerService.getBalance('company', c.id);

      // Resources
      const resTotals = await pool.query(
        `SELECT resource_id, SUM(quantity) as net_qty
         FROM resource_ledger
         WHERE owner_type = 'company' AND owner_id = $1
         GROUP BY resource_id`,
        [c.id]
      );
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

      // Base prices: 25, 15, 20, 20, 20, 25
      const resourceValuation = (compute * 25) + (energy * 15) + (logistics * 20) + (materials * 20) + (data * 20) + (infra * 25);
      const spv = balance + resourceValuation;

      csv += `"${c.id}","${c.name}","${c.status}",${c.tier},${balance},${compute},${energy},${logistics},${materials},${data},${infra},${spv}\n`;
    }
    return csv;
  }

  /**
   * Export complete citizen roster with wallets and assignments in CSV
   */
  static async exportCitizenRosterCsv(): Promise<string> {
    const res = await pool.query(`
      SELECT p.citizen_code, p.id, p.name, p.email, p.status,
             c.id as company_id, c.name as company_name, m.role as company_role
      FROM participants p
      LEFT JOIN memberships m ON p.id = m.participant_id AND m.status = 'active'
      LEFT JOIN companies c ON m.company_id = c.id
      ORDER BY p.citizen_code ASC
    `);

    let csv = 'Citizen Code,Participant ID,Name,Email,Company,Role,Wallet Balance (VB),Status\n';
    for (const r of res.rows) {
      const balance = await LedgerService.getBalance('participant', r.id);
      csv += `"${r.citizen_code}","${r.id}","${r.name}","${r.email || ''}","${r.company_name || 'Independent Free Agent'}","${r.company_role || 'Free Agent'}",${balance},"${r.status}"\n`;
    }
    return csv;
  }

  /**
   * Export company cap tables in CSV
   */
  static async exportCapTableCsv(): Promise<string> {
    const res = await pool.query(`
      SELECT ct.id, ct.company_id, c.name as company_name, ct.shareholder_type, ct.shareholder_id,
             ct.shares_or_percent, ct.rights,
             CASE
               WHEN ct.shareholder_type = 'company' THEN (SELECT name FROM companies WHERE id = ct.shareholder_id)
               WHEN ct.shareholder_type = 'participant' THEN (SELECT name FROM participants WHERE id = ct.shareholder_id)
               ELSE ct.shareholder_id
             END as shareholder_name
      FROM cap_table ct
      JOIN companies c ON ct.company_id = c.id
      ORDER BY ct.company_id, ct.shares_or_percent DESC
    `);

    let csv = 'Cap Table ID,Company ID,Company Name,Shareholder Type,Shareholder ID,Shareholder Name,Equity (%),Rights\n';
    for (const r of res.rows) {
      csv += `"${r.id}","${r.company_id}","${r.company_name}","${r.shareholder_type}","${r.shareholder_id}","${r.shareholder_name || ''}",${r.shares_or_percent},"${JSON.stringify(r.rights).replace(/"/g, '""')}"\n`;
    }
    return csv;
  }

  /**
   * Generate Printable Deal Slips HTML matching physical 30 numbered pads per desk
   */
  static generatePrintableDealSlipsHtml(deskName?: string, count: number = 30): string {
    const slips = [];
    for (let i = 1; i <= count; i++) {
      const padNum = String(i).padStart(3, '0');
      slips.push(`
        <div class="deal-slip">
          <div class="slip-header">
            <div class="title-block">
              <span class="logo">VENTURE CITY</span>
              <span class="subtitle">OFFICIAL PHYSICAL TRANSACTION FORM</span>
            </div>
            <div class="pad-number">FORM #${padNum}</div>
          </div>
          
          <div class="meta-row">
            <div><strong>DESK / STATION:</strong> ________________________</div>
            <div><strong>TICK:</strong> ______</div>
            <div><strong>TIME:</strong> ____________</div>
          </div>

          <div class="parties-grid">
            <div class="party-box">
              <div class="box-title">SENDER / PROPOSER (PARTY A)</div>
              <div class="field">Citizen Code / Company: ______________________</div>
              <div class="field">Signatory Name: ________________________________</div>
              <div class="field">Role: [ ] Founder  [ ] Employee  [ ] Free Agent</div>
            </div>
            <div class="party-box">
              <div class="box-title">RECIPIENT / COUNTERPARTY (PARTY B)</div>
              <div class="field">Citizen Code / Company: ______________________</div>
              <div class="field">Signatory Name: ________________________________</div>
              <div class="field">Role: [ ] Institution  [ ] Founder  [ ] Partner</div>
            </div>
          </div>

          <div class="terms-section">
            <div class="box-title">TRANSACTION SPECIFICATION</div>
            <div class="field"><strong>Type:</strong> [ ] Resource Sale &nbsp; [ ] Commercial Deal &nbsp; [ ] Loan &nbsp; [ ] Equity &nbsp; [ ] Service &nbsp; [ ] Settlement</div>
            <div class="field"><strong>Financial Value:</strong> __________________ VB (Venture Bucks)</div>
            <div class="field"><strong>Resources Exchanged:</strong> [ ] Compute &nbsp; [ ] Energy &nbsp; [ ] Logistics &nbsp; [ ] Materials &nbsp; [ ] Data &nbsp; [ ] Infra</div>
            <div class="field"><strong>Quantity & Specification:</strong> ________________________________________________________________</div>
            <div class="field"><strong>Performance Milestones / Terms:</strong> ____________________________________________________________</div>
          </div>

          <div class="signatures-grid">
            <div class="sig-box">
              <div>Party A Authorized Signature</div>
              <div class="sig-line">X ______________________________</div>
            </div>
            <div class="sig-box">
              <div>Party B Authorized Signature</div>
              <div class="sig-line">X ______________________________</div>
            </div>
            <div class="sig-box stamp-box">
              <div>Station Volunteer / Verifier Stamp</div>
              <div class="stamp-circle">[ OFFICIAL VERIFICATION ]</div>
            </div>
          </div>
          <div class="slip-footer">VENTURE CITY OPERATING SYSTEM · PAPER FALLBACK ARCHIVE · PESU VENTURE LABS</div>
        </div>
      `);
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Venture City - Printable Transaction Slips</title>
  <style>
    @page { size: A4; margin: 10mm; }
    body { font-family: monospace, sans-serif; margin: 0; padding: 10px; background: #fff; color: #000; }
    .deal-slip {
      border: 2px solid #000;
      padding: 14px;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .slip-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .title-block .logo { font-size: 18px; font-weight: 900; letter-spacing: 2px; }
    .title-block .subtitle { display: block; font-size: 10px; color: #444; }
    .pad-number { font-size: 16px; font-weight: bold; border: 2px solid #000; padding: 4px 8px; background: #eee; }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 12px; }
    .parties-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    .party-box, .terms-section { border: 1px solid #444; padding: 8px; font-size: 11px; }
    .box-title { font-weight: bold; background: #000; color: #fff; padding: 2px 4px; margin-bottom: 6px; font-size: 10px; }
    .field { margin-bottom: 4px; }
    .terms-section { margin-bottom: 10px; }
    .signatures-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .sig-box { border: 1px solid #444; padding: 6px; font-size: 10px; text-align: center; }
    .sig-line { margin-top: 25px; font-weight: bold; }
    .stamp-box .stamp-circle { border: 1px dashed #666; margin-top: 8px; padding: 8px; font-size: 9px; }
    .slip-footer { font-size: 8px; text-align: center; margin-top: 8px; color: #666; border-top: 1px dotted #888; padding-top: 4px; }
    @media print {
      .no-print { display: none; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; padding: 12px; background: #eee; border: 1px solid #999; display: flex; justify-content: space-between;">
    <div><strong>Venture City Physical Fallback Print Station</strong> — 30 Numbered Transaction Pads</div>
    <button onclick="window.print()" style="padding: 6px 16px; font-weight: bold; cursor: pointer; background: #000; color: #fff; border: none;">PRINT NOW</button>
  </div>
  ${slips.join('')}
</body>
</html>`;
  }

  /**
   * Take full database state JSON snapshot
   */
  static async createSnapshot(actorId: string, name?: string) {
    const [
      worldRes,
      compRes,
      partRes,
      membRes,
      instRes,
      resLedgRes,
      ledgRes,
      dealsRes,
      loansRes,
      capRes,
      crisesRes,
      dispRes,
      configRes,
      ticksRes,
    ] = await Promise.all([
      pool.query('SELECT * FROM world_state'),
      pool.query('SELECT * FROM companies'),
      pool.query('SELECT * FROM participants'),
      pool.query('SELECT * FROM memberships'),
      pool.query('SELECT * FROM institutions'),
      pool.query('SELECT * FROM resource_ledger'),
      pool.query('SELECT * FROM ledger_entries'),
      pool.query('SELECT * FROM deals'),
      pool.query('SELECT * FROM loans'),
      pool.query('SELECT * FROM cap_table'),
      pool.query('SELECT * FROM crises'),
      pool.query('SELECT * FROM disputes'),
      pool.query('SELECT * FROM config_params'),
      pool.query('SELECT * FROM ticks'),
    ]);

    const snapshotPayload = {
      timestamp: new Date().toISOString(),
      world_state: worldRes.rows,
      companies: compRes.rows,
      participants: partRes.rows,
      memberships: membRes.rows,
      institutions: instRes.rows,
      resource_ledger: resLedgRes.rows,
      ledger_entries: ledgRes.rows,
      deals: dealsRes.rows,
      loans: loansRes.rows,
      cap_table: capRes.rows,
      crises: crisesRes.rows,
      disputes: dispRes.rows,
      config_params: configRes.rows,
      ticks: ticksRes.rows,
    };

    const payloadString = JSON.stringify(snapshotPayload);
    const hash = crypto.createHash('sha256').update(payloadString).digest('hex');
    const snapshotId = `snap_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const snapName = name || `Venture City Snapshot - ${new Date().toLocaleTimeString()}`;

    await pool.query(
      `INSERT INTO system_snapshots (id, name, snapshot_hash, data, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [snapshotId, snapName, hash, payloadString, actorId]
    );

    return {
      snapshotId,
      name: snapName,
      hash,
      totalLedgerEntries: ledgRes.rows.length,
      totalCompanies: compRes.rows.length,
      totalParticipants: partRes.rows.length,
      payload: snapshotPayload,
    };
  }

  /**
   * List existing snapshots
   */
  static async listSnapshots() {
    const res = await pool.query(
      `SELECT id, name, snapshot_hash, created_by, created_at,
              jsonb_array_length(data->'ledger_entries') as ledger_count,
              jsonb_array_length(data->'companies') as company_count
       FROM system_snapshots
       ORDER BY created_at DESC`
    );
    return res.rows;
  }
}
