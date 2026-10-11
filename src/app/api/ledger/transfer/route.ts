import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { LedgerService } from '@/lib/ledger/service';
import { pool } from '@/lib/db';
import { eventBus } from '@/lib/events/bus';
import { checkRateLimit } from '@/lib/auth/policy';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch transactions involving the user
  const txRes = await pool.query(
    `SELECT t.*,
       sp.name as sender_name, sp.citizen_code as sender_citizen_code,
       rp.name as recipient_name, rp.citizen_code as recipient_citizen_code
     FROM transactions t
     LEFT JOIN participants sp ON t.sender_id = sp.id
     LEFT JOIN participants rp ON t.recipient_id = rp.id
     WHERE t.sender_id = $1 OR t.recipient_id = $1
     ORDER BY t.created_at DESC
     LIMIT 50`,
    [user.userId]
  );

  // Fetch recent ledger entries directly involving the user
  const ledgRes = await pool.query(
    `SELECT l.*,
       sp.name as from_name, sp.citizen_code as from_citizen_code,
       rp.name as to_name, rp.citizen_code as to_citizen_code
     FROM ledger_entries l
     LEFT JOIN participants sp ON l.from_id = sp.id
     LEFT JOIN participants rp ON l.to_id = rp.id
     WHERE (l.from_type = 'participant' AND l.from_id = $1)
        OR (l.to_type = 'participant' AND l.to_id = $1)
     ORDER BY l.timestamp DESC
     LIMIT 30`,
    [user.userId]
  );

  return NextResponse.json({
    transactions: txRes.rows,
    ledgerEntries: ledgRes.rows,
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rate = checkRateLimit(`transfer_${user.userId}`, 20, 60);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'RATE_LIMITED: Too many transfers initiated. Please wait.' }, { status: 429 });
  }

  const body = await req.json();
  const { recipientCode, amount, reason, idempotencyKey } = body;

  if (!recipientCode || !amount || !reason) {
    return NextResponse.json({ error: 'Recipient, amount, and reason are required.' }, { status: 400 });
  }

  const numAmount = parseInt(amount, 10);
  if (isNaN(numAmount) || numAmount <= 0) {
    return NextResponse.json({ error: 'Amount must be a positive integer.' }, { status: 400 });
  }

  // Find recipient participant
  const normRecipient = recipientCode.trim().toUpperCase();
  const recRes = await pool.query(
    `SELECT id, name, citizen_code FROM participants
     WHERE UPPER(citizen_code) = $1 OR UPPER(id) = $1 LIMIT 1`,
    [normRecipient]
  );

  const recipient = recRes.rows[0];
  if (!recipient) {
    return NextResponse.json({ error: `RECIPIENT_NOT_FOUND: Citizen "${recipientCode}" not found.` }, { status: 404 });
  }

  if (recipient.id === user.userId) {
    return NextResponse.json({ error: 'INVALID_RECIPIENT: Cannot transfer VB to yourself.' }, { status: 400 });
  }

  // Check Human Internet Mode restrictions
  const worldRes = await pool.query('SELECT human_internet_mode FROM world_state WHERE id = $1', ['default']);
  if (worldRes.rows.length > 0 && worldRes.rows[0].human_internet_mode) {
    if (numAmount > 1500 && !body.deskSlipCode && user.role !== 'gm' && user.role !== 'admin') {
      return NextResponse.json({
        error: 'HUMAN INTERNET MODE RESTRICTION: High-value transfers exceeding 1,500 VB require physical counterparty negotiation and a Station Desk Slip code (e.g. SLIP-2026). Walk the floor to finalize.',
      }, { status: 400 });
    }
  }

  const isProposalOnly = body.requiresConfirmation === true || body.proposalOnly === true;

  try {
    if (!isProposalOnly) {
      // 1. Direct Atomic Transfer with ACID guarantees
      // Enforces advisory lock on sender, verifies balance >= amount, debits sender, credits recipient
      const ledgerResult = await LedgerService.executeTransfer({
        fromType: 'participant',
        fromId: user.userId,
        toType: 'participant',
        toId: recipient.id,
        amount: numAmount,
        type: 'transfer',
        reason: reason.trim(),
        authoriser: user.userId,
        idempotencyKey,
      });

      // 2. Insert completed transaction receipt
      const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await pool.query(
        `INSERT INTO transactions (
          id, type, sender_type, sender_id, recipient_type, recipient_id, value, status, source, authoriser, idempotency_key, metadata
        ) VALUES ($1, 'vb_transfer', 'participant', $2, 'participant', $3, $4, 'completed', 'web', $2, $5, $6)`,
        [
          txId,
          user.userId,
          recipient.id,
          numAmount,
          idempotencyKey || null,
          JSON.stringify({ reason: reason.trim(), entryId: ledgerResult.entryId }),
        ]
      );

      // 3. Dispatch notification to recipient
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await pool.query(
        `INSERT INTO notifications (
          id, recipient_id, type, title, message, payload
        ) VALUES ($1, $2, 'transfer_received', 'VB Transfer Received', $3, $4)`,
        [
          notifId,
          recipient.id,
          `Citizen ${user.name} transferred ${numAmount} VB to you: "${reason.trim()}"`,
          JSON.stringify({ transactionId: txId, entryId: ledgerResult.entryId, amount: numAmount, senderId: user.userId }),
        ]
      );

      // 4. Query live updated sender and recipient balances
      const newSenderBalance = await LedgerService.getBalance('participant', user.userId);
      const newRecipientBalance = await LedgerService.getBalance('participant', recipient.id);

      eventBus.broadcast('transfer_completed', {
        transactionId: txId,
        entryId: ledgerResult.entryId,
        senderId: user.userId,
        recipientId: recipient.id,
        amount: numAmount,
      });

      return NextResponse.json({
        success: true,
        directSettled: true,
        transactionId: txId,
        entryId: ledgerResult.entryId,
        recipient: recipient.name,
        amount: numAmount,
        newSenderBalance,
        newRecipientBalance,
        message: `Successfully transferred ${numAmount} VB to ${recipient.name}. Your updated personal balance is ${newSenderBalance} VB.`,
      });
    } else {
      // 2-Party Confirmation Flow
      const result = await LedgerService.initiateCounterpartyTransfer({
        senderId: user.userId,
        recipientId: recipient.id,
        amount: numAmount,
        reason: reason.trim(),
        idempotencyKey,
      });

      eventBus.broadcast('transfer_requested', {
        transactionId: result.transactionId,
        senderId: user.userId,
        recipientId: recipient.id,
        amount: numAmount,
      });

      return NextResponse.json({
        success: true,
        directSettled: false,
        transactionId: result.transactionId,
        recipient: recipient.name,
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Transfer failed' }, { status: 400 });
  }
}
