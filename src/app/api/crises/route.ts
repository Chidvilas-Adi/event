import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { CrisesService } from '@/lib/crises/service';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || undefined;

  const crises = await CrisesService.listCrises(status);

  // If user is logged in, attach their company's responses
  let companyId: string | null = null;
  if (user) {
    const membRes = await pool.query(
      `SELECT company_id FROM memberships WHERE participant_id = $1 AND status = 'active' LIMIT 1`,
      [user.userId]
    );
    if (membRes.rows.length > 0) {
      companyId = membRes.rows[0].company_id;
    }
  }

  const responses = await CrisesService.getResponses();

  const formatted = crises.map(c => {
    const compResp = companyId ? responses.find(r => r.crisis_id === c.id && r.company_id === companyId) : null;
    return {
      ...c,
      companyResponse: compResp ? {
        pathId: compResp.selected_path_id,
        pathTitle: compResp.path_title,
        costVbPaid: compResp.cost_vb_paid,
        respondedAt: compResp.responded_at,
        notes: compResp.notes,
      } : null,
      totalResponsesCount: responses.filter(r => r.crisis_id === c.id).length,
    };
  });

  return NextResponse.json({ crises: formatted });
}
