import { pool, withTransaction } from '@/lib/db';
import crypto from 'crypto';

export interface RoleMissionDefinition {
  id: string;
  title: string;
  tier: number;
  wave: number;
  objective: string;
  verification_method: 'system_checked' | 'counterparty_code' | 'station_checkin' | 'scan_token' | 'multi_party';
  completion_rule: string;
  reward_vb: number;
  reward_resources?: Record<string, number>;
  station_id?: string;
  is_secret?: boolean;
}

export const ROLE_MISSION_TEMPLATES: Record<string, RoleMissionDefinition[]> = {
  // 1. Founder & CEO
  'Founder & CEO': [
    {
      id: 'ceo_term_sheet',
      title: 'Institutional Diligence: Frontier Fund Pitch',
      tier: 2,
      wave: 1,
      objective: 'Meet the Investment Partner at Frontier Venture Syndicate. Pitch your unit economics and open formal term sheet discussions.',
      verification_method: 'station_checkin',
      station_id: 'investor',
      completion_rule: 'station_id = investor',
      reward_vb: 1200,
    },
    {
      id: 'ceo_anchor_contract',
      title: 'Anchor Customer Milestone Closing',
      tier: 3,
      wave: 1,
      objective: 'Sign and execute the primary Anchor Procurement Contract with the Customer Desk worth at least 15,000 VB.',
      verification_method: 'system_checked',
      completion_rule: 'deals_executed >= 1',
      reward_vb: 1500,
    },
    {
      id: 'ceo_bank_line',
      title: 'Apex Bank Credit Facility Inception',
      tier: 2,
      wave: 1,
      objective: 'Secure an approved low-interest working capital facility from Apex Reserve Bank to bolster company runway.',
      verification_method: 'station_checkin',
      station_id: 'bank',
      completion_rule: 'station_id = bank',
      reward_vb: 1000,
    },
    {
      id: 'ceo_crisis_response',
      title: 'Decisive Crisis Management Leadership',
      tier: 3,
      wave: 2,
      objective: 'Submit a ratified board response to an active macroeconomic crisis within the allotted countdown window.',
      verification_method: 'system_checked',
      completion_rule: 'crisis_response_submitted',
      reward_vb: 1400,
    },
    {
      id: 'ceo_cap_table_vesting',
      title: 'Cap Table Vesting & Shareholder Audit',
      tier: 1,
      wave: 1,
      objective: 'Conduct official cap table review on the Founder Desk and verify exact 100% equity allocation across all co-founders.',
      verification_method: 'system_checked',
      completion_rule: 'cap_table_verified',
      reward_vb: 800,
    },
    {
      id: 'ceo_b2b_alliance',
      title: 'Inter-Venture Strategic Alliance Pact',
      tier: 2,
      wave: 2,
      objective: 'Negotiate and sign a bilateral mutual assistance or cross-licensing agreement with another active venture founder.',
      verification_method: 'counterparty_code',
      completion_rule: 'counterparty_deal_valid',
      reward_vb: 1100,
    },
    {
      id: 'ceo_governance_registry',
      title: 'City Commercial Registry Standing',
      tier: 1,
      wave: 1,
      objective: 'Complete corporate governance validation and verify active status with City Department of Commerce station officer.',
      verification_method: 'station_checkin',
      station_id: 'government',
      completion_rule: 'station_id = government',
      reward_vb: 750,
    },
    {
      id: 'ceo_runway_safeguard',
      title: 'Treasury Solvency & Runway Milestone',
      tier: 4,
      wave: 3,
      objective: 'Ensure the company maintains operational cash runway of at least 30,000 VB into the late trading ticks.',
      verification_method: 'system_checked',
      completion_rule: 'company_treasury >= 30000',
      reward_vb: 2000,
    },
    {
      id: 'ceo_observer_debrief',
      title: 'Executive Behavioral Evidence Staking',
      tier: 2,
      wave: 2,
      objective: 'Participate in an executive behavioral observation debrief with the City Observer station operator.',
      verification_method: 'station_checkin',
      station_id: 'investor',
      completion_rule: 'observer_debrief_verified',
      reward_vb: 900,
    },
  ],

  // 2. Co-Founder & CTO
  'Co-Founder & CTO': [
    {
      id: 'cto_compute_provision',
      title: 'AI High-Performance Compute Provisioning',
      tier: 2,
      wave: 1,
      objective: 'Procure and allocate at least 150 FLOPs/hr of Compute Units to maintain high-throughput model inferencing.',
      verification_method: 'system_checked',
      completion_rule: 'company_resources.compute >= 150',
      reward_vb: 1100,
    },
    {
      id: 'cto_infra_modules',
      title: 'Modular Infrastructure Rack Commissioning',
      tier: 3,
      wave: 1,
      objective: 'Acquire at least 2 Infrastructure Modules from the Bank Vault to scale proprietary lab facilities.',
      verification_method: 'system_checked',
      completion_rule: 'company_resources.infrastructure >= 120',
      reward_vb: 1300,
    },
    {
      id: 'cto_station_checkin',
      title: 'Hardware Vault Key Verification',
      tier: 1,
      wave: 1,
      objective: 'Perform technical station attestation and cryptographic security verification at Apex Reserve Bank.',
      verification_method: 'station_checkin',
      station_id: 'bank',
      completion_rule: 'station_id = bank',
      reward_vb: 750,
    },
    {
      id: 'cto_energy_grid',
      title: 'Clean Energy Grid Micro-Storage Sync',
      tier: 2,
      wave: 2,
      objective: 'Balance company energy reserves to maintain at least 120 kWh Clean Energy units through market fluctuations.',
      verification_method: 'system_checked',
      completion_rule: 'company_resources.energy >= 120',
      reward_vb: 950,
    },
    {
      id: 'cto_disaster_recovery',
      title: 'Off-site Disaster Recovery Synchronization',
      tier: 2,
      wave: 2,
      objective: 'Coordinate with Swift Logistics Provider to register an off-site physical data backup token.',
      verification_method: 'station_checkin',
      station_id: 'logistics',
      completion_rule: 'station_id = logistics',
      reward_vb: 900,
    },
    {
      id: 'cto_patent_filing',
      title: 'Proprietary IP Architecture Registration',
      tier: 3,
      wave: 2,
      objective: 'Submit proprietary deep-tech architecture documentation to the Department of Commerce for patent filing.',
      verification_method: 'station_checkin',
      station_id: 'government',
      completion_rule: 'station_id = government',
      reward_vb: 1250,
    },
    {
      id: 'cto_scan_token',
      title: 'Secure Firmware Token Scan',
      tier: 2,
      wave: 1,
      objective: 'Collect and verify the daily firmware cryptographic token from the Prime Supplier station terminal.',
      verification_method: 'scan_token',
      completion_rule: 'token_verified',
      reward_vb: 850,
    },
    {
      id: 'cto_tech_stack_audit',
      title: 'Zero-Debt Architecture Audit',
      tier: 4,
      wave: 3,
      objective: 'Conduct full technical systems integrity check and verify zero data corruption across ledger logs.',
      verification_method: 'system_checked',
      completion_rule: 'tech_audit_passed',
      reward_vb: 1600,
    },
    {
      id: 'cto_cross_tech_exchange',
      title: 'B2B Technical Intel Cross-Validation',
      tier: 2,
      wave: 2,
      objective: 'Exchange technical specifications with another venture CTO and obtain their counterparty confirmation code.',
      verification_method: 'counterparty_code',
      completion_rule: 'counterparty_code_valid',
      reward_vb: 1000,
    },
  ],

  // 3. Head of Product
  'Head of Product': [
    {
      id: 'prod_catalog_minting',
      title: 'Product Catalog Specification Minting',
      tier: 1,
      wave: 1,
      objective: 'Register the official company product card and solution specifications with the Customer Procurement Desk.',
      verification_method: 'station_checkin',
      station_id: 'enterprise_customer',
      completion_rule: 'station_id = enterprise_customer',
      reward_vb: 800,
    },
    {
      id: 'prod_feedback_sprint',
      title: 'Customer Feedback & Acceptance Validation',
      tier: 2,
      wave: 1,
      objective: 'Obtain counterparty verification codes from at least two pilot client buyers validating product acceptance.',
      verification_method: 'counterparty_code',
      completion_rule: 'feedback_count >= 2',
      reward_vb: 1100,
    },
    {
      id: 'prod_telemetry_intake',
      title: 'Product Usage Telemetry Ingestion',
      tier: 2,
      wave: 2,
      objective: 'Acquire at least 50 units of Market Data feeds from Prime Supplier to optimize client retention models.',
      verification_method: 'system_checked',
      completion_rule: 'company_resources.data >= 110',
      reward_vb: 950,
    },
    {
      id: 'prod_competitive_teardown',
      title: 'Market Competitive Teardown',
      tier: 2,
      wave: 2,
      objective: 'Analyze competitor product offerings and report findings to the Daily Chronicle media analyst desk.',
      verification_method: 'station_checkin',
      station_id: 'media',
      completion_rule: 'station_id = media',
      reward_vb: 850,
    },
    {
      id: 'prod_sla_delivery',
      title: 'Service Level Agreement Compliance Sign-off',
      tier: 3,
      wave: 2,
      objective: 'Secure 100% on-time milestone delivery sign-off on a customized client order.',
      verification_method: 'counterparty_code',
      completion_rule: 'sla_verified',
      reward_vb: 1300,
    },
    {
      id: 'prod_rfp_packaging',
      title: 'Enterprise RFP Proposal Package Staging',
      tier: 3,
      wave: 3,
      objective: 'Stage and validate an enterprise solution RFP package with Customer Desk officer.',
      verification_method: 'station_checkin',
      station_id: 'enterprise_customer',
      completion_rule: 'station_id = enterprise_customer',
      reward_vb: 1400,
    },
    {
      id: 'prod_prototype_showcase',
      title: 'Prototype Live Demonstration',
      tier: 2,
      wave: 2,
      objective: 'Conduct a live working prototype demonstration with the Station Observer and record verification.',
      verification_method: 'station_checkin',
      station_id: 'investor',
      completion_rule: 'showcase_verified',
      reward_vb: 1050,
    },
    {
      id: 'prod_roadmap_broadcast',
      title: 'Public Roadmap Announcement',
      tier: 1,
      wave: 1,
      objective: 'Publish a product feature milestone announcement to the citywide ticker feed.',
      verification_method: 'system_checked',
      completion_rule: 'announcement_verified',
      reward_vb: 700,
    },
    {
      id: 'prod_token_audit',
      title: 'Release Version Token Verification',
      tier: 2,
      wave: 1,
      objective: 'Obtain software version validation token at Swift Logistics technical checkpoint.',
      verification_method: 'scan_token',
      completion_rule: 'token_verified',
      reward_vb: 800,
    },
  ],

  // 4. VP of Commercialization
  'VP of Commercialization': [
    {
      id: 'comm_rfp_bid',
      title: 'Enterprise Customer Tender Submission',
      tier: 2,
      wave: 1,
      objective: 'Submit formal commercial tender for an open enterprise RFP card at Customer Procurement Desk.',
      verification_method: 'station_checkin',
      station_id: 'enterprise_customer',
      completion_rule: 'station_id = enterprise_customer',
      reward_vb: 1100,
    },
    {
      id: 'comm_contract_upsell',
      title: 'High-Value Commercial Upsell Negotiation',
      tier: 3,
      wave: 2,
      objective: 'Execute a commercial sale deal slip exceeding 10,000 VB with immediate settlement terms.',
      verification_method: 'system_checked',
      completion_rule: 'deal_value >= 10000',
      reward_vb: 1400,
    },
    {
      id: 'comm_cross_venture_sale',
      title: 'B2B Cross-Startup Solution Deployment',
      tier: 2,
      wave: 1,
      objective: 'Close a commercial contract selling your company components or services to a peer venture.',
      verification_method: 'counterparty_code',
      completion_rule: 'b2b_sale_verified',
      reward_vb: 1200,
    },
    {
      id: 'comm_sales_velocity',
      title: 'Sales Velocity Sprint: 3 Executed Deals',
      tier: 3,
      wave: 2,
      objective: 'Execute at least 3 distinct deals across transactions or opportunities within market trading hours.',
      verification_method: 'system_checked',
      completion_rule: 'deals_executed >= 3',
      reward_vb: 1500,
    },
    {
      id: 'comm_referral_pact',
      title: 'Client Referral Network Verification',
      tier: 2,
      wave: 2,
      objective: 'Obtain counterparty verification code from a company lead referring new customer business.',
      verification_method: 'counterparty_code',
      completion_rule: 'referral_verified',
      reward_vb: 950,
    },
    {
      id: 'comm_personal_commission',
      title: 'Commercial Commission Staking Target',
      tier: 2,
      wave: 1,
      objective: 'Grow personal citizen wallet balance to at least 1,200 VB through earned deal commissions.',
      verification_method: 'system_checked',
      completion_rule: 'wallet_balance >= 1200',
      reward_vb: 850,
    },
    {
      id: 'comm_customer_desk_checkin',
      title: 'Procurement Officer Executive Briefing',
      tier: 1,
      wave: 1,
      objective: 'Perform station check-in with Enterprise Customer Officer to review open customer demand.',
      verification_method: 'station_checkin',
      station_id: 'enterprise_customer',
      completion_rule: 'station_id = enterprise_customer',
      reward_vb: 750,
    },
    {
      id: 'comm_opportunity_claim',
      title: 'City Commercial Opportunity Capture',
      tier: 3,
      wave: 3,
      objective: 'Claim and successfully execute an open city commercial opportunity card.',
      verification_method: 'system_checked',
      completion_rule: 'opportunity_completed',
      reward_vb: 1350,
    },
    {
      id: 'comm_token_intake',
      title: 'Commercial Token Clearance',
      tier: 2,
      wave: 1,
      objective: 'Scan the commercial authorization token at Talent Exchange desk.',
      verification_method: 'scan_token',
      completion_rule: 'token_verified',
      reward_vb: 800,
    },
  ],

  // 5. Lead Systems Engineer
  'Lead Systems Engineer': [
    {
      id: 'sys_infra_commissioning',
      title: 'Core Infrastructure Grid Stabilization',
      tier: 2,
      wave: 1,
      objective: 'Commission at least 110 units of Infrastructure Modules in corporate inventory.',
      verification_method: 'system_checked',
      completion_rule: 'company_resources.infrastructure >= 110',
      reward_vb: 1000,
    },
    {
      id: 'sys_emergency_power',
      title: 'Auxiliary Power Reserves Provisioning',
      tier: 2,
      wave: 1,
      objective: 'Procure 50 units of Clean Energy from Supplier Market to prevent emergency power throttling.',
      verification_method: 'system_checked',
      completion_rule: 'company_resources.energy >= 110',
      reward_vb: 900,
    },
    {
      id: 'sys_logistics_priority',
      title: 'Express Priority Freight Dispatch',
      tier: 2,
      wave: 2,
      objective: 'Book and confirm priority freight capacity with Swift Logistics Controller.',
      verification_method: 'station_checkin',
      station_id: 'logistics',
      completion_rule: 'station_id = logistics',
      reward_vb: 950,
    },
    {
      id: 'sys_scan_token',
      title: 'Physical Terminal Diagnostics Scan',
      tier: 1,
      wave: 1,
      objective: 'Scan hardware telemetry token at Swift Logistics station terminal.',
      verification_method: 'scan_token',
      completion_rule: 'token_verified',
      reward_vb: 750,
    },
    {
      id: 'sys_network_latency',
      title: 'Inter-Node Bandwidth Stress Test',
      tier: 3,
      wave: 2,
      objective: 'Allocate 30 Compute Units into production environment and register benchmark.',
      verification_method: 'system_checked',
      completion_rule: 'benchmark_verified',
      reward_vb: 1200,
    },
    {
      id: 'sys_bank_vault_checkin',
      title: 'Reserve Bank Hardware Security Attestation',
      tier: 2,
      wave: 1,
      objective: 'Perform hardware security attestation check-in at Apex Reserve Bank.',
      verification_method: 'station_checkin',
      station_id: 'bank',
      completion_rule: 'station_id = bank',
      reward_vb: 850,
    },
    {
      id: 'sys_failover_drill',
      title: 'Emergency Failover Systems Drill',
      tier: 3,
      wave: 3,
      objective: 'Complete simulated system failover exercise during active market hours.',
      verification_method: 'counterparty_code',
      completion_rule: 'failover_verified',
      reward_vb: 1300,
    },
    {
      id: 'sys_capacity_reserve',
      title: 'Swift Logistics Route Reservation',
      tier: 2,
      wave: 2,
      objective: 'Reserve 50 crates freight dispatch capacity for upcoming trading tick.',
      verification_method: 'station_checkin',
      station_id: 'logistics',
      completion_rule: 'station_id = logistics',
      reward_vb: 900,
    },
    {
      id: 'sys_zero_downtime',
      title: 'High Availability Production Benchmark',
      tier: 4,
      wave: 3,
      objective: 'Maintain zero system disruptions across 3 consecutive trading ticks.',
      verification_method: 'system_checked',
      completion_rule: 'uptime_verified',
      reward_vb: 1700,
    },
  ],

  // 6. Lead Data Scientist
  'Lead Data Scientist': [
    {
      id: 'data_feed_ingestion',
      title: 'Proprietary Market Data Stream Ingestion',
      tier: 2,
      wave: 1,
      objective: 'Amass at least 120 Data Feeds in company resource holdings to fuel algorithmic models.',
      verification_method: 'system_checked',
      completion_rule: 'company_resources.data >= 120',
      reward_vb: 1050,
    },
    {
      id: 'data_arbitrage_model',
      title: 'Market Pricing Arbitrage Discovery',
      tier: 2,
      wave: 1,
      objective: 'Identify a 10% price delta between Supplier Desk and Bank Base price and register deal slip.',
      verification_method: 'system_checked',
      completion_rule: 'arbitrage_verified',
      reward_vb: 1100,
    },
    {
      id: 'data_supplier_checkin',
      title: 'Prime Supplier Market Index Collection',
      tier: 1,
      wave: 1,
      objective: 'Check in with Prime Supplier Market Dispatcher to collect live telemetry pricing feed.',
      verification_method: 'station_checkin',
      station_id: 'supplier',
      completion_rule: 'station_id = supplier',
      reward_vb: 800,
    },
    {
      id: 'data_intel_exchange',
      title: 'Telemetry Intel Bilateral Exchange',
      tier: 2,
      wave: 2,
      objective: 'Sell synthesized market intelligence to a peer company and record counterparty code.',
      verification_method: 'counterparty_code',
      completion_rule: 'intel_sale_verified',
      reward_vb: 1150,
    },
    {
      id: 'data_crisis_forecast',
      title: 'Macroeconomic Crisis Exposure Model',
      tier: 3,
      wave: 2,
      objective: 'Model estimated financial shock on company SPV and file mitigation notes with GM.',
      verification_method: 'system_checked',
      completion_rule: 'forecast_verified',
      reward_vb: 1350,
    },
    {
      id: 'data_observer_report',
      title: 'Observer Telemetry Intelligence Staking',
      tier: 2,
      wave: 2,
      objective: 'Present data analytics and efficiency telemetry to the City Observer station.',
      verification_method: 'station_checkin',
      station_id: 'investor',
      completion_rule: 'observer_report_verified',
      reward_vb: 950,
    },
    {
      id: 'data_scan_token',
      title: 'Algorithmic Calibration Token Scan',
      tier: 2,
      wave: 1,
      objective: 'Obtain daily data integrity verification token at Department of Commerce terminal.',
      verification_method: 'scan_token',
      completion_rule: 'token_verified',
      reward_vb: 850,
    },
    {
      id: 'data_spv_tracking',
      title: 'Company SPV Benchmark Validation',
      tier: 3,
      wave: 3,
      objective: 'Verify total company Starting Position Value (SPV) maintains benchmark range (28,000 VB ± 10%).',
      verification_method: 'system_checked',
      completion_rule: 'spv_verified',
      reward_vb: 1400,
    },
    {
      id: 'data_vault_security',
      title: 'Data Vault Leak Prevention Protocol',
      tier: 4,
      wave: 3,
      objective: 'Audit all company transactions to verify zero unauthorized intel disclosures occurred.',
      verification_method: 'system_checked',
      completion_rule: 'data_integrity_passed',
      reward_vb: 1600,
    },
  ],

  // 7. Hardware Architect
  'Hardware Architect': [
    {
      id: 'hw_material_procurement',
      title: 'Advanced Composite Raw Materials Intake',
      tier: 2,
      wave: 1,
      objective: 'Acquire at least 50 kg of Raw Materials from Prime Supplier Market to feed fabrication line.',
      verification_method: 'system_checked',
      completion_rule: 'company_resources.materials >= 120',
      reward_vb: 1000,
    },
    {
      id: 'hw_supplier_checkin',
      title: 'Prime Supplier Wholesale Inspection',
      tier: 1,
      wave: 1,
      objective: 'Perform wholesale component inspection check-in with Prime Supplier Dispatcher.',
      verification_method: 'station_checkin',
      station_id: 'supplier',
      completion_rule: 'station_id = supplier',
      reward_vb: 800,
    },
    {
      id: 'hw_safety_certification',
      title: 'Department of Commerce Safety Certification',
      tier: 2,
      wave: 2,
      objective: 'Obtain civic safety clearance and compliance token from Department of Commerce.',
      verification_method: 'station_checkin',
      station_id: 'government',
      completion_rule: 'station_id = government',
      reward_vb: 950,
    },
    {
      id: 'hw_prototype_fabrication',
      title: 'Physical Prototype Assembly & Staging',
      tier: 3,
      wave: 2,
      objective: 'Combine Raw Materials and Clean Energy into working hardware module. Verify with counterparty.',
      verification_method: 'counterparty_code',
      completion_rule: 'prototype_verified',
      reward_vb: 1300,
    },
    {
      id: 'hw_scan_token',
      title: 'Tooling Calibration Token Scan',
      tier: 1,
      wave: 1,
      objective: 'Collect hardware tooling token at Apex Reserve Bank technical vault terminal.',
      verification_method: 'scan_token',
      completion_rule: 'token_verified',
      reward_vb: 750,
    },
    {
      id: 'hw_syndicate_demo',
      title: 'Frontier Venture Hardware Showcase',
      tier: 3,
      wave: 2,
      objective: 'Demonstrate functional hardware architecture to Frontier Venture Fund analysts.',
      verification_method: 'station_checkin',
      station_id: 'investor',
      completion_rule: 'station_id = investor',
      reward_vb: 1250,
    },
    {
      id: 'hw_yield_optimization',
      title: 'Material Yield Efficiency Audit',
      tier: 2,
      wave: 2,
      objective: 'Optimize fabrication cycle to reduce material waste by 15% and document savings.',
      verification_method: 'system_checked',
      completion_rule: 'yield_verified',
      reward_vb: 900,
    },
    {
      id: 'hw_scrap_reclamation',
      title: 'Surplus Material Market Reclamation',
      tier: 2,
      wave: 3,
      objective: 'Sell surplus composite materials back to Prime Supplier Market for cash credit.',
      verification_method: 'system_checked',
      completion_rule: 'scrap_sale_verified',
      reward_vb: 1100,
    },
    {
      id: 'hw_supply_shock_pivot',
      title: 'Supply Chain Shortage Alternative Sourcing',
      tier: 4,
      wave: 3,
      objective: 'Successfully secure substitute components during an active commodity price shock.',
      verification_method: 'counterparty_code',
      completion_rule: 'shortage_resolved',
      reward_vb: 1600,
    },
  ],

  // 8. Supply Operations Lead
  'Supply Operations Lead': [
    {
      id: 'sup_wholesale_discount',
      title: 'Prime Supplier 10% Wholesale Discount Capture',
      tier: 2,
      wave: 1,
      objective: 'Purchase at least 50 units of core resources at 10% below Bank base price from Supplier Desk.',
      verification_method: 'system_checked',
      completion_rule: 'discount_purchase_verified',
      reward_vb: 1100,
    },
    {
      id: 'sup_inventory_balance',
      title: 'Six-Resource Strategic Stock Balancing',
      tier: 3,
      wave: 1,
      objective: 'Maintain a minimum of 80 units across all 6 core resources (Compute, Energy, Logistics, Materials, Data, Infra).',
      verification_method: 'system_checked',
      completion_rule: 'all_resources_above_80',
      reward_vb: 1400,
    },
    {
      id: 'sup_supplier_checkin',
      title: 'Wholesale Dispatch Terminal Check-in',
      tier: 1,
      wave: 1,
      objective: 'Register arrival and open order credit line with Prime Supplier Market Dispatcher.',
      verification_method: 'station_checkin',
      station_id: 'supplier',
      completion_rule: 'station_id = supplier',
      reward_vb: 750,
    },
    {
      id: 'sup_freight_booking',
      title: 'Swift Logistics Route Booking',
      tier: 2,
      wave: 2,
      objective: 'Confirm intermodal cargo booking with Swift Logistics Controller.',
      verification_method: 'station_checkin',
      station_id: 'logistics',
      completion_rule: 'station_id = logistics',
      reward_vb: 900,
    },
    {
      id: 'sup_scan_token',
      title: 'Warehouse Waybill Token Scan',
      tier: 1,
      wave: 1,
      objective: 'Scan the warehouse shipment token at Swift Logistics freight counter.',
      verification_method: 'scan_token',
      completion_rule: 'token_verified',
      reward_vb: 700,
    },
    {
      id: 'sup_asset_swap',
      title: 'Inter-Venture Commodity Barter Swap',
      tier: 2,
      wave: 2,
      objective: 'Execute a direct resource swap (e.g. Clean Energy for Compute Units) with another active venture.',
      verification_method: 'counterparty_code',
      completion_rule: 'barter_swap_verified',
      reward_vb: 1200,
    },
    {
      id: 'sup_deferred_terms',
      title: 'Vendor Deferred Payment Negotiation',
      tier: 3,
      wave: 2,
      objective: 'Negotiate milestone-based delivery payment terms on large wholesale procurement order.',
      verification_method: 'system_checked',
      completion_rule: 'deferred_terms_verified',
      reward_vb: 1250,
    },
    {
      id: 'sup_freight_optimization',
      title: 'Logistics Route Cost Optimization',
      tier: 2,
      wave: 3,
      objective: 'Optimize delivery grouping to save at least 500 VB in cumulative shipping tariffs.',
      verification_method: 'system_checked',
      completion_rule: 'logistics_savings_verified',
      reward_vb: 1000,
    },
    {
      id: 'sup_buffer_stock',
      title: 'Resilient Buffer Stock Maintenance',
      tier: 4,
      wave: 3,
      objective: 'Ensure zero stockouts across company production lines through late-stage market shocks.',
      verification_method: 'system_checked',
      completion_rule: 'zero_stockouts_verified',
      reward_vb: 1650,
    },
  ],

  // 9. Growth & Partnerships
  'Growth & Partnerships': [
    {
      id: 'gro_media_spotlight',
      title: 'The Daily Chronicle Featured Story Booking',
      tier: 2,
      wave: 1,
      objective: 'Book one of the 2 active featured story slots in The Daily Chronicle to amplify brand reach.',
      verification_method: 'station_checkin',
      station_id: 'media',
      completion_rule: 'station_id = media',
      reward_vb: 1100,
    },
    {
      id: 'gro_civic_grant',
      title: 'City Commerce Civic Grant Tender',
      tier: 2,
      wave: 1,
      objective: 'Apply for and secure civic non-dilutive grant funding from City Department of Commerce (pool: 30k VB).',
      verification_method: 'station_checkin',
      station_id: 'government',
      completion_rule: 'station_id = government',
      reward_vb: 1200,
    },
    {
      id: 'gro_tripartite_alliance',
      title: 'Tripartite Multi-Venture Consortium',
      tier: 3,
      wave: 2,
      objective: 'Facilitate a formal tripartite strategic cooperation agreement signed between 3 ventures.',
      verification_method: 'multi_party',
      completion_rule: 'tripartite_verified',
      reward_vb: 1500,
    },
    {
      id: 'gro_media_broadcast',
      title: 'Public Citywide Press Broadcast',
      tier: 1,
      wave: 1,
      objective: 'Coordinate with Media Desk operator to publish an urgent milestone announcement.',
      verification_method: 'station_checkin',
      station_id: 'media',
      completion_rule: 'station_id = media',
      reward_vb: 800,
    },
    {
      id: 'gro_talent_poach',
      title: 'Talent Exchange Specialist Recruitment',
      tier: 2,
      wave: 2,
      objective: 'Recruit a specialist from the Talent Exchange station or onboard an independent Free Agent.',
      verification_method: 'station_checkin',
      station_id: 'talent_exchange',
      completion_rule: 'station_id = talent_exchange',
      reward_vb: 1050,
    },
    {
      id: 'gro_counterparty_network',
      title: 'Venture Ecosystem Networking Sweep',
      tier: 2,
      wave: 2,
      objective: 'Collect verified counterparty codes from leads representing at least 3 distinct companies.',
      verification_method: 'counterparty_code',
      completion_rule: 'counterparty_count >= 3',
      reward_vb: 1250,
    },
    {
      id: 'gro_scan_token',
      title: 'Press Pass Verification Token',
      tier: 1,
      wave: 1,
      objective: 'Scan official press credentials token at The Daily Chronicle news desk.',
      verification_method: 'scan_token',
      completion_rule: 'token_verified',
      reward_vb: 750,
    },
    {
      id: 'gro_crisis_pr',
      title: 'Crisis Brand Neutralization Campaign',
      tier: 3,
      wave: 3,
      objective: 'Broadcast a strategic stabilization release following a market shock to protect company valuation.',
      verification_method: 'system_checked',
      completion_rule: 'pr_stabilization_verified',
      reward_vb: 1350,
    },
    {
      id: 'gro_investor_day_packet',
      title: 'Investor Day Final Briefing Staging',
      tier: 4,
      wave: 3,
      objective: 'Submit company executive profile and traction deck for final Investor Day packets.',
      verification_method: 'station_checkin',
      station_id: 'investor',
      completion_rule: 'station_id = investor',
      reward_vb: 1800,
    },
  ],

  // 10. CFO & General Counsel
  'CFO & General Counsel': [
    {
      id: 'cfo_balance_audit',
      title: 'Zero-Sum Ledger Reconciliation',
      tier: 2,
      wave: 1,
      objective: 'Perform complete zero-sum treasury reconciliation verifying cash matches ledger credits minus debits.',
      verification_method: 'system_checked',
      completion_rule: 'reconciliation_verified',
      reward_vb: 1100,
    },
    {
      id: 'cfo_bank_lending',
      title: 'Apex Reserve Bank Credit Term Negotiation',
      tier: 2,
      wave: 1,
      objective: 'Structure favorable interest terms with Apex Bank Manager for short-term working capital.',
      verification_method: 'station_checkin',
      station_id: 'bank',
      completion_rule: 'station_id = bank',
      reward_vb: 1000,
    },
    {
      id: 'cfo_dispute_filing',
      title: 'Commercial Arbitration Claim Inception',
      tier: 3,
      wave: 2,
      objective: 'File a formal commercial dispute or contract breach claim on the Arbitration Docket.',
      verification_method: 'system_checked',
      completion_rule: 'dispute_filed',
      reward_vb: 1300,
    },
    {
      id: 'cfo_payroll_disbursement',
      title: 'Team Payroll Stipend Distribution',
      tier: 2,
      wave: 2,
      objective: 'Ensure all company team members have received their tick salary disbursements.',
      verification_method: 'system_checked',
      completion_rule: 'payroll_verified',
      reward_vb: 950,
    },
    {
      id: 'cfo_equity_cap_audit',
      title: 'Cap Table 100% Precision Compliance Audit',
      tier: 2,
      wave: 1,
      objective: 'Verify shareholder equity allocations sum exactly to 100.00% without rounding drift.',
      verification_method: 'system_checked',
      completion_rule: 'cap_table_clean',
      reward_vb: 900,
    },
    {
      id: 'cfo_civic_compliance',
      title: 'City Commerce Civic Compliance Clearance',
      tier: 1,
      wave: 1,
      objective: 'Obtain statutory compliance stamp from City Department of Commerce station.',
      verification_method: 'station_checkin',
      station_id: 'government',
      completion_rule: 'station_id = government',
      reward_vb: 800,
    },
    {
      id: 'cfo_scan_token',
      title: 'Financial Vault Token Authentication',
      tier: 1,
      wave: 1,
      objective: 'Authenticate treasury encryption key with station token scan at Apex Bank.',
      verification_method: 'scan_token',
      completion_rule: 'token_verified',
      reward_vb: 750,
    },
    {
      id: 'cfo_arbitration_ruling',
      title: 'Favorable Arbitration Settlement Award',
      tier: 3,
      wave: 3,
      objective: 'Win a favorable GM arbitration ruling securing awarded VB settlement into company treasury.',
      verification_method: 'system_checked',
      completion_rule: 'arbitration_won',
      reward_vb: 1500,
    },
    {
      id: 'cfo_solvency_runway',
      title: 'Fiscal Health & Solvency Certification',
      tier: 4,
      wave: 3,
      objective: 'Certify company fiscal solvency through all trading ticks with no emergency capital calls.',
      verification_method: 'system_checked',
      completion_rule: 'solvency_certified',
      reward_vb: 1750,
    },
  ],

  // Independent Citizen / Free Agent
  'Independent Free Agent': [
    {
      id: 'free_staking_pass',
      title: 'Citizen Identity Staking Verification',
      tier: 1,
      wave: 1,
      objective: 'Verify your citizen mobile pass and confirm personal staking balance of 500 VB in the ledger.',
      verification_method: 'system_checked',
      completion_rule: 'wallet_balance >= 500',
      reward_vb: 250,
    },
    {
      id: 'free_talent_registration',
      title: 'Talent Exchange Roster Registration',
      tier: 1,
      wave: 1,
      objective: 'Check in at Metro Talent Exchange and register your freelance availability card.',
      verification_method: 'station_checkin',
      station_id: 'talent_exchange',
      completion_rule: 'station_id = talent_exchange',
      reward_vb: 600,
    },
    {
      id: 'free_consulting_deal',
      title: 'First Freelance Advisory Contract',
      tier: 2,
      wave: 1,
      objective: 'Sign and execute a paid advisory or freelance deal with an operating venture.',
      verification_method: 'counterparty_code',
      completion_rule: 'deal_executed',
      reward_vb: 900,
    },
    {
      id: 'free_market_arbitrage',
      title: 'Retail Spot Arbitrage Trade',
      tier: 2,
      wave: 2,
      objective: 'Purchase resources from Supplier Market and trade them to a startup in deficit.',
      verification_method: 'counterparty_code',
      completion_rule: 'trade_verified',
      reward_vb: 1000,
    },
    {
      id: 'free_civic_tender',
      title: 'Department of Commerce Civic Task',
      tier: 2,
      wave: 2,
      objective: 'Complete civic assistance task with the City Department of Commerce station.',
      verification_method: 'station_checkin',
      station_id: 'government',
      completion_rule: 'station_id = government',
      reward_vb: 850,
    },
    {
      id: 'free_media_tip',
      title: 'The Daily Chronicle Market Informant',
      tier: 1,
      wave: 1,
      objective: 'Provide a verified market news tip to The Daily Chronicle reporter desk.',
      verification_method: 'station_checkin',
      station_id: 'media',
      completion_rule: 'station_id = media',
      reward_vb: 500,
    },
    {
      id: 'free_scan_token',
      title: 'Citizen Terminal Security Check',
      tier: 1,
      wave: 1,
      objective: 'Scan citizen verification token at the Apex Bank public terminal.',
      verification_method: 'scan_token',
      completion_rule: 'token_verified',
      reward_vb: 650,
    },
    {
      id: 'free_venture_recruitment',
      title: 'Startup Core Team Joining Bonus',
      tier: 3,
      wave: 2,
      objective: 'Get hired into a permanent role inside one of the 10 operating ventures.',
      verification_method: 'system_checked',
      completion_rule: 'company_joined',
      reward_vb: 1500,
    },
    {
      id: 'free_wealth_accumulation',
      title: 'Free Agent Staking Milestone: 2,000 VB',
      tier: 4,
      wave: 3,
      objective: 'Accumulate at least 2,000 VB in personal wallet through skilled dealmaking.',
      verification_method: 'system_checked',
      completion_rule: 'wallet_balance >= 2000',
      reward_vb: 1200,
    },
  ],
};

