import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { pool, withTransaction } from '@/lib/db';
import { eventBus } from '@/lib/events/bus';
import crypto from 'crypto';

export async function GET() {
  const res = await pool.query('SELECT * FROM world_state WHERE id = $1', ['default']);
  if (res.rows.length === 0) {
    return NextResponse.json({ error: 'World state not initialized' }, { status: 404 });
  }

  const state = res.rows[0];
  let effectiveClockSeconds = state.clock_seconds;
  if (!state.is_paused && !state.is_frozen && state.updated_at) {
    const elapsedSinceUpdate = Math.floor((Date.now() - new Date(state.updated_at).getTime()) / 1000);
    if (elapsedSinceUpdate > 0) {
      effectiveClockSeconds += elapsedSinceUpdate;
    }
  }

  return NextResponse.json({
    clockSeconds: effectiveClockSeconds,
    currentTick: state.current_tick,
    isPaused: state.is_paused,
    isFrozen: state.is_frozen,
    freezeReason: state.freeze_reason,
    humanInternetMode: state.human_internet_mode,
    rulesLocked: state.rules_locked,
    versionLabel: state.version_label,
    stateHash: state.state_hash,
    lastTickAt: state.last_tick_at,
    wave: state.wave || 1,
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Game Master or Tech Admin can control world clock and state.' }, { status: 403 });
  }

  const body = await req.json();
  const { action, reason, elapsedIncrement } = body;

  if (!action) {
    return NextResponse.json({ error: 'Action is required.' }, { status: 400 });
  }

  if (['pause', 'advance_tick', 'freeze', 'unfreeze'].includes(action)) {
    if (!reason || reason.trim().length === 0) {
      return NextResponse.json({ error: 'A written reason is required for this world state action.' }, { status: 400 });
    }
  }

  return await withTransaction(async (client) => {
    const currentRes = await client.query('SELECT * FROM world_state WHERE id = $1 FOR UPDATE', ['default']);
    const current = currentRes.rows[0];

    // Compute accrued elapsed seconds while active
    let updatedClock = current.clock_seconds;
    if (!current.is_paused && !current.is_frozen && current.updated_at) {
      const elapsed = Math.floor((Date.now() - new Date(current.updated_at).getTime()) / 1000);
      if (elapsed > 0) {
        updatedClock += elapsed;
      }
    }

    let updatedTick = current.current_tick;
    let updatedPaused = current.is_paused;
    let updatedFrozen = current.is_frozen;
    let updatedFreezeReason = current.freeze_reason;
    let updatedHumanInternet = current.human_internet_mode;
    let auditAction = '';

    switch (action) {
      case 'start':
      case 'resume':
        updatedPaused = false;
        auditAction = 'WORLD_CLOCK_RESUMED';
        break;

      case 'pause':
        updatedPaused = true;
        auditAction = 'WORLD_CLOCK_PAUSED';
        break;

      case 'tick_second':
        // Increment elapsed simulation time
        if (!current.is_paused && !current.is_frozen) {
          updatedClock += (elapsedIncrement || 1);
        }
        break;

      case 'advance_tick':
        updatedTick += 1;
        // 30 min per tick = 1800 seconds
        updatedClock = updatedTick * 1800;
        auditAction = 'WORLD_TICK_ADVANCED';

        // Record tick in ticks table
        await client.query(
          'INSERT INTO ticks (tick_number, started_at, reason, advanced_by) VALUES ($1, NOW(), $2, $3)',
          [updatedTick, reason, user.userId]
        );
        break;

      case 'freeze':
        updatedFrozen = true;
        updatedFreezeReason = reason;
        auditAction = 'WORLD_FROZEN';
        break;

      case 'unfreeze':
        updatedFrozen = false;
        updatedFreezeReason = null;
        auditAction = 'WORLD_UNFROZEN';
        break;

      case 'toggle_human_internet':
        updatedHumanInternet = !current.human_internet_mode;
        auditAction = updatedHumanInternet ? 'HUMAN_INTERNET_ENABLED' : 'HUMAN_INTERNET_DISABLED';
        break;

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    await client.query(
      `UPDATE world_state SET
        clock_seconds = $1,
        current_tick = $2,
        is_paused = $3,
        is_frozen = $4,
        freeze_reason = $5,
        human_internet_mode = $6,
        updated_at = NOW()
      WHERE id = 'default'`,
      [updatedClock, updatedTick, updatedPaused, updatedFrozen, updatedFreezeReason, updatedHumanInternet]
    );

    if (auditAction) {
      const auditId = `aud_world_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (
          id, timestamp, actor_id, actor_role, action, object_type, object_id, before_state, after_state, reason, source
        ) VALUES ($1, NOW(), $2, $3, $4, 'world_state', 'default', $5, $6, $7, 'gm_console')`,
        [
          auditId,
          user.userId,
          user.role,
          auditAction,
          JSON.stringify({ clock: current.clock_seconds, tick: current.current_tick, paused: current.is_paused, frozen: current.is_frozen, humanInternet: current.human_internet_mode }),
          JSON.stringify({ clock: updatedClock, tick: updatedTick, paused: updatedPaused, frozen: updatedFrozen, humanInternet: updatedHumanInternet }),
          reason || 'Normal operation',
        ]
      );
    }

    const newState = {
      clockSeconds: updatedClock,
      currentTick: updatedTick,
      isPaused: updatedPaused,
      isFrozen: updatedFrozen,
      freezeReason: updatedFreezeReason,
      humanInternetMode: updatedHumanInternet,
      wave: current.wave || 1,
      action,
    };

    eventBus.broadcast('world_state_updated', newState);

    return NextResponse.json({ success: true, state: newState });
  });
}
