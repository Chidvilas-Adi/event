import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { pool } from '@/lib/db';
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
  const body = await req.json();
  const { targetIdentifier } = body;

  if (!targetIdentifier || typeof targetIdentifier !== 'string') {
    return NextResponse.json({ error: 'Please specify the target citizen code or ID.' }, { status: 400 });
  }

  // 1. Fetch mission instance and ensure it belongs to this user
  const instRes = await pool.query(
    `SELECT mi.*, m.title as mission_title, m.verification_method, m.verification_secret, p.name as sender_name, p.citizen_code as sender_citizen_code
     FROM mission_instances mi
     JOIN missions m ON mi.mission_id = m.id
     JOIN participants p ON mi.participant_id = p.id
     WHERE mi.id = $1`,
    [instanceId]
  );

  if (instRes.rows.length === 0) {
    return NextResponse.json({ error: 'Mission instance not found.' }, { status: 404 });
  }

  const inst = instRes.rows[0];
  if (inst.participant_id !== user.userId) {
    return NextResponse.json({ error: 'FORBIDDEN: You do not own this mission claim.' }, { status: 403 });
  }

  if (inst.status !== 'in_progress') {
    return NextResponse.json({ error: `Mission is already ${inst.status}.` }, { status: 400 });
  }

  // 2. Find target citizen
  const cleanTarget = targetIdentifier.trim().toUpperCase();
  const partRes = await pool.query(
    `SELECT id, name, citizen_code FROM participants
     WHERE UPPER(citizen_code) = $1 OR id = $2`,
    [cleanTarget, targetIdentifier.trim()]
  );

  if (partRes.rows.length === 0) {
    return NextResponse.json({ error: `No citizen found matching "${cleanTarget}".` }, { status: 404 });
  }

  const target = partRes.rows[0];
  if (target.id === user.userId) {
    return NextResponse.json({ error: 'You cannot initiate a peer handshake with yourself.' }, { status: 400 });
  }

  // 3. Determine handshake code
  const code = (inst.verification_secret || `CP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`).trim().toUpperCase();

  // 4. Update mission instance with handshake state
  const prevEvidence = inst.evidence || {};
  const updatedEvidence = {
    ...prevEvidence,
    target_participant_id: target.id,
    target_citizen_code: target.citizen_code,
    handshake_code: code,
    status: 'awaiting_peer_attestation',
    requested_at: new Date().toISOString(),
  };

  await pool.query(
    `UPDATE mission_instances
     SET counterparty_code = $1, evidence = $2
     WHERE id = $3`,
    [code, JSON.stringify(updatedEvidence), instanceId]
  );

  // 5. Notify target citizen
  const notifId = `notif_hs_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
  await pool.query(
    `INSERT INTO notifications (id, recipient_id, type, title, message, payload)
     VALUES ($1, $2, 'peer_mission_handshake', $3, $4, $5)`,
    [
      notifId,
      target.id,
      '🤝 Peer Mission Attestation Request',
      `Citizen ${inst.sender_name} (${inst.sender_citizen_code}) has initiated mission collaboration: "${inst.mission_title}". Your verification code is: ${code}`,
      JSON.stringify({
        instanceId,
        missionId: inst.mission_id,
        missionTitle: inst.mission_title,
        senderId: user.userId,
        senderName: inst.sender_name,
        senderCitizenCode: inst.sender_citizen_code,
        code,
      }),
    ]
  );

  return NextResponse.json({
    success: true,
    code,
    targetName: target.name,
    targetCitizenCode: target.citizen_code,
    message: `Handshake request dispatched to ${target.name} [${target.citizen_code}]. Verification key: ${code}`,
  });
}
