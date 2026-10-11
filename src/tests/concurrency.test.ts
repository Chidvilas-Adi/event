import { describe, it, expect, beforeAll } from 'vitest';
import { LedgerService } from '../lib/ledger/service';
import { runSeed } from '../../scripts/seed';

describe('Concurrency Validation - 50 Simultaneous Transfers', () => {
  beforeAll(async () => {
    await runSeed();
  });

  it('50 simultaneous concurrent transfers draining one wallet never take it below zero and never duplicate money', async () => {
    const senderId = 'vc_p_010';
    const recipientId = 'vc_p_011';

    // Check starting balances
    const initialSenderBal = await LedgerService.getBalance('participant', senderId);
    const initialRecipientBal = await LedgerService.getBalance('participant', recipientId);
    expect(initialSenderBal).toBe(500);

    // Attempt 50 simultaneous transfers of 20 VB each (Total requested = 1000 VB, but balance is only 500 VB)
    const transferAmount = 20;
    const totalRequests = 50;

    const promises = Array.from({ length: totalRequests }).map((_, i) =>
      LedgerService.executeTransfer({
        fromType: 'participant',
        fromId: senderId,
        toType: 'participant',
        toId: recipientId,
        amount: transferAmount,
        reason: `Concurrent transfer stress #${i}`,
        authoriser: senderId,
        idempotencyKey: `stress_${Date.now()}_${i}`,
      })
        .then((res) => ({ success: true, entryId: res.entryId }))
        .catch((err) => ({ success: false, error: err.message }))
    );

    const results = await Promise.all(promises);

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r): r is { success: false; error: string } => !r.success);

    // Starting balance 500 / 20 = exactly 25 transfers must succeed, 25 must fail
    expect(successes.length).toBe(25);
    expect(failures.length).toBe(25);

    // Every failure must be due to insufficient funds
    for (const f of failures) {
      expect(f.error).toMatch(/INSUFFICIENT_FUNDS/);
    }

    // Check ending balances
    const finalSenderBal = await LedgerService.getBalance('participant', senderId);
    const finalRecipientBal = await LedgerService.getBalance('participant', recipientId);

    // Sender must be exactly 0, never negative
    expect(finalSenderBal).toBe(0);

    // Recipient must receive exactly 25 * 20 = 500 VB
    expect(finalRecipientBal).toBe(initialRecipientBal + 500);

    // Conservation of money: (Sender_start + Recipient_start) === (Sender_end + Recipient_end)
    expect(initialSenderBal + initialRecipientBal).toBe(finalSenderBal + finalRecipientBal);
  });
});
