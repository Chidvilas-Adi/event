import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { MissionService } from '@/lib/missions/service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED: Session required.' }, { status: 401 });
  }

  const { id: instanceId } = await params;
  const body = await req.json();

  try {
    const result = await MissionService.verifyMission(instanceId, user.userId, {
      code: body.code,
      token: body.token,
      stationVerifierId: body.stationVerifierId,
      evidence: body.evidence,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
