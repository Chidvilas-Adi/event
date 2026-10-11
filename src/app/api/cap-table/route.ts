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

  if (!companyId) {
    return NextResponse.json({ error: 'Company ID required.' }, { status: 400 });
  }

  // Permission check: GM, Admin, Station Volunteers (Bank, Investor), or member of this company can see cap table
  const isAllowed =
    user.role === 'gm' ||
    user.role === 'admin' ||
    user.role === 'volunteer' ||
    user.role === 'observer' ||
    user.companyId === companyId;
  if (!isAllowed) {
    return NextResponse.json({ error: 'FORBIDDEN: Cap table is company-private.' }, { status: 403 });
  }

  const [compRes, res] = await Promise.all([
    pool.query('SELECT id, name, initial_cash FROM companies WHERE id = $1', [companyId]),
    pool.query(
      `SELECT ct.*, p.name as shareholder_name, p.citizen_code
       FROM cap_table ct
       LEFT JOIN participants p ON ct.shareholder_id = p.id
       WHERE ct.company_id = $1
       ORDER BY ct.shares_or_percent DESC`,
      [companyId]
    ),
  ]);

  const company = compRes.rows[0];
  const balance = await LedgerService.getBalance('company', companyId);
  const impliedValuation = Math.max(parseInt(company?.initial_cash || '30000', 10), balance, 30000);

  const totalAuthorizedShares = 1000;
  const enrichedRows = res.rows.map((row) => {
    const percent = parseFloat(row.shares_or_percent);
    const shares = Math.round(percent * 10);
    const valueVb = Math.round((percent / 100) * impliedValuation);
    const shareClass = row.rights?.class || (
      row.shareholder_type === 'founder'
        ? 'Founding Common'
        : row.shareholder_type === 'pool'
        ? 'Unallocated Option Pool'
        : 'Preferred Equity'
    );

    return {
      ...row,
      percent,
      shares,
      value_vb: valueVb,
      share_class: shareClass,
    };
  });

  return NextResponse.json({
    companyId,
    companyName: company?.name || companyId,
    impliedValuationVb: impliedValuation,
    totalAuthorizedShares,
    startingState: {
      authorizedShares: 1000,
      foundingCommonShares: 800,
      foundingCommonPercent: 80.0,
      optionPoolShares: 200,
      optionPoolPercent: 20.0,
    },
    capTable: enrichedRows,
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { companyId, recipientId, recipientType = 'participant', recipientName, grantPercent = 1.0, shareClass = 'Incentive Equity' } = body;

  if (!companyId || !recipientId || grantPercent <= 0) {
    return NextResponse.json({ error: 'companyId, recipientId, and valid grantPercent required.' }, { status: 400 });
  }

  const isFounder = user.role === 'company_lead' && user.companyId === companyId;
  const isGm = user.role === 'gm' || user.role === 'admin';
  if (!isFounder && !isGm) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Founder or GM can issue equity grants from option pool.' }, { status: 403 });
  }

  // ACID transaction with row-level locks
  return await withTransaction(async (client) => {
    // 1. Lock all rows for this company's cap table
    const lockedRows = await client.query(
      'SELECT * FROM cap_table WHERE company_id = $1 FOR UPDATE',
      [companyId]
    );

    const poolRow = lockedRows.rows.find((r) => r.shareholder_type === 'pool');
    if (!poolRow) {
      throw new Error('NO_OPTION_POOL: No unallocated employee option pool found on cap table.');
    }

    const availablePool = parseFloat(poolRow.shares_or_percent);
    const parsedGrant = parseFloat(Number(grantPercent).toFixed(2));

    if (parsedGrant > availablePool) {
      throw new Error(`INSUFFICIENT_POOL: Requested ${parsedGrant}% exceeds available unallocated pool (${availablePool}%).`);
    }

    // 2. Deduct from option pool
    const newPoolPercent = parseFloat((availablePool - parsedGrant).toFixed(2));
    await client.query(
      'UPDATE cap_table SET shares_or_percent = $1, updated_at = NOW() WHERE id = $2',
      [newPoolPercent, poolRow.id]
    );

    // 3. Grant to recipient
    const existingRecipientRow = lockedRows.rows.find((r) => r.shareholder_id === recipientId);
    if (existingRecipientRow) {
      const updatedPercent = parseFloat((parseFloat(existingRecipientRow.shares_or_percent) + parsedGrant).toFixed(2));
      await client.query(
        'UPDATE cap_table SET shares_or_percent = $1, updated_at = NOW() WHERE id = $2',
        [updatedPercent, existingRecipientRow.id]
      );
    } else {
      const newId = `cap_${companyId}_${recipientId}_${Date.now()}`;
      await client.query(
        `INSERT INTO cap_table (
          id, company_id, shareholder_type, shareholder_id, shares_or_percent, rights
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          newId,
          companyId,
          recipientType,
          recipientId,
          parsedGrant,
          JSON.stringify({ class: shareClass, granted_by: user.userId, granted_at: new Date().toISOString() }),
        ]
      );
    }

    // 4. Verify Consistency invariant: sum of equity MUST equal 100.00%
    const sumRes = await client.query(
      'SELECT SUM(shares_or_percent) as total FROM cap_table WHERE company_id = $1',
      [companyId]
    );
    const totalEquity = Math.round(parseFloat(sumRes.rows[0].total) * 100) / 100;
    if (Math.abs(totalEquity - 100.0) > 0.05) {
      throw new Error(`CAP_TABLE_INVARIANT_VIOLATION: Total equity sums to ${totalEquity}%, expected 100.00%. Transaction rolled back.`);
    }

    // 5. Audit log
    const auditId = `aud_cap_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    await client.query(
      `INSERT INTO audit_log (
        id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
      ) VALUES ($1, NOW(), $2, $3, 'EQUITY_GRANTED', 'cap_table', $4, $5, 'cap_table_desk')`,
      [
        auditId,
        user.userId,
        user.role,
        companyId,
        `Granted ${parsedGrant}% (${parsedGrant * 10} shares) from Option Pool to ${recipientName || recipientId}`,
      ]
    );

    return NextResponse.json({
      success: true,
      message: `Successfully granted ${parsedGrant}% equity (${parsedGrant * 10} shares) to ${recipientName || recipientId}.`,
      grantedPercent: parsedGrant,
      grantedShares: parsedGrant * 10,
      remainingPoolPercent: newPoolPercent,
    });
  });
}
