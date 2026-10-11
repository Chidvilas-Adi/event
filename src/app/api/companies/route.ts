import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { pool } from '@/lib/db';
import { LedgerService } from '@/lib/ledger/service';
import { PolicyEngine } from '@/lib/auth/policy';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('id');

  if (companyId) {
    const compRes = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
    if (compRes.rows.length === 0) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    const comp = compRes.rows[0];

    // Check permission to view private company data
    const canSeePrivate = PolicyEngine.can(user, 'VIEW_COMPANY_PRIVATE', { companyId });
    if (!canSeePrivate && !PolicyEngine.can(user, 'VIEW_COMPANIES')) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    // Fetch members
    const membersRes = await pool.query(
      `SELECT m.role, m.status, p.id, p.name, p.citizen_code
       FROM memberships m
       JOIN participants p ON m.participant_id = p.id
       WHERE m.company_id = $1 AND m.status = 'active'`,
      [companyId]
    );

    // Fetch balance and resources if allowed
    let balance = null;
    let resources: Record<string, number> = {};
    let recentLedger: any[] = [];

    if (canSeePrivate) {
      balance = await LedgerService.getBalance('company', companyId);

      const resRes = await pool.query<{ resource_id: string; total: string }>(
        `SELECT resource_id, SUM(quantity) as total
         FROM resource_ledger
         WHERE owner_type = 'company' AND owner_id = $1
         GROUP BY resource_id`,
        [companyId]
      );
      for (const r of resRes.rows) {
        resources[r.resource_id] = parseInt(r.total || '0', 10);
      }

      const ledgerRes = await pool.query(
        `SELECT * FROM ledger_entries
         WHERE (from_type = 'company' AND from_id = $1)
            OR (to_type = 'company' AND to_id = $1)
         ORDER BY timestamp DESC LIMIT 20`,
        [companyId]
      );
      recentLedger = ledgerRes.rows;
    }

    // Fetch published company documents (including founder dossier)
    const docsRes = await pool.query(
      `SELECT id, kind, title, body, dossier_url, published_at
       FROM company_documents
       WHERE company_id = $1 AND published = TRUE
       ORDER BY created_at ASC`,
      [companyId]
    );

    return NextResponse.json({
      company: {
        ...comp,
        vault_balance: balance,
        resources: canSeePrivate ? resources : undefined,
        members: membersRes.rows,
        recentLedger: canSeePrivate ? recentLedger : undefined,
        documents: docsRes.rows,
      },
    });
  }

  // List all companies
  const listRes = await pool.query(`
    SELECT c.*,
      COUNT(m.id) as member_count
    FROM companies c
    LEFT JOIN memberships m ON c.id = m.company_id AND m.status = 'active'
    GROUP BY c.id
    ORDER BY c.tier ASC, c.name ASC
  `);

  // For GM, Admins, Volunteers (underwriting), and Observers, fetch balances for all companies
  const canSeeAllBalances =
    user?.role === 'gm' ||
    user?.role === 'admin' ||
    user?.role === 'volunteer' ||
    user?.role === 'observer';

  const companies = await Promise.all(
    listRes.rows.map(async (c) => {
      let balance = null;
      let resources: Record<string, number> = {};
      if (canSeeAllBalances || (user?.companyId && user.companyId === c.id)) {
        balance = await LedgerService.getBalance('company', c.id);
        const resRes = await pool.query<{ resource_id: string; total: string }>(
          `SELECT resource_id, SUM(quantity) as total
           FROM resource_ledger
           WHERE owner_type = 'company' AND owner_id = $1
           GROUP BY resource_id`,
          [c.id]
        );
        for (const r of resRes.rows) {
          resources[r.resource_id] = parseInt(r.total || '0', 10);
        }
      }

      return PolicyEngine.filterObject(
        {
          ...c,
          vault_balance: balance,
          resources: canSeeAllBalances ? resources : undefined,
        },
        'company',
        user
      );
    })
  );

  return NextResponse.json({ companies });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Game Master or Tech Admin can create ventures.' }, { status: 403 });
  }

  const body = await req.json();
  const { id, name, tagline = '', description = '', tier = 1, status = 'operating', initialTreasury = 0 } = body;

  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: 'Company name is required.' }, { status: 400 });
  }

  const { withTransaction } = await import('@/lib/db');
  const crypto = await import('crypto');

  return await withTransaction(async (client) => {
    const compId = (id || `comp_${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`).trim();

    const dup = await client.query('SELECT id FROM companies WHERE id = $1 OR name = $2', [compId, name.trim()]);
    if (dup.rows.length > 0) {
      return NextResponse.json({ error: 'Company with this ID or Name already exists.' }, { status: 400 });
    }

    await client.query(
      `INSERT INTO companies (id, name, tagline, description, status, tier, is_hidden, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE, NOW())`,
      [compId, name.trim(), tagline.trim(), description.trim(), status, parseInt(tier, 10) || 1]
    );

    const initBal = parseInt(initialTreasury, 10) || 0;
    if (initBal > 0) {
      const ledgId = `ledg_init_${compId}_${Date.now()}`;
      await client.query(
        `INSERT INTO ledger_entries (
          id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
        ) VALUES ($1, NOW(), 'system', NULL, 'company', $2, $3, 'grant', 'GM Created Company Initial Treasury', $4)`,
        [ledgId, compId, initBal, user.userId]
      );
    }

    const auditId = `aud_comp_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    await client.query(
      `INSERT INTO audit_log (
        id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
      ) VALUES ($1, NOW(), $2, 'gm', 'COMPANY_CREATED', 'companies', $3, $4, 'company_api')`,
      [auditId, user.userId, compId, `Created company ${name}`]
    );

    return NextResponse.json({ success: true, companyId: compId });
  });
}

export async function PUT(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Game Master or Tech Admin can update ventures.' }, { status: 403 });
  }

  const body = await req.json();
  const { id, name, tagline, description, tier, status, isHidden, adjustmentVb, adjustmentReason } = body;

  if (!id) {
    return NextResponse.json({ error: 'Company ID is required.' }, { status: 400 });
  }

  const { withTransaction } = await import('@/lib/db');
  const crypto = await import('crypto');

  return await withTransaction(async (client) => {
    const existing = await client.query('SELECT * FROM companies WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
    }

    const updateFields: string[] = [];
    const updateVals: any[] = [];
    let idx = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${idx++}`);
      updateVals.push(name.trim());
    }
    if (tagline !== undefined) {
      updateFields.push(`tagline = $${idx++}`);
      updateVals.push(tagline.trim());
    }
    if (description !== undefined) {
      updateFields.push(`description = $${idx++}`);
      updateVals.push(description.trim());
    }
    if (tier !== undefined) {
      updateFields.push(`tier = $${idx++}`);
      updateVals.push(parseInt(tier, 10));
    }
    if (status !== undefined) {
      updateFields.push(`status = $${idx++}`);
      updateVals.push(status);
    }
    if (isHidden !== undefined) {
      updateFields.push(`is_hidden = $${idx++}`);
      updateVals.push(Boolean(isHidden));
    }

    if (updateFields.length > 0) {
      updateVals.push(id);
      await client.query(
        `UPDATE companies SET ${updateFields.join(', ')} WHERE id = $${idx}`,
        updateVals
      );
    }

    if (adjustmentVb && parseInt(adjustmentVb, 10) !== 0) {
      const amt = parseInt(adjustmentVb, 10);
      const adjId = `ledg_adj_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      if (amt > 0) {
        await client.query(
          `INSERT INTO ledger_entries (
            id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
          ) VALUES ($1, NOW(), 'system', NULL, 'company', $2, $3, 'adjustment', $4, $5)`,
          [adjId, id, amt, adjustmentReason || 'GM Treasury Adjustment', user.userId]
        );
      } else {
        await client.query(
          `INSERT INTO ledger_entries (
            id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
          ) VALUES ($1, NOW(), 'company', $2, 'system', NULL, $3, 'fine', $4, $5)`,
          [adjId, id, Math.abs(amt), adjustmentReason || 'GM Treasury Deduction', user.userId]
        );
      }
    }

    const auditId = `aud_edit_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    await client.query(
      `INSERT INTO audit_log (
        id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
      ) VALUES ($1, NOW(), $2, 'gm', 'COMPANY_UPDATED', 'companies', $3, $4, 'company_api')`,
      [auditId, user.userId, id, `GM updated company ${id}`]
    );

    return NextResponse.json({ success: true, updatedId: id });
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'gm' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN: Only Game Master or Tech Admin can delete ventures.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  let companyId = searchParams.get('id') || searchParams.get('companyId');
  if (!companyId) {
    try {
      const body = await req.json();
      companyId = body?.id || body?.companyId;
    } catch {
      // No body
    }
  }

  if (!companyId) {
    return NextResponse.json({ error: 'Company ID is required to delete.' }, { status: 400 });
  }

  const { withTransaction } = await import('@/lib/db');
  const crypto = await import('crypto');

  return await withTransaction(async (client) => {
    await client.query('DELETE FROM memberships WHERE company_id = $1', [companyId]);
    await client.query('DELETE FROM cap_table WHERE company_id = $1', [companyId]);
    await client.query('DELETE FROM investments WHERE company_id = $1', [companyId]);
    await client.query('DELETE FROM loans WHERE company_id = $1', [companyId]);
    await client.query('DELETE FROM crisis_responses WHERE company_id = $1', [companyId]);
    await client.query('DELETE FROM company_lifecycle_events WHERE company_id = $1 OR counterparty_company_id = $1', [companyId]);
    await client.query('DELETE FROM opportunities WHERE company_id = $1', [companyId]);
    await client.query('UPDATE founder_evidence SET company_id = NULL WHERE company_id = $1', [companyId]);
    await client.query('DELETE FROM companies WHERE id = $1', [companyId]);

    const auditId = `aud_del_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    await client.query(
      `INSERT INTO audit_log (
        id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
      ) VALUES ($1, NOW(), $2, 'gm', 'COMPANY_DELETED', 'companies', $3, 'GM deleted venture company', 'company_api')`,
      [auditId, user.userId, companyId]
    );

    return NextResponse.json({ success: true, deletedId: companyId });
  });
}

