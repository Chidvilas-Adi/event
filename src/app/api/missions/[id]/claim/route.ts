import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { MissionService } from '@/lib/missions/service';
import { pool } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED: Session required.' }, { status: 401 });
  }

  const { id: missionId } = await params;

  // Retrieve role
  let companyRole = user.companyRole;
  if (!companyRole) {
    const memRes = await pool.query(
      "SELECT role FROM memberships WHERE participant_id = $1 AND status = 'active' LIMIT 1",
      [user.userId]
    );
    companyRole = memRes.rows[0]?.role || (user.role === 'company_lead' ? 'Founder & CEO' : 'Independent Free Agent');
  }

  try {
    const instance = await MissionService.claimMission(missionId, user.userId, companyRole);
    return NextResponse.json({ success: true, instance });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
