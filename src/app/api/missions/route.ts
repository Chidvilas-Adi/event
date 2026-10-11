import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { MissionService } from '@/lib/missions/service';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED: Session required.' }, { status: 401 });
  }

  // Check world state for current wave
  const worldRes = await pool.query('SELECT current_tick, wave FROM world_state WHERE id = $1', ['default']);
  const currentTick = worldRes.rows[0]?.current_tick || 1;
  // Use explicit wave set by GM, or default based on tick
  const activeWave = worldRes.rows[0]?.wave || (currentTick >= 4 ? 3 : currentTick >= 2 ? 2 : 1);

  // Fetch participant company role if participant
  let companyRole = user.companyRole;
  if (!companyRole && (user.role === 'participant' || user.role === 'company_lead')) {
    const memRes = await pool.query(
      "SELECT role FROM memberships WHERE participant_id = $1 AND status = 'active' LIMIT 1",
      [user.userId]
    );
    companyRole = memRes.rows[0]?.role || (user.role === 'company_lead' ? 'Founder & CEO' : 'Independent Free Agent');
  }

  const isGm = user.role === 'gm' || user.role === 'admin';

  const missions = await MissionService.listMissions({
    participantId: user.userId,
    companyId: user.companyId,
    role: companyRole,
    wave: activeWave,
    isGm,
  });

  return NextResponse.json({
    missions,
    activeWave,
    currentTick,
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Game Master or Tech Admin can create missions.' }, { status: 403 });
  }

  const body = await req.json();
  const {
    title,
    tier = 1,
    wave = 1,
    objective,
    verificationMethod = 'system_checked',
    completionRule = 'Auto verification upon condition fulfillment',
    rewardVb = 500,
    stationId,
    isSecret = false,
    secretRole,
    verificationSecret,
    claimLimit = 1,
    timeLimitMinutes,
  } = body;

  if (!title || !objective) {
    return NextResponse.json({ error: 'Mission title and objective are required.' }, { status: 400 });
  }

  const crypto = await import('crypto');
  const mId = `msn_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;

  await pool.query(
    `INSERT INTO missions (
      id, title, tier, wave, objective, verification_method, completion_rule,
      reward_vb, station_id, is_secret, secret_role, verification_secret,
      claim_limit, time_limit_minutes, is_active, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, TRUE, NOW())`,
    [
      mId,
      title.trim(),
      parseInt(tier, 10) || 1,
      parseInt(wave, 10) || 1,
      objective.trim(),
      verificationMethod,
      completionRule.trim(),
      parseInt(rewardVb, 10) || 0,
      stationId ? stationId.trim() : null,
      Boolean(isSecret),
      secretRole ? secretRole.trim() : null,
      verificationSecret ? verificationSecret.trim() : null,
      parseInt(claimLimit, 10) || 1,
      timeLimitMinutes ? parseInt(timeLimitMinutes, 10) : null,
    ]
  );

  const auditId = `aud_msn_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
  await pool.query(
    `INSERT INTO audit_log (
      id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
    ) VALUES ($1, NOW(), $2, 'gm', 'MISSION_CREATED', 'missions', $3, $4, 'mission_api')`,
    [auditId, user.userId, mId, `GM created mission ${title}`]
  );

  return NextResponse.json({ success: true, missionId: mId });
}

