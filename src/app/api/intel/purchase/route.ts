import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { LedgerService } from '@/lib/ledger/service';
import { pool } from '@/lib/db';
import crypto from 'crypto';
import { STATION_FLAGS } from '@/lib/data/station-flags';

export async function GET() {
  // Public directory of stations and available intelligence packages
  const stations = Object.entries(STATION_FLAGS).map(([id, info]) => ({
    id,
    name: info.name,
    cost: info.cost,
  }));
  return NextResponse.json({ stations });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED: Login session required.' }, { status: 401 });
  }

  const body = await req.json();
  const stationId = (body.stationId || 'bank').toLowerCase().trim();
  const info = STATION_FLAGS[stationId];

  if (!info) {
    return NextResponse.json(
      { error: `Unknown station '${stationId}'. Available stations: ${Object.keys(STATION_FLAGS).join(', ')}` },
      { status: 400 }
    );
  }

  // 1. Verify user wallet balance
  const currentBalance = await LedgerService.getBalance('participant', user.userId);
  if (currentBalance < info.cost) {
    return NextResponse.json(
      {
        error: `INSUFFICIENT_FUNDS: Intelligence decryption requires ${info.cost} VB. Your current balance is ${currentBalance} VB.`,
      },
      { status: 400 }
    );
  }

  try {
    // 2. Atomically transfer intelligence payment to system treasury
    const idempotencyKey = `intel_${user.userId}_${stationId}_${Date.now()}`;
    await LedgerService.executeTransfer({
      fromType: 'participant',
      fromId: user.userId,
      toType: 'system',
      toId: 'system_treasury',
      amount: info.cost,
      type: 'fee',
      reason: `Treasure Hunt Intel Purchase: ${info.name} Decryption Flag`,
      authoriser: user.userId,
      idempotencyKey,
    });

    // 3. Log audit entry
    const auditId = `aud_intel_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    await pool.query(
      `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
       VALUES ($1, NOW(), $2, $3, 'TREASURE_HUNT_INTEL_PURCHASED', 'intel', $4, $5, 'intel_desk')`,
      [auditId, user.userId, user.role, stationId, `Citizen paid ${info.cost} VB for ${info.name} secret flag.`]
    );

    return NextResponse.json({
      success: true,
      stationId,
      stationName: info.name,
      costPaid: info.cost,
      flagToken: info.flag,
      clue: info.clue,
      message: `Decryption successful! Charged ${info.cost} VB. Copy secret flag code to complete your mission!`,
    });
  } catch (err: any) {
    console.error('Intel purchase failed:', err);
    return NextResponse.json({ error: err.message || 'Failed to purchase intelligence.' }, { status: 500 });
  }
}
