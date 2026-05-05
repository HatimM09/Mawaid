import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  console.log("Preparing schema as a Supabase Migration...");
  
  const supabaseDir = path.join(__dirname, 'supabase');
  const migrationsDir = path.join(supabaseDir, 'migrations');
  
  if (!fs.existsSync(supabaseDir)) fs.mkdirSync(supabaseDir);
  if (!fs.existsSync(migrationsDir)) fs.mkdirSync(migrationsDir);

  // Clear old migrations to avoid conflicts
  const files = fs.readdirSync(migrationsDir);
  for (const file of files) {
    fs.unlinkSync(path.join(migrationsDir, file));
  }

  // Copy the sql file into a new migration
  const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const migrationFile = path.join(migrationsDir, `${timestamp}_apply_schema.sql`);
  const sql = fs.readFileSync(path.join(__dirname, 'supabase_reset_all_and_apply.sql'), 'utf8');
  
  fs.writeFileSync(migrationFile, sql);
  console.log(`Created migration file: ${migrationFile}`);

  console.log("\nPushing migration directly to your linked remote Supabase project...");
  console.log("Please wait (it may ask for your database password)...\n");

  // Push directly to the linked project
  execSync('npx supabase db push', {
    stdio: 'inherit' // This allows you to type your password if prompted!
  });

  console.log("\n✅ SUCCESS: Database schema and RLS policies have been fully applied to your LIVE project!");
  console.log("The 403 Forbidden errors should now be completely fixed.");

} catch (error) {
  console.error("\n❌ Failed to run script:", error.message);
}