// SPICY & SECRET UNIQUE EVENT MISSIONS (Corporate Espionage, Leaks, Whistleblowing, Undercover Deals)
export const SPICY_SECRET_MISSIONS: RoleMissionDefinition[] = [
  {
    id: 'spy_leak_pricing',
    title: '[CLASSIFIED] Industrial Espionage: Leak Pricing Sheet',
    tier: 3,
    wave: 2,
    objective: 'Covertly approach a rival venture lead and transmit your company’s internal product cost and pricing formula. Receive at least 1,500 VB private transfer to your personal wallet.',
    verification_method: 'counterparty_code',
    completion_rule: 'counterparty_code_valid',
    reward_vb: 1800,
    is_secret: true,
  },
  {
    id: 'spy_leak_ip_specs',
    title: '[CLASSIFIED] Tech Espionage: Leak Architecture Blueprints',
    tier: 3,
    wave: 2,
    objective: 'Privately transmit your company’s proprietary system deployment blueprint to a competitor’s CTO. Obtain their secret counterparty verification code.',
    verification_method: 'counterparty_code',
    completion_rule: 'counterparty_code_valid',
    reward_vb: 2000,
    is_secret: true,
  },
  {
    id: 'spy_whistleblower_cartel',
    title: '[CONFIDENTIAL] Civic Whistleblower: Report Resource Cartel',
    tier: 3,
    wave: 2,
    objective: 'Privately alert the Department of Commerce desk about an undisclosed 150+ unit resource hoard or illegal price manipulation ring. Claim your civic bounty.',
    verification_method: 'station_checkin',
    station_id: 'government',
    completion_rule: 'station_id = government',
    reward_vb: 1600,
    is_secret: true,
  },
  {
    id: 'spy_poach_engineer',
    title: '[CLASSIFIED] Corporate Headhunting: Engineer Defection',
    tier: 3,
    wave: 2,
    objective: 'Undercover operation: Persuade the Lead Systems Engineer or Data Scientist of a rival venture to defect or sign an exclusive advisory agreement.',
    verification_method: 'counterparty_code',
    completion_rule: 'counterparty_code_valid',
    reward_vb: 2200,
    is_secret: true,
  },
  {
    id: 'spy_shadow_arbitrage',
    title: '[CLASSIFIED] Black Market Commodity Arbitrage',
    tier: 3,
    wave: 2,
    objective: 'Off-the-books trade: Covertly acquire wholesale materials and broker them directly to an embargoed venture at a 25% premium without Bank registration.',
    verification_method: 'counterparty_code',
    completion_rule: 'counterparty_code_valid',
    reward_vb: 2400,
    is_secret: true,
  },
  {
    id: 'spy_insider_frontrun',
    title: '[CLASSIFIED] Insider Intel: Crisis Front-Running',
    tier: 3,
    wave: 2,
    objective: 'Acquire advance intel on an impending macro supply shock and position your personal holdings before the public announcement breaks.',
    verification_method: 'scan_token',
    completion_rule: 'token_verified',
    reward_vb: 1750,
    is_secret: true,
  },
  {
    id: 'spy_mole_uncover',
    title: '[CONFIDENTIAL] Counter-Espionage: Unmask the Mole',
    tier: 4,
    wave: 3,
    objective: 'Identify an internal team member leaking proprietary data to competitors and present conclusive evidence to the Founder Desk or Station Observer.',
    verification_method: 'station_checkin',
    station_id: 'investor',
    completion_rule: 'mole_unmasked',
    reward_vb: 2500,
    is_secret: true,
  },
];

