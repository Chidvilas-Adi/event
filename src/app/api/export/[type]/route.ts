import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { PaperFallbackService } from '@/lib/export/paper-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin' && user.role !== 'event_lead')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only GM, Admin, and Event Lead can export data.' }, { status: 403 });
  }

  const { type } = await params;
  const now = Date.now();

  if (type === 'ledger') {
    const csv = await PaperFallbackService.exportLedgerCsv();
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="venture-city-ledger-${now}.csv"`,
      },
    });
  }

  if (type === 'balances') {
    const csv = await PaperFallbackService.exportCompanyBalancesCsv();
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="venture-city-company-balances-${now}.csv"`,
      },
    });
  }

  if (type === 'roster') {
    const csv = await PaperFallbackService.exportCitizenRosterCsv();
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="venture-city-citizen-roster-${now}.csv"`,
      },
    });
  }

  if (type === 'cap-table') {
    const csv = await PaperFallbackService.exportCapTableCsv();
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="venture-city-cap-table-${now}.csv"`,
      },
    });
  }

  if (type === 'deal-slips') {
    const html = PaperFallbackService.generatePrintableDealSlipsHtml('City Commerce Desks', 30);
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  }

  if (type === 'snapshot') {
    const snap = await PaperFallbackService.createSnapshot(user.userId, `GM Export Snapshot ${new Date().toISOString()}`);
    return new Response(JSON.stringify(snap, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="venture-city-snapshot-${now}.json"`,
      },
    });
  }

  return NextResponse.json({ error: `Unknown export type: ${type}` }, { status: 400 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only GM and Tech Admin can manage snapshots.' }, { status: 403 });
  }

  const { type } = await params;
  if (type === 'snapshot') {
    const body = await req.json().catch(() => ({}));
    const snap = await PaperFallbackService.createSnapshot(user.userId, body.name);
    return NextResponse.json({ success: true, snapshot: snap });
  }

  return NextResponse.json({ error: `Unsupported POST operation for type: ${type}` }, { status: 400 });
}
