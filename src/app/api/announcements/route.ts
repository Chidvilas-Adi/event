import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { pool } from '@/lib/db';
import { eventBus } from '@/lib/events/bus';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);

  let query = 'SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50';
  let params: any[] = [];

  if (user && user.role !== 'gm' && user.role !== 'admin' && user.role !== 'event_lead') {
    query = `SELECT * FROM announcements
             WHERE audience = 'all'
                OR (audience = 'company' AND target_id = $1)
                OR (audience = 'role' AND target_id = $2)
             ORDER BY created_at DESC LIMIT 50`;
    params = [user.companyId || 'none', user.role];
  }

  const res = await pool.query(query, params);
  return NextResponse.json(res.rows);
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'event_lead')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only GM or Event Lead can publish announcements.' }, { status: 403 });
  }

  const body = await req.json();
  const { audience = 'all', targetId = null, priority = 'normal', title, content } = body;
  const rawMessage = body.message || (title ? (content ? `${title} — ${content}` : title) : content);

  if (!rawMessage || rawMessage.trim().length === 0) {
    return NextResponse.json({ error: 'Announcement message cannot be empty.' }, { status: 400 });
  }

  const message = rawMessage.trim();

  const id = `ann_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  await pool.query(
    `INSERT INTO announcements (id, audience, target_id, message, priority, author_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, audience, targetId, message.trim(), priority, user.userId]
  );

  // Audit log
  const auditId = `aud_ann_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  await pool.query(
    `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
     VALUES ($1, NOW(), $2, $3, 'ANNOUNCEMENT_PUBLISHED', 'announcements', $4, $5, 'announcement_api')`,
    [auditId, user.userId, user.role, id, `Published announcement: ${message.slice(0, 50)}...`]
  );

  const announcement = { id, audience, targetId, message: message.trim(), priority, author_id: user.userId, created_at: new Date() };

  // Real-time broadcast
  eventBus.broadcast('new_announcement', announcement);

  return NextResponse.json({ success: true, announcement });
}

export async function PUT(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin' && user.role !== 'event_lead')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only GM, Admin, or Event Lead can edit announcements.' }, { status: 403 });
  }

  const body = await req.json();
  const { id, message, priority, audience, targetId } = body;

  if (!id) {
    return NextResponse.json({ error: 'Announcement ID is required.' }, { status: 400 });
  }

  const existingRes = await pool.query('SELECT * FROM announcements WHERE id = $1', [id]);
  if (existingRes.rows.length === 0) {
    return NextResponse.json({ error: 'Announcement not found.' }, { status: 404 });
  }

  const updateFields: string[] = [];
  const updateVals: any[] = [];
  let idx = 1;

  if (message !== undefined) {
    updateFields.push(`message = $${idx++}`);
    updateVals.push(message.trim());
  }
  if (priority !== undefined) {
    updateFields.push(`priority = $${idx++}`);
    updateVals.push(priority);
  }
  if (audience !== undefined) {
    updateFields.push(`audience = $${idx++}`);
    updateVals.push(audience);
  }
  if (targetId !== undefined) {
    updateFields.push(`target_id = $${idx++}`);
    updateVals.push(targetId || null);
  }

  if (updateFields.length > 0) {
    updateVals.push(id);
    await pool.query(`UPDATE announcements SET ${updateFields.join(', ')} WHERE id = $${idx}`, updateVals);
  }

  const auditId = `aud_ann_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  await pool.query(
    `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
     VALUES ($1, NOW(), $2, $3, 'ANNOUNCEMENT_UPDATED', 'announcements', $4, $5, 'announcement_api')`,
    [auditId, user.userId, user.role, id, `GM edited announcement ${id}`]
  );

  return NextResponse.json({ success: true, updatedId: id });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin' && user.role !== 'event_lead')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only GM, Admin, or Event Lead can delete announcements.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  let id = searchParams.get('id') || searchParams.get('announcementId');
  if (!id) {
    try {
      const body = await req.json();
      id = body?.id || body?.announcementId;
    } catch {
      // No body
    }
  }

  if (!id) {
    return NextResponse.json({ error: 'Announcement ID is required to delete.' }, { status: 400 });
  }

  await pool.query('DELETE FROM announcements WHERE id = $1', [id]);

  const auditId = `aud_ann_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  await pool.query(
    `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
     VALUES ($1, NOW(), $2, $3, 'ANNOUNCEMENT_DELETED', 'announcements', $4, $5, 'announcement_api')`,
    [auditId, user.userId, user.role, id, `GM deleted announcement ${id}`]
  );

  return NextResponse.json({ success: true, deletedId: id });
}

