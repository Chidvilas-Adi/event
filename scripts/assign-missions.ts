import { MissionAutomationEngine } from '../src/lib/missions/automation';

async function main() {
  console.log('⚡ Initializing Automated Mission Distribution (10 Missions per Participant & Founder)...');
  try {
    const res = await MissionAutomationEngine.autoAssignAllMissions({
      cleanExisting: false,
      missionsPerParticipant: 10,
    });

    console.log('✅ Mission Auto-Assignment Completed Successfully!');
    console.log(`📊 Participants Processed: ${res.participantsAssigned}`);
    console.log(`🎯 Missions Created: ${res.missionsCreated}`);
    console.log(`📦 Instances Assigned: ${res.instancesAssigned}`);
    console.log('🎭 Role Distribution:');
    Object.entries(res.breakdownByRole).forEach(([role, count]) => {
      console.log(`   - ${role}: ${count} citizens`);
    });
    process.exit(0);
  } catch (err) {
    console.error('❌ Mission assignment failed:', err);
    process.exit(1);
  }
}

main();
