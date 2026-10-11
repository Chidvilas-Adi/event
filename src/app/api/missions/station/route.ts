import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { MissionService } from '@/lib/missions/service';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED: Session required.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const stationId = searchParams.get('stationId') || user.institutionId;

  if (!stationId) {
    return NextResponse.json({ error: 'Station ID required.' }, { status: 400 });
  }

  const pendingClaims = await MissionService.listStationPendingClaims(stationId);
  return NextResponse.json({ pendingClaims });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED: Session required.' }, { status: 401 });
  }

  const body = await req.json();
  const { instanceId, stationId } = body;

  if (!instanceId || !stationId) {
    return NextResponse.json({ error: 'instanceId and stationId required.' }, { status: 400 });
  }

  try {
    const result = await MissionService.approveStationCheckin(instanceId, stationId, user.userId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
