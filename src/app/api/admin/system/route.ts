import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { pool, withTransaction } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'admin' && user.role !== 'gm')) {
    return NextResponse.json({ error: 'FORBIDDEN: Tech Admin or GM access required.' }, { status: 403 });
  }

  const start = Date.now();
  await pool.query('SELECT 1');
  const dbLatencyMs = Date.now() - start;

  // 1. Connection Pool Telemetry
  const poolStats = {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    maxLimit: 60,
  };

  // 2. Table Row Censuses
  const tables = [
    'ledger_entries',
    'audit_log',
    'participants',
    'companies',
    'institutions',
    'resource_ledger',
    'deals',
    'contracts',
    'loans',
    'missions',
    'mission_instances',
    'opportunities',
  ];

  const tableCounts: Record<string, number> = {};
  for (const tbl of tables) {
    try {
      const cRes = await pool.query(`SELECT COUNT(*) as count FROM ${tbl}`);
      tableCounts[tbl] = parseInt(cRes.rows[0]?.count || '0', 10);
    } catch {
      tableCounts[tbl] = 0;
    }
  }

  // 3. Ledger Zero-Sum Mathematical Integrity Audit
  const creditsRes = await pool.query<{ total: string }>(
    'SELECT COALESCE(SUM(amount), 0) as total FROM ledger_entries WHERE to_id IS NOT NULL'
  );
  const debitsRes = await pool.query<{ total: string }>(
    'SELECT COALESCE(SUM(amount), 0) as total FROM ledger_entries WHERE from_id IS NOT NULL'
  );
  const balancesRes = await pool.query<{ total: string }>(
    'SELECT COALESCE(SUM(balance), 0) as total FROM v_entity_balances'
  );

  const totalCredits = parseInt(creditsRes.rows[0]?.total || '0', 10);
  const totalDebits = parseInt(debitsRes.rows[0]?.total || '0', 10);
  const totalEntityBalances = parseInt(balancesRes.rows[0]?.total || '0', 10);
  const discrepancy = totalCredits - totalDebits - totalEntityBalances;

  // 4. Engine Triggers Status
  const triggersRes = await pool.query(`
    SELECT trigger_name, event_manipulation, event_object_table, action_statement
    FROM information_schema.triggers
    WHERE trigger_name IN ('trg_ledger_entries_append_only', 'trg_audit_log_append_only')
  `);

  // 5. World State & Config
  const worldRes = await pool.query('SELECT * FROM world_state WHERE id = $1', ['default']);
  const worldState = worldRes.rows[0] || {};

  return NextResponse.json({
    dbLatencyMs,
    poolStats,
    tableCounts,
    ledgerIntegrity: {
      totalCredits,
      totalDebits,
      totalEntityBalances,
      discrepancy,
      isConsistent: discrepancy === 0,
    },
    triggersActive: triggersRes.rows.length >= 2,
    triggers: triggersRes.rows,
    worldState,
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== 'admin' && user.role !== 'gm')) {
    return NextResponse.json({ error: 'FORBIDDEN: Tech Admin or GM access required.' }, { status: 403 });
  }

  const body = await req.json();
  const { action } = body;

  if (action === 'test_immutability') {
    // Run live test probing trigger blocks
    let updateBlocked = false;
    let deleteBlocked = false;
    let updateErrorMsg = '';
    let deleteErrorMsg = '';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Probe UPDATE on ledger_entries
      try {
        await client.query('SAVEPOINT p1');
        await client.query(
          "UPDATE ledger_entries SET amount = 999999 WHERE id = (SELECT id FROM ledger_entries LIMIT 1)"
        );
        // If reached here, trigger failed!
      } catch (err: any) {
        updateBlocked = true;
        updateErrorMsg = err.message;
        await client.query('ROLLBACK TO SAVEPOINT p1');
      }

      // 2. Probe DELETE on audit_log
      try {
        await client.query('SAVEPOINT p2');
        await client.query("DELETE FROM audit_log WHERE id = (SELECT id FROM audit_log LIMIT 1)");
      } catch (err: any) {
        deleteBlocked = true;
        deleteErrorMsg = err.message;
        await client.query('ROLLBACK TO SAVEPOINT p2');
      }

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    return NextResponse.json({
      success: updateBlocked && deleteBlocked,
      updateBlocked,
      deleteBlocked,
      updateErrorMsg,
      deleteErrorMsg,
      message:
        updateBlocked && deleteBlocked
          ? 'PostgreSQL engine triggers strictly blocked illegal UPDATE and DELETE queries.'
          : 'WARNING: Triggers failed to block mutation!',
    });
  }

  if (action === 'update_config') {
    const { tickIntervalMinutes, rulesLocked } = body;
    await pool.query(
      `UPDATE world_state
       SET tick_interval_minutes = COALESCE($1, tick_interval_minutes),
           rules_locked = COALESCE($2, rules_locked),
           updated_at = NOW()
       WHERE id = 'default'`,
      [tickIntervalMinutes, rulesLocked]
    );

    return NextResponse.json({ success: true, message: 'Configuration hot-reloaded successfully!' });
  }

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
}
