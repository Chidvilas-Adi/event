import { describe, it, expect, beforeAll } from 'vitest';
import { pool } from '../lib/db';
import { runSeed } from '../../scripts/seed';

describe('Database Level Triggers - Immutability Enforcement', () => {
  beforeAll(async () => {
    await runSeed();
  });

  it('strictly blocks UPDATE on ledger_entries at the PostgreSQL engine level', async () => {
    // Get an existing entry
    const entryRes = await pool.query('SELECT id FROM ledger_entries LIMIT 1');
    const entryId = entryRes.rows[0].id;

    await expect(
      pool.query('UPDATE ledger_entries SET amount = 999999 WHERE id = $1', [entryId])
    ).rejects.toThrow(/append-only.*UPDATE and DELETE operations are forbidden/i);
  });

  it('strictly blocks DELETE on ledger_entries at the PostgreSQL engine level', async () => {
    const entryRes = await pool.query('SELECT id FROM ledger_entries LIMIT 1');
    const entryId = entryRes.rows[0].id;

    await expect(
      pool.query('DELETE FROM ledger_entries WHERE id = $1', [entryId])
    ).rejects.toThrow(/append-only.*UPDATE and DELETE operations are forbidden/i);
  });

  it('strictly blocks UPDATE on audit_log at the PostgreSQL engine level', async () => {
    let auditRes = await pool.query('SELECT id FROM audit_log LIMIT 1');
    if (auditRes.rows.length === 0) {
      await pool.query(
        "INSERT INTO audit_log (id, actor_id, actor_role, action, object_type, reason) VALUES ('test_aud_1', 'system', 'system', 'TEST', 'system', 'test entry')"
      );
      auditRes = await pool.query('SELECT id FROM audit_log LIMIT 1');
    }
    const auditId = auditRes.rows[0].id;

    await expect(
      pool.query('UPDATE audit_log SET reason = \'altered malicious reason\' WHERE id = $1', [auditId])
    ).rejects.toThrow(/append-only.*UPDATE and DELETE operations are forbidden/i);
  });

  it('strictly blocks DELETE on audit_log at the PostgreSQL engine level', async () => {
    let auditRes = await pool.query('SELECT id FROM audit_log LIMIT 1');
    if (auditRes.rows.length === 0) {
      await pool.query(
        "INSERT INTO audit_log (id, actor_id, actor_role, action, object_type, reason) VALUES ('test_aud_2', 'system', 'system', 'TEST', 'system', 'test entry')"
      );
      auditRes = await pool.query('SELECT id FROM audit_log LIMIT 1');
    }
    const auditId = auditRes.rows[0].id;

    await expect(
      pool.query('DELETE FROM audit_log WHERE id = $1', [auditId])
    ).rejects.toThrow(/append-only.*UPDATE and DELETE operations are forbidden/i);
  });
});
