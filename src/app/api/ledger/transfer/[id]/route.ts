import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { LedgerService } from '@/lib/ledger/service';
import { eventBus } from '@/lib/events/bus';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: transactionId } = await params;
  const body = await req.json();
  const { action, reason } = body;

  if (action !== 'accept' && action !== 'reject') {
    return NextResponse.json({ error: 'Action must be "accept" or "reject".' }, { status: 400 });
  }

  try {
    if (action === 'accept') {
      const result = await LedgerService.confirmTransfer(transactionId, user.userId);
      eventBus.broadcast('transfer_completed', {
        transactionId,
        entryId: result.entryId,
        recipientId: user.userId,
      });
      return NextResponse.json({ success: true, entryId: result.entryId });
    } else {
      await LedgerService.rejectTransfer(transactionId, user.userId, reason);
      eventBus.broadcast('transfer_rejected', {
        transactionId,
        recipientId: user.userId,
      });
      return NextResponse.json({ success: true, rejected: true });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Operation failed' }, { status: 400 });
  }
}
