import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { MissionAutomationEngine } from '@/lib/missions/automation';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Game Master or Tech Admin can trigger automated mission distribution.' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { cleanExisting = false, missionsPerParticipant = 10 } = body;

    const result = await MissionAutomationEngine.autoAssignAllMissions({
      cleanExisting,
      missionsPerParticipant,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully generated and assigned ${missionsPerParticipant} tailored missions per citizen!`,
      ...result,
    });
  } catch (err: any) {
    console.error('Mission auto-assignment failed:', err);
    return NextResponse.json({ error: err.message || 'Auto-assignment failed.' }, { status: 500 });
  }
}
