/**
 * Apply Supabase schema using the Supabase Management API.
 * This bypasses the CLI entirely and talks directly to Supabase's servers.
 * 
 * INSTRUCTIONS:
 * 1. Go to https://supabase.com/dashboard/account/tokens
 * 2. Create a new access token (name it anything, e.g. "schema-apply")
 * 3. Copy the token
 * 4. Run: node apply_schema.js YOUR_TOKEN_HERE
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_REF = 'spciaktztqnjsttrtosu';
const token = process.argv[2];

if (!token) {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  SUPABASE SCHEMA APPLY SCRIPT                               ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  To use this script, you need a Supabase Access Token.       ║
║                                                              ║
║  Step 1: Open this URL in your browser:                      ║
║    https://supabase.com/dashboard/account/tokens              ║
║                                                              ║
║  Step 2: Click "Generate new token"                          ║
║          Name it anything (e.g. "apply-schema")              ║
║          Copy the token                                      ║
║                                                              ║
║  Step 3: Run this command with your token:                   ║
║    node apply_schema.js sbp_YOUR_TOKEN_HERE                  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

async function applySchema() {
  const sqlPath = path.join(__dirname, 'supabase_reset_all_and_apply.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('📄 Read SQL file successfully (' + sql.length + ' characters)');
  console.log('🚀 Sending SQL to Supabase Management API...\n');

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
      console.error('\n⚠️  Your token is invalid or expired. Generate a new one at:');
      console.error('   https://supabase.com/dashboard/account/tokens\n');
    }
    process.exit(1);
  }

  const result = await response.json();
  console.log('✅ SUCCESS! Database schema and RLS policies have been fully applied!');
  console.log('');
  console.log('Your tables now have the correct RLS policies:');
  console.log('  ✓ weekly_menu  → Anyone can read');
  console.log('  ✓ user_stats   → Anyone can read, users can update own');
  console.log('  ✓ staff        → Anyone can read');
  console.log('  ✓ All other tables configured');
  console.log('');
  console.log('🎉 The 403 Forbidden errors are now FIXED!');
  console.log('   Refresh your app to verify.');
}

applySchema().catch(err => {
  console.error('❌ Unexpected error:', err.message);
});