// VENTURE PROFILES FOR INTELLIGENT MISSION TAILORING
export const VENTURE_PROFILES: Record<string, { name: string; sector: string; rivals: string[] }> = {
  comp_swiftcart: { name: 'SwiftCart', sector: 'Quick Commerce & Logistics (Physical)', rivals: ['comp_voltway', 'comp_harvestloop', 'comp_mango'] },
  comp_ledgerly: { name: 'Ledgerly', sector: 'Payments & Merchant Capital (Digital/Regulated)', rivals: ['comp_trustlayer', 'comp_stackhouse', 'comp_pulseai'] },
  comp_mango: { name: 'Mango & Co.', sector: 'Consumer Brand & Lifestyle (Physical)', rivals: ['comp_forgeline', 'comp_harvestloop', 'comp_swiftcart'] },
  comp_skillforge: { name: 'SkillForge', sector: 'EdTech Bootcamps & Placement (Digital)', rivals: ['comp_pulseai', 'comp_stackhouse', 'comp_mango'] },
  comp_pulseai: { name: 'PulseAI', sector: 'Business AI & Forecasting (Digital)', rivals: ['comp_stackhouse', 'comp_ledgerly', 'comp_trustlayer'] },
  comp_greengrid: { name: 'GreenGrid', sector: 'Clean Energy & Storage (Physical/Regulated)', rivals: ['comp_stackhouse', 'comp_voltway', 'comp_forgeline'] },
  comp_medilink: { name: 'MediLink', sector: 'Telehealth & Pharmacy (Digital/Regulated)', rivals: ['comp_pulseai', 'comp_trustlayer', 'comp_swiftcart'] },
  comp_harvestloop: { name: 'HarvestLoop', sector: 'Farm-to-Business Bio-Materials (Physical)', rivals: ['comp_mango', 'comp_swiftcart', 'comp_forgeline'] },
  comp_stackhouse: { name: 'StackHouse', sector: 'Cloud Compute & Data Centre (Digital)', rivals: ['comp_greengrid', 'comp_pulseai', 'comp_trustlayer'] },
  comp_voltway: { name: 'Voltway', sector: 'Electric Fleet Mobility (Physical)', rivals: ['comp_swiftcart', 'comp_greengrid', 'comp_harvestloop'] },
  comp_forgeline: { name: 'Forgeline', sector: 'Contract Manufacturing (Physical)', rivals: ['comp_harvestloop', 'comp_mango', 'comp_greengrid'] },
  comp_trustlayer: { name: 'TrustLayer', sector: 'Cybersecurity & Compliance (Digital/Regulated)', rivals: ['comp_ledgerly', 'comp_medilink', 'comp_stackhouse'] },
};

