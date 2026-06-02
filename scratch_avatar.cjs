const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const code = fs.readFileSync('./src/admin/supabaseClient.js', 'utf8');
const urlMatch = code.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = code.match(/supabaseAnonKey\s*=\s*['"]([^'"]+)['"]/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

supabase.from('user_stats').select('name, avatar_url').limit(5)
  .then(res => {
    console.log("DB Avatar Data:", JSON.stringify(res.data, null, 2));
  })
  .catch(err => console.error(err));
