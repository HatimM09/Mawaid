const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env','utf8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.+?)$/m)?.[1]?.trim();
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.+?)$/m)?.[1]?.trim();
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  // Get current week menu for Monday
  const { data: menu } = await supabase.from('weekly_menu').select('*').eq('week_start', '2026-07-20').eq('day_name', 'monday');
  console.log('Monday menu:', JSON.stringify(menu, null, 2));

  // Check if there are any submission rows with data
  const { data: subs } = await supabase.from('survey_submissions_flat').select('*').limit(20);
  if (subs && subs.length > 0) {
    const cols = Object.keys(subs[0]).filter(k => k.includes('dish'));
    console.log('\nAll dish columns:', cols.sort().join(', '));
    console.log('\nTotal dish columns:', cols.length);
    console.log('\nSample row dish values:');
    const row = subs[0];
    cols.forEach(c => {
      if (row[c] !== null && row[c] !== undefined) {
        console.log(`  ${c}: ${row[c]}`);
      }
    });
  } else {
    console.log('\nNo submissions yet');
  }

  // Check the lunch string parsing
  const lunch = menu?.[0]?.lunch || '';
  console.log('\nLunch string:', lunch);
  const dishes = lunch.split(',').map(s => s.trim()).filter(Boolean);
  console.log('Parsed dishes:', dishes);
  console.log('Dish count:', dishes.length);
})();
