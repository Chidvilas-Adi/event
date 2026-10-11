import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { pool } from '@/lib/db';
import { MissionService } from '@/lib/missions/service';
import crypto from 'crypto';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED: Session required.' }, { status: 401 });
  }

  const { id: instanceId } = await params;

  // 1. Fetch mission instance
  const instRes = await pool.query(
    `SELECT mi.*, m.title as mission_title, m.reward_vb, p.id as owner_id, p.name as owner_name, p.citizen_code as owner_citizen_code
     FROM mission_instances mi
     JOIN missions m ON mi.mission_id = m.id
     JOIN participants p ON mi.participant_id = p.id
     WHERE mi.id = $1`,
    [instanceId]
  );

  if (instRes.rows.length === 0) {
    return NextResponse.json({ error: 'Mission claim instance not found.' }, { status: 404 });
  }

  const inst = instRes.rows[0];
  const evidence = inst.evidence || {};

  // 2. Validate that the logged in user is the designated peer counterparty
  if (evidence.target_participant_id !== user.userId) {
    return NextResponse.json({
      error: 'FORBIDDEN: You are not the designated counterparty for this handshake attestation.',
    }, { status: 403 });
  }

  if (inst.status !== 'in_progress') {
    return NextResponse.json({ error: `Mission is already ${inst.status}.` }, { status: 400 });
  }

  try {
    // 3. Complete verification using the recorded handshake code
    const result = await MissionService.verifyMission(instanceId, inst.owner_id, {
      code: inst.counterparty_code,
      stationVerifierId: user.citizenCode || user.userId,
      evidence: {
        peer_attested_by: user.userId,
        peer_name: user.name,
        peer_code: user.citizenCode,
        attested_at: new Date().toISOString(),
      },
    });

    // 4. Mark notification as read
    await pool.query(
      `UPDATE notifications SET is_read = TRUE
       WHERE recipient_id = $1 AND type = 'peer_mission_handshake' AND payload->>'instanceId' = $2`,
      [user.userId, instanceId]
    );

    // 5. Notify the mission owner (Citizen A)
    const notifId = `notif_conf_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    await pool.query(
      `INSERT INTO notifications (id, recipient_id, type, title, message, payload)
       VALUES ($1, $2, 'mission_attested', $3, $4, $5)`,
      [
        notifId,
        inst.owner_id,
        '🎉 Peer Handshake Attested & Verified!',
        `Citizen ${user.name} (${user.citizenCode}) has confirmed and attested your handshake for "${inst.mission_title}". Reward +${inst.reward_vb} VB credited to your ledger!`,
        JSON.stringify({ instanceId, attestedBy: user.userId, code: inst.counterparty_code }),
      ]
    );

    return NextResponse.json({
      success: true,
      message: `Handshake confirmed for ${inst.owner_name}. Mission completed and reward paid!`,
      result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
