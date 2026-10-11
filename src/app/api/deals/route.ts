import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { DealService } from '@/lib/deals/service';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const instId = searchParams.get('institutionId');

  // If querying specific institution desk deals
  if (instId) {
    const isElevated = user.role === 'gm' || user.role === 'admin' || user.role === 'event_lead' || user.role === 'observer';
    const isVolunteerForDesk = user.role === 'volunteer' && user.institutionId === instId;

    if (!isElevated && !isVolunteerForDesk) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sql = `
      SELECT d.*,
             c1.name as sender_company_name, c2.name as recipient_company_name,
             p1.name as sender_participant_name, p1.citizen_code as sender_citizen_code,
             p2.name as recipient_participant_name, p2.citizen_code as recipient_citizen_code
      FROM deals d
      LEFT JOIN companies c1 ON d.sender_type = 'company' AND d.sender_id = c1.id
      LEFT JOIN companies c2 ON d.recipient_type = 'company' AND d.recipient_id = c2.id
      LEFT JOIN participants p1 ON d.sender_type = 'participant' AND d.sender_id = p1.id
      LEFT JOIN participants p2 ON d.recipient_type = 'participant' AND d.recipient_id = p2.id
      WHERE (d.sender_type = 'institution' AND d.sender_id = $1)
         OR (d.recipient_type = 'institution' AND d.recipient_id = $1)
      ORDER BY d.created_at DESC LIMIT 100
    `;
    const res = await pool.query(sql, [instId]);
    return NextResponse.json({ deals: res.rows });
  }

  // If Game Master or Tech Admin, return all recent city deals
  if (user.role === 'gm' || user.role === 'admin') {
    const sql = `
      SELECT d.*,
             c1.name as sender_company_name, c2.name as recipient_company_name,
             p1.name as sender_participant_name, p1.citizen_code as sender_citizen_code,
             p2.name as recipient_participant_name, p2.citizen_code as recipient_citizen_code
      FROM deals d
      LEFT JOIN companies c1 ON d.sender_type = 'company' AND d.sender_id = c1.id
      LEFT JOIN companies c2 ON d.recipient_type = 'company' AND d.recipient_id = c2.id
      LEFT JOIN participants p1 ON d.sender_type = 'participant' AND d.sender_id = p1.id
      LEFT JOIN participants p2 ON d.recipient_type = 'participant' AND d.recipient_id = p2.id
      ORDER BY d.created_at DESC LIMIT 100
    `;
    const res = await pool.query(sql);
    return NextResponse.json({ deals: res.rows });
  }

  // Fetch deals involving the user directly, their company, or assigned desk
  let sql = `
    SELECT d.*,
           c1.name as sender_company_name, c2.name as recipient_company_name,
           p1.name as sender_participant_name, p1.citizen_code as sender_citizen_code,
           p2.name as recipient_participant_name, p2.citizen_code as recipient_citizen_code
    FROM deals d
    LEFT JOIN companies c1 ON d.sender_type = 'company' AND d.sender_id = c1.id
    LEFT JOIN companies c2 ON d.recipient_type = 'company' AND d.recipient_id = c2.id
    LEFT JOIN participants p1 ON d.sender_type = 'participant' AND d.sender_id = p1.id
    LEFT JOIN participants p2 ON d.recipient_type = 'participant' AND d.recipient_id = p2.id
    WHERE (d.sender_id = $1 OR d.recipient_id = $1)
  `;
  const params: any[] = [user.userId];

  if (user.companyId) {
    sql += ` OR (d.sender_type = 'company' AND d.sender_id = $2) OR (d.recipient_type = 'company' AND d.recipient_id = $2)`;
    params.push(user.companyId);
  }

  if (user.institutionId) {
    sql += ` OR (d.sender_type = 'institution' AND d.sender_id = $${params.length + 1}) OR (d.recipient_type = 'institution' AND d.recipient_id = $${params.length + 1})`;
    params.push(user.institutionId);
  }

  sql += ' ORDER BY d.created_at DESC LIMIT 50';

  const res = await pool.query(sql, params);
  return NextResponse.json({ deals: res.rows });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    templateType,
    recipientType = 'company',
    recipientId,
    terms,
    asCompany = false,
    asInstitution = false,
    institutionId,
  } = body;

  if (!templateType || !recipientId || !terms) {
    return NextResponse.json({ error: 'templateType, recipientId, and terms are required.' }, { status: 400 });
  }

  // Determine sender type
  let senderType: 'participant' | 'company' | 'institution' = 'participant';
  let senderId = user.userId;

  if (asInstitution && institutionId) {
    const isElevated = user.role === 'gm' || user.role === 'admin' || user.role === 'event_lead';
    const isVolunteerForDesk = user.role === 'volunteer' && user.institutionId === institutionId;
    if (!isElevated && !isVolunteerForDesk) {
      return NextResponse.json({ error: 'Forbidden to propose deals on behalf of this institution desk.' }, { status: 403 });
    }
    senderType = 'institution';
    senderId = institutionId;
  } else if (asCompany && user.companyId) {
    senderType = 'company';
    senderId = user.companyId;
  } else if (user.institutionId) {
    senderType = 'institution';
    senderId = user.institutionId;
  }

  // Resolve recipient ID if citizen code (e.g. VC-001) was passed
  let resolvedRecipientId = recipientId;
  if (recipientType === 'participant') {
    const pCheck = await pool.query(
      'SELECT id FROM participants WHERE id = $1 OR UPPER(citizen_code) = UPPER($1)',
      [recipientId]
    );
    if (pCheck.rows.length > 0) {
      resolvedRecipientId = pCheck.rows[0].id;
    }
  }

  try {
    const result = await DealService.createDeal({
      templateType,
      senderType,
      senderId,
      recipientType,
      recipientId: resolvedRecipientId,
      terms,
      authoriser: user.userId,
    });

    return NextResponse.json({ success: true, dealId: result.dealId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Deal creation failed' }, { status: 400 });
  }
}
