import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { pool } from '@/lib/db';
import { LedgerService } from '@/lib/ledger/service';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const targetCompanyId = body.companyId || user.companyId;

  if (!targetCompanyId) {
    return NextResponse.json({ error: 'Target companyId required.' }, { status: 400 });
  }

  // Check authorization: must be company lead of target company or GM/Admin
  if (user.role !== 'gm' && user.role !== 'admin' && (user.role !== 'company_lead' || user.companyId !== targetCompanyId)) {
    return NextResponse.json({ error: 'FORBIDDEN: Only the Company Lead or GM can run payroll.' }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch active members
    const membersRes = await client.query<{ participant_id: string; role: string; name: string }>(
      `SELECT m.participant_id, m.role, p.name
       FROM memberships m
       JOIN participants p ON m.participant_id = p.id
       WHERE m.company_id = $1 AND m.status = 'active'`,
      [targetCompanyId]
    );

    const members = membersRes.rows;
    if (members.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'No active members found in this company.' }, { status: 400 });
    }

    // 100 VB per employee per tick (L0 standard salary)
    const salaryPerHead = 100;
    const totalPayroll = members.length * salaryPerHead;

    // 2. Lock company balance and verify funds
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [targetCompanyId]);
    const balanceRes = await client.query<{ balance: string }>(
      'SELECT balance FROM v_entity_balances WHERE entity_id = $1',
      [targetCompanyId]
    );
    const companyBalance = parseInt(balanceRes.rows[0]?.balance || '0', 10);

    if (companyBalance < totalPayroll) {
      await client.query('ROLLBACK');
      return NextResponse.json({
        error: `Insufficient company treasury. Required: ${totalPayroll} VB for ${members.length} staff, Available: ${companyBalance} VB.`,
      }, { status: 400 });
    }

    // 3. Post payroll transactions for each member
    const payouts: any[] = [];
    for (const member of members) {
      const entryId = `ledg_pay_${Date.now()}_${member.participant_id.slice(-4)}_${Math.random().toString(36).substring(2, 6)}`;
      await client.query(
        `INSERT INTO ledger_entries (
          id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
        ) VALUES ($1, NOW(), 'company', $2, 'participant', $3, $4, 'transfer', $5, $6)`,
        [
          entryId,
          targetCompanyId,
          member.participant_id,
          salaryPerHead,
          `Tick Payroll Disbursement (L0 Standard @ 100 VB)`,
          user.userId,
        ]
      );
      payouts.push({ participantId: member.participant_id, name: member.name, amount: salaryPerHead });
    }

    // 4. Record in audit log
    const auditId = `aud_pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await client.query(
      `INSERT INTO audit_log (
        id, timestamp, actor_id, actor_role, action, object_type, object_id, before_state, after_state, reason, source
      ) VALUES ($1, NOW(), $2, $3, 'PAYROLL_DISBURSED', 'company', $4, $5, $6, $7, 'payroll_api')`,
      [
        auditId,
        user.userId,
        user.role,
        targetCompanyId,
        JSON.stringify({ previous_balance: companyBalance }),
        JSON.stringify({ new_balance: companyBalance - totalPayroll, headcount: members.length, totalDisbursed: totalPayroll }),
        `Disbursed L0 salaries (100 VB/head) across ${members.length} team members`,
      ]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      totalPayroll,
      headcount: members.length,
      payouts,
      remainingTreasury: companyBalance - totalPayroll,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: err.message || 'Payroll disbursement failed' }, { status: 500 });
  } finally {
    client.release();
  }
}
