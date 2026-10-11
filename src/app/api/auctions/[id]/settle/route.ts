import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { AuctionService } from '@/lib/auctions/service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'volunteer' && user.role !== 'event_lead')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only GM or Desk Operator can settle an auction.' }, { status: 403 });
  }

  const { id: auctionId } = await params;
  try {
    const result = await AuctionService.settleAuction(auctionId, user.userId);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Settlement failed' }, { status: 400 });
  }
}
