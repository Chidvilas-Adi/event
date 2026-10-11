import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { pool, withTransaction } from '@/lib/db';
import { eventBus } from '@/lib/events/bus';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const res = await pool.query('SELECT wave, current_tick FROM world_state WHERE id = $1', ['default']);
  const row = res.rows[0];
  return NextResponse.json({
    wave: row?.wave || 1,
    currentTick: row?.current_tick || 1,
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json(
      { error: 'FORBIDDEN: Only Game Master or Tech Admin can change simulation waves.' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const targetWave = parseInt(body.wave, 10);
  if (!targetWave || targetWave < 1 || targetWave > 3) {
    return NextResponse.json(
      { error: 'Invalid wave. Allowed values are 1 (Easy), 2 (Medium), 3 (Hard).' },
      { status: 400 }
    );
  }

  return await withTransaction(async (client) => {
    // 1. Update wave in world_state
    await client.query(
      'UPDATE world_state SET wave = $1, updated_at = NOW() WHERE id = $2',
      [targetWave, 'default']
    );

    // 2. Publish urgent citywide broadcast announcement
    const annId = `ann_wave_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const waveNames: Record<number, string> = {
      1: 'WAVE 1: FOUNDATION & CAPITAL GENESIS (Easy)',
      2: 'WAVE 2: INTER-VENTURE ALLIANCES & MACRO EXPANSION (Medium)',
      3: 'WAVE 3: ENDGAME CONVERGENCE & SOVEREIGN CRISIS (Hard)',
    };
    const waveLabel = waveNames[targetWave] || `WAVE ${targetWave}`;
    const annMsg = `🚨 WORLD DIRECTIVE: Game Master has declared ${waveLabel.toUpperCase()}! Check your terminal for active tier missions, physical verification flag targets, and sovereign tenders!`;

    await client.query(
      `INSERT INTO announcements (id, audience, target_id, message, priority, author_id)
       VALUES ($1, 'all', NULL, $2, 'critical', $3)`,
      [annId, annMsg, user.userId]
    );

    // 3. Log audit event
    const auditId = `aud_wave_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    await client.query(
      `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
       VALUES ($1, NOW(), $2, 'gm', 'SET_SIMULATION_WAVE', 'world_state', 'default', $3, 'gm_console')`,
      [auditId, user.userId, `Set simulation wave to ${targetWave} (${waveLabel})`]
    );

    eventBus.broadcast('world_wave_changed', { wave: targetWave, initiatedBy: user.userId });
    eventBus.broadcast('world_state_updated', { wave: targetWave });

    return NextResponse.json({
      success: true,
      wave: targetWave,
      message: `Successfully transitioned Venture City to ${waveLabel}.`,
    });
  });
}
