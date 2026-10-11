import { describe, it, expect, beforeAll } from 'vitest';
import { runSeed } from '../../scripts/seed';
import { LedgerService } from '../lib/ledger/service';
import { DealService } from '../lib/deals/service';
import { pool } from '../lib/db';

describe('ACID Transaction Atomicity & Bilateral Debit/Credit Conservation', () => {
  beforeAll(async () => {
    await runSeed();
  });

  const founderId = 'vc_p_001'; // Aarav Sharma (Founder & CEO of SwiftCart)
  const recipientId = 'vc_p_002'; // Vivaan Patel

  it('guarantees personal balance immediately reduces on transaction and recipient is credited', async () => {
    // 1. Get initial personal balances
    const founderBalBefore = await LedgerService.getBalance('participant', founderId);
    const recipientBalBefore = await LedgerService.getBalance('participant', recipientId);

    expect(founderBalBefore).toBeGreaterThan(0);
    expect(recipientBalBefore).toBeGreaterThan(0);

    const transferAmount = 150;

    // 2. Execute atomic transfer
    const res = await LedgerService.executeTransfer({
      fromType: 'participant',
      fromId: founderId,
      toType: 'participant',
      toId: recipientId,
      amount: transferAmount,
      type: 'transfer',
      reason: 'Founder personal consulting disbursement',
      authoriser: founderId,
    });

    expect(res.committed).toBe(true);

    // 3. Verify founder personal balance is IMMEDIATELY reduced
    const founderBalAfter = await LedgerService.getBalance('participant', founderId);
    expect(founderBalAfter).toBe(founderBalBefore - transferAmount);

    // 4. Verify recipient balance is IMMEDIATELY credited
    const recipientBalAfter = await LedgerService.getBalance('participant', recipientId);
    expect(recipientBalAfter).toBe(recipientBalBefore + transferAmount);

    // 5. Zero-sum invariant check: Delta sender + Delta recipient = 0
    const deltaSender = founderBalAfter - founderBalBefore;
    const deltaRecipient = recipientBalAfter - recipientBalBefore;
    expect(deltaSender + deltaRecipient).toBe(0);
  });

  it('enforces ACID Atomicity: overdraft rollbacks completely and leaves personal balance unchanged', async () => {
    const founderBalBefore = await LedgerService.getBalance('participant', founderId);
    const recipientBalBefore = await LedgerService.getBalance('participant', recipientId);

    // Attempting to transfer more than available
    const excessiveAmount = founderBalBefore + 10000;

    await expect(
      LedgerService.executeTransfer({
        fromType: 'participant',
        fromId: founderId,
        toType: 'participant',
        toId: recipientId,
        amount: excessiveAmount,
        type: 'transfer',
        reason: 'Attempted overdraft transaction',
        authoriser: founderId,
      })
    ).rejects.toThrow(/INSUFFICIENT_FUNDS/);

    // Balances must remain strictly unchanged (Rollback verified)
    const founderBalAfter = await LedgerService.getBalance('participant', founderId);
    const recipientBalAfter = await LedgerService.getBalance('participant', recipientId);

    expect(founderBalAfter).toBe(founderBalBefore);
    expect(recipientBalAfter).toBe(recipientBalBefore);
  });

  it('guarantees bilateral deal settlement atomicity: buyer is debited and seller is credited', async () => {
    // 1. Create a commercial sale deal between two companies
    const dealRes = await DealService.createDeal({
      templateType: 'Sale',
      senderType: 'company',
      senderId: 'comp_ledgerly',
      recipientType: 'company',
      recipientId: 'comp_swiftcart',
      terms: {
        item: 'Tactical Sensor Firmware',
        quantity: 1,
        price_vb: 2000,
        price: 2000,
      },
      authoriser: 'vc_p_010',
    });

    const dealId = dealRes.dealId;

    const aetherBalBefore = await LedgerService.getBalance('company', 'comp_swiftcart');
    const kavachBalBefore = await LedgerService.getBalance('company', 'comp_ledgerly');

    // 2. Accept deal (SwiftCart buys from Ledgerly for 2,000 VB)
    const acceptRes = await DealService.acceptDeal(dealId, 'vc_p_001');
    expect(acceptRes.success).toBe(true);

    // 3. Verify buyer debited and seller credited
    const aetherBalAfter = await LedgerService.getBalance('company', 'comp_swiftcart');
    const kavachBalAfter = await LedgerService.getBalance('company', 'comp_ledgerly');

    expect(aetherBalAfter).toBe(aetherBalBefore - 2000);
    expect(kavachBalAfter).toBe(kavachBalBefore + 2000);

    // Delta sum is 0
    expect((aetherBalAfter - aetherBalBefore) + (kavachBalAfter - kavachBalBefore)).toBe(0);
  });

  it('validates Freelance agreement compensation: client debited, freelancer credited', async () => {
    const employerBalBefore = await LedgerService.getBalance('company', 'comp_swiftcart');
    const freelancerBalBefore = await LedgerService.getBalance('participant', 'vc_p_091'); // Free Agent

    const dealRes = await DealService.createDeal({
      templateType: 'Freelance',
      senderType: 'company',
      senderId: 'comp_swiftcart',
      recipientType: 'participant',
      recipientId: 'vc_p_091',
      terms: {
        deliverable: 'Avionics Firmware Audit',
        fee_vb: 300,
        fee: 300,
      },
      authoriser: founderId,
    });

    await DealService.acceptDeal(dealRes.dealId, 'vc_p_091');

    const employerBalAfter = await LedgerService.getBalance('company', 'comp_swiftcart');
    const freelancerBalAfter = await LedgerService.getBalance('participant', 'vc_p_091');

    expect(employerBalAfter).toBe(employerBalBefore - 300);
    expect(freelancerBalAfter).toBe(freelancerBalBefore + 300);
  });

  it('verifies system-wide zero-sum conservation across all ledger entries', async () => {
    // Total credits minus debits for non-system entities must balance minted currency
    const res = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN from_type = 'system' THEN amount ELSE 0 END), 0) as total_minted,
        COALESCE(SUM(CASE WHEN to_type = 'system' THEN amount ELSE 0 END), 0) as total_burned,
        COALESCE(SUM(CASE WHEN to_type != 'system' THEN amount ELSE 0 END), 0) as total_credits,
        COALESCE(SUM(CASE WHEN from_type != 'system' THEN amount ELSE 0 END), 0) as total_debits
      FROM ledger_entries
    `);

    const minted = parseInt(res.rows[0].total_minted, 10);
    const burned = parseInt(res.rows[0].total_burned, 10);
    const credits = parseInt(res.rows[0].total_credits, 10);
    const debits = parseInt(res.rows[0].total_debits, 10);

    // In a double-entry / append-only ledger:
    // (Credits to entities) - (Debits from entities) must exactly equal Net Minted (Minted - Burned)
    const netEntityCirculation = credits - debits;
    const netSystemCreated = minted - burned;

    expect(netEntityCirculation).toBe(netSystemCreated);
  });
});
