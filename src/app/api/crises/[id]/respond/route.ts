import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { CrisesService } from '@/lib/crises/service';
import { pool } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: crisisId } = await params;
  const body = await req.json();
  const { pathId } = body;

  if (!pathId) {
    return NextResponse.json({ error: 'Response path ID is required.' }, { status: 400 });
  }

  // Find user's company
  const membRes = await pool.query(
    `SELECT company_id, role FROM memberships WHERE participant_id = $1 AND status = 'active' LIMIT 1`,
    [user.userId]
  );

  let targetCompanyId = body.companyId;
  if (!targetCompanyId) {
    if (membRes.rows.length === 0) {
      return NextResponse.json({ error: 'You are not an active member of any company.' }, { status: 403 });
    }
    targetCompanyId = membRes.rows[0].company_id;
  }

  // Verify authorization: must be founder/lead or GM/admin
  if (user.role !== 'gm' && user.role !== 'admin' && user.role !== 'company_lead') {
    const isLead = membRes.rows.some(m => ['founder', 'company_lead', 'director', 'ceo'].includes(m.role.toLowerCase()));
    if (!isLead) {
      return NextResponse.json({ error: 'FORBIDDEN: Only Company Founders and Leads can commit crisis response strategies.' }, { status: 403 });
    }
  }

  try {
    const result = await CrisesService.respondToCrisis({
      crisisId,
      companyId: targetCompanyId,
      pathId,
      actorId: user.userId,
    });

    return NextResponse.json({ ...result, success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to submit crisis response.' }, { status: 400 });
  }
}
