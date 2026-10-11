import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { MissionService } from '@/lib/missions/service';
import { pool } from '@/lib/db';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED: Session required.' }, { status: 401 });
  }

  const opportunities = await MissionService.listOpportunities();
  return NextResponse.json({ opportunities });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED: Session required.' }, { status: 401 });
  }

  const body = await req.json();
  const { opportunityId, pitchTerms } = body;

  if (!opportunityId) {
    return NextResponse.json({ error: 'Opportunity ID is required.' }, { status: 400 });
  }

  // Fetch opportunity
  const oppRes = await pool.query('SELECT * FROM opportunities WHERE id = $1 AND status = $2', [opportunityId, 'open']);
  if (oppRes.rows.length === 0) {
    return NextResponse.json({ error: 'Opportunity not found or closed.' }, { status: 404 });
  }

  const opp = oppRes.rows[0];

  // If claimed/pitched, create deal proposal for the counterparty institution or company
  const dealId = `deal_opp_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
  await pool.query(
    `INSERT INTO deals (
      id, template_type, sender_type, sender_id, recipient_type, recipient_id, version, terms, status
    ) VALUES ($1, 'Sale', 'participant', $2, 'institution', $3, 1, $4, 'pending')`,
    [
      dealId,
      user.userId,
      opp.institution_id || 'enterprise_customer',
      JSON.stringify({
        opportunity_id: opportunityId,
        title: opp.title,
        price_vb: opp.budget_vb,
        pitch: pitchTerms || 'Formal proposal submitted via Opportunity Radar',
      }),
    ]
  );

  return NextResponse.json({ success: true, dealId, message: 'Proposal submitted to opportunity counterparty!' });
}
