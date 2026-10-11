import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LedgerService } from '../lib/ledger/service';
import { pool } from '../lib/db';
import { runSeed } from '../../scripts/seed';

describe('World Freeze State - Write Blocking Enforcement', () => {
  beforeAll(async () => {
    await runSeed();
  });

  afterAll(async () => {
    // Unfreeze at end of test suite
    await pool.query("UPDATE world_state SET is_frozen = FALSE, freeze_reason = NULL WHERE id = 'default'");
  });

  it('blocks participant-to-participant transfers when simulation is frozen', async () => {
    // 1. Freeze the world
    await pool.query(
      "UPDATE world_state SET is_frozen = TRUE, freeze_reason = 'Simulation Freeze Drill' WHERE id = 'default'"
    );

    // 2. Attempt direct transfer
    await expect(
      LedgerService.executeTransfer({
        fromType: 'participant',
        fromId: 'vc_p_001',
        toType: 'participant',
        toId: 'vc_p_002',
        amount: 25,
        reason: 'Transfer during freeze',
        authoriser: 'vc_p_001',
        isGmOverride: false,
      })
    ).rejects.toThrow(/WORLD_IS_FROZEN/);

    // 3. Attempt transfer proposal creation
    await expect(
      LedgerService.initiateCounterpartyTransfer({
        senderId: 'vc_p_001',
        recipientId: 'vc_p_002',
        amount: 25,
        reason: 'Proposal during freeze',
      })
    ).rejects.toThrow(/WORLD_IS_FROZEN/);

    // 4. GM override CAN execute during freeze for audited emergency corrections
    const gmOverride = await LedgerService.executeTransfer({
      fromType: 'system',
      fromId: null,
      toType: 'participant',
      toId: 'vc_p_001',
      amount: 100,
      reason: 'GM emergency liquidity during freeze',
      authoriser: 'op_gm',
      isGmOverride: true,
    });
    expect(gmOverride.committed).toBe(true);

    // 5. Unfreeze and verify normal operations resume
    await pool.query(
      "UPDATE world_state SET is_frozen = FALSE, freeze_reason = NULL WHERE id = 'default'"
    );

    const normalTransfer = await LedgerService.executeTransfer({
      fromType: 'participant',
      fromId: 'vc_p_001',
      toType: 'participant',
      toId: 'vc_p_002',
      amount: 25,
      reason: 'Transfer after unfreeze',
      authoriser: 'vc_p_001',
      isGmOverride: false,
    });
    expect(normalTransfer.committed).toBe(true);
  });
});
