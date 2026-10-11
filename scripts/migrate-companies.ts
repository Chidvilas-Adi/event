import { pool, withTransaction } from '../src/lib/db';
import fs from 'fs';
import path from 'path';

async function migrate() {
  console.log('--- Starting Migration to 12 Canonical Companies ---');

  const cataloguePath = path.join(process.cwd(), 'src/lib/data/companies-catalogue.json');
  if (!fs.existsSync(cataloguePath)) {
    throw new Error('companies-catalogue.json not found!');
  }
  const catalogue = JSON.parse(fs.readFileSync(cataloguePath, 'utf8'));

  await withTransaction(async (client) => {
    // 1. Add columns to companies
    await client.query(`
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS code VARCHAR(10);
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS sector VARCHAR(150);
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS cluster VARCHAR(100);
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS fills_slots VARCHAR(100);
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS critical_slot VARCHAR(150);
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS workforce_mix VARCHAR(50);
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS ceo_persona VARCHAR(100);
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS deficit_domain VARCHAR(100);
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS notable_asset VARCHAR(255);
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS gate VARCHAR(255);
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS liability VARCHAR(255);
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS hidden_lever TEXT;
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS vulnerability TEXT;
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS initial_cash BIGINT DEFAULT 30000;
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS dossier_filename VARCHAR(255);
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS dossier_url VARCHAR(255);
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS dossier_slug_url VARCHAR(255);
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS at_a_glance TEXT;
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS founder_letter TEXT;
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
    `);

    // 2. Create company_documents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS company_documents (
        id VARCHAR(100) PRIMARY KEY,
        company_id VARCHAR(100) REFERENCES companies(id) ON DELETE CASCADE,
        kind VARCHAR(50) NOT NULL DEFAULT 'FOUNDER_DOSSIER',
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        dossier_url VARCHAR(255),
        published BOOLEAN NOT NULL DEFAULT TRUE,
        published_at TIMESTAMPTZ DEFAULT NOW(),
        published_by VARCHAR(100) DEFAULT 'system',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. Clear old mock company references
    console.log('Clearing old mock company relationships...');
    await client.query('DELETE FROM memberships');
    await client.query('DELETE FROM cap_table');
    await client.query('DELETE FROM loans');
    await client.query('DELETE FROM opportunities');
    await client.query('DELETE FROM investments');
    await client.query('DELETE FROM crisis_responses');
    await client.query('DELETE FROM company_lifecycle_events');
    await client.query('DELETE FROM company_documents');
    await client.query("DELETE FROM resource_ledger WHERE owner_type = 'company'");
    await client.query('DELETE FROM companies');

    // 4. Insert 12 Companies
    console.log('Inserting 12 canonical companies...');
    for (const comp of catalogue) {
      await client.query(
        `INSERT INTO companies (
          id, name, tagline, description, status, tier, is_hidden,
          code, sector, cluster, fills_slots, critical_slot, workforce_mix,
          ceo_persona, deficit_domain, notable_asset, gate, liability,
          hidden_lever, vulnerability, initial_cash, dossier_filename,
          dossier_url, dossier_slug_url, at_a_glance, founder_letter, metadata
        ) VALUES (
          $1, $2, $3, $4, 'operating', 1, FALSE,
          $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18, $19,
          $20, $21, $22, $23, $24
        )`,
        [
          comp.id,
          comp.name,
          comp.tagline,
          comp.description,
          comp.code,
          comp.sector,
          comp.cluster,
          (comp.fills_slots || []).join(', '),
          comp.critical_slot,
          comp.workforce_mix,
          comp.ceo_persona,
          comp.deficit_domain,
          comp.notable_asset,
          comp.gate_licence,
          comp.deadlines,
          comp.hidden_lever,
          comp.vulnerability,
          comp.initial_cash,
          comp.dossier_filename,
          comp.dossier_url,
          comp.dossier_slug_url,
          comp.at_a_glance,
          comp.founder_letter,
          JSON.stringify({
            scarcest_resources: comp.scarcest_resources,
            cannot_do_alone: comp.cannot_do_alone,
            consumption: comp.consumption,
            products: comp.products_table,
            obligations: comp.obligations_table,
            leads: comp.leads_table,
            dependencies: comp.dependencies_table,
            objectives: comp.objectives_table,
            intel_facts: comp.intel_facts_table,
          }),
        ]
      );

      // Insert Company Document (Full Dossier)
      const docId = `doc_${comp.id}_dossier`;
      const fullBody = (comp.all_paragraphs || []).join('\n\n');
      await client.query(
        `INSERT INTO company_documents (
          id, company_id, kind, title, body, dossier_url, published
        ) VALUES ($1, $2, 'FOUNDER_DOSSIER', $3, $4, $5, TRUE)`,
        [
          docId,
          comp.id,
          `${comp.name} — Founder Dossier`,
          fullBody,
          comp.dossier_url,
        ]
      );

      // Seed Initial Company Vault Balance in Ledger
      const entryId = `led_init_${comp.id}_${Date.now()}`;
      await client.query(
        `INSERT INTO ledger_entries (
          id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser, idempotency_key
        ) VALUES ($1, NOW(), 'system', 'city_reserve', 'company', $2, $3, 'transfer', 'Opening capital reserve', 'system', $4)
        ON CONFLICT (idempotency_key) DO NOTHING`,
        [entryId, comp.id, comp.initial_cash, `init_res_${comp.id}`]
      );

      // Seed 100 units of each of the 6 resources for every company
      const resourcesList = ['compute', 'energy', 'logistics', 'materials', 'data', 'infrastructure'];
      for (const resId of resourcesList) {
        await client.query(
          `INSERT INTO resource_ledger (
            id, timestamp, resource_id, quantity, owner_type, owner_id, reason, authoriser
          ) VALUES ($1, NOW(), $2, 100, 'company', $3, 'T0 baseline allocation (100 units)', 'system')`,
          [`rl_${comp.id}_${resId}`, resId, comp.id]
        );
      }

      // Seed Cap Table (80% Founding Common, 20% Unallocated Pool)
      await client.query(
        `INSERT INTO cap_table (
          id, company_id, shareholder_type, shareholder_id, shares_or_percent, rights
        ) VALUES
        ($1, $2, 'founder', 'Founding Shareholders', 80.00, '{"shares": 800, "class": "Founding Common"}'::jsonb),
        ($3, $2, 'pool', 'Employee Option Pool', 20.00, '{"shares": 200, "class": "Unallocated Pool"}'::jsonb)`,
        [
          `cap_${comp.id}_founding`,
          comp.id,
          `cap_${comp.id}_pool`,
        ]
      );
    }

    // 5. Allocate Participants dynamically to the 12 companies
    console.log('Allocating participants across 12 companies...');
    const partsRes = await client.query('SELECT * FROM participants ORDER BY citizen_code ASC');
    const participants = partsRes.rows;
    console.log(`Total registered participants: ${participants.length}`);

    const compIds = catalogue.map((c: any) => c.id);
    const domainRoles = [
      'Founder & CEO',
      'Authorised Signatory / Product Lead',
      'Authorised Signatory / Operations Lead',
      'Growth & Sales Lead',
      'Finance & Capital Lead',
      'Research & Intelligence Lead',
      'Brand & Community Lead',
      'Specialist Operator',
      'Generalist Associate',
    ];

    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      // Distribute evenly across 12 companies
      const compId = compIds[i % compIds.length];
      const roleIndex = Math.floor(i / compIds.length) % domainRoles.length;
      const roleName = domainRoles[roleIndex] || 'Operations Specialist';

      const memId = `mem_${p.id}_${compId}`;
      await client.query(
        `INSERT INTO memberships (
          id, participant_id, company_id, role, status
        ) VALUES ($1, $2, $3, $4, 'active')`,
        [memId, p.id, compId, roleName]
      );
    }

    // 6. Update world state event date to 24 October 2026
    await client.query(`
      UPDATE world_state
      SET current_tick = 1,
          is_frozen = FALSE,
          freeze_reason = NULL,
          updated_at = NOW()
      WHERE id = 'default'
    `);

    console.log('--- Migration completed successfully! ---');
  });

  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
