import { runMigrations } from './migrate';
import { runSeed } from './seed';

async function setup() {
  console.log('🚀 Running Venture City full setup (migrate + seed)...');
  await runMigrations();
  await runSeed();
  console.log('✨ Setup complete! Venture City is ready.');
  process.exit(0);
}

setup().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
