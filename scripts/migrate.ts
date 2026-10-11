import { pool } from '../src/lib/db';

export async function runMigrations() {
  console.log('🔄 Running database migrations...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Roles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Visibility Policies
    await client.query(`
      CREATE TABLE IF NOT EXISTS visibility_policies (
        id VARCHAR(100) PRIMARY KEY,
        object_type VARCHAR(50) NOT NULL,
        field_name VARCHAR(50) NOT NULL,
        visibility_class VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 3. Companies
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        tagline VARCHAR(255),
        description TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'operating',
        tier INT NOT NULL DEFAULT 1,
        is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 4. Institutions
    await client.query(`
      CREATE TABLE IF NOT EXISTS institutions (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        capacity INT NOT NULL DEFAULT 100,
        is_open BOOLEAN NOT NULL DEFAULT TRUE,
        close_reason TEXT,
        config JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 5. Participants
    await client.query(`
      CREATE TABLE IF NOT EXISTS participants (
        id VARCHAR(100) PRIMARY KEY,
        citizen_code VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150),
        event_code VARCHAR(50) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'participant',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_participants_citizen_code ON participants(citizen_code);
    `);

    // 6. Operator Accounts (GM, Admin, Volunteer, Observer, Event Lead)
    await client.query(`
      CREATE TABLE IF NOT EXISTS operator_accounts (
        id VARCHAR(100) PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        role_id VARCHAR(50) NOT NULL REFERENCES roles(id),
        institution_id VARCHAR(50) REFERENCES institutions(id),
        password_hash VARCHAR(255) NOT NULL,
        totp_secret VARCHAR(100),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_operator_username ON operator_accounts(username);
    `);

    // 7. Company Memberships
    await client.query(`
      CREATE TABLE IF NOT EXISTS memberships (
        id VARCHAR(100) PRIMARY KEY,
        participant_id VARCHAR(100) NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
        company_id VARCHAR(100) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL DEFAULT 'employee',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        left_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_memberships_participant ON memberships(participant_id);
      CREATE INDEX IF NOT EXISTS idx_memberships_company ON memberships(company_id);
    `);

    // 8. Resources
    await client.query(`
      CREATE TABLE IF NOT EXISTS resources (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        base_price INT NOT NULL DEFAULT 10,
        description TEXT
      );
    `);

    // 9. Resource Ledger
    await client.query(`
      CREATE TABLE IF NOT EXISTS resource_ledger (
        id VARCHAR(100) PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resource_id VARCHAR(50) NOT NULL REFERENCES resources(id),
        owner_type VARCHAR(50) NOT NULL,
        owner_id VARCHAR(100) NOT NULL,
        quantity INT NOT NULL,
        committed_quantity INT NOT NULL DEFAULT 0,
        reason TEXT NOT NULL,
        authoriser VARCHAR(100) NOT NULL,
        linked_transaction_id VARCHAR(100)
      );
      CREATE INDEX IF NOT EXISTS idx_res_ledger_owner ON resource_ledger(owner_type, owner_id);
    `);

    // 10. VB Ledger Entries (APPEND-ONLY)
    await client.query(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id VARCHAR(100) PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        from_type VARCHAR(50) NOT NULL,
        from_id VARCHAR(100),
        to_type VARCHAR(50) NOT NULL,
        to_id VARCHAR(100),
        amount INT NOT NULL CHECK (amount > 0),
        type VARCHAR(50) NOT NULL,
        reason TEXT NOT NULL,
        authoriser VARCHAR(100) NOT NULL,
        linked_transaction_id VARCHAR(100),
        linked_original_id VARCHAR(100),
        idempotency_key VARCHAR(150) UNIQUE
      );
      CREATE INDEX IF NOT EXISTS idx_ledger_from ON ledger_entries(from_type, from_id);
      CREATE INDEX IF NOT EXISTS idx_ledger_to ON ledger_entries(to_type, to_id);
      CREATE INDEX IF NOT EXISTS idx_ledger_timestamp ON ledger_entries(timestamp);
    `);

    // 11. Transactions (for counterparty confirmation & deal flow)
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(100) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        sender_type VARCHAR(50) NOT NULL,
        sender_id VARCHAR(100) NOT NULL,
        recipient_type VARCHAR(50) NOT NULL,
        recipient_id VARCHAR(100) NOT NULL,
        value INT NOT NULL CHECK (value > 0),
        status VARCHAR(50) NOT NULL DEFAULT 'pending_confirmation',
        source VARCHAR(50) NOT NULL DEFAULT 'web',
        authoriser VARCHAR(100),
        rejection_reason TEXT,
        idempotency_key VARCHAR(150) UNIQUE,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_tx_sender ON transactions(sender_type, sender_id);
      CREATE INDEX IF NOT EXISTS idx_tx_recipient ON transactions(recipient_type, recipient_id);
      CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
    `);

    // 12. World State
    await client.query(`
      CREATE TABLE IF NOT EXISTS world_state (
        id VARCHAR(20) PRIMARY KEY DEFAULT 'default',
        clock_seconds INT NOT NULL DEFAULT 0,
        current_tick INT NOT NULL DEFAULT 1,
        is_paused BOOLEAN NOT NULL DEFAULT FALSE,
        is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
        freeze_reason TEXT,
        human_internet_mode BOOLEAN NOT NULL DEFAULT FALSE,
        tick_interval_minutes INT NOT NULL DEFAULT 30,
        last_tick_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        rules_locked BOOLEAN NOT NULL DEFAULT TRUE,
        version_label VARCHAR(50) NOT NULL DEFAULT '0x7F3A',
        state_hash VARCHAR(50) NOT NULL DEFAULT 'LIVE',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 13. Ticks History
    await client.query(`
      CREATE TABLE IF NOT EXISTS ticks (
        id SERIAL PRIMARY KEY,
        tick_number INT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ended_at TIMESTAMPTZ,
        reason TEXT,
        advanced_by VARCHAR(100) NOT NULL
      );
    `);

    // 14. Announcements
    await client.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id VARCHAR(100) PRIMARY KEY,
        audience VARCHAR(50) NOT NULL DEFAULT 'all',
        target_id VARCHAR(100),
        message TEXT NOT NULL,
        priority VARCHAR(20) NOT NULL DEFAULT 'normal',
        author_id VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at DESC);
    `);

    // 15. Notifications
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(100) PRIMARY KEY,
        recipient_id VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notifs_recipient ON notifications(recipient_id, is_read);
    `);

    // 16. Audit Log (APPEND-ONLY)
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id VARCHAR(100) PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        actor_id VARCHAR(100) NOT NULL,
        actor_role VARCHAR(50) NOT NULL,
        action VARCHAR(100) NOT NULL,
        object_type VARCHAR(50) NOT NULL,
        object_id VARCHAR(100),
        before_state JSONB,
        after_state JSONB,
        reason TEXT,
        related_record_id VARCHAR(100),
        source VARCHAR(50) NOT NULL DEFAULT 'web'
      );
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
    `);

    // 17. Config Params
    await client.query(`
      CREATE TABLE IF NOT EXISTS config_params (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        scope VARCHAR(50) NOT NULL DEFAULT 'global',
        description TEXT,
        updated_by VARCHAR(100) NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 18. Placeholder Tables (Clean structure for Phase 2-5)
    await client.query(`
      CREATE TABLE IF NOT EXISTS missions (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        tier INT NOT NULL DEFAULT 1,
        wave INT NOT NULL DEFAULT 1,
        objective TEXT NOT NULL,
        eligibility JSONB NOT NULL DEFAULT '{}'::jsonb,
        prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
        verification_method VARCHAR(50) NOT NULL,
        completion_rule TEXT NOT NULL,
        reward_vb INT NOT NULL DEFAULT 0,
        reward_resources JSONB NOT NULL DEFAULT '{}'::jsonb,
        claim_limit INT NOT NULL DEFAULT 1,
        time_limit_minutes INT,
        verifier VARCHAR(100),
        station_id VARCHAR(50),
        secret_role VARCHAR(50),
        secret_participant_id VARCHAR(100),
        verification_secret VARCHAR(100),
        gm_notes TEXT,
        is_secret BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE missions ADD COLUMN IF NOT EXISTS wave INT NOT NULL DEFAULT 1;
      ALTER TABLE missions ADD COLUMN IF NOT EXISTS station_id VARCHAR(50);
      ALTER TABLE missions ADD COLUMN IF NOT EXISTS secret_role VARCHAR(50);
      ALTER TABLE missions ADD COLUMN IF NOT EXISTS secret_participant_id VARCHAR(100);
      ALTER TABLE missions ADD COLUMN IF NOT EXISTS verification_secret VARCHAR(100);

      CREATE TABLE IF NOT EXISTS mission_instances (
        id VARCHAR(100) PRIMARY KEY,
        mission_id VARCHAR(100) NOT NULL REFERENCES missions(id),
        participant_id VARCHAR(100) NOT NULL REFERENCES participants(id),
        status VARCHAR(50) NOT NULL DEFAULT 'available',
        evidence JSONB,
        counterparty_code VARCHAR(50),
        station_verifier_id VARCHAR(100),
        reward_vb_paid INT NOT NULL DEFAULT 0,
        verified_by VARCHAR(100),
        notes TEXT,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE mission_instances ADD COLUMN IF NOT EXISTS reward_vb_paid INT NOT NULL DEFAULT 0;
      ALTER TABLE mission_instances ADD COLUMN IF NOT EXISTS verified_by VARCHAR(100);
      ALTER TABLE mission_instances ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE mission_instances ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS opportunities (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'enterprise_rfp',
        budget_vb INT NOT NULL DEFAULT 0,
        company_id VARCHAR(100) REFERENCES companies(id),
        institution_id VARCHAR(50),
        claimant_id VARCHAR(100),
        visibility VARCHAR(50) NOT NULL DEFAULT 'public',
        terms JSONB NOT NULL DEFAULT '{}'::jsonb,
        status VARCHAR(50) NOT NULL DEFAULT 'open',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'enterprise_rfp';
      ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS budget_vb INT NOT NULL DEFAULT 0;
      ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS institution_id VARCHAR(50);
      ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS claimant_id VARCHAR(100);

      CREATE TABLE IF NOT EXISTS deals (
        id VARCHAR(100) PRIMARY KEY,
        template_type VARCHAR(50) NOT NULL,
        sender_type VARCHAR(50) NOT NULL DEFAULT 'participant',
        sender_id VARCHAR(100) NOT NULL,
        recipient_type VARCHAR(50) NOT NULL DEFAULT 'participant',
        recipient_id VARCHAR(100) NOT NULL,
        version INT NOT NULL DEFAULT 1,
        parent_deal_id VARCHAR(100),
        terms JSONB NOT NULL DEFAULT '{}'::jsonb,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        signatures JSONB NOT NULL DEFAULT '[]'::jsonb,
        rejection_reason TEXT,
        executed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS sender_type VARCHAR(50) NOT NULL DEFAULT 'participant';
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(50) NOT NULL DEFAULT 'participant';
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS parent_deal_id VARCHAR(100);
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS terms JSONB NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS signatures JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;

      CREATE INDEX IF NOT EXISTS idx_deals_sender ON deals(sender_type, sender_id);
      CREATE INDEX IF NOT EXISTS idx_deals_recipient ON deals(recipient_type, recipient_id);
      CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);

      CREATE TABLE IF NOT EXISTS contracts (
        id VARCHAR(100) PRIMARY KEY,
        deal_id VARCHAR(100) REFERENCES deals(id),
        type VARCHAR(50) NOT NULL,
        terms JSONB NOT NULL DEFAULT '{}'::jsonb,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS loans (
        id VARCHAR(100) PRIMARY KEY,
        company_id VARCHAR(100) NOT NULL REFERENCES companies(id),
        lender_id VARCHAR(100) NOT NULL,
        principal INT NOT NULL,
        interest_rate_percent INT NOT NULL DEFAULT 10,
        repayment_total INT NOT NULL,
        amount_repaid INT NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        due_at_tick INT
      );
      CREATE INDEX IF NOT EXISTS idx_loans_company ON loans(company_id, status);

      CREATE TABLE IF NOT EXISTS auctions (
        id VARCHAR(100) PRIMARY KEY,
        item_type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        seller_type VARCHAR(50) NOT NULL DEFAULT 'system',
        seller_id VARCHAR(100),
        starting_bid INT NOT NULL DEFAULT 0,
        current_bid INT NOT NULL DEFAULT 0,
        highest_bidder_id VARCHAR(100),
        winner_id VARCHAR(100),
        bids JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        ends_at TIMESTAMPTZ,
        settled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE auctions ADD COLUMN IF NOT EXISTS seller_type VARCHAR(50) NOT NULL DEFAULT 'system';
      ALTER TABLE auctions ADD COLUMN IF NOT EXISTS seller_id VARCHAR(100);
      ALTER TABLE auctions ADD COLUMN IF NOT EXISTS winner_id VARCHAR(100);
      ALTER TABLE auctions ADD COLUMN IF NOT EXISTS bids JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE auctions ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS events (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        impact_config JSONB NOT NULL DEFAULT '{}'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        triggered_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS crises (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        response_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
        hidden_opportunity JSONB,
        deadline TIMESTAMPTZ,
        status VARCHAR(50) NOT NULL DEFAULT 'inactive',
        triggered_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS crisis_responses (
        id VARCHAR(100) PRIMARY KEY,
        crisis_id VARCHAR(100) NOT NULL REFERENCES crises(id),
        company_id VARCHAR(100) NOT NULL REFERENCES companies(id),
        selected_path_id VARCHAR(100) NOT NULL,
        path_title VARCHAR(200) NOT NULL,
        cost_vb_paid INT NOT NULL DEFAULT 0,
        resources_deducted JSONB NOT NULL DEFAULT '{}'::jsonb,
        actor_id VARCHAR(100) NOT NULL,
        unlocked_opportunity_id VARCHAR(100),
        status VARCHAR(50) NOT NULL DEFAULT 'executed',
        notes TEXT,
        responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_crisis_responses ON crisis_responses(crisis_id, company_id);

      CREATE TABLE IF NOT EXISTS disputes (
        id VARCHAR(100) PRIMARY KEY,
        deal_id VARCHAR(100) REFERENCES deals(id),
        claimant_type VARCHAR(50) NOT NULL,
        claimant_id VARCHAR(100) NOT NULL,
        respondent_type VARCHAR(50) NOT NULL,
        respondent_id VARCHAR(100) NOT NULL,
        amount_vb INT NOT NULL CHECK (amount_vb >= 0),
        reason VARCHAR(255) NOT NULL,
        evidence TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'open',
        ruling VARCHAR(50),
        awarded_vb INT NOT NULL DEFAULT 0,
        ruling_notes TEXT,
        ruled_by VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_disputes_claimant ON disputes(claimant_type, claimant_id);
      CREATE INDEX IF NOT EXISTS idx_disputes_respondent ON disputes(respondent_type, respondent_id);
      CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

      CREATE TABLE IF NOT EXISTS company_lifecycle_events (
        id VARCHAR(100) PRIMARY KEY,
        company_id VARCHAR(100) NOT NULL REFERENCES companies(id),
        event_type VARCHAR(50) NOT NULL,
        from_status VARCHAR(50),
        to_status VARCHAR(50),
        counterparty_company_id VARCHAR(100) REFERENCES companies(id),
        actor_id VARCHAR(100) NOT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        reason TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_lifecycle_company ON company_lifecycle_events(company_id);

      CREATE TABLE IF NOT EXISTS system_snapshots (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        snapshot_hash VARCHAR(100) NOT NULL,
        data JSONB NOT NULL,
        created_by VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE system_snapshots ADD COLUMN IF NOT EXISTS snapshot_type VARCHAR(50) DEFAULT 'manual';
      ALTER TABLE system_snapshots ADD COLUMN IF NOT EXISTS state_hash VARCHAR(100);
      ALTER TABLE system_snapshots ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE system_snapshots ALTER COLUMN name DROP NOT NULL;
      ALTER TABLE system_snapshots ALTER COLUMN snapshot_hash DROP NOT NULL;

      CREATE TABLE IF NOT EXISTS investments (
        id VARCHAR(100) PRIMARY KEY,
        investor_id VARCHAR(100) NOT NULL,
        company_id VARCHAR(100) NOT NULL REFERENCES companies(id),
        amount INT NOT NULL,
        equity_percent NUMERIC(5,2) NOT NULL,
        terms JSONB NOT NULL DEFAULT '{}'::jsonb,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS cap_table (
        id VARCHAR(100) PRIMARY KEY,
        company_id VARCHAR(100) NOT NULL REFERENCES companies(id),
        shareholder_type VARCHAR(50) NOT NULL,
        shareholder_id VARCHAR(100) NOT NULL,
        shares_or_percent NUMERIC(5,2) NOT NULL,
        rights JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS founder_evidence (
        id VARCHAR(100) PRIMARY KEY,
        participant_id VARCHAR(100) NOT NULL REFERENCES participants(id),
        observer_id VARCHAR(100) NOT NULL,
        trait_category VARCHAR(100) NOT NULL,
        notes TEXT NOT NULL,
        evidence_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE founder_evidence ADD COLUMN IF NOT EXISTS company_id VARCHAR(100);
      ALTER TABLE founder_evidence ADD COLUMN IF NOT EXISTS rating VARCHAR(50) DEFAULT 'neutral';
      ALTER TABLE founder_evidence ADD COLUMN IF NOT EXISTS incident_citation VARCHAR(200);
    `);

    // 19. Append-Only Trigger Functions & Triggers
    await client.query(`
      CREATE OR REPLACE FUNCTION prevent_update_or_delete()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Table % is strictly append-only. UPDATE and DELETE operations are forbidden.', TG_TABLE_NAME;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_audit_log_append_only ON audit_log;
      CREATE TRIGGER trg_audit_log_append_only
      BEFORE UPDATE OR DELETE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION prevent_update_or_delete();

      DROP TRIGGER IF EXISTS trg_ledger_entries_append_only ON ledger_entries;
      CREATE TRIGGER trg_ledger_entries_append_only
      BEFORE UPDATE OR DELETE ON ledger_entries
      FOR EACH ROW EXECUTE FUNCTION prevent_update_or_delete();
    `);

    // 20. Balance Views
    await client.query(`
      CREATE OR REPLACE VIEW v_entity_balances AS
      WITH credits AS (
        SELECT to_type AS entity_type, to_id AS entity_id, SUM(amount) AS total_credits
        FROM ledger_entries
        WHERE to_id IS NOT NULL
        GROUP BY to_type, to_id
      ),
      debits AS (
        SELECT from_type AS entity_type, from_id AS entity_id, SUM(amount) AS total_debits
        FROM ledger_entries
        WHERE from_id IS NOT NULL
        GROUP BY from_type, from_id
      ),
      all_entities AS (
        SELECT entity_type, entity_id FROM credits
        UNION
        SELECT entity_type, entity_id FROM debits
      )
      SELECT
        ae.entity_type,
        ae.entity_id,
        COALESCE(c.total_credits, 0) - COALESCE(d.total_debits, 0) AS balance
      FROM all_entities ae
      LEFT JOIN credits c ON ae.entity_type = c.entity_type AND ae.entity_id = c.entity_id
      LEFT JOIN debits d ON ae.entity_type = d.entity_type AND ae.entity_id = d.entity_id;
    `);

    await client.query('COMMIT');
    console.log('✅ Database migrations applied successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
