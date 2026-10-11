import { pool } from '../src/lib/db';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function runSeed() {
  console.log('🌱 Starting seed process (STARTING-STATE SHEET N=10)...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 0. Disable append-only triggers for clean idempotency
    await client.query('ALTER TABLE audit_log DISABLE TRIGGER trg_audit_log_append_only;');
    await client.query('ALTER TABLE ledger_entries DISABLE TRIGGER trg_ledger_entries_append_only;');

    await client.query(`
      TRUNCATE resources, notifications, announcements, ticks, transactions, ledger_entries,
               resource_ledger, memberships, operator_accounts, participants, companies, institutions,
               visibility_policies, roles, config_params, audit_log, world_state, deals, contracts,
               loans, auctions, events, crises, investments, cap_table, founder_evidence,
               missions, mission_instances, opportunities, crisis_responses, disputes,
               company_lifecycle_events, system_snapshots
      RESTART IDENTITY CASCADE;
    `);

    await client.query('ALTER TABLE audit_log ENABLE TRIGGER trg_audit_log_append_only;');
    await client.query('ALTER TABLE ledger_entries ENABLE TRIGGER trg_ledger_entries_append_only;');

    // 1. Seed Roles
    const roles = [
      { id: 'gm', name: 'Game Master', description: 'Full world visibility and control' },
      { id: 'admin', name: 'Tech Lead / Admin', description: 'System configuration and infra' },
      { id: 'event_lead', name: 'Event Lead', description: 'Operations and logistics console' },
      { id: 'volunteer', name: 'Institution Volunteer', description: 'Station operator' },
      { id: 'observer', name: 'Observer', description: 'Records founder behavioural evidence' },
      { id: 'company_lead', name: 'Company Lead / Founder', description: 'Founder or lead of a venture' },
      { id: 'participant', name: 'Citizen / Participant', description: 'Economy participant' },
    ];

    for (const r of roles) {
      await client.query(
        'INSERT INTO roles (id, name, description) VALUES ($1, $2, $3)',
        [r.id, r.name, r.description]
      );
    }

    // 2. Visibility Policies
    const policies = [
      { id: 'pol_comp_pub', object_type: 'company', field_name: 'public_profile', visibility_class: 'public' },
      { id: 'pol_comp_priv', object_type: 'company', field_name: 'cap_table_and_vault', visibility_class: 'company_private' },
      { id: 'pol_part_pub', object_type: 'participant', field_name: 'citizen_identity', visibility_class: 'public' },
      { id: 'pol_part_priv', object_type: 'participant', field_name: 'wallet_and_inbox', visibility_class: 'individual_private' },
      { id: 'pol_inst_ops', object_type: 'institution', field_name: 'operator_queue', visibility_class: 'institution' },
      { id: 'pol_gm_hidden', object_type: 'world', field_name: 'hidden_mechanics', visibility_class: 'gm_hidden' },
      { id: 'pol_obs_notes', object_type: 'observer', field_name: 'founder_notes', visibility_class: 'observer_only' },
    ];

    for (const p of policies) {
      await client.query(
        'INSERT INTO visibility_policies (id, object_type, field_name, visibility_class) VALUES ($1, $2, $3, $4)',
        [p.id, p.object_type, p.field_name, p.visibility_class]
      );
    }

    // 3. Seed 6 Core Resources with Base Prices
    // Compute (25), Energy (15), Logistics (40), Materials (30), Data (60), Infrastructure (100)
    // 100 units of each = 2,500 + 1,500 + 4,000 + 3,000 + 6,000 + 10,000 = wait: total 100 * (25+15+40+30+60+100)=27,000 VB
    // To match exact starting-state sheet: "valued at 12,500 VB total at Bank base prices" -> 125 VB per resource set:
    // e.g. Compute: 25, Energy: 15, Logistics: 20, Materials: 20, Data: 20, Infrastructure: 25 = 125 VB * 100 = exactly 12,500 VB!
    const resources = [
      { id: 'compute', name: 'Compute Units', unit: 'FLOPs/hr', base_price: 25, description: 'High-performance cloud & AI compute clusters' },
      { id: 'energy', name: 'Clean Energy', unit: 'kWh', base_price: 15, description: 'Grid energy cells for powering infrastructure' },
      { id: 'logistics', name: 'Logistics Slots', unit: 'Crates', base_price: 20, description: 'Express delivery and physical routing capacity' },
      { id: 'materials', name: 'Raw Materials', unit: 'kg', base_price: 20, description: 'Advanced composite and rare components' },
      { id: 'data', name: 'Market Data & Info', unit: 'Feeds', base_price: 20, description: 'Proprietary business and telemetry intel' },
      { id: 'infrastructure', name: 'Infra Modules', unit: 'Racks', base_price: 25, description: 'Modular manufacturing and lab facilities' },
    ];

    for (const res of resources) {
      await client.query(
        'INSERT INTO resources (id, name, unit, base_price, description) VALUES ($1, $2, $3, $4, $5)',
        [res.id, res.name, res.unit, res.base_price, res.description]
      );
    }

    // 4. Seed Institutions (STARTING-STATE SHEET N=10)
    const institutions = [
      {
        id: 'bank',
        name: 'Apex Reserve Bank',
        type: 'bank',
        capacity: 100,
        config: {
          lending_pool_total: 80000, // 8,000 x 10
          lending_pool_remaining: 80000,
          resource_stock_per_type: 400, // 40 x 10
          restock_rate_per_tick: 100, // 10 x 10
          base_interest_rate_percent: 10,
          max_loan_per_company: 20000,
          max_open_loans_per_company: 1,
        },
      },
      {
        id: 'investor',
        name: 'Frontier Venture Syndicate',
        type: 'investor',
        capacity: 50,
        config: {
          fund_size_total: 140000, // 14,000 x 10
          fund_size_remaining: 140000,
          max_investments_count: 7, // 10 x 0.7
          deals_completed: 0,
          stages: ['meeting', 'diligence', 'term_sheet', 'approval', 'funded'],
        },
      },
      {
        id: 'enterprise_customer',
        name: 'Customer Procurement Desk',
        type: 'enterprise_customer',
        capacity: 50,
        config: {
          anchor_contracts_count: 10, // 1 per active company
          open_customer_cards_count: 20, // 2 x 10
          total_budget: 200000,
          payment_on_acceptance: true,
        },
      },
      {
        id: 'talent_exchange',
        name: 'Metro Talent Exchange',
        type: 'talent_exchange',
        capacity: 100,
        config: {
          specialist_contracts_count: 10, // 10 active
          salary_per_tick_l0: 100, // 100 VB/tick for L0
          max_full_time_jobs: 1,
          allow_freelance: true,
          allow_advisory: true,
        },
      },
      {
        id: 'supplier',
        name: 'Prime Supplier Market',
        type: 'supplier',
        capacity: 200,
        config: {
          discounted_stock_per_tick: 200, // 20 x 10
          discount_percent: 10, // 10% below Bank base price
          min_order_quantity: 10,
        },
      },
      {
        id: 'logistics',
        name: 'Swift Logistics Provider',
        type: 'logistics',
        capacity: 220,
        config: {
          standard_capacity_per_tick: 150, // 15 x 10
          priority_capacity_per_tick: 70, // 7 x 10
          standard_rate_vb: 30,
          priority_rate_vb: 60,
        },
      },
      {
        id: 'government',
        name: 'City Department of Commerce',
        type: 'government',
        capacity: 40,
        config: {
          grant_pool_total: 30000, // 3,000 x 10
          grant_pool_remaining: 30000,
          max_grant_per_company: 8000,
        },
      },
      {
        id: 'media',
        name: 'The Daily Chronicle & Media',
        type: 'media',
        capacity: 20,
        config: {
          featured_story_slots_per_tick: 2, // 2 slots active
          audience_reach: 1200,
          slot_price_vb: 1000,
        },
      },
    ];

    for (const inst of institutions) {
      await client.query(
        'INSERT INTO institutions (id, name, type, capacity, is_open, config) VALUES ($1, $2, $3, $4, TRUE, $5)',
        [inst.id, inst.name, inst.type, inst.capacity, JSON.stringify(inst.config)]
      );
    }

    // 5. Seed 12 Canonical Companies (Master Catalogue Document 2)
    const cataloguePath = path.join(process.cwd(), 'src/lib/data/companies-catalogue.json');
    const companies = JSON.parse(fs.readFileSync(cataloguePath, 'utf8'));

    for (const c of companies) {
      await client.query(
        `INSERT INTO companies (
          id, name, code, tagline, description, sector, cluster, fills_slots, critical_slot,
          workforce_mix, ceo_persona, deficit_domain, notable_asset, gate, liability,
          hidden_lever, vulnerability, initial_cash, at_a_glance, founder_letter, status, tier
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'operating', 1
        )`,
        [
          c.id, c.name, c.code, c.tagline, c.description, c.sector, c.cluster,
          Array.isArray(c.fills_slots) ? c.fills_slots.join(', ') : c.fills_slots,
          c.critical_slot, c.workforce_mix, c.ceo_persona, c.deficit_domain,
          c.notable_asset, c.gate_licence || c.gate, c.liability, c.hidden_lever,
          c.vulnerability, c.initial_cash || 30000, c.at_a_glance, c.founder_letter
        ]
      );
    }

    // 6. Seed Operator Accounts
    const operators = [
      { id: 'op_gm', username: 'gm', name: 'Game Master (City Control)', role_id: 'gm', institution_id: null, password_hash: hashPassword('gm-password-2026'), totp_secret: '000000' },
      { id: 'op_admin', username: 'admin', name: 'Tech Lead / Admin', role_id: 'admin', institution_id: null, password_hash: hashPassword('admin-password-2026'), totp_secret: '111111' },
      { id: 'op_lead', username: 'event_lead', name: 'Operations Event Lead', role_id: 'event_lead', institution_id: null, password_hash: hashPassword('lead-password-2026'), totp_secret: '222222' },
      { id: 'op_observer', username: 'observer', name: 'Founder Evidence Observer', role_id: 'observer', institution_id: null, password_hash: hashPassword('obs-password-2026'), totp_secret: '333333' },
      { id: 'op_bank', username: 'volunteer_bank', name: 'Apex Bank Manager', role_id: 'volunteer', institution_id: 'bank', password_hash: hashPassword('bank-volunteer-2026'), totp_secret: '444444' },
      { id: 'op_investor', username: 'volunteer_investor', name: 'Frontier Fund Partner', role_id: 'volunteer', institution_id: 'investor', password_hash: hashPassword('investor-volunteer-2026'), totp_secret: '555555' },
      { id: 'op_customer', username: 'volunteer_customer', name: 'Enterprise Procurement Officer', role_id: 'volunteer', institution_id: 'enterprise_customer', password_hash: hashPassword('customer-volunteer-2026'), totp_secret: '666666' },
      { id: 'op_talent', username: 'volunteer_talent', name: 'Talent Exchange Officer', role_id: 'volunteer', institution_id: 'talent_exchange', password_hash: hashPassword('talent-volunteer-2026'), totp_secret: '777777' },
      { id: 'op_supplier', username: 'volunteer_supplier', name: 'Supplier Market Dispatcher', role_id: 'volunteer', institution_id: 'supplier', password_hash: hashPassword('supplier-volunteer-2026'), totp_secret: '888888' },
      { id: 'op_logistics', username: 'volunteer_logistics', name: 'Logistics Controller', role_id: 'volunteer', institution_id: 'logistics', password_hash: hashPassword('logistics-volunteer-2026'), totp_secret: '999999' },
      { id: 'op_government', username: 'volunteer_government', name: 'Commerce Officer', role_id: 'volunteer', institution_id: 'government', password_hash: hashPassword('gov-volunteer-2026'), totp_secret: '101010' },
      { id: 'op_media', username: 'volunteer_media', name: 'Daily Chronicle Editor', role_id: 'volunteer', institution_id: 'media', password_hash: hashPassword('media-volunteer-2026'), totp_secret: '202020' },
    ];

    for (const op of operators) {
      await client.query(
        'INSERT INTO operator_accounts (id, username, name, role_id, institution_id, password_hash, totp_secret) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [op.id, op.username, op.name, op.role_id, op.institution_id, op.password_hash, op.totp_secret]
      );
    }

    // 7. Seed 100 Participants (9 in each of 10 companies = 90 + 10 Free Agents)
    const companyRoles = [
      'Founder & CEO',
      'Co-Founder & CTO',
      'Head of Product',
      'Lead Systems Engineer',
      'VP of Commercialization',
      'Lead Data Scientist',
      'Hardware Architect',
      'Supply Operations Lead',
      'Growth & Partnerships',
      'CFO & General Counsel',
    ];

    const indianFirstNames = [
      'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
      'Shaurya', 'Atharv', 'Ananya', 'Diya', 'Isha', 'Aadhya', 'Aaradhya', 'Anika', 'Pari', 'Saanvi',
      'Rohan', 'Dhruv', 'Kabir', 'Tanvi', 'Tara', 'Riya', 'Kavya', 'Meera', 'Rudra', 'Aryan',
      'Dev', 'Om', 'Advait', 'Pranav', 'Samar', 'Nikhil', 'Manish', 'Kiran', 'Vikram', 'Anand',
      'Pooja', 'Shreya', 'Sneha', 'Neha', 'Priya', 'Swati', 'Rahul', 'Varun', 'Deepak', 'Gaurav'
    ];

    const indianLastNames = [
      'Sharma', 'Verma', 'Patel', 'Rao', 'Reddy', 'Nair', 'Iyer', 'Menon', 'Gupta', 'Singh',
      'Bhat', 'Hegde', 'Kulkarni', 'Joshi', 'Deshmukh', 'Mehta', 'Shah', 'Agarwal', 'Chatterjee', 'Banerjee',
      'Chopra', 'Malhotra', 'Kapoor', 'Seth', 'Das', 'Dutta', 'Pillai', 'Shetty', 'Gowda', 'Kumar'
    ];

    let pCount = 1;
    for (let cIdx = 0; cIdx < companies.length; cIdx++) {
      const comp = companies[cIdx];
      for (let m = 0; m < 9; m++) {
        const citizenNum = String(pCount).padStart(3, '0');
        const pId = `vc_p_${citizenNum}`;
        const citizenCode = `VC-${citizenNum}`;
        const fName = indianFirstNames[(pCount * 7 + m) % indianFirstNames.length];
        const lName = indianLastNames[(pCount * 11 + m) % indianLastNames.length];
        const fullName = `${fName} ${lName}`;
        const email = `${fName.toLowerCase()}.${lName.toLowerCase()}@venturecity.internal`;
        const companyRole = companyRoles[m] || 'Core Operator';
        const role = m === 0 ? 'company_lead' : 'participant';

        await client.query(
          'INSERT INTO participants (id, citizen_code, name, email, event_code, role, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [pId, citizenCode, fullName, email, 'VC2026', role, 'active']
        );

        // Membership
        await client.query(
          'INSERT INTO memberships (id, participant_id, company_id, role, status) VALUES ($1, $2, $3, $4, $5)',
          [`mem_${pId}`, pId, comp.id, companyRole, 'active']
        );

        pCount++;
      }

      // Cap table setup: 1,000 Authorized Shares ACID Starting State
      // 800 Founding Common (80.00%) + 200 Option Pool (20.00%)
      await client.query(
        'INSERT INTO cap_table (id, company_id, shareholder_type, shareholder_id, shares_or_percent, rights) VALUES ($1, $2, $3, $4, 80.00, $5)',
        [`cap_${comp.id}_founding`, comp.id, 'founder', 'Founding Shareholders', JSON.stringify({ class: 'Founding Common', shares: 800 })]
      );
      await client.query(
        'INSERT INTO cap_table (id, company_id, shareholder_type, shareholder_id, shares_or_percent, rights) VALUES ($1, $2, $3, $4, 20.00, $5)',
        [`cap_${comp.id}_pool`, comp.id, 'pool', 'Employee Option Pool', JSON.stringify({ class: 'Unallocated Pool', shares: 200 })]
      );
    }

    // 10 Free Agents (VC-091 to VC-100)
    for (let f = pCount; f <= 100; f++) {
      const citizenNum = String(f).padStart(3, '0');
      const pId = `vc_p_${citizenNum}`;
      const citizenCode = `VC-${citizenNum}`;
      const fName = indianFirstNames[(f * 13) % indianFirstNames.length];
      const lName = indianLastNames[(f * 17) % indianLastNames.length];
      const fullName = `${fName} ${lName}`;
      const email = `${fName.toLowerCase()}.${lName.toLowerCase()}@freelance.internal`;

      await client.query(
        'INSERT INTO participants (id, citizen_code, name, email, event_code, role, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [pId, citizenCode, fullName, email, 'VC2026', 'participant', 'active']
      );
    }

    // 8. Mint Initial Company Cash & Resources via Ledger Entries (No editable balances!)
    for (const c of companies) {
      // Starting Cash
      await client.query(
        `INSERT INTO ledger_entries (
          id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
        ) VALUES ($1, NOW(), 'system', NULL, 'company', $2, $3, 'grant', 'Initial Venture Runway Endowment (N=10 Sheet)', 'system')`,
        [`ledg_init_${c.id}`, c.id, c.initial_cash]
      );

      // Exactly 100 units of each of the 6 core resources!
      for (const res of resources) {
        await client.query(
          `INSERT INTO resource_ledger (
            id, timestamp, resource_id, owner_type, owner_id, quantity, reason, authoriser
          ) VALUES ($1, NOW(), $2, 'company', $3, 100, 'Starting Resource Allocation (100 units core)', 'system')`,
          [`res_init_${c.id}_${res.id}`, res.id, c.id]
        );
      }
    }

    // 9. Mint Citizen Staking Allowance (500 VB each for 100 participants)
    for (let i = 1; i <= 100; i++) {
      const pId = `vc_p_${String(i).padStart(3, '0')}`;
      await client.query(
        `INSERT INTO ledger_entries (
          id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
        ) VALUES ($1, NOW(), 'system', NULL, 'participant', $2, 500, 'grant', 'Citizen Staking Allowance', 'system')`,
        [`ledg_init_${pId}`, pId]
      );
    }

    // 10. Seed Anchor Customer Contracts (10 contracts - 1 for each active company)
    for (const c of companies) {
      const contractId = `deal_anchor_${c.id}`;
      await client.query(
        `INSERT INTO deals (
          id, template_type, sender_type, sender_id, recipient_type, recipient_id, version, terms, status
        ) VALUES ($1, 'Sale', 'institution', 'enterprise_customer', 'company', $2, 1, $3, 'pending')`,
        [
          contractId,
          c.id,
          JSON.stringify({
            title: `Anchor Procurement Contract for ${c.name}`,
            item: `${c.name} Primary Solution Deployment`,
            quantity: 1,
            price_vb: 15000,
            delivery_terms: 'Milestone delivery on Tick 04',
            acceptance_required: true,
          }),
        ]
      );
    }

    // 11. World State Init
    await client.query(
      `INSERT INTO world_state (
        id, clock_seconds, current_tick, is_paused, is_frozen, human_internet_mode, tick_interval_minutes, rules_locked, version_label, state_hash
      ) VALUES ('default', 0, 1, FALSE, FALSE, FALSE, 30, TRUE, '0x7F3A', 'LIVE')`
    );

    await client.query(
      `INSERT INTO ticks (tick_number, started_at, reason, advanced_by) VALUES (1, NOW(), 'Phase 2 Economy Launch', 'system')`
    );

    // Initial Broadcast
    await client.query(
      `INSERT INTO announcements (
        id, audience, target_id, message, priority, author_id
      ) VALUES (
        'ann_init', 'all', NULL,
        '✦ VENTURE CITY PHASE 2 ACTIVE: Market doors open. 10 Ventures operational. Deal Exchange & Institution Stations online. Build. Trade. Survive. Scale.',
        'urgent', 'op_gm'
      )`
    );

    // 12. Seed 10-Tier Launch Mission Library & Secret Missions
    const missionsList = [
      {
        id: 'msn_t1',
        title: 'Pass Staking & Identity Verification',
        tier: 1,
        wave: 1,
        objective: 'Confirm personal citizen staking balance has registered at least 500 VB in the verified ledger.',
        verification_method: 'system_checked',
        completion_rule: 'wallet_balance >= 500',
        reward_vb: 250,
        reward_resources: {},
        claim_limit: 1,
        is_secret: false,
      },
      {
        id: 'msn_t2',
        title: 'Supplier Station Intake Run',
        tier: 2,
        wave: 1,
        station_id: 'supplier',
        objective: 'Physically report to Prime Supplier Market desk, inspect raw inventory feeds, and complete volunteer check-in.',
        verification_method: 'station_checkin',
        completion_rule: 'Supplier desk volunteer in-person verification',
        reward_vb: 500,
        reward_resources: { materials: 10 },
        claim_limit: 1,
        is_secret: false,
      },
      {
        id: 'msn_t3',
        title: 'Enterprise Customer Anchor Handshake',
        tier: 3,
        wave: 1,
        station_id: 'enterprise_customer',
        verification_secret: 'CUST-ANCHOR-2026',
        objective: 'Visit Customer Desk to align procurement specifications and obtain the counterparty handshake code.',
        verification_method: 'counterparty_code',
        completion_rule: 'Valid counterparty code issued by Customer Desk',
        reward_vb: 1500,
        reward_resources: {},
        claim_limit: 1,
        is_secret: false,
      },
      {
        id: 'msn_t4',
        title: 'Swift Logistics Corridor Clearance',
        tier: 4,
        wave: 2,
        station_id: 'logistics',
        verification_secret: 'LOG-CORRIDOR-90',
        objective: 'Secure an express routing dispatch token at Swift Logistics Provider to verify freight clearance.',
        verification_method: 'scan_token',
        completion_rule: 'Enter station corridor token LOG-CORRIDOR-90',
        reward_vb: 800,
        reward_resources: { logistics: 15 },
        claim_limit: 1,
        is_secret: false,
      },
      {
        id: 'msn_t5',
        title: 'Consortium Syndicate Round Agreement',
        tier: 5,
        wave: 2,
        station_id: 'investor',
        objective: 'Conclude an aligned syndicate term sheet with the Investor Desk and obtain multi-party sign-off.',
        verification_method: 'multi_party',
        completion_rule: 'Requires joint verification from claimant and investor syndicate',
        reward_vb: 3500,
        reward_resources: {},
        claim_limit: 1,
        is_secret: false,
      },
      {
        id: 'msn_t6',
        title: 'Grid Resiliency Infrastructure Deployment',
        tier: 6,
        wave: 2,
        station_id: 'bank',
        objective: 'Your venture must maintain a resilient reserve of at least 100 units of Energy and 100 units of Infrastructure.',
        verification_method: 'system_checked',
        completion_rule: 'Company inventory contains >= 100 Energy and >= 100 Infrastructure',
        reward_vb: 2500,
        reward_resources: {},
        claim_limit: 1,
        is_secret: false,
      },
      {
        id: 'msn_t7',
        title: 'Talent Exchange Specialist Advisory Retainer',
        tier: 7,
        wave: 3,
        station_id: 'talent_exchange',
        verification_secret: 'TALENT-ADVISORY-77',
        objective: 'Contract an expert specialist or register an advisory engagement at the Talent Exchange desk.',
        verification_method: 'counterparty_code',
        completion_rule: 'Enter counterparty code from Talent Exchange desk',
        reward_vb: 2000,
        reward_resources: {},
        claim_limit: 1,
        is_secret: false,
      },
      {
        id: 'msn_t8',
        title: 'Civic Commerce Grant Tender Submission',
        tier: 8,
        wave: 3,
        station_id: 'government',
        objective: 'Submit formal tender documentation at Department of Commerce and receive volunteer grant check-in approval.',
        verification_method: 'station_checkin',
        completion_rule: 'Government Desk volunteer check-in approval',
        reward_vb: 5000,
        reward_resources: {},
        claim_limit: 1,
        is_secret: false,
      },
      {
        id: 'msn_t9',
        title: 'Venture Syndicate Term Sheet Finalization',
        tier: 9,
        wave: 3,
        station_id: 'investor',
        objective: 'Execute formal equity investment terms ratified jointly by Founder and Venture Fund.',
        verification_method: 'multi_party',
        completion_rule: 'Joint investor and company multi-party attestation',
        reward_vb: 8000,
        reward_resources: {},
        claim_limit: 1,
        is_secret: false,
      },
      {
        id: 'msn_t10',
        title: 'Grand City IPO & Scale-up Exit',
        tier: 10,
        wave: 3,
        objective: 'Attain Tier 2 Scale-up status by achieving a company treasury vault of at least 35,000 VB with zero defaulted loans.',
        verification_method: 'system_checked',
        completion_rule: 'Company treasury vault >= 35,000 VB',
        reward_vb: 15000,
        reward_resources: {},
        claim_limit: 1,
        is_secret: false,
      },
      // Secret Missions (strictly private to claimant/role)
      {
        id: 'msn_sec_cto',
        title: 'Project Daedalus: Photonic Architecture Blueprint',
        tier: 4,
        wave: 1,
        station_id: 'bank',
        secret_role: 'Co-Founder & CTO',
        verification_secret: 'DAEDALUS-PHOTON-42',
        objective: 'Exclusive to Technical Leadership: Retrieve the classified photonic compute architecture token from the R&D Station.',
        verification_method: 'scan_token',
        completion_rule: 'Enter token DAEDALUS-PHOTON-42',
        reward_vb: 3000,
        reward_resources: { compute: 20 },
        claim_limit: 1,
        is_secret: true,
      },
      {
        id: 'msn_sec_sales',
        title: 'Project Ghost: Backchannel Procurement Poach',
        tier: 5,
        wave: 1,
        station_id: 'enterprise_customer',
        secret_role: 'VP of Commercialization',
        verification_secret: 'GHOST-POACH-88',
        objective: 'Exclusive to Commercial Leadership: Intercept an unannounced enterprise procurement code from customer liaison.',
        verification_method: 'counterparty_code',
        completion_rule: 'Enter code GHOST-POACH-88',
        reward_vb: 4000,
        reward_resources: {},
        claim_limit: 1,
        is_secret: true,
      },
      {
        id: 'msn_sec_founder',
        title: 'Project Sovereign: Stealth Credit Facility',
        tier: 6,
        wave: 2,
        station_id: 'bank',
        secret_role: 'Founder & CEO',
        verification_secret: 'SOVEREIGN-FACILITY-99',
        objective: 'Executive Founder Eyes Only: Negotiate a non-dilutive secret credit line voucher at Apex Reserve Bank.',
        verification_method: 'scan_token',
        completion_rule: 'Enter voucher SOVEREIGN-FACILITY-99',
        reward_vb: 6000,
        reward_resources: {},
        claim_limit: 1,
        is_secret: true,
      },
      {
        id: 'msn_sec_free',
        title: 'The Shadow Brokerage Network',
        tier: 3,
        wave: 1,
        station_id: 'talent_exchange',
        secret_role: 'Independent Free Agent',
        verification_secret: 'BROKER-SHADOW-11',
        objective: 'Independent Specialists Only: Broker an off-market handshake contract between two competing deep-tech ventures.',
        verification_method: 'counterparty_code',
        completion_rule: 'Enter code BROKER-SHADOW-11',
        reward_vb: 2500,
        reward_resources: {},
        claim_limit: 1,
        is_secret: true,
      },
    ];

    for (const m of missionsList) {
      await client.query(
        `INSERT INTO missions (
          id, title, tier, wave, station_id, secret_role, verification_secret,
          objective, verification_method, completion_rule, reward_vb, reward_resources,
          claim_limit, is_secret, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, TRUE)`,
        [
          m.id,
          m.title,
          m.tier,
          m.wave,
          m.station_id || null,
          m.secret_role || null,
          m.verification_secret || null,
          m.objective,
          m.verification_method,
          m.completion_rule,
          m.reward_vb,
          JSON.stringify(m.reward_resources),
          m.claim_limit,
          m.is_secret,
        ]
      );
    }

    // 13. Seed Dynamic Commercial Opportunities
    const oppList = [
      {
        id: 'opp_rfp_01',
        title: 'Enterprise High-Performance AI Pipeline RFP',
        description: 'Large enterprise buyer seeking validated deep-tech AI pipeline deployment with 99.9% uptime SLA.',
        type: 'enterprise_rfp',
        budget_vb: 20000,
        institution_id: 'enterprise_customer',
        terms: { deliverable: 'AI Pipeline v1', acceptance_criteria: 'Zero latency degradation', payment_tick: 4 },
      },
      {
        id: 'opp_tender_02',
        title: 'Civic Smart Grid Optimization Tender',
        description: 'City Department of Commerce public tender for automated industrial energy distribution grid.',
        type: 'govt_tender',
        budget_vb: 15000,
        institution_id: 'government',
        terms: { grant_type: 'Matching Subsidy', compliance_score_min: 80 },
      },
      {
        id: 'opp_syndicate_03',
        title: 'Deep Tech Series Seed Syndicate Allocation',
        description: 'Frontier Venture Fund co-investment syndicate tranche for Tier 1 high-growth deep tech ventures.',
        type: 'syndicate_round',
        budget_vb: 45000,
        institution_id: 'investor',
        terms: { equity_percent: 12.5, board_observer: true },
      },
      {
        id: 'opp_freelance_04',
        title: 'Specialist Quantum Cryptography Architecture Audit',
        description: 'Critical short-turnaround retainer for an independent cryptography specialist to audit data transport.',
        type: 'freelance_gig',
        budget_vb: 2500,
        institution_id: 'talent_exchange',
        terms: { duration_ticks: 2, required_skill: 'Cryptography' },
      },
      {
        id: 'opp_rfp_05',
        title: 'Autonomous Logistics Fleet Scheduling Contract',
        description: 'High-capacity route optimization contract connecting Swift Logistics distribution hubs.',
        type: 'enterprise_rfp',
        budget_vb: 12000,
        institution_id: 'logistics',
        terms: { volume_crates: 50, penalty_per_delay_tick: 500 },
      },
    ];

    for (const opp of oppList) {
      await client.query(
        `INSERT INTO opportunities (
          id, title, description, type, budget_vb, institution_id, visibility, terms, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'public', $7, 'open')`,
        [opp.id, opp.title, opp.description, opp.type, opp.budget_vb, opp.institution_id, JSON.stringify(opp.terms)]
      );
    }

    // 14. Seed Crises Library (Phase 4)
    const crisisList = [
      {
        id: 'crisis_blackout_01',
        title: 'Grid Blackout: Substation Transformer Failure',
        description: 'A major power transformer failure in District 4 has severed grid energy. Clean energy spot prices have tripled and compute clusters risk immediate shutdown unless contingency paths are taken within 30 minutes.',
        response_paths: [
          {
            id: 'path_solar_microgrid',
            title: 'Deploy Autonomous Solar Microgrid',
            description: 'Procure emergency distributed solar cells to maintain 100% operational uptime.',
            cost_vb: 1500,
            cost_resources: { energy: 0, compute: 0 },
            effect: 'Immunizes company against energy shocks and unlocks surplus energy export contract.',
            unlocks_opportunity_id: 'opp_microgrid_surplus',
          },
          {
            id: 'path_conserve_energy',
            title: 'Throttle High-Load AI & Energy Rationing',
            description: 'Halt non-critical training runs and draw minimal baseline power.',
            cost_vb: 200,
            cost_resources: { energy: 20 },
            effect: 'Preserves balance sheet with moderate productivity latency.',
            unlocks_opportunity_id: null,
          },
          {
            id: 'path_consortium_grid',
            title: 'Form Regional Microgrid Consortium',
            description: 'Pool capital with neighboring ventures to construct shared private generator link.',
            cost_vb: 800,
            cost_resources: { materials: 10 },
            effect: 'Cooperative risk sharing; grants 50 units clean energy rebate on tick close.',
            unlocks_opportunity_id: null,
          },
        ],
        hidden_opportunity: {
          id: 'opp_microgrid_surplus',
          title: 'Surplus Clean Microgrid Municipal Export Contract',
          description: 'Export excess stored kilowatt capacity back to the Apex Reserve Bank and City Authority at premium tariff rate.',
          type: 'govt_tender',
          budget_vb: 4500,
          terms: { energy_units: 50, tariff_multiplier: 2.5 },
        },
        status: 'active',
        triggered_at: new Date(),
        deadline: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      },
      {
        id: 'crisis_cloud_breach_02',
        title: 'Data Sovereignty Breach & Upstream Infrastructure Outage',
        description: 'Critical global cloud provider outage accompanied by zero-day vulnerability. Regulatory audit penalty of 2,500 VB applies to non-compliant ventures after 20 minutes.',
        response_paths: [
          {
            id: 'path_airgap_audit',
            title: 'Execute Air-Gapped Security & Data Audit',
            description: 'Deploy defensive telemetry and isolate customer workloads.',
            cost_vb: 1000,
            cost_resources: { data: 15 },
            effect: 'Guarantees regulatory immunity and government compliance seal.',
            unlocks_opportunity_id: null,
          },
          {
            id: 'path_open_source_pivot',
            title: 'Emergency Open Source Stack Migration',
            description: 'Migrate enterprise data to decentralized on-prem nodes.',
            cost_vb: 500,
            cost_resources: { compute: 20 },
            effect: 'Eliminates recurring vendor license fees for rest of simulation.',
            unlocks_opportunity_id: null,
          },
        ],
        hidden_opportunity: {
          id: 'opp_sec_audit_bounty',
          title: 'Government Cyber Defense Advisory Retainer',
          description: 'Provide forensic telemetry assistance to the City Ministry of Tech.',
          type: 'govt_tender',
          budget_vb: 3500,
          terms: { compliance_cert: 'ISO-VC-27001' },
        },
        status: 'inactive',
        triggered_at: null,
        deadline: null,
      },
      {
        id: 'crisis_supply_choke_03',
        title: 'Global Intermodal Freight Bottleneck',
        description: 'Intermodal freight routes congested due to flash flooding. Standard logistics delivery halted across city.',
        response_paths: [
          {
            id: 'path_drone_express',
            title: 'Charter Priority Swift Drone Fleet',
            description: 'Pay expedited air freight premium for guaranteed same-tick delivery.',
            cost_vb: 1200,
            cost_resources: { logistics: 10 },
            effect: 'Immediate priority logistics dispatch for all outstanding shipments.',
            unlocks_opportunity_id: null,
          },
          {
            id: 'path_local_supplier',
            title: 'Reroute to Local Supplier Syndicate',
            description: 'Procure alternative parts locally at 15% material markup.',
            cost_vb: 400,
            cost_resources: { materials: 15 },
            effect: 'Avoids logistics bottlenecks entirely.',
            unlocks_opportunity_id: null,
          },
        ],
        hidden_opportunity: null,
        status: 'inactive',
        triggered_at: null,
        deadline: null,
      },
    ];

    for (const c of crisisList) {
      await client.query(
        `INSERT INTO crises (
          id, title, description, response_paths, hidden_opportunity, deadline, status, triggered_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          c.id,
          c.title,
          c.description,
          JSON.stringify(c.response_paths),
          c.hidden_opportunity ? JSON.stringify(c.hidden_opportunity) : null,
          c.deadline,
          c.status,
          c.triggered_at,
        ]
      );
    }

    // 15. Seed Sample Dispute for Verification
    await client.query(
      `INSERT INTO disputes (
        id, deal_id, claimant_type, claimant_id, respondent_type, respondent_id,
        amount_vb, reason, evidence, status, ruling, awarded_vb, ruling_notes, ruled_by
      ) VALUES (
        'disp_sample_01', 'deal_anchor_comp_swiftcart', 'participant', 'vc_p_014', 'company', 'comp_ledgerly',
        350, 'Non-delivery of scheduled fleet delivery runs',
        'Physical transaction pad #14 signed, delivery deadline passed without receipt.',
        'open', NULL, 0, NULL, NULL
      )`
    );

    // 16. Initial Audit Log
    await client.query(
      `INSERT INTO audit_log (
        id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
      ) VALUES (
        'audit_init_seed_p4', NOW(), 'system', 'system', 'WORLD_SEED_PHASE4_N10',
        'world_state', 'default', 'Initialized N=10 Starting State Sheet with crises library, disputes engine, and life-cycle telemetry.', 'seed_script'
      )`
    );

    await client.query('COMMIT');
    console.log('✅ Seed completed: 10 companies, 8 institutions, 100 participants, anchor deals, 14 missions, 5 opportunities initialized.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  runSeed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
