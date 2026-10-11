import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { CrisesService } from '@/lib/crises/service';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: GM or Tech Admin only.' }, { status: 403 });
  }

  const [crises, responses] = await Promise.all([
    CrisesService.listCrises(),
    CrisesService.getResponses(),
  ]);

  return NextResponse.json({ crises, responses });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: GM or Tech Admin only.' }, { status: 403 });
  }

  const body = await req.json();
  const { action, crisisId, durationMinutes, customParams, notes } = body;

  try {
    if (action === 'trigger') {
      if (!crisisId) {
        return NextResponse.json({ error: 'Crisis ID is required to trigger.' }, { status: 400 });
      }
      const res = await CrisesService.triggerCrisis({
        crisisId,
        durationMinutes: durationMinutes || 30,
        actorId: user.userId,
        customParams,
      });
      return NextResponse.json({ ...res, success: true });
    }

    if (action === 'resolve') {
      if (!crisisId) {
        return NextResponse.json({ error: 'Crisis ID is required to resolve.' }, { status: 400 });
      }
      const res = await CrisesService.resolveCrisis(crisisId, user.userId, notes);
      return NextResponse.json({ ...res, success: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Operation failed.' }, { status: 400 });
  }
}
