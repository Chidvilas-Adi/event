import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { pool } from '@/lib/db';
import { LedgerService } from '@/lib/ledger/service';
import { PolicyEngine } from '@/lib/auth/policy';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';
  const companyId = searchParams.get('companyId');

  let sql = `
    SELECT p.id, p.citizen_code, p.name, p.email, p.role, p.status,
           m.company_id, c.name as company_name, m.role as company_role
    FROM participants p
    LEFT JOIN memberships m ON p.id = m.participant_id AND m.status = 'active'
    LEFT JOIN companies c ON m.company_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (query.trim().length > 0) {
    params.push(`%${query.trim()}%`);
    sql += ` AND (p.name ILIKE $${params.length} OR p.citizen_code ILIKE $${params.length} OR c.name ILIKE $${params.length})`;
  }

  if (companyId) {
    params.push(companyId);
    sql += ` AND m.company_id = $${params.length}`;
  }

  const isGm = user?.role === 'gm' || user?.role === 'admin';
  sql += isGm ? ' ORDER BY p.citizen_code ASC LIMIT 500' : ' ORDER BY p.citizen_code ASC LIMIT 100';

  const res = await pool.query(sql, params);

  const participants = await Promise.all(
    res.rows.map(async (p) => {
      let walletBalance = undefined;
      // Only GM or the user themselves can see their wallet
      if (isGm || (user && user.userId === p.id)) {
        walletBalance = await LedgerService.getBalance('participant', p.id);
      }

      return PolicyEngine.filterObject(
        {
          ...p,
          wallet_balance: walletBalance,
        },
        'participant',
        user
      );
    })
  );

  return NextResponse.json({ participants });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Game Master or Tech Admin can create participants.' }, { status: 403 });
  }

  const body = await req.json();
  const { name, citizenCode, role = 'participant', companyId, companyRole = 'Core Operator', initialBalance = 500, email } = body;

  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  }

  const { withTransaction } = await import('@/lib/db');
  const crypto = await import('crypto');

  return await withTransaction(async (client) => {
    const code = (citizenCode || `VC-${Math.floor(100 + Math.random() * 900)}`).trim().toUpperCase();
    const pId = `vc_p_${code.replace(/[^A-Z0-9]/g, '').toLowerCase()}`;

    const dup = await client.query('SELECT id FROM participants WHERE citizen_code = $1', [code]);
    if (dup.rows.length > 0) {
      return NextResponse.json({ error: `DUPLICATE_CODE: Citizen code ${code} is already in use.` }, { status: 400 });
    }

    await client.query(
      `INSERT INTO participants (id, citizen_code, name, email, event_code, role, status)
       VALUES ($1, $2, $3, $4, 'VC2026', $5, 'active')`,
      [pId, code, name.trim(), email || `${name.toLowerCase().replace(/\s+/g, '.')}@pesu.internal`, role]
    );

    if (companyId) {
      await client.query(
        `INSERT INTO memberships (id, participant_id, company_id, role, status)
         VALUES ($1, $2, $3, $4, 'active')`,
        [`mem_${pId}`, pId, companyId, companyRole]
      );
    }

    const initBal = parseInt(initialBalance, 10) || 500;
    if (initBal > 0) {
      await client.query(
        `INSERT INTO ledger_entries (
          id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
        ) VALUES ($1, NOW(), 'system', NULL, 'participant', $2, $3, 'grant', 'GM Created Citizen Allowance', $4)`,
        [`ledg_init_${pId}`, pId, initBal, user.userId]
      );
    }

    const auditId = `aud_acc_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    await client.query(
      `INSERT INTO audit_log (
        id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
      ) VALUES ($1, NOW(), $2, 'gm', 'PARTICIPANT_CREATED', 'participants', $3, $4, 'participant_api')`,
      [auditId, user.userId, pId, `Created participant ${name} (${code})`]
    );

    return NextResponse.json({ success: true, citizenId: pId, citizenCode: code });
  });
}

