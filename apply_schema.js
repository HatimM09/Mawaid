const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, 'supabase_reset_all_and_apply.sql');

try {
  console.log("Reading SQL file...");
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  console.log("Applying SQL schema to your Supabase project...");
  console.log("This will override the database with the correct tables and policies.");
  console.log("Please wait...\n");

  const result = spawnSync('npx.cmd', ['supabase', 'db', 'query'], {
    input: sql,
    stdio: ['pipe', 'inherit', 'inherit']
  });

  if (result.error) {
    console.error("❌ Error executing Supabase CLI:", result.error.message);
  } else if (result.status !== 0) {
    console.error(`❌ Supabase CLI exited with code ${result.status}. Check the output above.`);
  } else {
    console.log("\n✅ SUCCESS: Database schema and RLS policies have been fully applied!");
    console.log("The 403 Forbidden errors should now be completely fixed.");
  }
} catch (error) {
  console.error("❌ Failed to run script:", error.message);
}
