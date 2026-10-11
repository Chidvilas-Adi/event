import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { pool, withTransaction } from '@/lib/db';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED: Valid session required.' }, { status: 401 });
  }

  const isGovVolunteer = user.role === 'volunteer' && user.institutionId === 'government';
  const isElevated = user.role === 'gm' || user.role === 'admin' || user.role === 'event_lead';

  if (!isGovVolunteer && !isElevated) {
    return NextResponse.json(
      { error: 'FORBIDDEN: Only Department of Commerce (Government Desk) or Game Master can disburse civic grants.' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { targetType = 'company', targetId, amount, purpose = 'Civic Economic Development Grant' } = body;

  const numAmount = parseInt(amount, 10);
  if (!targetId || isNaN(numAmount) || numAmount <= 0) {
    return NextResponse.json({ error: 'Valid targetId and positive grant amount are required.' }, { status: 400 });
  }

  if (numAmount > 8000 && !isElevated) {
    return NextResponse.json(
      { error: 'GRANT_CAP_EXCEEDED: Maximum civic grant per allocation is 8,000 VB.' },
      { status: 400 }
    );
  }

  return await withTransaction(async (client) => {
    // 1. Verify target exists and fetch name
    let targetName = targetId;
    if (targetType === 'company') {
      const cRes = await client.query('SELECT name FROM companies WHERE id = $1', [targetId]);
      if (cRes.rows.length === 0) {
        throw new Error(`Target venture company ${targetId} not found.`);
      }
      targetName = cRes.rows[0].name;
    } else {
      const pRes = await client.query('SELECT name, citizen_code FROM participants WHERE id = $1 OR UPPER(citizen_code) = UPPER($1)', [targetId]);
      if (pRes.rows.length === 0) {
        throw new Error(`Target citizen ${targetId} not found.`);
      }
      targetName = `${pRes.rows[0].name} (${pRes.rows[0].citizen_code})`;
    }

    // 2. Lock Government institution row and deduct grant pool
    const govRes = await client.query('SELECT config FROM institutions WHERE id = $1 FOR UPDATE', ['government']);
    if (govRes.rows.length === 0) {
      throw new Error('Government institution record not found.');
    }

    const govConfig = govRes.rows[0].config || {};
    const remainingPool = govConfig.grant_pool_remaining ?? govConfig.grant_pool_total ?? 30000;

    if (numAmount > remainingPool && !isElevated) {
      throw new Error(
        `GRANT_POOL_EXHAUSTED: Requested ${numAmount.toLocaleString()} VB exceeds remaining civic grant pool (${remainingPool.toLocaleString()} VB).`
      );
    }

    const newRemaining = Math.max(0, remainingPool - numAmount);
    govConfig.grant_pool_remaining = newRemaining;
    govConfig.grants_disbursed = (govConfig.grants_disbursed || 0) + 1;
    govConfig.total_vb_disbursed = (govConfig.total_vb_disbursed || 0) + numAmount;

    await client.query('UPDATE institutions SET config = $1, updated_at = NOW() WHERE id = $2', [
      JSON.stringify(govConfig),
      'government',
    ]);

    // 3. Insert immutable ledger entry
    const ledgId = `ledg_gov_grnt_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    await client.query(
      `INSERT INTO ledger_entries (
        id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
      ) VALUES ($1, NOW(), 'institution', 'government', $2, $3, $4, 'grant', $5, $6)`,
      [ledgId, targetType, targetId, numAmount, `Civic Grant: ${purpose.trim()}`, user.userId]
    );

    // 4. Send notification to recipient
    const notifId = `notif_grnt_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    await client.query(
      `INSERT INTO notifications (id, recipient_id, type, title, message, payload)
       VALUES ($1, $2, 'grant_received', $3, $4, $5)`,
      [
        notifId,
        targetId,
        'Civic Grant Endowment Disbursed',
        `Department of Commerce has awarded and credited a non-dilutive grant of ${numAmount.toLocaleString()} VB. Justification: "${purpose.trim()}"`,
        JSON.stringify({ targetType, targetId, amount: numAmount, purpose }),
      ]
    );

    // 5. Audit log
    const auditId = `aud_gov_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    await client.query(
      `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
       VALUES ($1, NOW(), $2, $3, 'CIVIC_GRANT_DISBURSED', $4, $5, $6, 'government_desk')`,
      [
        auditId,
        user.userId,
        user.role,
        targetType,
        targetId,
        `Government disbursed ${numAmount} VB grant to ${targetName} (${purpose.trim()})`,
      ]
    );

    return NextResponse.json({
      success: true,
      amount: numAmount,
      targetName,
      grantPoolRemaining: newRemaining,
      ledgerId: ledgId,
      message: `Successfully disbursed ${numAmount.toLocaleString()} VB civic grant to ${targetName}. Remaining pool: ${newRemaining.toLocaleString()} VB.`,
    });
  });
}
