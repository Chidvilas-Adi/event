import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { pool, withTransaction } from '@/lib/db';
import crypto from 'crypto';

export async function GET() {
  const res = await pool.query('SELECT * FROM institutions ORDER BY id ASC');
  return NextResponse.json(res.rows);
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Game Master or Tech Admin can manage institutions.' }, { status: 403 });
  }

  const body = await req.json();
  const { id, name, type, capacity, isOpen, closeReason, config, reason, action } = body;

  if (action === 'create' || (!reason && name && type)) {
    // Create new institution
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Institution desk name is required.' }, { status: 400 });
    }
    const instId = (id || `inst_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`).trim();

    const dup = await pool.query('SELECT id FROM institutions WHERE id = $1', [instId]);
    if (dup.rows.length > 0) {
      return NextResponse.json({ error: `Institution ID ${instId} already exists.` }, { status: 400 });
    }

    const confJson = typeof config === 'string' ? config : JSON.stringify(config || {});

    await pool.query(
      `INSERT INTO institutions (id, name, type, capacity, is_open, close_reason, config, created_at, updated_at)
       VALUES ($1, $2, $3, $4, TRUE, NULL, $5::jsonb, NOW(), NOW())`,
      [instId, name.trim(), (type || 'regulatory').trim(), parseInt(capacity, 10) || 100, confJson]
    );

    const auditId = `aud_inst_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    await pool.query(
      `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
       VALUES ($1, NOW(), $2, 'gm', 'INSTITUTION_CREATED', 'institutions', $3, $4, 'institution_api')`,
      [auditId, user.userId, instId, `GM created institution desk ${name}`]
    );

    return NextResponse.json({ success: true, id: instId });
  }

  // Update existing status
  if (!id) {
    return NextResponse.json({ error: 'Institution ID required.' }, { status: 400 });
  }

  if (!reason || reason.trim().length === 0) {
    return NextResponse.json({ error: 'A written reason is required to modify institution status or limits.' }, { status: 400 });
  }

  const currentRes = await pool.query('SELECT * FROM institutions WHERE id = $1', [id]);
  if (currentRes.rows.length === 0) {
    return NextResponse.json({ error: 'Institution not found.' }, { status: 404 });
  }
  const current = currentRes.rows[0];

  const updatedOpen = isOpen !== undefined ? isOpen : current.is_open;
  const updatedCloseReason = isOpen === false ? (closeReason || reason) : null;
  const updatedConfig = config !== undefined ? (typeof config === 'string' ? config : JSON.stringify(config)) : current.config;

  await pool.query(
    `UPDATE institutions SET
      is_open = $1,
      close_reason = $2,
      config = $3,
      updated_at = NOW()
     WHERE id = $4`,
    [updatedOpen, updatedCloseReason, updatedConfig, id]
  );

  const auditId = `aud_inst_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  await pool.query(
    `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, before_state, after_state, reason, source)
     VALUES ($1, NOW(), $2, 'gm', 'INSTITUTION_UPDATED', 'institutions', $3, $4, $5, $6, 'institution_api')`,
    [
      auditId,
      user.userId,
      id,
      JSON.stringify({ is_open: current.is_open, config: current.config }),
      JSON.stringify({ is_open: updatedOpen, config: updatedConfig }),
      reason,
    ]
  );

  return NextResponse.json({ success: true });
}

export async function PUT(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Game Master or Tech Admin can edit institutions.' }, { status: 403 });
  }

  const body = await req.json();
  const { id, name, type, capacity, isOpen, closeReason, config, reason } = body;

  if (!id) {
    return NextResponse.json({ error: 'Institution ID required.' }, { status: 400 });
  }

  const existingRes = await pool.query('SELECT * FROM institutions WHERE id = $1', [id]);
  if (existingRes.rows.length === 0) {
    return NextResponse.json({ error: 'Institution not found.' }, { status: 404 });
  }

  const updateFields: string[] = ['updated_at = NOW()'];
  const updateVals: any[] = [];
  let idx = 1;

  if (name !== undefined) {
    updateFields.push(`name = $${idx++}`);
    updateVals.push(name.trim());
  }
  if (type !== undefined) {
    updateFields.push(`type = $${idx++}`);
    updateVals.push(type.trim());
  }
  if (capacity !== undefined) {
    updateFields.push(`capacity = $${idx++}`);
    updateVals.push(parseInt(capacity, 10));
  }
  if (isOpen !== undefined) {
    updateFields.push(`is_open = $${idx++}`);
    updateVals.push(Boolean(isOpen));
  }
  if (closeReason !== undefined) {
    updateFields.push(`close_reason = $${idx++}`);
    updateVals.push(closeReason);
  }
  if (config !== undefined) {
    updateFields.push(`config = $${idx++}::jsonb`);
    updateVals.push(typeof config === 'string' ? config : JSON.stringify(config));
  }

  updateVals.push(id);
  await pool.query(`UPDATE institutions SET ${updateFields.join(', ')} WHERE id = $${idx}`, updateVals);

  const auditId = `aud_inst_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  await pool.query(
    `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
     VALUES ($1, NOW(), $2, 'gm', 'INSTITUTION_UPDATED', 'institutions', $3, $4, 'institution_api')`,
    [auditId, user.userId, id, reason || `GM updated institution desk ${id}`]
  );

  return NextResponse.json({ success: true, updatedId: id });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Game Master or Tech Admin can delete institutions.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  let id = searchParams.get('id') || searchParams.get('institutionId');
  if (!id) {
    try {
      const body = await req.json();
      id = body?.id || body?.institutionId;
    } catch {
      // No body
    }
  }

  if (!id) {
    return NextResponse.json({ error: 'Institution ID required to delete.' }, { status: 400 });
  }

  return await withTransaction(async (client) => {
    // Unlink operator accounts
    await client.query('UPDATE operator_accounts SET institution_id = NULL WHERE institution_id = $1', [id]);
    // Delete institution
    await client.query('DELETE FROM institutions WHERE id = $1', [id]);

    const auditId = `aud_inst_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    await client.query(
      `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
       VALUES ($1, NOW(), $2, 'gm', 'INSTITUTION_DELETED', 'institutions', $3, 'GM deleted institution desk', 'institution_api')`,
      [auditId, user.userId, id]
    );

    return NextResponse.json({ success: true, deletedId: id });
  });
}
