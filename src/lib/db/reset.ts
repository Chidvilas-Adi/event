import { pool, withTransaction } from '@/lib/db';
import { hashPassword } from '@/lib/auth/session';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { MissionAutomationEngine } from '@/lib/missions/automation';

export async function executeCompleteWorldReset(actorId: string = 'system') {
  console.log('🔄 Executing Complete World Reset to Canonical Master State...');

  await withTransaction(async (client) => {
    // 0. Disable append-only triggers
    await client.query('ALTER TABLE audit_log DISABLE TRIGGER trg_audit_log_append_only;');
    await client.query('ALTER TABLE ledger_entries DISABLE TRIGGER trg_ledger_entries_append_only;');

    // 1. Truncate all tables
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

    // 2. Seed Roles
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
      await client.query('INSERT INTO roles (id, name, description) VALUES ($1, $2, $3)', [r.id, r.name, r.description]);
    }

    // 3. Visibility Policies
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
      await client.query('INSERT INTO visibility_policies (id, object_type, field_name, visibility_class) VALUES ($1, $2, $3, $4)', [p.id, p.object_type, p.field_name, p.visibility_class]);
    }

    // 4. Seed Resources with Bank Base Prices (Total 100 of each = 12,500 VB per company inventory)
    const resources = [
      { id: 'compute', name: 'Compute Units', unit: 'FLOPs/hr', base_price: 25, description: 'High-performance cloud & AI compute clusters' },
      { id: 'energy', name: 'Clean Energy', unit: 'kWh', base_price: 15, description: 'Grid energy cells for powering infrastructure' },
      { id: 'logistics', name: 'Logistics Slots', unit: 'Crates', base_price: 20, description: 'Express delivery and physical routing capacity' },
      { id: 'materials', name: 'Raw Materials', unit: 'kg', base_price: 20, description: 'Advanced composite and rare components' },
      { id: 'data', name: 'Market Data & Info', unit: 'Feeds', base_price: 20, description: 'Proprietary business and telemetry intel' },
      { id: 'infrastructure', name: 'Infra Modules', unit: 'Racks', base_price: 25, description: 'Modular manufacturing and lab facilities' },
    ];
    for (const r of resources) {
      await client.query('INSERT INTO resources (id, name, unit, base_price, description) VALUES ($1, $2, $3, $4, $5)', [r.id, r.name, r.unit, r.base_price, r.description]);
    }

    // 5. Seed 8 Sovereign City Institutions with Full Pools
    const institutions = [
      {
        id: 'bank',
        name: 'Apex Reserve Bank',
        type: 'bank',
        capacity: 100,
        config: {
          lending_pool_total: 80000,
          lending_pool_remaining: 80000,
          resource_stock_per_type: 400,
          restock_rate_per_tick: 100,
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
          fund_size_total: 140000,
          fund_size_remaining: 140000,
          max_investments_count: 7,
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
          anchor_contracts_count: 12,
          open_customer_cards_count: 24,
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
          specialist_contracts_count: 12,
          salary_per_tick_l0: 100,
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
          discounted_stock_per_tick: 200,
          discount_percent: 10,
          min_order_quantity: 10,
        },
      },
      {
        id: 'logistics',
        name: 'Swift Logistics Provider',
        type: 'logistics',
        capacity: 220,
        config: {
          standard_capacity_per_tick: 150,
          priority_capacity_per_tick: 70,
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
          grant_pool_total: 30000,
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
          featured_story_slots_per_tick: 2,
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

    // 6. Seed 12 Canonical Companies (Master Catalogue Document 2)
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

      // Seed 30,000 VB cash balance via ledger
      const ledgId = `ledg_init_comp_${c.id}`;
      await client.query(
        `INSERT INTO ledger_entries (
          id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
        ) VALUES ($1, NOW(), 'system', NULL, 'company', $2, $3, 'transfer', 'Master Catalogue Initial Treasury Vault', 'world_reset')`,
        [ledgId, c.id, c.initial_cash || 30000]
      );

      // Seed 100 units of each of the 6 resources in resource_ledger
      for (const res of resources) {
        const resLedgId = `res_init_${c.id}_${res.id}`;
        await client.query(
          `INSERT INTO resource_ledger (
            id, timestamp, resource_id, owner_type, owner_id, quantity, reason, authoriser
          ) VALUES ($1, NOW(), $2, 'company', $3, 100, 'Master Catalogue Initial Resource Package', 'world_reset')`,
          [resLedgId, res.id, c.id]
        );
      }

      // Seed Clean Starting Cap Table: 800 Founding Common (80%) + 200 Option Pool (20%)
      await client.query(
        'INSERT INTO cap_table (id, company_id, shareholder_type, shareholder_id, shares_or_percent, rights) VALUES ($1, $2, $3, $4, 80.00, $5)',
        [`cap_${c.id}_founding`, c.id, 'founder', 'Founding Shareholders', JSON.stringify({ class: 'Founding Common', shares: 800 })]
      );
      await client.query(
        'INSERT INTO cap_table (id, company_id, shareholder_type, shareholder_id, shares_or_percent, rights) VALUES ($1, $2, $3, $4, 20.00, $5)',
        [`cap_${c.id}_pool`, c.id, 'pool', 'Employee Option Pool', JSON.stringify({ class: 'Unallocated Pool', shares: 200 })]
      );
    }

    // 7. Seed 12 Operator Accounts
    const operators = [
      { id: 'op_gm', username: 'gm', name: 'Game Master (City Control)', role_id: 'gm', institution_id: null, password_hash: hashPassword('gm-password-2026'), totp_secret: '000000' },
      { id: 'op_admin', username: 'admin', name: 'Tech Lead / Admin', role_id: 'admin', institution_id: null, password_hash: hashPassword('admin-password-2026'), totp_secret: '111111' },
      { id: 'op_lead', username: 'event_lead', name: 'Operations Event Lead', role_id: 'event_lead', institution_id: null, password_hash: hashPassword('lead-password-2026'), totp_secret: '222222' },
      { id: 'op_observer', username: 'observer', name: 'Founder Evidence Observer', role_id: 'observer', institution_id: null, password_hash: hashPassword('obs-password-2026'), totp_secret: '333333' },
      { id: 'op_bank', username: 'volunteer_bank', name: 'Apex Bank Manager', role_id: 'volunteer', institution_id: 'bank', password_hash: hashPassword('bank-volunteer-2026'), totp_secret: '444444' },
      { id: 'op_investor', username: 'volunteer_investor', name: 'Frontier Fund Partner', role_id: 'volunteer', institution_id: 'investor', password_hash: hashPassword('investor-volunteer-2026'), totp_secret: '555555' },
      { id: 'op_customer', username: 'volunteer_customer', name: 'Enterprise Procurement Officer', role_id: 'volunteer', institution_id: 'enterprise_customer', password_hash: hashPassword('customer-volunteer-2026'), totp_secret: '666666' },
      { id: 'op_talent', username: 'volunteer_talent', name: 'Talent Exchange Officer', role_id: 'volunteer', institution_id: 'talent_exchange', password_hash: hashPassword('talent-volunteer-2026'), totp_secret: '777777' },
      { id: 'op_supplier', username: 'volunteer_supplier', name: 'Prime Supplier Dispatcher', role_id: 'volunteer', institution_id: 'supplier', password_hash: hashPassword('supplier-volunteer-2026'), totp_secret: '888888' },
      { id: 'op_logistics', username: 'volunteer_logistics', name: 'Logistics Controller', role_id: 'volunteer', institution_id: 'logistics', password_hash: hashPassword('logistics-volunteer-2026'), totp_secret: '999999' },
      { id: 'op_government', username: 'volunteer_government', name: 'Commerce Officer', role_id: 'volunteer', institution_id: 'government', password_hash: hashPassword('gov-volunteer-2026'), totp_secret: '101010' },
      { id: 'op_media', username: 'volunteer_media', name: 'Daily Chronicle Editor', role_id: 'volunteer', institution_id: 'media', password_hash: hashPassword('media-volunteer-2026'), totp_secret: '202020' },
    ];
    for (const op of operators) {
      await client.query(
        'INSERT INTO operator_accounts (id, username, name, role_id, institution_id, password_hash, totp_secret, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)',
        [op.id, op.username, op.name, op.role_id, op.institution_id, op.password_hash, op.totp_secret]
      );
    }

    // 8. Seed 100 Participants (Assigned evenly across 12 companies + Free Agents)
    const companyRoles = [
      'Founder & CEO', 'Co-Founder & CTO', 'Head of Product', 'Lead Systems Engineer',
      'VP of Commercialization', 'Lead Data Scientist', 'Hardware Architect', 'Supply Operations Lead',
    ];
    const names = [
      'Aarav Sharma', 'Vivaan Gupta', 'Aditya Verma', 'Vihaan Rao', 'Arjun Nair', 'Sai Kumar',
      'Reyansh Joshi', 'Ayaan Mehta', 'Krishna Iyer', 'Ishaan Pillai', 'Shaurya Sen', 'Atharv Kulkarni',
      'Ananya Deshmukh', 'Diya Bhat', 'Isha Reddy', 'Aadhya Hegde', 'Aaradhya Menon', 'Anika Ghosh',
      'Pari Chawla', 'Saanvi Malhotra', 'Rohan Kapoor', 'Dhruv Saxena', 'Kabir Sethi', 'Tanvi Roy',
      'Tara Banerjee', 'Riya Bhattacharya', 'Kavya Singhania', 'Meera Mittal', 'Rudra Patel', 'Aryan Jain',
      'Dev Agarwal', 'Om Chauhan', 'Advait Pandey', 'Pranav Mishra', 'Samar Tiwari', 'Nikhil Tripathi',
      'Manish Dubey', 'Kiran Kaushik', 'Vikram Goswami', 'Anand Upadhyay', 'Pooja Shukla', 'Shreya Pathak',
      'Sneha Dixit', 'Neha Bajpai', 'Priya Dwivedi', 'Swati Awasthi', 'Rahul Chaturvedi', 'Varun Nigam',
      'Deepak Agnihotri', 'Gaurav Vajpayee', 'Yash Mathur', 'Harsh Shrivastav', 'Siddharth Saxena',
      'Alok Sinha', 'Sanjay Lal', 'Amitabh Das', 'Kunal Sengupta', 'Rajesh Majumdar', 'Sunil Choudhury',
      'Suresh Dutta', 'Ramesh Biswas', 'Dinesh Bose', 'Mahesh Mukherjee', 'Ganesh Ganguly', 'Kartik Chakraborty',
      'Abhishek Samanta', 'Sourav Mondal', 'Subhash Paul', 'Anirban Guha', 'Partha Roychowdhury', 'Dipak Barman',
      'Tapan Jana', 'Chandan Bhowmik', 'Swapan Adhikary', 'Prabir Sarkar', 'Ashok Pramanik', 'Tarun Halder',
      'Bimal Naskar', 'Dulal Sardar', 'Manojit Mandal', 'Debasis Dasgupta', 'Sujit De', 'Avik Nag',
      'Suman Sil', 'Prasenjit Kundu', 'Anupam Pal', 'Tanmoy Ghosh', 'Rupak Saha', 'Indrajit Das',
      'Bhaskar Ray', 'Arup Roy', 'Chayan Basu', 'Debojyoti Sen', 'Kaushik Banerjee', 'Nilanjan Mukherjee',
      'Saptarshi Chatterjee', 'Sayantan Bhattacharya', 'Shibaji Chakraborty', 'Surajit Ganguly', 'Tuhin Sengupta',
    ];

    for (let i = 0; i < 100; i++) {
      const pId = `vc_p_${String(i + 1).padStart(3, '0')}`;
      const code = `VC-${String(i + 1).padStart(3, '0')}`;
      const name = names[i] || `Citizen ${i + 1}`;
      const email = `citizen_${i + 1}@venturecity.game`;

      // 12 companies: 8 per company = 96, plus 4 free agents
      const compIndex = Math.floor(i / 8);
      const roleIndex = i % 8;
      const isAffiliated = compIndex < companies.length;
      const assignedComp = isAffiliated ? companies[compIndex] : null;
      const assignedRole = isAffiliated ? companyRoles[roleIndex] : 'Independent Free Agent';
      const userRole = (isAffiliated && assignedRole === 'Founder & CEO') ? 'company_lead' : 'participant';

      await client.query(
        `INSERT INTO participants (id, citizen_code, name, email, role, status, event_code, created_at)
         VALUES ($1, $2, $3, $4, $5, 'active', 'VC2026', NOW())`,
        [pId, code, name, email, userRole]
      );

      // Starter personal wallet balance (500 VB)
      const personalLedgId = `ledg_init_part_${pId}`;
      await client.query(
        `INSERT INTO ledger_entries (
          id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser
        ) VALUES ($1, NOW(), 'system', NULL, 'participant', $2, 500, 'grant', 'Citizen Initial Staking Endowment', 'world_reset')`,
        [personalLedgId, pId]
      );

      // Membership
      if (assignedComp) {
        const memId = `mem_${pId}_${assignedComp.id}`;
        await client.query(
          `INSERT INTO memberships (id, participant_id, company_id, role, status)
           VALUES ($1, $2, $3, $4, 'active')`,
          [memId, pId, assignedComp.id, assignedRole]
        );
      }
    }

    // 9. World State
    await client.query(
      `INSERT INTO world_state (
        id, current_tick, wave, clock_seconds, is_paused, is_frozen, rules_locked, version_label, state_hash, updated_at
      ) VALUES ('default', 1, 1, 0, FALSE, FALSE, TRUE, '0x7F3A', 'LIVE', NOW())`
    );

    // 10. Seed Canonical Anchor Deals for all 12 Master Catalogue companies
    for (const c of companies) {
      const dealId = `deal_anchor_${c.id}`;
      await client.query(
        `INSERT INTO deals (
          id, sender_type, sender_id, recipient_type, recipient_id,
          template_type, terms, version, status, created_at, updated_at
        ) VALUES ($1, 'institution', 'enterprise_customer', 'company', $2, 'sale', $3, 1, 'proposed', NOW(), NOW())`,
        [
          dealId,
          c.id,
          JSON.stringify({
            item: `Anchor Enterprise Procurement Contract (${c.name})`,
            quantity: 1,
            price_vb: 15000,
            delivery_slot: c.fills_slots?.[0] || 'Core Deliverable',
          }),
        ]
      );
    }

    // 11. Log Audit Record
    const auditId = `aud_reset_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    await client.query(
      `INSERT INTO audit_log (
        id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
      ) VALUES ($1, NOW(), $2, 'gm', 'COMPLETE_WORLD_RESET', 'world_state', 'default',
        'Restored Venture City to pristine canonical state: 12 Master Catalogue companies, 8 institutions, 100 participants, fresh treasuries.', 'reset_engine')`,
      [auditId, actorId]
    );

    console.log('✅ Base tables and world state reset successfully. Running automated mission assignments...');
  });

  const missionStats = await MissionAutomationEngine.autoAssignAllMissions();
  console.log('✅ Automated missions successfully seeded:', missionStats);
  return { success: true, missionStats };
}

