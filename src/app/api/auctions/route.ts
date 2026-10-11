import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { AuctionService } from '@/lib/auctions/service';

export async function GET() {
  const auctions = await AuctionService.listAuctions();
  return NextResponse.json({ auctions });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { action = 'bid' } = body;

  try {
    if (action === 'create') {
      if (user.role !== 'gm' && user.role !== 'volunteer' && user.role !== 'event_lead') {
        return NextResponse.json({ error: 'FORBIDDEN: Only GM or Desk Operator can launch an auction.' }, { status: 403 });
      }

      const { itemType, title, description, startingBid, durationMinutes } = body;
      const result = await AuctionService.createAuction({
        itemType,
        title,
        description,
        startingBid: parseInt(startingBid, 10),
        sellerType: user.institutionId ? 'institution' : 'system',
        sellerId: user.institutionId || 'system',
        durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : 30,
      });

      return NextResponse.json({ success: true, auctionId: result.auctionId });
    }

    if (action === 'bid') {
      const { auctionId, bidAmount, asCompany } = body;
      const bidderId = asCompany && user.companyId ? user.companyId : user.userId;

      await AuctionService.placeBid(auctionId, bidderId, parseInt(bidAmount, 10));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown auction action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Auction action failed' }, { status: 400 });
  }
}
