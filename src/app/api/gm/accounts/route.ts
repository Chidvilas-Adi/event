import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { pool, withTransaction } from '@/lib/db';
import { hashPassword } from '@/lib/auth/session';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: GM or Tech Admin access required.' }, { status: 403 });
  }

  const parts = await pool.query(`
    SELECT p.id, p.citizen_code, p.name, p.email, p.role, p.status, m.company_id, m.role as company_role, c.name as company_name,
      COALESCE((
        SELECT SUM(
          CASE
            WHEN to_type = 'participant' AND to_id = p.id THEN amount
            WHEN from_type = 'participant' AND from_id = p.id THEN -amount
            ELSE 0
          END
        ) FROM ledger_entries
      ), 0) as wallet_balance
    FROM participants p
    LEFT JOIN memberships m ON p.id = m.participant_id AND m.status = 'active'
    LEFT JOIN companies c ON m.company_id = c.id
    ORDER BY p.citizen_code ASC
  `);

  const ops = await pool.query(`
    SELECT id, username, name, role_id, institution_id, is_active, created_at
    FROM operator_accounts
    ORDER BY role_id ASC
  `);

  return NextResponse.json({
    participants: parts.rows,
    operators: ops.rows,
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Game Master or Tech Admin can create credentials and accounts.' }, { status: 403 });
  }

  const body = await req.json();
  const {
    accountType = 'participant', // 'participant' | 'operator'
    name,
    citizenCode,
    companyId,
    companyRole = 'Core Operator',
    role = 'participant',
    username,
    password,
    institutionId,
  } = body;

  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  }

  return await withTransaction(async (client) => {
    if (accountType === 'participant') {
      const code = (citizenCode || `VC-${Math.floor(100 + Math.random() * 900)}`).trim().toUpperCase();
      const pId = `vc_p_${code.replace(/[^A-Z0-9]/g, '').toLowerCase()}`;

      // Check duplicate code
      const dup = await client.query('SELECT id FROM participants WHERE citizen_code = $1', [code]);
      if (dup.rows.length > 0) {
        throw new Error(`DUPLICATE_CODE: Citizen code ${code} is already in use.`);
      }

      await client.query(
        `INSERT INTO participants (id, citizen_code, name, event_code, role, status)
         VALUES ($1, $2, $3, 'VC2026', $4, 'active')`,
        [pId, code, name.trim(), role]
      );

      // If company assigned, create membership
      if (companyId) {
        await client.query(
          `INSERT INTO memberships (id, participant_id, company_id, role, status)
           VALUES ($1, $2, $3, $4, 'active')`,
          [`mem_${pId}`, pId, companyId, companyRole]
        );
      }

      // Mint initial citizen staking allowance (500 VB)
      await client.query(
        `INSERT INTO ledger_entries (
          id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
        ) VALUES ($1, NOW(), 'system', NULL, 'participant', $2, 500, 'grant', 'GM Created Citizen Allowance', $3)`,
        [`ledg_init_${pId}`, pId, user.userId]
      );

      // Audit log
      const auditId = `aud_acc_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (
          id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
        ) VALUES ($1, NOW(), $2, 'gm', 'ACCOUNT_CREATED', 'participants', $3, $4, 'gm_console')`,
        [auditId, user.userId, pId, `Created participant ${name} (${code})`]
      );

      return NextResponse.json({ success: true, citizenId: pId, citizenCode: code });
    } else {
      // Operator account
      if (!username || !password) {
        throw new Error('Username and password required for operator account.');
      }
      const opId = `op_${username.trim().toLowerCase()}`;
      const hashed = hashPassword(password);

      await client.query(
        `INSERT INTO operator_accounts (id, username, name, role_id, institution_id, password_hash, totp_secret, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, '000000', TRUE)`,
        [opId, username.trim().toLowerCase(), name.trim(), role, institutionId || null, hashed]
      );

      const auditId = `aud_acc_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (
          id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
        ) VALUES ($1, NOW(), $2, 'gm', 'OPERATOR_CREATED', 'operator_accounts', $3, $4, 'gm_console')`,
        [auditId, user.userId, opId, `Created operator ${username} with role ${role}`]
      );

      return NextResponse.json({ success: true, operatorId: opId, username });
    }
  });
}

