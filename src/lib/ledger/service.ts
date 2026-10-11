import { pool, withTransaction } from '../db';
import crypto from 'crypto';

export interface LedgerTransferParams {
  fromType: 'participant' | 'company' | 'institution' | 'system';
  fromId: string | null;
  toType: 'participant' | 'company' | 'institution' | 'system';
  toId: string | null;
  amount: number;
  type?: 'transfer' | 'credit' | 'debit' | 'grant' | 'compensation' | 'fee';
  reason: string;
  authoriser: string;
  idempotencyKey?: string;
  linkedTransactionId?: string;
  isGmOverride?: boolean;
}

export interface BalanceResult {
  entityType: string;
  entityId: string;
  balance: number;
}

export class LedgerService {
  /**
   * Calculates the exact net VB balance for an entity dynamically from ledger_entries.
   * Balance = (Sum of Credits) - (Sum of Debits). No editable stored balance.
   */
  static async getBalance(
    entityType: 'participant' | 'company' | 'institution',
    entityId: string
  ): Promise<number> {
    const res = await pool.query<{ balance: string }>(
      `SELECT
        COALESCE(
          (SELECT SUM(amount) FROM ledger_entries WHERE to_type = $1 AND to_id = $2),
          0
        ) -
        COALESCE(
          (SELECT SUM(amount) FROM ledger_entries WHERE from_type = $1 AND from_id = $2),
          0
        ) AS balance`,
      [entityType, entityId]
    );

    return parseInt(res.rows[0]?.balance || '0', 10);
  }

  /**
   * Atomically commits a VB ledger entry.
   * Checks freeze status, checks sufficient balance for non-system debits,
   * prevents duplicate execution via idempotency key, and records an audit log.
   */
  static async executeTransfer(params: LedgerTransferParams): Promise<{ entryId: string; committed: boolean }> {
    const {
      fromType,
      fromId,
      toType,
      toId,
      amount,
      type = 'transfer',
      reason,
      authoriser,
      idempotencyKey,
      linkedTransactionId,
      isGmOverride = false,
    } = params;

    // Validate integer amount > 0
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error(`INVALID_AMOUNT: Amount must be a positive integer. Received: ${amount}`);
    }

    if (!reason || reason.trim().length === 0) {
      throw new Error('MISSING_REASON: A written reason is required for every ledger movement.');
    }

    return await withTransaction(async (client) => {
      // 1. Check world freeze state
      const worldRes = await client.query<{ is_frozen: boolean }>(
        'SELECT is_frozen FROM world_state WHERE id = $1',
        ['default']
      );
      const isFrozen = worldRes.rows[0]?.is_frozen ?? false;
      if (isFrozen && !isGmOverride) {
        throw new Error('WORLD_IS_FROZEN: Simulation is frozen. No transactions permitted.');
      }

      // 2. Check Idempotency Key
      if (idempotencyKey) {
        const existing = await client.query<{ id: string }>(
          'SELECT id FROM ledger_entries WHERE idempotency_key = $1',
          [idempotencyKey]
        );
        if (existing.rows.length > 0) {
          return { entryId: existing.rows[0].id, committed: false };
        }
      }

      // 3. Balance verification with advisory lock on sender entity
      if (fromType !== 'system' && fromId) {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [fromId]);

        const balanceRes = await client.query<{ balance: string }>(
          `SELECT
            COALESCE(
              (SELECT SUM(amount) FROM ledger_entries WHERE to_type = $1 AND to_id = $2),
              0
            ) -
            COALESCE(
              (SELECT SUM(amount) FROM ledger_entries WHERE from_type = $1 AND from_id = $2),
              0
            ) AS balance`,
          [fromType, fromId]
        );

        const currentBalance = parseInt(balanceRes.rows[0]?.balance || '0', 10);
        if (currentBalance < amount) {
          throw new Error(
            `INSUFFICIENT_FUNDS: Entity ${fromType}:${fromId} has balance ${currentBalance} VB, required ${amount} VB.`
          );
        }
      }

      // 4. Insert ledger entry
      const entryId = `ledg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      await client.query(
        `INSERT INTO ledger_entries (
          id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser, linked_transaction_id, idempotency_key
        ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          entryId,
          fromType,
          fromId,
          toType,
          toId,
          amount,
          type,
          reason,
          authoriser,
          linkedTransactionId || null,
          idempotencyKey || null,
        ]
      );

