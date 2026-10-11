import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { pool, withTransaction } from '@/lib/db';
import { LedgerService } from '@/lib/ledger/service';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId') || user.companyId;

  let sql = `
    SELECT l.*, c.name as company_name
    FROM loans l
    JOIN companies c ON l.company_id = c.id
  `;
  const params: any[] = [];

  // Non-bank and non-GM can only see their own company's loans
  const isBankOrGm = user.role === 'gm' || user.institutionId === 'bank';
  if (!isBankOrGm && companyId) {
    sql += ' WHERE l.company_id = $1';
    params.push(companyId);
  }

  sql += ' ORDER BY l.created_at DESC';
  const res = await pool.query(sql, params);
  return NextResponse.json({ loans: res.rows });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { loanId, amount } = body;

  const repayAmount = parseInt(amount, 10);
  if (isNaN(repayAmount) || repayAmount <= 0) {
    return NextResponse.json({ error: 'Repayment amount must be a positive integer.' }, { status: 400 });
  }

  return await withTransaction(async (client) => {
    // 1. Lock loan row
    const loanRes = await client.query('SELECT * FROM loans WHERE id = $1 FOR UPDATE', [loanId]);
    if (loanRes.rows.length === 0) throw new Error('LOAN_NOT_FOUND');

    const loan = loanRes.rows[0];
    if (loan.status !== 'active') {
      throw new Error(`LOAN_INACTIVE: Loan is already ${loan.status}.`);
    }

    const remainingDebt = loan.repayment_total - loan.amount_repaid;
    if (repayAmount > remainingDebt) {
      throw new Error(`OVERPAYMENT: Remaining debt is ${remainingDebt} VB, cannot repay ${repayAmount} VB.`);
    }

    // 2. Lock company treasury & check balance
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [loan.company_id]);
    const compBal = await LedgerService.getBalance('company', loan.company_id);
    if (compBal < repayAmount) {
      throw new Error(`INSUFFICIENT_FUNDS: Company treasury has ${compBal} VB, required ${repayAmount} VB for repayment.`);
    }

    // 3. Move money from Company to Bank in ledger_entries
    const entryId = `ledg_repay_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    await client.query(
      `INSERT INTO ledger_entries (
        id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser, linked_transaction_id
      ) VALUES ($1, NOW(), 'company', $2, 'institution', 'bank', $3, 'debit', $4, $5, $6)`,
      [
        entryId,
        loan.company_id,
        repayAmount,
        `Bank Loan Repayment (${repayAmount} VB towards Loan ${loan.id})`,
        user.userId,
        loan.id,
      ]
    );

    // 4. Update loan status
    const newRepaid = loan.amount_repaid + repayAmount;
    const isFullyRepaid = newRepaid >= loan.repayment_total;
    const nextStatus = isFullyRepaid ? 'repaid' : 'active';

    await client.query(
      'UPDATE loans SET amount_repaid = $1, status = $2 WHERE id = $3',
      [newRepaid, nextStatus, loanId]
    );

    // 5. Replenish Bank lending pool capacity
    const bankRes = await client.query('SELECT config FROM institutions WHERE id = $1 FOR UPDATE', ['bank']);
    const bankConfig = bankRes.rows[0]?.config || {};
    bankConfig.lending_pool_remaining = (bankConfig.lending_pool_remaining || 0) + repayAmount;
    await client.query('UPDATE institutions SET config = $1, updated_at = NOW() WHERE id = $2', [
      JSON.stringify(bankConfig),
      'bank',
    ]);

    // 6. Audit log
    const auditId = `aud_loan_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    await client.query(
      `INSERT INTO audit_log (
        id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
      ) VALUES ($1, NOW(), $2, 'citizen', 'LOAN_REPAYMENT', 'loans', $3, $4, 'loan_api')`,
      [auditId, user.userId, loanId, `Repaid ${repayAmount} VB. Status: ${nextStatus}`]
    );

    return NextResponse.json({
      success: true,
      amountRepaid: repayAmount,
      totalRepaid: newRepaid,
      status: nextStatus,
    });
  });
}
