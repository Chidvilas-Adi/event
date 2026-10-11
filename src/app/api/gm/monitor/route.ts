import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { pool } from '@/lib/db';
import { LedgerService } from '@/lib/ledger/service';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin' && user.role !== 'observer' && user.role !== 'event_lead')) {
    return NextResponse.json({ error: 'FORBIDDEN: GM, Admin, or Observer monitoring access required.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get('id');
  const targetType = searchParams.get('type');

  if (!targetId) {
    return NextResponse.json({ error: 'Target ID required.' }, { status: 400 });
  }

  // 1. Check if Company
  if (targetType === 'company' || targetId.startsWith('comp_')) {
    const compRes = await pool.query('SELECT * FROM companies WHERE id = $1', [targetId]);
    if (compRes.rows.length > 0) {
      const comp = compRes.rows[0];
      const balance = await LedgerService.getBalance('company', comp.id);

      // Resources
      const resQuery = await pool.query(
        `SELECT resource_id, COALESCE(SUM(quantity), 0) as total_qty
         FROM resource_ledger
         WHERE owner_type = 'company' AND owner_id = $1
         GROUP BY resource_id`,
        [comp.id]
      );
      const resources: Record<string, number> = {};
      resQuery.rows.forEach((r) => {
        resources[r.resource_id] = parseInt(r.total_qty, 10);
      });

      // Active deals
      const dealsRes = await pool.query(
        `SELECT * FROM deals WHERE sender_id = $1 OR recipient_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [comp.id]
      );

      // Audit logs
      const auditRes = await pool.query(
        `SELECT * FROM audit_log WHERE object_id = $1 OR reason ILIKE $2 ORDER BY timestamp DESC LIMIT 30`,
        [comp.id, `%${comp.name}%`]
      );

      return NextResponse.json({
        targetType: 'company',
        entity: comp,
        balance,
        resources,
        activeDeals: dealsRes.rows,
        recentAudits: auditRes.rows,
      });
    }
  }

  // 2. Check if Participant
  const partRes = await pool.query(
    `SELECT p.*, m.company_id, c.name as company_name, m.role as company_role
     FROM participants p
     LEFT JOIN memberships m ON p.id = m.participant_id AND m.status = 'active'
     LEFT JOIN companies c ON m.company_id = c.id
     WHERE p.id = $1 OR p.citizen_code = $1`,
    [targetId]
  );

  if (partRes.rows.length > 0) {
    const p = partRes.rows[0];
    const balance = await LedgerService.getBalance('participant', p.id);

    // Fetch user's deals
    const dealsRes = await pool.query(
      `SELECT * FROM deals WHERE sender_id = $1 OR recipient_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [p.id]
    );

    // Fetch user's ledger entries
    const ledgerRes = await pool.query(
      `SELECT * FROM ledger_entries WHERE from_id = $1 OR to_id = $1 ORDER BY timestamp DESC LIMIT 20`,
      [p.id]
    );

    // Fetch complete audit logs for this user
    const auditRes = await pool.query(
      `SELECT * FROM audit_log WHERE actor_id = $1 OR object_id = $1 ORDER BY timestamp DESC LIMIT 30`,
      [p.id]
    );

    return NextResponse.json({
      targetType: 'participant',
      entity: p,
      profile: p,
      balance,
      activeDeals: dealsRes.rows,
      ledgerEntries: ledgerRes.rows,
      recentAudits: auditRes.rows,
    });
  }

  // 3. Check if Operator
  const opRes = await pool.query(
    `SELECT op.*, inst.name as institution_name
     FROM operator_accounts op
     LEFT JOIN institutions inst ON op.institution_id = inst.id
     WHERE op.id = $1 OR op.username = $1`,
    [targetId]
  );

  if (opRes.rows.length > 0) {
    const op = opRes.rows[0];
    const auditRes = await pool.query(
      `SELECT * FROM audit_log WHERE actor_id = $1 OR object_id = $1 ORDER BY timestamp DESC LIMIT 30`,
      [op.id]
    );

    return NextResponse.json({
      targetType: 'operator',
      entity: op,
      profile: op,
      recentAudits: auditRes.rows,
    });
  }

  return NextResponse.json({ error: 'Target not found.' }, { status: 404 });
}