      // 5. Audit log entry
      const auditId = `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (
          id, timestamp, actor_id, actor_role, action, object_type, object_id, after_state, reason, related_record_id, source
        ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          auditId,
          authoriser,
          isGmOverride ? 'gm' : 'participant',
          'LEDGER_TRANSACTION',
          'ledger_entries',
          entryId,
          JSON.stringify({ fromType, fromId, toType, toId, amount, type }),
          reason,
          linkedTransactionId || entryId,
          'ledger_service',
        ]
      );

      return { entryId, committed: true };
    });
  }

  /**
   * Creates a compensating ledger entry to reverse an original transaction.
   * Never edits or deletes the original.
   */
  static async createCompensatingEntry(
    originalEntryId: string,
    authoriser: string,
    reason: string,
    isGmOverride = true
  ): Promise<string> {
    if (!reason || reason.trim().length === 0) {
      throw new Error('MISSING_REASON: Reason is mandatory for compensating ledger entries.');
    }

    return await withTransaction(async (client) => {
      // Fetch original entry
      const originalRes = await client.query(
        'SELECT * FROM ledger_entries WHERE id = $1',
        [originalEntryId]
      );

      if (originalRes.rows.length === 0) {
        throw new Error(`ENTRY_NOT_FOUND: Ledger entry ${originalEntryId} does not exist.`);
      }

      const orig = originalRes.rows[0];

      // Invert sender and recipient
      const compId = `comp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      await client.query(
        `INSERT INTO ledger_entries (
          id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser, linked_original_id
        ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, 'compensation', $7, $8, $9)`,
        [
          compId,
          orig.to_type,
          orig.to_id,
          orig.from_type,
          orig.from_id,
          orig.amount,
          `Compensating reversal for ${originalEntryId}: ${reason}`,
          authoriser,
          originalEntryId,
        ]
      );

