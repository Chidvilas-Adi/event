import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { executeCompleteWorldReset } from '@/lib/db/reset';
import { eventBus } from '@/lib/events/bus';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json(
      { error: 'FORBIDDEN: Only Game Master or Tech Admin can execute complete world reset.' },
      { status: 403 }
    );
  }

  try {
    const result = await executeCompleteWorldReset(user.userId);
    eventBus.broadcast('world_state_updated', { reset: true, tick: 1, wave: 1 });

    return NextResponse.json({
      ...result,
      message: 'Venture City world successfully reset to pristine canonical starting state (12 Master Catalogue companies, 30,000 VB vault, 100 units/resource, reset pools, Tick 1, Wave 1).',
    });
  } catch (err: any) {
    console.error('World Reset Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to execute world reset.' },
      { status: 500 }
    );
  }
}
