'use client';

import React, { useState } from 'react';
import {
  FileText,
  Shield,
  Building2,
  Briefcase,
  Target,
  Users,
  Coins,
  Cpu,
  Zap,
  Globe,
  Lock,
  ChevronRight,
  X,
  Sparkles,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';

export const COMPANY_DOSSIERS: Record<
  string,
  {
    name: string;
    industry: string;
    tagline: string;
    overview: string;
    coreTech: string[];
    primaryClients: string;
    strategicGoal: string;
    rivals: string[];
  }
> = {
  comp_swiftcart: {
    name: 'SwiftCart',
    industry: 'Quick Commerce & Fleet Capacity',
    tagline: '30-minute consumer grocery delivery and last-mile fleet capacity',
    overview:
      'SwiftCart operates dark-store networks and rapid last-mile courier logistics across Venture City, selling both direct consumer delivery and spare delivery runs to other enterprises.',
    coreTech: ['Dynamic Dispatch Engine', 'Cold-Chain Delivery Pods', 'Dark-Store Micro-Fulfillment'],
    primaryClients: 'Urban consumers, Pharmaceutical distributors, Fresh grocery brands',
    strategicGoal: 'Secure cold-chain delivery permit from City Government and expand dark-store footprint.',
    rivals: ['Voltway', 'HarvestLoop'],
  },
  comp_ledgerly: {
    name: 'Ledgerly',
    industry: 'Merchant Payments & Small-Business Capital',
    tagline: 'Payment rails, merchant working capital advances, and transaction intel',
    overview:
      'Ledgerly powers point-of-sale payment clearing, micro-advances for growing city businesses, and merchant telemetry data feeds.',
    coreTech: ['High-throughput Payment Switch', 'Automated Underwriting Engine', 'Real-time Settlement Rails'],
    primaryClients: 'City merchants, Retail chains, Digital service platforms',
    strategicGoal: 'Acquire regulatory payment licence from Commerce Department and expand partner rails.',
    rivals: ['TrustLayer', 'PulseAI'],
  },
  comp_mango: {
    name: 'Mango & Co.',
    industry: 'Consumer Brand: Mango Foods & Lifestyle Goods',
    tagline: 'Premium consumer food, beverage, and lifestyle community products',
    overview:
      'Mango & Co. transforms regional fruit harvests into premium consumer packaged goods, supported by an impassioned brand community.',
    coreTech: ['Small-Batch Aseptic Packaging', 'Direct-to-Consumer Community Flywheel', 'Flavor Matrix Formulation'],
    primaryClients: 'Urban retail consumers, Specialty grocers, Lifestyle outlets',
    strategicGoal: 'Attain Food Safety Certification from Government and close retail-chain enterprise distribution.',
    rivals: ['HarvestLoop', 'SwiftCart'],
  },
  comp_skillforge: {
    name: 'SkillForge',
    industry: 'Technical Bootcamps & Placement Marketplace',
    tagline: 'Accelerated technical skilling and enterprise placement of trained hires',
    overview:
      'SkillForge trains and matches high-caliber engineering, operational, and data talent directly into Venture City enterprises.',
    coreTech: ['Skill Competency Diagnostic Engine', 'Accelerated Immersive Curriculum', 'Employer Matching Pipeline'],
    primaryClients: 'Deep tech ventures, Corporate IT departments, Ambitious citizens',
    strategicGoal: 'Secure official course accreditation from City Commerce and win enterprise talent tenders.',
    rivals: ['PulseAI', 'StackHouse'],
  },
  comp_pulseai: {
    name: 'PulseAI',
    industry: 'Business AI Software: Forecasting & Analytics',
    tagline: 'Predictive analytics, demand forecasting, and operational modeling',
    overview:
      'PulseAI trains custom enterprise intelligence models that predict demand spikes, resource consumption, and market price movements.',
    coreTech: ['Dynamic Time-Series Transformer', 'Probabilistic Inventory Modeler', 'Autonomous Forecasting API'],
    primaryClients: 'Enterprise procurement desks, Supply chain operators, Reserve banks',
    strategicGoal: 'Complete 2 customer pilots to unlock premium Enterprise analytics contracts.',
    rivals: ['StackHouse', 'Ledgerly'],
  },
  comp_greengrid: {
    name: 'GreenGrid',
    industry: 'Climate & Clean Energy: Solar-Battery Retrofits',
    tagline: 'Solar-plus-battery grid energy supply and corporate energy efficiency retrofits',
    overview:
      'GreenGrid generates clean power from solar and battery assets, selling long-term power purchase agreements and microgrid connections.',
    coreTech: ['Bifacial Solar Tracking', 'Containerized LFP Battery Storage', 'Smart Inverter Microgrid Dispatch'],
    primaryClients: 'High-compute datacenters, Industrial factories, Municipal grid infrastructure',
    strategicGoal: 'Sign 2 offtake agreements to unlock Apex Reserve Bank project financing.',
    rivals: ['StackHouse', 'Voltway'],
  },
  comp_medilink: {
    name: 'MediLink',
    industry: 'Digital Health & Telepharmacy Marketplace',
    tagline: 'Telehealth consultations, automated prescription pharmacy, and health telemetry',
    overview:
      'MediLink connects licensed physicians and diagnostic pharmacies with citizens, delivering rapid prescription medicines across the city.',
    coreTech: ['HIPAA-Compliant Encrypted Telehealth', 'Automated Dispensing Telemetry', 'Clinical Provider Directory'],
    primaryClients: 'Citizens, Enterprise employers, Municipal health authorities',
    strategicGoal: 'Complete 3 verified clinic deliveries to unlock Enterprise Hospital procurement contracts.',
    rivals: ['PulseAI', 'TrustLayer'],
  },
  comp_harvestloop: {
    name: 'HarvestLoop',
    industry: 'AgriTech: Farm-to-Business Grower Network',
    tagline: 'Fresh farm produce, organic supplies, and bio-material feedstocks',
    overview:
      'HarvestLoop aggregates fresh produce and bio-materials directly from regional farm networks, cutting middleman costs for urban businesses.',
    coreTech: ['Cold-Storage Aggregation Logistics', 'Grower Quality Verification Mesh', 'Dynamic Perishable Pricing'],
    primaryClients: 'Food manufacturers, Consumer brands, Urban grocery cooperatives',
    strategicGoal: 'Obtain Food Safety Certification from Government to unlock direct consumer and export sales.',
    rivals: ['Mango & Co.', 'SwiftCart'],
  },
  comp_stackhouse: {
    name: 'StackHouse',
    industry: 'Cloud Infrastructure & Data-Centre Hosting',
    tagline: 'High-density compute hosting and colocation from proprietary data centres',
    overview:
      'StackHouse operates server halls and high-density compute infrastructure, supplying reliable compute slots to AI and software platforms.',
    coreTech: ['Liquid-Cooled Server Racks', 'N+1 Redundant Power Distribution', 'Direct Fiber Interconnects'],
    primaryClients: 'AI model developers, Financial tech networks, SaaS ventures',
    strategicGoal: 'Achieve 3 ticks of unbroken uptime delivery to secure Enterprise hosting buyers.',
    rivals: ['PulseAI', 'GreenGrid'],
  },
  comp_voltway: {
    name: 'Voltway',
    industry: 'Commercial Mobility & Electric Fleet Capacity',
    tagline: 'Electric vans and drivers by the tick, commercial logistics and consumer rides',
    overview:
      'Voltway manages a fleet of commercial electric vans, supplying dedicated transport capacity and consumer mobility across Venture City.',
    coreTech: ['Fleet Telematics & Battery Health', 'Automated Charging Scheduling', 'Dynamic Route Dispatch'],
    primaryClients: 'Delivery ventures, Corporate passenger transport, Urban commuters',
    strategicGoal: 'Obtain Transport Operating Permit from City Department of Commerce to open Consumer Rides.',
    rivals: ['SwiftCart', 'GreenGrid'],
  },
  comp_forgeline: {
    name: 'Forgeline',
    industry: 'Contract Manufacturing & Assembly Lines',
    tagline: 'Precision contract manufacturing runs for physical products and hardware',
    overview:
      'Forgeline operates high-throughput factory lines for assembly, packaging, and hardware fabrication for physical ventures.',
    coreTech: ['Modular Assembly Tooling', 'Computer Vision Quality Inspection', 'Rapid Tooling Reconfiguration'],
    primaryClients: 'Physical hardware brands, Consumer packaged goods, Clean energy manufacturers',
    strategicGoal: 'Pass first batch inspection with Customer Procurement Desk to unlock Enterprise bulk orders.',
    rivals: ['HarvestLoop', 'Mango & Co.'],
  },
  comp_trustlayer: {
    name: 'TrustLayer',
    industry: 'Cybersecurity Audits & Compliance Software',
    tagline: 'Security audits, continuous monitoring, and official compliance attestations',
    overview:
      'TrustLayer provides automated security scanning, code auditing, and compliance attestations required by regulated institutions.',
    coreTech: ['Static Binary Code Analyzer', 'Continuous Intrusion Detection Engine', 'Cryptographic Proof of Compliance'],
    primaryClients: 'Fintech platforms, Health networks, Regulated digital infrastructure',
    strategicGoal: 'Obtain Approved Auditor status from City Commerce to issue binding compliance certifications.',
    rivals: ['Ledgerly', 'StackHouse'],
  },
};

export const ROLE_OPERATIONAL_DIRECTIVES: Record<string, { summary: string; responsibilities: string[] }> = {
  'Founder & CEO': {
    summary: 'Executive leadership, cap table sovereignty, institutional fundraising, and high-stakes negotiation.',
    responsibilities: [
      'Represent the venture at the Frontier Venture Syndicate desk for equity financing.',
      'Maintain adequate treasury runway and disburse tick payroll to preserve team morale.',
      'Sign high-value Anchor Procurement agreements with Enterprise Customers.',
      'Lead crisis response actions when macroeconomic shocks hit the city.',
    ],
  },
  'Co-Founder & CTO': {
    summary: 'Technical architecture, computing infrastructure, patents, and system resilience.',
    responsibilities: [
      'Procure compute and clean energy resources to maintain core system operations.',
      'Architect proprietary tech blueprints and protect against hostile IP theft.',
      'Verify technical milestones on anchor contracts and prototype fabrication.',
      'Evaluate inter-venture technical partnerships and cross-licensing pacts.',
    ],
  },
  'Head of Product': {
    summary: 'Commercial delivery, anchor contract milestone execution, and customer success.',
    responsibilities: [
      'Meet Enterprise Customer desk representatives to negotiate custom project milestones.',
      'Align engineering specifications with client requirements to prevent contract disputes.',
      'Ensure deliverable quality and trigger milestone payment releases.',
      'Conduct market competitor analysis to defend product pricing power.',
    ],
  },
  'Lead Systems Engineer': {
    summary: 'Infrastructure integration, system hardware compliance, and reliability engineering.',
    responsibilities: [
      'Interface with Prime Supplier Market to source precision hardware components.',
      'Verify Department of Commerce safety and regulatory standards for production equipment.',
      'Conduct stress-testing and fault recovery drills during grid disruptions.',
      'Manage tooling tokens and instrument physical deployment stations.',
    ],
  },
  'Lead Data Scientist': {
    summary: 'Algorithmic models, data analytics pipelines, and economic intelligence.',
    responsibilities: [
      'Analyze commodity price trends across ticks to advise treasury purchases.',
      'Train predictive models using high-frequency city telemetry feeds.',
      'Audit cap table dilution and financial return projections.',
      'Safeguard proprietary datasets against competitor extraction.',
    ],
  },
  'Hardware Architect': {
    summary: 'Physical hardware engineering, prototyping, and material fabrication.',
    responsibilities: [
      'Procure composite raw materials from wholesale supplier desks.',
      'Assemble and test physical hardware prototypes for investor demonstrations.',
      'Manage tooling calibration and equipment salvage during component shortages.',
      'Maintain factory floor safety certification with city regulators.',
    ],
  },
  'Supply Operations Lead': {
    summary: 'Supply chain management, wholesale discounts, and freight coordination.',
    responsibilities: [
      'Secure 10% wholesale volume discounts at Prime Supplier Market desks.',
      'Maintain balanced buffer stocks across all 6 core simulation commodities.',
      'Book intermodal transport capacity with Swift Logistics to avoid delivery bottlenecks.',
      'Execute secondary-market commodity sales when surplus inventory accumulates.',
    ],
  },
  'VP of Commercialization': {
    summary: 'Revenue expansion, strategic channel partnerships, and market capture.',
    responsibilities: [
      'Structure bilateral revenue-sharing agreements with complementary ventures.',
      'Pitch featured promotional slots to Daily Chronicle media broadcasters.',
      'Identify tender opportunities issued by the Department of Commerce.',
      'Broker freelance and specialist advisory contracts across the trading floor.',
    ],
  },
  'Growth & Partnerships': {
    summary: 'Ecosystem development, talent recruiting, and public relations.',
    responsibilities: [
      'Recruit elite specialist contractors from the Talent Exchange desk.',
      'Coordinate co-marketing and joint venture alliances with peer companies.',
      'Manage stakeholder communications during market disruption announcements.',
      'Represent company interests in civic council consultations.',
    ],
  },
  'Independent Free Agent': {
    summary: 'Specialist advisory, mercenary consulting, and independent venture incubation.',
    responsibilities: [
      'Monetize specialized expertise by pitching consulting gigs to active ventures.',
      'Broker information arbitrage and confidential deal transactions.',
      'Accumulate personal VB capital to incorporate a future spin-out company.',
      'Accept covert intelligence dockets from institutional or private counterparties.',
    ],
  },
};

export function ParticipantDossierModal({
  isOpen,
  onClose,
  participant,
}: {
  isOpen: boolean;
  onClose: () => void;
  participant: any;
}) {
  const [activeTab, setActiveTab] = useState<'venture' | 'role' | 'intel'>('venture');

  if (!isOpen || !participant) return null;

  const companyId = participant.companyId || participant.company?.id;
  const companyDossier = (companyId && COMPANY_DOSSIERS[companyId]) || {
    name: participant.company?.name || 'Independent Free Agent',
    industry: 'Specialist Advisory & Independent Commerce',
    tagline: 'Autonomous economic operator navigating the Venture City ecosystem',
    overview:
      'Independent citizens operate as specialist contractors, technical advisors, and market brokers with complete flexibility to contract with any operating venture.',
    coreTech: ['Specialist Advisory', 'Market Arbitrage', 'Cross-Venture Brokerage'],
    primaryClients: 'All active ventures, Civic institutions, Private syndicates',
    strategicGoal: 'Maximize personal ledger balance and position for key contract bids.',
    rivals: ['Other Free Agents'],
  };

  const role =
    participant.companyRole ||
    (participant.role === 'company_lead' ? 'Founder & CEO' : 'Independent Free Agent');

  const roleDirectives = ROLE_OPERATIONAL_DIRECTIVES[role] || {
    summary: `Operational duties for assigned designation: ${role}.`,
    responsibilities: [
      'Execute company strategic directives and maintain cross-functional alignment.',
      'Engage with relevant institution desks to secure resources and clearances.',
      'Protect internal company assets and execute assigned mission dockets.',
    ],
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-[#070b16] border border-vc-gold/40 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl font-mono text-xs overflow-hidden">
        {/* Header */}
        <div className="bg-[#030610] border-b border-gray-800 p-4 sm:p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-vc-gold/10 border border-vc-gold/40 flex items-center justify-center text-vc-gold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-vc-gold/20 text-vc-gold border border-vc-gold/40 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  CLASSIFIED DOSSIER
                </span>
                <span className="text-[10px] text-gray-500 font-bold">
                  CLEARANCE TIER {participant.role === 'company_lead' ? 'LEVEL-4 (EXECUTIVE)' : 'LEVEL-2 (OPERATOR)'}
                </span>
              </div>
              <h2 className="text-lg font-syne font-black text-white mt-1">
                {participant.name} · <span className="text-vc-gold">{participant.citizenCode}</span>
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800 bg-black/40 px-4">
          <button
            onClick={() => setActiveTab('venture')}
            className={`py-3 px-4 font-bold border-b-2 text-xs transition-colors flex items-center gap-2 ${
              activeTab === 'venture'
                ? 'border-vc-gold text-vc-gold'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Assigned Venture</span>
          </button>
          <button
            onClick={() => setActiveTab('role')}
            className={`py-3 px-4 font-bold border-b-2 text-xs transition-colors flex items-center gap-2 ${
              activeTab === 'role'
                ? 'border-vc-gold text-vc-gold'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Role Directives</span>
          </button>
          <button
            onClick={() => setActiveTab('intel')}
            className={`py-3 px-4 font-bold border-b-2 text-xs transition-colors flex items-center gap-2 ${
              activeTab === 'intel'
                ? 'border-vc-gold text-vc-gold'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>City Competitor Intel</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-gray-300">
          {activeTab === 'venture' && (
            <div className="space-y-4">
              <div className="p-4 bg-black/40 border border-gray-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-vc-gold uppercase font-bold tracking-wider">
                    {companyDossier.industry}
                  </span>
                  {participant.company?.balance !== undefined && (
                    <span className="text-xs text-vc-emerald font-bold">
                      Runway Vault: {participant.company.balance.toLocaleString()} VB
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-syne font-black text-white">{companyDossier.name}</h3>
                <p className="text-xs text-gray-400 italic font-mono">&ldquo;{companyDossier.tagline}&rdquo;</p>
                <p className="text-xs text-gray-300 pt-2 leading-relaxed">{companyDossier.overview}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-black/30 border border-gray-800/80 rounded-lg space-y-1.5">
                  <div className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1.5">
                    <Cpu className="w-3 h-3 text-vc-blue" />
                    <span>Proprietary Capabilities</span>
                  </div>
                  <ul className="space-y-1 text-xs">
                    {companyDossier.coreTech.map((tech: string, i: number) => (
                      <li key={i} className="flex items-center gap-1.5 text-gray-300">
                        <span className="text-vc-gold text-[10px]">■</span> {tech}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-black/30 border border-gray-800/80 rounded-lg space-y-1.5">
                  <div className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1.5">
                    <Target className="w-3 h-3 text-vc-rose" />
                    <span>Target Customer Segments</span>
                  </div>
                  <p className="text-xs text-gray-300">{companyDossier.primaryClients}</p>
                </div>
              </div>

              <div className="p-3.5 bg-vc-gold/5 border border-vc-gold/30 rounded-lg space-y-1">
                <div className="text-[10px] text-vc-gold uppercase font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Primary Venture Objective</span>
                </div>
                <p className="text-xs text-gray-200">{companyDossier.strategicGoal}</p>
              </div>
            </div>
          )}

          {activeTab === 'role' && (
            <div className="space-y-4">
              <div className="p-4 bg-black/40 border border-gray-800 rounded-xl space-y-2">
                <div className="text-[10px] text-vc-gold uppercase font-bold">YOUR DESIGNATION BRIEFING</div>
                <h3 className="text-lg font-syne font-black text-white">{role}</h3>
                <p className="text-xs text-gray-300 leading-relaxed">{roleDirectives.summary}</p>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Core Operational Directives:
                </div>
                <div className="space-y-2">
                  {roleDirectives.responsibilities.map((resp, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-black/30 border border-gray-800 rounded-lg flex items-start gap-2.5"
                    >
                      <CheckCircle className="w-4 h-4 text-vc-emerald shrink-0 mt-0.5" />
                      <span className="text-xs text-gray-200">{resp}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-black/40 border border-gray-800 rounded-lg text-xs text-gray-400">
                <strong className="text-white">Directive Note:</strong> All role actions are evaluated in live simulation scoring. Ensure alignment with your company founder before committing treasury funds.
              </div>
            </div>
          )}

          {activeTab === 'intel' && (
            <div className="space-y-3">
              <div className="text-xs text-gray-400">
                Classified competitor overview across the 10 active corporate ventures in Venture City:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Object.entries(COMPANY_DOSSIERS).map(([cId, cData]) => {
                  const isOwn = cId === companyId;
                  return (
                    <div
                      key={cId}
                      className={`p-3 rounded-lg border text-xs space-y-1 ${
                        isOwn
                          ? 'bg-vc-gold/10 border-vc-gold/40 text-white'
                          : 'bg-black/30 border-gray-800 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <strong className="font-syne text-white text-xs">{cData.name}</strong>
                        {isOwn && (
                          <span className="text-[9px] bg-vc-gold text-black font-bold px-1.5 py-0.5 rounded uppercase">
                            YOUR VENTURE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400">{cData.industry}</div>
                      <div className="text-[11px] text-gray-400 line-clamp-2">{cData.strategicGoal}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#030610] border-t border-gray-800 flex items-center justify-between">
          <div className="text-[10px] text-gray-500 font-mono">
            CONFIDENTIAL BRIEFING · DO NOT DISCLOSE TO RIVALS
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 rounded font-bold transition-colors"
            >
              Close Dossier
            </button>
            <Link
              href="/portal/missions"
              onClick={onClose}
              className="px-4 py-2 bg-vc-gold hover:bg-yellow-400 text-black font-syne font-bold rounded flex items-center gap-1.5 transition-all shadow"
            >
              <span>Deploy to Missions</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
