import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { LedgerService } from '@/lib/ledger/service';
import { pool, withTransaction } from '@/lib/db';
import { eventBus } from '@/lib/events/bus';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== 'gm') {
    return NextResponse.json({
      error: 'FORBIDDEN: Only Game Master can execute direct grants or revocations. Admin and other roles cannot move game assets directly.',
    }, { status: 403 });
  }

  const body = await req.json();
  const {
    targetType, // 'company' | 'participant'
    targetId,
    assetType = 'vb', // 'vb' | resource_id
    actionType = 'grant', // 'grant' | 'revoke'
    amount,
    reason,
  } = body;

  if (!targetType || !targetId || !amount || !reason) {
    return NextResponse.json({ error: 'targetType, targetId, amount, and reason are required.' }, { status: 400 });
  }

  const numAmount = parseInt(amount, 10);
  if (isNaN(numAmount) || numAmount <= 0) {
    return NextResponse.json({ error: 'Amount must be a positive integer.' }, { status: 400 });
  }

  if (reason.trim().length === 0) {
    return NextResponse.json({ error: 'Written reason is mandatory for GM asset adjustments.' }, { status: 400 });
  }

  try {
    if (assetType === 'vb') {
      if (actionType === 'grant') {
        const result = await LedgerService.executeTransfer({
          fromType: 'system',
          fromId: null,
          toType: targetType,
          toId: targetId,
          amount: numAmount,
          type: 'grant',
          reason: `[GM Grant] ${reason}`,
          authoriser: user.userId,
          isGmOverride: true,
        });

        eventBus.broadcast('ledger_updated', { targetType, targetId, amount: numAmount, action: 'grant' });
        return NextResponse.json({ success: true, entryId: result.entryId });
      } else {
        // Revoke (Debit to system)
        const currentBal = await LedgerService.getBalance(targetType, targetId);
        if (currentBal < numAmount) {
          return NextResponse.json({
            error: `Cannot revoke ${numAmount} VB. Current balance is only ${currentBal} VB.`,
          }, { status: 400 });
        }

        const result = await LedgerService.executeTransfer({
          fromType: targetType,
          fromId: targetId,
          toType: 'system',
          toId: null,
          amount: numAmount,
          type: 'debit',
          reason: `[GM Revoke] ${reason}`,
          authoriser: user.userId,
          isGmOverride: true,
        });

        eventBus.broadcast('ledger_updated', { targetType, targetId, amount: numAmount, action: 'revoke' });
        return NextResponse.json({ success: true, entryId: result.entryId });
      }
    } else {
      // Resource grant / revocation
      return await withTransaction(async (client) => {
        const resId = `res_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        const delta = actionType === 'grant' ? numAmount : -numAmount;

        await client.query(
          `INSERT INTO resource_ledger (
            id, timestamp, resource_id, owner_type, owner_id, quantity, reason, authoriser
          ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7)`,
          [
            resId,
            assetType,
            targetType,
            targetId,
            delta,
            `[GM ${actionType}] ${reason}`,
            user.userId,
          ]
        );

        const auditId = `aud_res_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        await client.query(
          `INSERT INTO audit_log (
            id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
          ) VALUES ($1, NOW(), $2, 'gm', 'GM_RESOURCE_ADJUSTMENT', 'resource_ledger', $3, $4, 'gm_console')`,
          [auditId, user.userId, resId, reason]
        );

        eventBus.broadcast('resources_updated', { targetType, targetId, assetType, delta });
        return NextResponse.json({ success: true, resourceEntryId: resId });
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Operation failed' }, { status: 400 });
  }
}
