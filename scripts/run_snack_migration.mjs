/**
 * Run just the snack_defaults migration via Supabase Management API.
 * Safe — only adds a column, won't touch existing data.
 * 
 * Usage: node scripts/run_snack_migration.mjs sbp_YOUR_TOKEN
 */

const PROJECT_REF = 'spciaktztqnjsttrtosu';
const token = process.argv[2];

if (!token) {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  SNACK DEFAULTS MIGRATION                                   ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  This adds a snack_defaults column to user_stats.            ║
║  Safe — won't affect existing data.                         ║
║                                                              ║
║  Step 1: Open https://supabase.com/dashboard/account/tokens  ║
║  Step 2: Generate new token, copy it (starts with sbp_)     ║
║  Step 3: Run:                                               ║
║    node scripts/run_snack_migration.mjs sbp_YOUR_TOKEN      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

const sql = `ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS snack_defaults JSONB DEFAULT '{"dish_1":0,"dish_2":0,"dish_3":0,"dish_4":0}';`;

async function run() {
  console.log('🚀 Running migration via Supabase Management API...\n');

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ API returned ${response.status}: ${errorText}`);
    
    if (response.status === 401) {
      console.error('\n⚠️  Token invalid or expired. Generate a new one:');
      console.error('   https://supabase.com/dashboard/account/tokens\n');
    } else if (response.status === 403) {
      console.error('\n⚠️  Your token may not have the right permissions.');
    }
    process.exit(1);
  }

  console.log('✅ Migration applied successfully!');
  console.log('   Added snack_defaults JSONB column to user_stats table.');
  console.log('\n📝 Now admins can set per-dish snack defaults from the Users page.');
  console.log('   Users will see count inputs pre-filled with defaults in the survey.\n');
}

run().catch(err => {
  console.error('❌ Unexpected error:', err.message);
});
