import { describe, it, expect, beforeAll } from 'vitest';
import { LedgerService } from '../lib/ledger/service';
import { pool } from '../lib/db';
import { runSeed } from '../../scripts/seed';

describe('VB Ledger Service - Core Rules & Integrity', () => {
  beforeAll(async () => {
    await runSeed();
  });

  it('calculates balance correctly from ledger_entries without editable numbers', async () => {
    // VC-001 starts with 500 VB staking allowance from seed
    const balance = await LedgerService.getBalance('participant', 'vc_p_001');
    expect(balance).toBe(500);
  });

  it('rejects floating point amounts strictly', async () => {
    await expect(
      LedgerService.executeTransfer({
        fromType: 'participant',
        fromId: 'vc_p_001',
        toType: 'participant',
        toId: 'vc_p_002',
        amount: 25.5, // float
        reason: 'Illegal fractional VB transfer',
        authoriser: 'vc_p_001',
      })
    ).rejects.toThrow(/INVALID_AMOUNT/);
  });

  it('rejects non-positive amounts', async () => {
    await expect(
      LedgerService.executeTransfer({
        fromType: 'participant',
        fromId: 'vc_p_001',
        toType: 'participant',
        toId: 'vc_p_002',
        amount: -100,
        reason: 'Negative transfer',
        authoriser: 'vc_p_001',
      })
    ).rejects.toThrow(/INVALID_AMOUNT/);
  });

  it('rejects overspend when balance is insufficient', async () => {
    const currentBal = await LedgerService.getBalance('participant', 'vc_p_001');
    await expect(
      LedgerService.executeTransfer({
        fromType: 'participant',
        fromId: 'vc_p_001',
        toType: 'participant',
        toId: 'vc_p_002',
        amount: currentBal + 500, // exceeds balance
        reason: 'Attempted overspend',
        authoriser: 'vc_p_001',
      })
    ).rejects.toThrow(/INSUFFICIENT_FUNDS/);
  });

  it('enforces idempotency - duplicate key does not duplicate money or create duplicate entry', async () => {
    const key = `test_idemp_${Date.now()}`;
    const initialBalSender = await LedgerService.getBalance('participant', 'vc_p_001');
    const initialBalRecipient = await LedgerService.getBalance('participant', 'vc_p_002');

    // First attempt
    const res1 = await LedgerService.executeTransfer({
      fromType: 'participant',
      fromId: 'vc_p_001',
      toType: 'participant',
      toId: 'vc_p_002',
      amount: 50,
      reason: 'Idempotency test transfer',
      authoriser: 'vc_p_001',
      idempotencyKey: key,
    });
    expect(res1.committed).toBe(true);

    // Second attempt with exact same idempotency key
    const res2 = await LedgerService.executeTransfer({
      fromType: 'participant',
      fromId: 'vc_p_001',
      toType: 'participant',
      toId: 'vc_p_002',
      amount: 50,
      reason: 'Duplicate retry',
      authoriser: 'vc_p_001',
      idempotencyKey: key,
    });
    expect(res2.committed).toBe(false);
    expect(res2.entryId).toBe(res1.entryId);

    // Verify balances changed only once
    const endBalSender = await LedgerService.getBalance('participant', 'vc_p_001');
    const endBalRecipient = await LedgerService.getBalance('participant', 'vc_p_002');
    expect(endBalSender).toBe(initialBalSender - 50);
    expect(endBalRecipient).toBe(initialBalRecipient + 50);
  });

  it('creates compensating entry that links to original without editing the original', async () => {
    // 1. Initial transfer
    const res = await LedgerService.executeTransfer({
      fromType: 'participant',
      fromId: 'vc_p_001',
      toType: 'participant',
      toId: 'vc_p_002',
      amount: 40,
      reason: 'Erroneous transfer to be reversed',
      authoriser: 'vc_p_001',
    });

    const balAfterTransfer = await LedgerService.getBalance('participant', 'vc_p_001');

    // 2. Compensating entry
    const compId = await LedgerService.createCompensatingEntry(
      res.entryId,
      'op_gm',
      'Compensating erroneous payment reversal',
      true
    );

    // 3. Balance restored
    const balAfterComp = await LedgerService.getBalance('participant', 'vc_p_001');
    expect(balAfterComp).toBe(balAfterTransfer + 40);

    // 4. Verify original entry still exists unaltered in database
    const origQuery = await pool.query('SELECT * FROM ledger_entries WHERE id = $1', [res.entryId]);
    expect(origQuery.rows.length).toBe(1);
    expect(origQuery.rows[0].amount).toBe(40);

    // 5. Verify compensation links to original
    const compQuery = await pool.query('SELECT * FROM ledger_entries WHERE id = $1', [compId]);
    expect(compQuery.rows[0].linked_original_id).toBe(res.entryId);
    expect(compQuery.rows[0].type).toBe('compensation');
  });
});