export async function PUT(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Game Master or Tech Admin can edit participants.' }, { status: 403 });
  }

  const body = await req.json();
  const { id, name, citizenCode, role, status, companyId, companyRole, adjustmentVb, adjustmentReason } = body;

  if (!id) {
    return NextResponse.json({ error: 'Participant ID is required to update.' }, { status: 400 });
  }

  const { withTransaction } = await import('@/lib/db');
  const crypto = await import('crypto');

  return await withTransaction(async (client) => {
    const existing = await client.query('SELECT * FROM participants WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Participant not found.' }, { status: 404 });
    }

    const updateFields: string[] = [];
    const updateVals: any[] = [];
    let idx = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${idx++}`);
      updateVals.push(name.trim());
    }
    if (citizenCode !== undefined) {
      updateFields.push(`citizen_code = $${idx++}`);
      updateVals.push(citizenCode.trim().toUpperCase());
    }
    if (role !== undefined) {
      updateFields.push(`role = $${idx++}`);
      updateVals.push(role);
    }
    if (status !== undefined) {
      updateFields.push(`status = $${idx++}`);
      updateVals.push(status);
    }

    if (updateFields.length > 0) {
      updateVals.push(id);
      await client.query(
        `UPDATE participants SET ${updateFields.join(', ')} WHERE id = $${idx}`,
        updateVals
      );
    }

    if (companyId !== undefined) {
      await client.query("UPDATE memberships SET status = 'terminated' WHERE participant_id = $1", [id]);
      if (companyId && companyId.trim() !== '') {
        const memId = `mem_${id}_${Date.now()}`;
        await client.query(
          `INSERT INTO memberships (id, participant_id, company_id, role, status)
           VALUES ($1, $2, $3, $4, 'active')`,
          [memId, id, companyId, companyRole || 'Core Operator']
        );
      }
    } else if (companyRole !== undefined) {
      await client.query(
        "UPDATE memberships SET role = $1 WHERE participant_id = $2 AND status = 'active'",
        [companyRole, id]
      );
    }

    if (adjustmentVb && parseInt(adjustmentVb, 10) !== 0) {
      const amt = parseInt(adjustmentVb, 10);
      const adjId = `ledg_adj_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      if (amt > 0) {
        await client.query(
          `INSERT INTO ledger_entries (
            id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
          ) VALUES ($1, NOW(), 'system', NULL, 'participant', $2, $3, 'adjustment', $4, $5)`,
          [adjId, id, amt, adjustmentReason || 'GM Discretionary Credit', user.userId]
        );
      } else {
        await client.query(
          `INSERT INTO ledger_entries (
            id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
          ) VALUES ($1, NOW(), 'participant', $2, 'system', NULL, $3, 'fine', $4, $5)`,
          [adjId, id, Math.abs(amt), adjustmentReason || 'GM Discretionary Deduction', user.userId]
        );
      }
    }

    const auditId = `aud_edit_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    await client.query(
      `INSERT INTO audit_log (
        id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
      ) VALUES ($1, NOW(), $2, 'gm', 'PARTICIPANT_UPDATED', 'participants', $3, $4, 'participant_api')`,
      [auditId, user.userId, id, `GM updated participant profile (${name || id})`]
    );

    return NextResponse.json({ success: true, updatedId: id });
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Game Master or Tech Admin can delete participants.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  let participantId = searchParams.get('id') || searchParams.get('participantId');
  if (!participantId) {
    try {
      const body = await req.json();
      participantId = body?.id || body?.participantId;
    } catch {
      // No body
    }
  }

  if (!participantId) {
    return NextResponse.json({ error: 'Participant ID is required to delete.' }, { status: 400 });
  }

  const { withTransaction } = await import('@/lib/db');
  const crypto = await import('crypto');

  return await withTransaction(async (client) => {
    await client.query("DELETE FROM founder_evidence WHERE participant_id = $1", [participantId]);
    await client.query("DELETE FROM mission_instances WHERE participant_id = $1", [participantId]);
    await client.query("DELETE FROM memberships WHERE participant_id = $1", [participantId]);
    await client.query("DELETE FROM notifications WHERE recipient_id = $1", [participantId]);
    await client.query("DELETE FROM cap_table WHERE shareholder_type = 'participant' AND shareholder_id = $1", [participantId]);
    await client.query("UPDATE missions SET secret_participant_id = NULL WHERE secret_participant_id = $1", [participantId]);
    await client.query("DELETE FROM participants WHERE id = $1", [participantId]);

    const auditId = `aud_del_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    await client.query(
      `INSERT INTO audit_log (
        id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
      ) VALUES ($1, NOW(), $2, 'gm', 'PARTICIPANT_DELETED', 'participants', $3, 'GM deleted participant', 'participant_api')`,
      [auditId, user.userId, participantId]
    );

    return NextResponse.json({ success: true, deletedId: participantId });
  });
}

