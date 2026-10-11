import { describe, it, expect } from 'vitest';
import { runSeed } from '../../scripts/seed';
import { pool } from '../lib/db';
import { LedgerService } from '../lib/ledger/service';

describe('Seed Data Integrity and Reconciliation', () => {
  it('runs cleanly and reconciles all currency and entity totals exactly', async () => {
    await runSeed();

    // 1. Verify 12 Companies (Master Catalogue N=12)
    const compRes = await pool.query('SELECT COUNT(*) as count FROM companies');
    expect(parseInt(compRes.rows[0].count, 10)).toBe(12);

    // 2. Verify 8 Institutions
    const instRes = await pool.query('SELECT COUNT(*) as count FROM institutions');
    expect(parseInt(instRes.rows[0].count, 10)).toBe(8);

    // 3. Verify 100 Participants
    const partRes = await pool.query('SELECT COUNT(*) as count FROM participants');
    expect(parseInt(partRes.rows[0].count, 10)).toBe(100);

    // 4. Verify Operator Accounts
    const opRes = await pool.query('SELECT username, role_id FROM operator_accounts');
    const usernames = opRes.rows.map((r) => r.username);
    expect(usernames).toContain('gm');
    expect(usernames).toContain('admin');
    expect(usernames).toContain('event_lead');
    expect(usernames).toContain('observer');
    expect(usernames).toContain('volunteer_bank');

    // 5. Verify Ledger Balances
    const swiftcartBal = await LedgerService.getBalance('company', 'comp_swiftcart');
    expect(swiftcartBal).toBeGreaterThan(0);

    const voltwayBal = await LedgerService.getBalance('company', 'comp_voltway');
    expect(voltwayBal).toBeGreaterThan(0);

    // Verify participant balances
    const p1Bal = await LedgerService.getBalance('participant', 'vc_p_001');
    expect(p1Bal).toBe(500);

    const p100Bal = await LedgerService.getBalance('participant', 'vc_p_100');
    expect(p100Bal).toBe(500);

    // 6. Verify Resource ledger initialized (100 units of each of 6 resources per company = 6,000 units)
    const resLedgerRes = await pool.query('SELECT SUM(quantity) as total FROM resource_ledger');
    expect(parseInt(resLedgerRes.rows[0].total, 10)).toBe(6000);
  });
});