export async function PUT(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Game Master or Tech Admin can edit participant and operator accounts.' }, { status: 403 });
  }

  const body = await req.json();
  const {
    accountType = 'participant',
    id,
    name,
    citizenCode,
    role,
    status,
    companyId,
    companyRole,
    adjustmentVb,
    adjustmentReason,
    newPassword,
    isActive,
    institutionId,
  } = body;

  if (!id) {
    return NextResponse.json({ error: 'Account ID is required to update.' }, { status: 400 });
  }

  return await withTransaction(async (client) => {
    if (accountType === 'participant') {
      const existing = await client.query('SELECT * FROM participants WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        throw new Error('Participant not found.');
      }

      // Update participant core record
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
      if (newPassword && newPassword.trim() !== '') {
        updateFields.push(`event_code = $${idx++}`);
        updateVals.push(newPassword.trim().toUpperCase());
      }

      if (updateFields.length > 0) {
        updateVals.push(id);
        await client.query(
          `UPDATE participants SET ${updateFields.join(', ')} WHERE id = $${idx}`,
          updateVals
        );
      }

      // Handle Company Membership & Role
      if (companyId !== undefined) {
        // Deactivate existing memberships
        await client.query(
          "UPDATE memberships SET status = 'terminated' WHERE participant_id = $1",
          [id]
        );

        if (companyId && companyId.trim() !== '') {
          // Add or reactivate membership
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

      // Optional VB balance adjustment directly from GM
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

      // Audit log
      const auditId = `aud_edit_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (
          id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
        ) VALUES ($1, NOW(), $2, 'gm', 'PARTICIPANT_UPDATED', 'participants', $3, $4, 'gm_console')`,
        [auditId, user.userId, id, `GM updated participant profile (${name || id})`]
      );

      return NextResponse.json({ success: true, updatedId: id });
    } else {
      // Update operator
      const updateFields: string[] = [];
      const updateVals: any[] = [];
      let idx = 1;

      if (name !== undefined) {
        updateFields.push(`name = $${idx++}`);
        updateVals.push(name.trim());
      }
      if (role !== undefined) {
        updateFields.push(`role_id = $${idx++}`);
        updateVals.push(role);
      }
      if (institutionId !== undefined) {
        updateFields.push(`institution_id = $${idx++}`);
        updateVals.push(institutionId || null);
      }
      if (isActive !== undefined) {
        updateFields.push(`is_active = $${idx++}`);
        updateVals.push(Boolean(isActive));
      }
      if (newPassword && newPassword.trim() !== '') {
        updateFields.push(`password_hash = $${idx++}`);
        updateVals.push(hashPassword(newPassword.trim()));
      }

      if (updateFields.length > 0) {
        updateVals.push(id);
        await client.query(
          `UPDATE operator_accounts SET ${updateFields.join(', ')} WHERE id = $${idx}`,
          updateVals
        );
      }

      const auditId = `aud_edit_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (
          id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
        ) VALUES ($1, NOW(), $2, 'gm', 'OPERATOR_UPDATED', 'operator_accounts', $3, $4, 'gm_console')`,
        [auditId, user.userId, id, `GM updated operator profile (${id})`]
      );

      return NextResponse.json({ success: true, updatedId: id });
    }
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Game Master or Tech Admin can delete or revoke accounts.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  let participantId = searchParams.get('participantId');
  let operatorId = searchParams.get('operatorId');

  if (!participantId && !operatorId) {
    try {
      const body = await req.json();
      if (body) {
        participantId = body.participantId || (body.accountType === 'participant' ? body.id : null);
        operatorId = body.operatorId || (body.accountType === 'operator' ? body.id : null);
      }
    } catch {
      // Body empty or not JSON, query params used
    }
  }

  if (!participantId && !operatorId) {
    return NextResponse.json({ error: 'Participant ID or Operator ID is required to delete.' }, { status: 400 });
  }

  return await withTransaction(async (client) => {
    if (participantId) {
      // 1. Delete associated founder evidence
      await client.query("DELETE FROM founder_evidence WHERE participant_id = $1", [participantId]);
      // 2. Delete mission instances
      await client.query("DELETE FROM mission_instances WHERE participant_id = $1", [participantId]);
      // 3. Delete memberships
      await client.query("DELETE FROM memberships WHERE participant_id = $1", [participantId]);
      // 4. Delete notifications
      await client.query("DELETE FROM notifications WHERE recipient_id = $1", [participantId]);
      // 5. Delete cap table entries
      await client.query("DELETE FROM cap_table WHERE shareholder_type = 'participant' AND shareholder_id = $1", [participantId]);
      // 6. Nullify missions secret participant
      await client.query("UPDATE missions SET secret_participant_id = NULL WHERE secret_participant_id = $1", [participantId]);
      // 7. Delete participant
      await client.query("DELETE FROM participants WHERE id = $1", [participantId]);

      // Audit log
      const auditId = `aud_del_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (
          id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
        ) VALUES ($1, NOW(), $2, 'gm', 'PARTICIPANT_DELETED', 'participants', $3, 'GM permanently deleted participant', 'gm_console')`,
        [auditId, user.userId, participantId]
      );

      return NextResponse.json({ success: true, deletedId: participantId });
    } else if (operatorId) {
      if (operatorId === 'op_gm' || operatorId === user.userId) {
        throw new Error('Cannot delete primary Game Master account or currently active session.');
      }

      await client.query('DELETE FROM operator_accounts WHERE id = $1', [operatorId]);

      const auditId = `aud_del_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (
          id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
        ) VALUES ($1, NOW(), $2, 'gm', 'OPERATOR_DELETED', 'operator_accounts', $3, 'GM deleted operator', 'gm_console')`,
        [auditId, user.userId, operatorId]
      );

      return NextResponse.json({ success: true, deletedId: operatorId });
    }
  });
}
