import { pool, withTransaction } from '../src/lib/db';
import { MissionAutomationEngine } from '../src/lib/missions/automation';

export const COMPANY_SPECIFIC_ROLES: Record<string, string[]> = {
  comp_swiftcart: [
    'Founder & CEO',
    'Head of Dark Store Operations',
    'Fleet Dispatch & Last-Mile Lead',
    'Cold-Chain Logistics Specialist',
    'Merchant Catalog Manager',
    'Rapid Fulfillment Supervisor',
    'Consumer Growth Lead',
    'Courier Operations Specialist',
    'Warehouse Inventory Associate',
  ],
  comp_ledgerly: [
    'Founder & CEO',
    'Chief Payments Rails Architect',
    'Merchant Working Capital Lead',
    'Regulatory Compliance & AML Officer',
    'Underwriting Risk Analyst',
    'Terminal Integration Specialist',
    'Institutional Treasury Lead',
    'Fraud Prevention Specialist',
    'Fintech Settlements Associate',
  ],
  comp_mango: [
    'Founder & CEO',
    'Creative Director & Brand Lead',
    'Packaging & Food Formulation Specialist',
    'Retail Distribution & Merchandising Director',
    'Food Safety Compliance Officer',
    'Community & Influencer Lead',
    'Omnichannel Supply Coordinator',
    'D2C Growth Lead',
    'Brand Operations Associate',
  ],
  comp_skillforge: [
    'Founder & CEO',
    'Head of Curriculum & Technical Dean',
    'Enterprise Placement Director',
    'Corporate Talent Partnerships Lead',
    'Admissions & Candidate Screener',
    'Career Success Coach',
    'Immersive Bootcamp Instructor',
    'Talent Assessment Coordinator',
    'Student Operations Associate',
  ],
  comp_pulseai: [
    'Founder & CEO',
    'Principal ML Research Scientist',
    'Forecasting Model Architect',
    'High-Throughput Compute Ops Lead',
    'Enterprise Pilot Director',
    'Time-Series Analytics Engineer',
    'Quantitative Solution Architect',
    'Model Reliability Specialist',
    'Data Pipeline Associate',
  ],
  comp_greengrid: [
    'Founder & CEO',
    'Grid Connection & Interconnection Engineer',
    'Battery Storage System Architect',
    'Corporate Offtake & PPA Negotiator',
    'Renewable Permitting & Subsidy Lead',
    'Commercial Retrofit Project Manager',
    'Energy Microgrid Dispatcher',
    'Environmental Compliance Officer',
    'Solar Field Operations Associate',
  ],
  comp_medilink: [
    'Founder & CEO',
    'Chief Medical Informatics Officer',
    'Telepharmacy Fulfillment Director',
    'Healthcare Privacy & HIPAA Compliance Lead',
    'Clinical Provider Network Lead',
    'Hospital Enterprise Account Director',
    'Telehealth Triage Coordinator',
    'Medical Data Security Analyst',
    'Clinical Operations Associate',
  ],
  comp_harvestloop: [
    'Founder & CEO',
    'Grower Network Relations Director',
    'Regional Produce Aggregation Lead',
    'Cold-Storage Warehouse Supervisor',
    'Traceability & Organic Standards Inspector',
    'Wholesale B2B Account Manager',
    'Farm Fleet Logistics Coordinator',
    'Bio-Materials Sourcing Specialist',
    'Grower Intake Associate',
  ],
  comp_stackhouse: [
    'Founder & CEO',
    'Data Centre Facilities Director',
    'Site Reliability & Power Engineer',
    'Server Colocation Architect',
    'Cooling & Thermal Efficiency Specialist',
    'Enterprise Hosting Solutions Director',
    'Fiber Interconnect Network Engineer',
    '24/7 Server Hall Duty Engineer',
    'Data Hall Infrastructure Associate',
  ],
  comp_voltway: [
    'Founder & CEO',
    'Electric Van Fleet Operations Director',
    'Charging Hub Infrastructure Lead',
    'Telematics & Diagnostics Engineer',
    'Commercial Ride Logistics Director',
    'Municipal Mobility Permitting Lead',
    'Driver Community Supervisor',
    'EV Battery Health Technician',
    'Depot Maintenance Associate',
  ],
  comp_forgeline: [
    'Founder & CEO',
    'Factory Line Production Superintendent',
    'Tooling & Precision Fabrication Lead',
    'Raw Materials Procurement Director',
    'Quality Assurance & Tolerance Inspector',
    'Enterprise Bulk Manufacturing Lead',
    'Industrial Automation Robotics Specialist',
    'Plant Safety & Shift Coordinator',
    'Manufacturing Line Associate',
  ],
  comp_trustlayer: [
    'Founder & CEO',
    'Principal Security Auditor & Pen-Tester',
    'Threat Detection Engine Lead',
    'Government Regulatory Attestation Specialist',
    'Cryptographic Protocols Engineer',
    'Security Operations Center Lead',
    'Enterprise Vulnerability Assessor',
    'Compliance Reporting Officer',
    'Security Audit Associate',
  ],
};

async function assignRolesAndMissions() {
  console.log('--- Assigning Tailored Domain Roles to All 12 Companies ---');

  await withTransaction(async (client) => {
    // 1. Fetch companies
    const compRes = await client.query('SELECT id FROM companies ORDER BY id ASC');
    const compIds = compRes.rows.map((r) => r.id);

    for (const compId of compIds) {
      const rolesList = COMPANY_SPECIFIC_ROLES[compId] || [
        'Founder & CEO',
        'Head of Product',
        'Lead Systems Engineer',
        'Supply Operations Lead',
        'Growth & Partnerships',
        'CFO & General Counsel',
        'Specialist Operator',
        'Generalist Associate',
      ];

      // Get members of this company ordered by citizen code
      const memRes = await client.query(
        `SELECT m.id, m.participant_id, p.citizen_code
         FROM memberships m
         JOIN participants p ON m.participant_id = p.id
         WHERE m.company_id = $1 AND m.status = 'active'
         ORDER BY p.citizen_code ASC`,
        [compId]
      );

      const members = memRes.rows;
      for (let i = 0; i < members.length; i++) {
        const role = rolesList[i % rolesList.length];
        await client.query('UPDATE memberships SET role = $1 WHERE id = $2', [role, members[i].id]);
        // Also update participants role column if CEO
        if (role === 'Founder & CEO') {
          await client.query("UPDATE participants SET role = 'company_lead' WHERE id = $1", [members[i].participant_id]);
        } else {
          await client.query("UPDATE participants SET role = 'participant' WHERE id = $1", [members[i].participant_id]);
        }
      }
      console.log(`Updated ${members.length} member roles for ${compId}`);
    }
  });

  console.log('--- Triggering Dynamic Wave & Tier Mission Distribution ---');
  const missionResult = await MissionAutomationEngine.autoAssignAllMissions({
    cleanExisting: true,
    missionsPerParticipant: 10,
  });

  console.log('✅ Mission Distribution Finished:');
  console.log(`   - Citizens Assigned: ${missionResult.participantsAssigned}`);
  console.log(`   - Missions Created: ${missionResult.missionsCreated}`);
  console.log(`   - Instances Assigned: ${missionResult.instancesAssigned}`);
  console.log('   - Role Breakdown:');
  Object.entries(missionResult.breakdownByRole).forEach(([role, count]) => {
    console.log(`     * ${role}: ${count}`);
  });

  await pool.end();
}

assignRolesAndMissions().catch((err) => {
  console.error('Error assigning roles and missions:', err);
  process.exit(1);
});