export class MissionAutomationEngine {
  /**
   * Automatically generates and assigns role-tailored and company-specific missions
   * across waves and difficulty tiers.
   */
  static async autoAssignAllMissions(options: {
    cleanExisting?: boolean;
    missionsPerParticipant?: number;
  } = {}): Promise<{
    participantsAssigned: number;
    missionsCreated: number;
    instancesAssigned: number;
    breakdownByRole: Record<string, number>;
  }> {
    const { cleanExisting = false, missionsPerParticipant = 10 } = options;

    return await withTransaction(async (client) => {
      if (cleanExisting) {
        await client.query("DELETE FROM mission_instances WHERE status = 'available'");
      }

      // Fetch all active participants with their company and role
      const partsRes = await client.query(`
        SELECT p.id, p.citizen_code, p.name, p.role as user_role,
               m.company_id, m.role as company_role, c.name as company_name
        FROM participants p
        LEFT JOIN memberships m ON p.id = m.participant_id AND m.status = 'active'
        LEFT JOIN companies c ON m.company_id = c.id
        WHERE p.status = 'active'
        ORDER BY p.citizen_code ASC
      `);

      const participants = partsRes.rows;
      let missionsCreated = 0;
      let instancesAssigned = 0;
      const breakdownByRole: Record<string, number> = {};

      for (const p of participants) {
        // Determine role category
        let effectiveRole = p.company_role || (p.user_role === 'company_lead' ? 'Founder & CEO' : 'Independent Free Agent');

        // Normalize if necessary to match available template keys
        if (!ROLE_MISSION_TEMPLATES[effectiveRole]) {
          // If specific role contains keywords, map smartly
          const rLow = (p.company_role || '').toLowerCase();
          if (rLow.includes('founder') || rLow.includes('ceo')) effectiveRole = 'Founder & CEO';
          else if (rLow.includes('cto') || rLow.includes('tech') || rLow.includes('architect') || rLow.includes('engineer')) effectiveRole = 'Lead Systems Engineer';
          else if (rLow.includes('product') || rLow.includes('designer') || rLow.includes('curriculum')) effectiveRole = 'Head of Product';
          else if (rLow.includes('ops') || rLow.includes('operations') || rLow.includes('dispatch') || rLow.includes('logistics') || rLow.includes('plant')) effectiveRole = 'Supply Operations Lead';
          else if (rLow.includes('growth') || rLow.includes('sales') || rLow.includes('commercial') || rLow.includes('partner') || rLow.includes('placement')) effectiveRole = 'Growth & Partnerships';
          else if (rLow.includes('finance') || rLow.includes('cfo') || rLow.includes('treasury') || rLow.includes('capital') || rLow.includes('compliance')) effectiveRole = 'CFO & General Counsel';
          else if (rLow.includes('research') || rLow.includes('scientist') || rLow.includes('data') || rLow.includes('analyst')) effectiveRole = 'Lead Data Scientist';
          else effectiveRole = p.user_role === 'company_lead' ? 'Founder & CEO' : 'Independent Free Agent';
        }

        breakdownByRole[effectiveRole] = (breakdownByRole[effectiveRole] || 0) + 1;

        // Resolve venture profile and designate rival venture
        const myVenture = (p.company_id && VENTURE_PROFILES[p.company_id])
          ? VENTURE_PROFILES[p.company_id]
          : { name: p.company_name || 'Independent Free Agent', sector: 'Autonomous Commerce', rivals: ['comp_voltway', 'comp_swiftcart', 'comp_forgeline'] };

        const rivalId = myVenture.rivals[Math.floor(Math.random() * myVenture.rivals.length)] || 'comp_voltway';
        const rivalVenture = VENTURE_PROFILES[rivalId] || { name: 'Voltway', sector: 'Electric Fleet Mobility' };

        // Get role templates
        const roleTemplates = [...(ROLE_MISSION_TEMPLATES[effectiveRole] || ROLE_MISSION_TEMPLATES['Independent Free Agent'])];
        roleTemplates.sort(() => Math.random() - 0.5);

        // Pick 8 or 9 role missions
        const selectedMissions: { template: RoleMissionDefinition; isSecret: boolean }[] = [];
        const roleCount = missionsPerParticipant >= 10 ? 8 : missionsPerParticipant - 1;

        for (let i = 0; i < Math.min(roleCount, roleTemplates.length); i++) {
          selectedMissions.push({ template: roleTemplates[i], isSecret: false });
        }

        // Add 1 or 2 SPICY / SECRET MISSIONS
        const spicyCount = missionsPerParticipant - selectedMissions.length;
        const spicyShuffled = [...SPICY_SECRET_MISSIONS].sort(() => Math.random() - 0.5);

        for (let s = 0; s < spicyCount && s < spicyShuffled.length; s++) {
          selectedMissions.push({ template: spicyShuffled[s], isSecret: true });
        }

        // Now upsert into missions and assign mission_instances for this participant
        for (let idx = 0; idx < selectedMissions.length; idx++) {
          const { template, isSecret } = selectedMissions[idx];

          // Generate unique verification handshake code
          const verSecret = (template.verification_method === 'counterparty_code' || template.verification_method === 'scan_token')
            ? `CP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
            : null;

          // Personalize title and objective
          let tailoredTitle = template.title;
          let tailoredObjective = template.objective;

          if (isSecret) {
            tailoredTitle = tailoredTitle
              .replace(/a rival venture/gi, rivalVenture.name)
              .replace(/competitor’s/gi, `${rivalVenture.name}'s`)
              .replace(/competitors/gi, rivalVenture.name);

            tailoredObjective = tailoredObjective
              .replace(/a rival venture/gi, rivalVenture.name)
              .replace(/a competitor’s/gi, `${rivalVenture.name}'s`)
              .replace(/competitors/gi, rivalVenture.name)
              .replace(/your company’s/gi, `${myVenture.name}'s`);

            if (verSecret) {
              tailoredObjective += ` [Secret Target: ${rivalVenture.name} | Handshake Verification Code: ${verSecret} or transfer minimum 100 VB to counterparty to verify]`;
            }
          } else {
            if (p.company_name && !tailoredTitle.includes(p.company_name)) {
              tailoredTitle = `${p.company_name}: ${tailoredTitle}`;
            }
            if (p.company_name) {
              tailoredObjective = tailoredObjective.replace(/the company/gi, p.company_name);
            }
            if (verSecret) {
              tailoredObjective += ` [Verification Handshake Code: ${verSecret}]`;
            }
          }

          // Unique mission ID per participant
          const mId = `msn_${template.id}_${p.id}_${idx + 1}`;

          // Upsert mission with verification_secret
          await client.query(`
            INSERT INTO missions (
              id, title, tier, wave, objective, verification_method, completion_rule,
              reward_vb, reward_resources, claim_limit, station_id, is_secret, secret_participant_id, verification_secret, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb, 1, $9, $10, $11, $12, TRUE)
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              objective = EXCLUDED.objective,
              verification_method = EXCLUDED.verification_method,
              completion_rule = EXCLUDED.completion_rule,
              reward_vb = EXCLUDED.reward_vb,
              station_id = EXCLUDED.station_id,
              is_secret = EXCLUDED.is_secret,
              secret_participant_id = EXCLUDED.secret_participant_id,
              verification_secret = EXCLUDED.verification_secret
          `, [
            mId,
            tailoredTitle,
            template.tier,
            template.wave,
            tailoredObjective,
            template.verification_method,
            template.completion_rule,
            template.reward_vb,
            template.station_id || null,
            isSecret,
            p.id,
            verSecret,
          ]);
          missionsCreated++;

          // Create mission instance for participant in 'in_progress' status
          const instId = `inst_${mId}_${p.id}`;
          const insRes = await client.query(`
            INSERT INTO mission_instances (
              id, mission_id, participant_id, status, reward_vb_paid, started_at, created_at
            ) VALUES ($1, $2, $3, 'in_progress', 0, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
          `, [instId, mId, p.id]);

          if ((insRes.rowCount ?? 0) > 0) {
            instancesAssigned++;
          }
        }
      }

      // Log GM Audit entry
      const auditId = `aud_msn_auto_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await client.query(`
        INSERT INTO audit_log (
          id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
        ) VALUES ($1, NOW(), 'system', 'gm', 'AUTO_ASSIGN_MISSIONS', 'missions', 'all',
          $2, 'automation_runner')
      `, [auditId, `Auto-assigned 10 dynamic company & role missions per citizen across ${participants.length} participants`]);

      return {
        participantsAssigned: participants.length,
        missionsCreated,
        instancesAssigned,
        breakdownByRole,
      };
    });
  }
}
