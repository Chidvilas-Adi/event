import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin' && user.role !== 'event_lead')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only GM, Admin, and Event Lead can view audit logs.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';

  let sql = 'SELECT * FROM audit_log WHERE 1=1';
  const params: any[] = [];

  if (q.trim().length > 0) {
    params.push(`%${q.trim()}%`);
    sql += ` AND (action ILIKE $${params.length} OR reason ILIKE $${params.length} OR actor_id ILIKE $${params.length} OR object_id ILIKE $${params.length})`;
  }

  sql += ' ORDER BY timestamp DESC LIMIT 100';

  const res = await pool.query(sql, params);
  return NextResponse.json(res.rows);
}
