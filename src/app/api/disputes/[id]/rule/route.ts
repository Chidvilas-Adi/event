import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { DisputesService } from '@/lib/disputes/service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Game Master or Tech Admin can issue arbitration rulings.' }, { status: 403 });
  }

  const { id: disputeId } = await params;
  const body = await req.json();
  const { ruling, awardedVb, rulingNotes } = body;

  if (!ruling || !['claimant_upheld', 'claimant_dismissed', 'compromise'].includes(ruling)) {
    return NextResponse.json({ error: 'Valid ruling is required (claimant_upheld, claimant_dismissed, or compromise).' }, { status: 400 });
  }

  if (!rulingNotes || rulingNotes.trim().length === 0) {
    return NextResponse.json({ error: 'A written arbitration rationale is required.' }, { status: 400 });
  }

  try {
    const result = await DisputesService.ruleDispute({
      disputeId,
      ruling,
      awardedVb: awardedVb !== undefined ? parseInt(awardedVb, 10) : undefined,
      rulingNotes,
      actorId: user.userId,
      actorRole: user.role,
    });

    return NextResponse.json({ ...result, success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Arbitration ruling failed.' }, { status: 400 });
  }
}
