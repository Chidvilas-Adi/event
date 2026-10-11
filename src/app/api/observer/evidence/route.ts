import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { ObserverEvidenceService } from '@/lib/observer/service';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED: Session required.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId') || undefined;
  const participantId = searchParams.get('participantId') || undefined;
  const traitCategory = searchParams.get('traitCategory') || undefined;

  // Observers, GMs, Admins can view all evidence.
  // Founders can only view evidence relevant to their company if authorized.
  if (user.role !== 'gm' && user.role !== 'admin' && user.role !== 'observer' && user.role !== 'event_lead') {
    if (user.role === 'company_lead' && user.companyId) {
      const records = await ObserverEvidenceService.listEvidence({ companyId: user.companyId });
      return NextResponse.json({ evidence: records });
    }
    return NextResponse.json({ error: 'FORBIDDEN: Observer or Executive privileges required to inspect Founder Ledger.' }, { status: 403 });
  }

  const records = await ObserverEvidenceService.listEvidence({
    companyId,
    participantId,
    traitCategory,
  });

  return NextResponse.json({ evidence: records });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'observer' && user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Observers and Game Masters can record behavioral evidence in the Founder Ledger.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { participantId, companyId, traitCategory, rating, notes, incidentCitation } = body;

    if (!participantId || !traitCategory || !notes) {
      return NextResponse.json({ error: 'Participant ID, Trait Category, and qualitative notes are required.' }, { status: 400 });
    }

    const record = await ObserverEvidenceService.recordEvidence({
      participantId,
      companyId,
      observerId: user.userId,
      traitCategory,
      rating: rating || 'neutral',
      notes,
      incidentCitation,
    });

    return NextResponse.json({ success: true, evidence: record });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to record evidence.' }, { status: 400 });
  }
}
