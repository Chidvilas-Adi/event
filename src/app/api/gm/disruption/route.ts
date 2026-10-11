import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { pool, withTransaction } from '@/lib/db';
import { eventBus } from '@/lib/events/bus';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Game Master or Tech Admin can trigger world disruptions.' }, { status: 403 });
  }

  const body = await req.json();
  let {
    title,
    description,
    disruptionType = 'price_shock',
    targetResource,
    priceChangePercent,
    params,
    reason,
  } = body;

  // Handle preset params if passed from UI
  if (params) {
    if (params.targetResource) targetResource = params.targetResource;
    if (params.priceChangePercent !== undefined) priceChangePercent = params.priceChangePercent;
    if (params.factor && !priceChangePercent) {
      priceChangePercent = Math.round((params.factor - 1) * 100);
    }
  }

  if (!title || !description) {
    return NextResponse.json({ error: 'Title and description are required.' }, { status: 400 });
  }

  return await withTransaction(async (client) => {
    const eventId = `evt_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;

    // 1. Record event
    await client.query(
      `INSERT INTO events (id, title, description, impact_config, is_active, triggered_at)
       VALUES ($1, $2, $3, $4, TRUE, NOW())`,
      [
        eventId,
        title,
        description,
        JSON.stringify({ disruptionType, targetResource, priceChangePercent, params, reason }),
      ]
    );

    // 2. Resource price shocks
    if (disruptionType === 'inflation_spike' || params?.allResources) {
      const mult = 1 + (priceChangePercent || 25) / 100;
      await client.query(
        'UPDATE resources SET base_price = GREATEST(1, ROUND(base_price * $1))',
        [mult]
      );
    } else if (targetResource && priceChangePercent) {
      const mult = 1 + priceChangePercent / 100;
      await client.query(
        'UPDATE resources SET base_price = GREATEST(1, ROUND(base_price * $1)) WHERE id = $2',
        [mult, targetResource]
      );
    }

    // 3. Institution capacity changes
    if (disruptionType === 'capacity_drop' || params?.capacityFactor) {
      const factor = params?.capacityFactor || (params?.factor ? params.factor : 0.5);
      const instId = params?.institutionId || 'logistics';
      await client.query(
        'UPDATE institutions SET capacity = GREATEST(10, ROUND(capacity * $1)) WHERE id = $2',
        [factor, instId]
      );
    }

    // 4. Financial & Institution Pool shocks
    if (disruptionType === 'bank_run' || params?.poolReduction) {
      const reduction = params?.poolReduction || 30000;
      await client.query(
        `UPDATE institutions
         SET config = jsonb_set(config, '{lending_pool_remaining}',
           to_jsonb(GREATEST(0, COALESCE((config->>'lending_pool_remaining')::int, 80000) - $1::int)))
         WHERE id = 'bank'`,
        [reduction]
      );
    }

    if (disruptionType === 'fund_freeze' || params?.fundReduction) {
      const reduction = params?.fundReduction || 40000;
      await client.query(
        `UPDATE institutions
         SET config = jsonb_set(config, '{fund_size_remaining}',
           to_jsonb(GREATEST(0, COALESCE((config->>'fund_size_remaining')::int, 140000) - $1::int)))
         WHERE id = 'investor'`,
        [reduction]
      );
    }

    if (disruptionType === 'grant_stimulus' || params?.grantAddition) {
      const addition = params?.grantAddition || 30000;
      await client.query(
        `UPDATE institutions
         SET config = jsonb_set(config, '{grant_pool_remaining}',
           to_jsonb(COALESCE((config->>'grant_pool_remaining')::int, 30000) + $1::int))
         WHERE id = 'government'`,
        [addition]
      );
    }

    if (disruptionType === 'wage_inflation' || params?.wageIncrease) {
      const increase = params?.wageIncrease || 30;
      await client.query(
        `UPDATE institutions
         SET config = jsonb_set(config, '{salary_per_tick_l0}',
           to_jsonb(COALESCE((config->>'salary_per_tick_l0')::int, 100) + $1::int))
         WHERE id = 'talent_exchange'`,
        [increase]
      );
    }

    // 5. Publish critical announcement
    const annId = `ann_disrupt_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const annMsg = `✦ CITY DISTURBANCE: [${title.toUpperCase()}] ${description}`;
    await client.query(
      `INSERT INTO announcements (id, audience, target_id, message, priority, author_id)
       VALUES ($1, 'all', NULL, $2, 'critical', $3)`,
      [annId, annMsg, user.userId]
    );

    // 6. Audit log
    const auditId = `aud_disrupt_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    await client.query(
      `INSERT INTO audit_log (id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source)
       VALUES ($1, NOW(), $2, 'gm', 'MARKET_DISRUPTION_TRIGGERED', 'events', $3, $4, 'gm_disruption')`,
      [auditId, user.userId, eventId, reason || title]
    );

    const disruptionPayload = { eventId, title, description, disruptionType, targetResource, priceChangePercent };
    eventBus.broadcast('market_disruption', disruptionPayload);

    return NextResponse.json({ success: true, eventId, title });
  });
}