export async function PUT(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Game Master or Tech Admin can edit missions.' }, { status: 403 });
  }

  const body = await req.json();
  const {
    id,
    title,
    tier,
    wave,
    objective,
    verificationMethod,
    completionRule,
    rewardVb,
    stationId,
    isSecret,
    secretRole,
    verificationSecret,
    claimLimit,
    timeLimitMinutes,
    isActive,
  } = body;

  if (!id) {
    return NextResponse.json({ error: 'Mission ID is required.' }, { status: 400 });
  }

  const existing = await pool.query('SELECT * FROM missions WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    return NextResponse.json({ error: 'Mission not found.' }, { status: 404 });
  }

  const updateFields: string[] = [];
  const updateVals: any[] = [];
  let idx = 1;

  if (title !== undefined) {
    updateFields.push(`title = $${idx++}`);
    updateVals.push(title.trim());
  }
  if (tier !== undefined) {
    updateFields.push(`tier = $${idx++}`);
    updateVals.push(parseInt(tier, 10));
  }
  if (wave !== undefined) {
    updateFields.push(`wave = $${idx++}`);
    updateVals.push(parseInt(wave, 10));
  }
  if (objective !== undefined) {
    updateFields.push(`objective = $${idx++}`);
    updateVals.push(objective.trim());
  }
  if (verificationMethod !== undefined) {
    updateFields.push(`verification_method = $${idx++}`);
    updateVals.push(verificationMethod);
  }
  if (completionRule !== undefined) {
    updateFields.push(`completion_rule = $${idx++}`);
    updateVals.push(completionRule.trim());
  }
  if (rewardVb !== undefined) {
    updateFields.push(`reward_vb = $${idx++}`);
    updateVals.push(parseInt(rewardVb, 10));
  }
  if (stationId !== undefined) {
    updateFields.push(`station_id = $${idx++}`);
    updateVals.push(stationId ? stationId.trim() : null);
  }
  if (isSecret !== undefined) {
    updateFields.push(`is_secret = $${idx++}`);
    updateVals.push(Boolean(isSecret));
  }
  if (secretRole !== undefined) {
    updateFields.push(`secret_role = $${idx++}`);
    updateVals.push(secretRole ? secretRole.trim() : null);
  }
  if (verificationSecret !== undefined) {
    updateFields.push(`verification_secret = $${idx++}`);
    updateVals.push(verificationSecret ? verificationSecret.trim() : null);
  }
  if (claimLimit !== undefined) {
    updateFields.push(`claim_limit = $${idx++}`);
    updateVals.push(parseInt(claimLimit, 10));
  }
  if (timeLimitMinutes !== undefined) {
    updateFields.push(`time_limit_minutes = $${idx++}`);
    updateVals.push(timeLimitMinutes ? parseInt(timeLimitMinutes, 10) : null);
  }
  if (isActive !== undefined) {
    updateFields.push(`is_active = $${idx++}`);
    updateVals.push(Boolean(isActive));
  }

  if (updateFields.length > 0) {
    updateVals.push(id);
    await pool.query(`UPDATE missions SET ${updateFields.join(', ')} WHERE id = $${idx}`, updateVals);
  }

  const crypto = await import('crypto');
  const auditId = `aud_msn_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
  await pool.query(
    `INSERT INTO audit_log (
      id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
    ) VALUES ($1, NOW(), $2, 'gm', 'MISSION_UPDATED', 'missions', $3, $4, 'mission_api')`,
    [auditId, user.userId, id, `GM updated mission ${id}`]
  );

  return NextResponse.json({ success: true, updatedId: id });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Game Master or Tech Admin can delete missions.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  let missionId = searchParams.get('id') || searchParams.get('missionId');
  if (!missionId) {
    try {
      const body = await req.json();
      missionId = body?.id || body?.missionId;
    } catch {
      // No body
    }
  }

  if (!missionId) {
    return NextResponse.json({ error: 'Mission ID is required to delete.' }, { status: 400 });
  }

  const { withTransaction } = await import('@/lib/db');
  const crypto = await import('crypto');

  return await withTransaction(async (client) => {
    await client.query('DELETE FROM mission_instances WHERE mission_id = $1', [missionId]);
    await client.query('DELETE FROM missions WHERE id = $1', [missionId]);

    const auditId = `aud_del_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    await client.query(
      `INSERT INTO audit_log (
        id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
      ) VALUES ($1, NOW(), $2, 'gm', 'MISSION_DELETED', 'missions', $3, 'GM deleted mission', 'mission_api')`,
      [auditId, user.userId, missionId]
    );

    return NextResponse.json({ success: true, deletedId: missionId });
  });
}