      // Audit log
      const auditId = `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (
          id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, related_record_id, source
        ) VALUES ($1, NOW(), $2, $3, 'LEDGER_COMPENSATION', 'ledger_entries', $4, $5, $6, 'ledger_service')`,
        [
          auditId,
          authoriser,
          isGmOverride ? 'gm' : 'operator',
          compId,
          reason,
          originalEntryId,
        ]
      );

      return compId;
    });
  }

  /**
   * Participant-to-Participant transfer request flow (with counterparty confirmation).
   * Step 1: Sender creates a transfer proposal in transactions table.
   */
  static async initiateCounterpartyTransfer(params: {
    senderId: string;
    recipientId: string;
    amount: number;
    reason: string;
    idempotencyKey?: string;
  }): Promise<{ transactionId: string }> {
    const { senderId, recipientId, amount, reason, idempotencyKey } = params;

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('INVALID_AMOUNT: Transfer amount must be a positive integer.');
    }

    if (senderId === recipientId) {
      throw new Error('INVALID_RECIPIENT: Cannot transfer VB to yourself.');
    }

    // Check freeze
    const worldRes = await pool.query<{ is_frozen: boolean }>(
      'SELECT is_frozen FROM world_state WHERE id = $1',
      ['default']
    );
    if (worldRes.rows[0]?.is_frozen) {
      throw new Error('WORLD_IS_FROZEN: City is frozen. Transfers disabled.');
    }

    // Check sender has sufficient funds
    const currentBalance = await this.getBalance('participant', senderId);
    if (currentBalance < amount) {
      throw new Error(`INSUFFICIENT_FUNDS: Current balance is ${currentBalance} VB. Required: ${amount} VB.`);
    }

    // Check recipient exists
    const recRes = await pool.query('SELECT name FROM participants WHERE id = $1', [recipientId]);
    if (recRes.rows.length === 0) {
      throw new Error(`RECIPIENT_NOT_FOUND: Participant ${recipientId} does not exist.`);
    }

    const txId = `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    return await withTransaction(async (client) => {
      if (idempotencyKey) {
        const existing = await client.query<{ id: string }>(
          'SELECT id FROM transactions WHERE idempotency_key = $1',
          [idempotencyKey]
        );
        if (existing.rows.length > 0) {
          return { transactionId: existing.rows[0].id };
        }
      }

      await client.query(
        `INSERT INTO transactions (
          id, type, sender_type, sender_id, recipient_type, recipient_id, value, status, source, authoriser, idempotency_key, metadata
        ) VALUES ($1, 'vb_transfer', 'participant', $2, 'participant', $3, $4, 'pending_confirmation', 'web', $2, $5, $6)`,
        [
          txId,
          senderId,
          recipientId,
          amount,
          idempotencyKey || null,
          JSON.stringify({ reason }),
        ]
      );

      // Create notification for recipient
      const notifId = `notif_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      await client.query(
        `INSERT INTO notifications (
          id, recipient_id, type, title, message, payload
        ) VALUES ($1, $2, 'transfer_request', 'Incoming VB Transfer Request', $3, $4)`,
        [
          notifId,
          recipientId,
          `Citizen ${senderId} wants to send you ${amount} VB: "${reason}"`,
          JSON.stringify({ transactionId: txId, amount, senderId, reason }),
        ]
      );

      return { transactionId: txId };
    });
  }

  /**
   * Participant-to-Participant transfer request flow.
   * Step 2: Recipient accepts the transfer -> committed atomically.
   */
  static async confirmTransfer(transactionId: string, recipientId: string): Promise<{ entryId: string }> {
    return await withTransaction(async (client) => {
      // 1. Lock transaction row
      const txRes = await client.query(
        'SELECT * FROM transactions WHERE id = $1 FOR UPDATE',
        [transactionId]
      );

      if (txRes.rows.length === 0) {
        throw new Error('TRANSACTION_NOT_FOUND');
      }

      const tx = txRes.rows[0];

      if (tx.recipient_id !== recipientId) {
        throw new Error('UNAUTHORIZED_ACTION: Only recipient can accept this transfer.');
      }

      if (tx.status !== 'pending_confirmation') {
        throw new Error(`INVALID_STATUS: Transaction is already ${tx.status}.`);
      }

      // 2. Check world freeze
      const worldRes = await client.query<{ is_frozen: boolean }>(
        'SELECT is_frozen FROM world_state WHERE id = $1',
        ['default']
      );
      if (worldRes.rows[0]?.is_frozen) {
        throw new Error('WORLD_IS_FROZEN: Simulation is frozen.');
      }

      // 3. Check sender balance with advisory lock
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [tx.sender_id]);
      const balanceRes = await client.query<{ balance: string }>(
        `SELECT
          COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE to_type = 'participant' AND to_id = $1), 0) -
          COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE from_type = 'participant' AND from_id = $1), 0) AS balance`,
        [tx.sender_id]
      );
      const currentSenderBal = parseInt(balanceRes.rows[0]?.balance || '0', 10);
      if (currentSenderBal < tx.value) {
        await client.query(
          "UPDATE transactions SET status = 'failed', rejection_reason = 'Insufficient sender balance at confirmation' WHERE id = $1",
          [transactionId]
        );
        throw new Error(`INSUFFICIENT_FUNDS: Sender has ${currentSenderBal} VB, required ${tx.value} VB.`);
      }

      // 4. Commit to ledger_entries
      const entryId = `ledg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const reason = tx.metadata?.reason || 'Citizen transfer';

      await client.query(
        `INSERT INTO ledger_entries (
          id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser, linked_transaction_id
        ) VALUES ($1, NOW(), 'participant', $2, 'participant', $3, $4, 'transfer', $5, $6, $7)`,
        [entryId, tx.sender_id, tx.recipient_id, tx.value, reason, recipientId, transactionId]
      );

      // 5. Update transaction status
      await client.query(
        "UPDATE transactions SET status = 'completed', updated_at = NOW() WHERE id = $1",
        [transactionId]
      );

      // 6. Notify sender that transfer completed
      const senderNotifId = `notif_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      await client.query(
        `INSERT INTO notifications (
          id, recipient_id, type, title, message, payload
        ) VALUES ($1, $2, 'transfer_completed', 'Transfer Accepted', $3, $4)`,
        [
          senderNotifId,
          tx.sender_id,
          `Citizen ${recipientId} accepted your transfer of ${tx.value} VB.`,
          JSON.stringify({ transactionId, entryId, amount: tx.value }),
        ]
      );

      // 7. Audit log
      const auditId = `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (
          id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, related_record_id, source
        ) VALUES ($1, NOW(), $2, 'participant', 'TRANSFER_CONFIRMED', 'transactions', $3, $4, $5, 'ledger_service')`,
        [auditId, recipientId, transactionId, 'Counterparty accepted transfer', entryId]
      );

      return { entryId };
    });
  }

  /**
   * Participant-to-Participant transfer request flow.
   * Step 2 (alternate): Recipient rejects the transfer.
   */
  static async rejectTransfer(transactionId: string, recipientId: string, reason?: string): Promise<void> {
    await withTransaction(async (client) => {
      const txRes = await client.query(
        'SELECT * FROM transactions WHERE id = $1 FOR UPDATE',
        [transactionId]
      );

      if (txRes.rows.length === 0) {
        throw new Error('TRANSACTION_NOT_FOUND');
      }

      const tx = txRes.rows[0];

      if (tx.recipient_id !== recipientId) {
        throw new Error('UNAUTHORIZED_ACTION: Only recipient can reject this transfer.');
      }

      if (tx.status !== 'pending_confirmation') {
        throw new Error(`INVALID_STATUS: Transaction is already ${tx.status}.`);
      }

      await client.query(
        "UPDATE transactions SET status = 'rejected', rejection_reason = $1, updated_at = NOW() WHERE id = $2",
        [reason || 'Rejected by counterparty', transactionId]
      );

      // Notify sender
      const notifId = `notif_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      await client.query(
        `INSERT INTO notifications (
          id, recipient_id, type, title, message, payload
        ) VALUES ($1, $2, 'transfer_rejected', 'Transfer Rejected', $3, $4)`,
        [
          notifId,
          tx.sender_id,
          `Citizen ${recipientId} declined your transfer of ${tx.value} VB.`,
          JSON.stringify({ transactionId, reason }),
        ]
      );

      // Audit log
      const auditId = `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (
          id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, related_record_id, source
        ) VALUES ($1, NOW(), $2, 'participant', 'TRANSFER_REJECTED', 'transactions', $3, $4, NULL, 'ledger_service')`,
        [auditId, recipientId, transactionId, reason || 'Counterparty rejected transfer']
      );
    });
  }
}
