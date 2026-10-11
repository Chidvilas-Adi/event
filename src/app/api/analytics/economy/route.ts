import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { EconomyAnalyticsService } from '@/lib/analytics/service';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED: Session required.' }, { status: 401 });
  }

  // Analytics accessible to GMs, Admins, Observers, Event Leads, and Founders
  if (user.role !== 'gm' && user.role !== 'admin' && user.role !== 'observer' && user.role !== 'event_lead' && user.role !== 'company_lead') {
    return NextResponse.json({ error: 'FORBIDDEN: Executive telemetry privileges required.' }, { status: 403 });
  }

  try {
    const analytics = await EconomyAnalyticsService.getEconomyAnalytics();
    return NextResponse.json({ analytics });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch economy analytics.' }, { status: 500 });
  }
}
