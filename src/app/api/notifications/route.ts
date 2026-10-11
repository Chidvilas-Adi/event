import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const res = await pool.query(
    `SELECT * FROM notifications
     WHERE recipient_id = $1 OR (recipient_id = $2 AND $2 IS NOT NULL)
     ORDER BY created_at DESC LIMIT 30`,
    [user.userId, user.companyId || null]
  );

  return NextResponse.json({ notifications: res.rows });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await req.json();
  const { id, action } = body;

  if (action === 'mark_read' && id) {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND (recipient_id = $2 OR recipient_id = $3)`,
      [id, user.userId, user.companyId || null]
    );
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid notification action' }, { status: 400 });
}
