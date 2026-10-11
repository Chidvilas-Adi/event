import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { DisputesService } from '@/lib/disputes/service';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || undefined;

  // GM and Admin can see all disputes
  if (user.role === 'gm' || user.role === 'admin') {
    const disputes = await DisputesService.listDisputes({ status });
    return NextResponse.json({ disputes });
  }

  // Citizens and founders see disputes where they or their company are involved
  const membRes = await pool.query(
    `SELECT company_id FROM memberships WHERE participant_id = $1 AND status = 'active' LIMIT 1`,
    [user.userId]
  );
  const userCompanyId = membRes.rows.length > 0 ? membRes.rows[0].company_id : null;

  let query = `
    SELECT d.*,
      CASE
        WHEN d.claimant_type = 'company' THEN (SELECT name FROM companies WHERE id = d.claimant_id)
        ELSE (SELECT name FROM participants WHERE id = d.claimant_id)
      END as claimant_name,
      CASE
        WHEN d.respondent_type = 'company' THEN (SELECT name FROM companies WHERE id = d.respondent_id)
        ELSE (SELECT name FROM participants WHERE id = d.respondent_id)
      END as respondent_name
    FROM disputes d
    WHERE d.claimant_id = $1 OR d.respondent_id = $1
  `;
  const params: any[] = [user.userId];

  if (userCompanyId) {
    query += ` OR d.claimant_id = $2 OR d.respondent_id = $2`;
    params.push(userCompanyId);
  }

  query += ' ORDER BY d.created_at DESC';

  const res = await pool.query(query, params);
  return NextResponse.json({ disputes: res.rows });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    dealId,
    claimantType = 'participant',
    claimantId = user.userId,
    respondentType,
    respondentId,
    amountVb,
    reason,
    evidence,
  } = body;

  if (!respondentType || !respondentId || !reason || amountVb === undefined) {
    return NextResponse.json({
      error: 'Respondent information, reason, and claimed amount (VB) are required.',
    }, { status: 400 });
  }

  try {
    const dispute = await DisputesService.fileDispute({
      dealId,
      claimantType,
      claimantId: claimantId || user.userId,
      respondentType,
      respondentId,
      amountVb: parseInt(amountVb, 10) || 0,
      reason,
      evidence,
      actorId: user.userId,
    });

    return NextResponse.json({ success: true, dispute });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to file dispute.' }, { status: 400 });
  }
}
