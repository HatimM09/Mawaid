/**
 * Fix 403 Forbidden errors by restoring GRANT permissions.
 * Uses the Supabase Management API directly.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_REF = 'spciaktztqnjsttrtosu';
const token = process.argv[2];

async function fixGrants() {
  const sqlPath = path.join(__dirname, 'fix_grants.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('🔧 Fixing database GRANT permissions...');
  console.log('   This restores access for the anon & authenticated roles.\n');

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
    process.exit(1);
  }

  const result = await response.json();
  console.log('✅ GRANT permissions restored successfully!\n');
  console.log('   The anon and authenticated roles can now access your tables.');
  console.log('   The 403 Forbidden errors should be GONE now.');
  console.log('\n🔄 Refresh your app to verify!');
}

fixGrants().catch(err => {
  console.error('❌ Error:', err.message);
});
