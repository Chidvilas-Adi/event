import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { DealService } from '@/lib/deals/service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: dealId } = await params;
  const deal = await DealService.getDeal(dealId);
  if (!deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  return NextResponse.json({ deal });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: dealId } = await params;
  const body = await req.json();
  const { action, updatedTerms, reason } = body;

  try {
    if (action === 'accept') {
      const isGm = user.role === 'gm';
      const result = await DealService.acceptDeal(dealId, user.userId, isGm);
      return NextResponse.json({ success: true, contractId: result.contractId });
    }

    if (action === 'reject') {
      await DealService.rejectDeal(dealId, user.userId, reason);
      return NextResponse.json({ success: true, rejected: true });
    }

    if (action === 'counter') {
      if (!updatedTerms) {
        return NextResponse.json({ error: 'updatedTerms required for counter-offer.' }, { status: 400 });
      }
      const result = await DealService.counterDeal({
        parentDealId: dealId,
        authoriserId: user.userId,
        updatedTerms,
        reason: reason || 'Counter-proposal submitted',
      });
      return NextResponse.json({ success: true, counterDealId: result.dealId, version: result.version });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Operation failed' }, { status: 400 });
  }
}
