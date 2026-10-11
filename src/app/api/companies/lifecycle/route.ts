import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { CompanyLifecycleService } from '@/lib/companies/lifecycle';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId') || undefined;

  const [history, companies] = await Promise.all([
    CompanyLifecycleService.getHistory(companyId),
    pool.query('SELECT id, name, status, tier FROM companies ORDER BY name ASC'),
  ]);

  return NextResponse.json({
    history,
    companies: companies.rows,
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { action } = body;

  try {
    if (action === 'status_change') {
      const { companyId, newStatus, reason } = body;
      const res = await CompanyLifecycleService.changeStatus({
        companyId,
        newStatus,
        reason: reason || 'Lifecycle operational transition',
        actorId: user.userId,
        actorRole: user.role,
      });
      return NextResponse.json(res);
    }

    if (action === 'merge') {
      const { acquirerId, targetId, purchasePriceVb, terms, reason } = body;
      // GM, Admin, or Founder of acquirer
      if (user.role !== 'gm' && user.role !== 'admin' && user.role !== 'company_lead') {
        return NextResponse.json({ error: 'FORBIDDEN: Only GM or Company Founders can execute M&A consolidation.' }, { status: 403 });
      }

      const res = await CompanyLifecycleService.executeMerger({
        acquirerId,
        targetId,
        purchasePriceVb: parseInt(purchasePriceVb, 10) || 0,
        terms,
        reason: reason || `M&A consolidation of ${targetId} into ${acquirerId}`,
        actorId: user.userId,
        actorRole: user.role,
      });
      return NextResponse.json(res);
    }

    if (action === 'spinout') {
      const { parentCompanyId, founderParticipantId, newCompanyName, tagline, description, startingCapitalVb, equityTerms } = body;
      // GM, Admin, or Founder
      if (user.role !== 'gm' && user.role !== 'admin' && user.role !== 'company_lead') {
        return NextResponse.json({ error: 'FORBIDDEN: Only GM or Company Founders can incorporate a spin-out venture.' }, { status: 403 });
      }

      const res = await CompanyLifecycleService.executeSpinout({
        parentCompanyId,
        founderParticipantId: founderParticipantId || user.userId,
        newCompanyName,
        tagline,
        description,
        startingCapitalVb: parseInt(startingCapitalVb, 10) || 2000,
        equityTerms,
        actorId: user.userId,
        actorRole: user.role,
      });
      return NextResponse.json(res);
    }

    if (action === 'liquidate') {
      const { companyId, reason } = body;
      const res = await CompanyLifecycleService.executeLiquidation({
        companyId,
        reason: reason || 'Enforced insolvency liquidation',
        actorId: user.userId,
        actorRole: user.role,
      });
      return NextResponse.json(res);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lifecycle execution failed.' }, { status: 400 });
  }
}
