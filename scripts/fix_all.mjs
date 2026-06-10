import { readFileSync, writeFileSync } from 'fs';

let c = readFileSync('src/App.jsx', 'utf8');

// 1. Remove the entire helper block (function definitions + overflow check)
const blockStart = c.indexOf('  const getDishLimit = (idx) => { const v = snackDefaults');
const retIdx = c.indexOf('  return (', blockStart + 100);
c = c.substring(0, blockStart) + c.substring(retIdx);

console.log('✅ Block removed');

// 2. Remove all remaining references in JSX
let changes = 0;
const pairs = [
  ['Count (max {getDishLimit(idx)}):', 'Count:'],
  ['max={getDishLimit(idx)} value={typeof responses[dish] === \'number\' ? responses[dish] : getDishDefault(idx)}', 'value={typeof responses[dish] === \'number\' ? responses[dish] : 0}'],
  ['Math.min(val, getDishLimit(idx))', 'val'],
  ['{loading || Object.keys(responses).length < dishes.length || hasSnackOverflow}', '{loading || Object.keys(responses).length < dishes.length}'],
  ['Object.keys(responses).length < dishes.length || hasSnackOverflow ? t.border : t.accentGrad', 'Object.keys(responses).length < dishes.length ? t.border : t.accentGrad'],
  ["Object.keys(responses).length < dishes.length || hasSnackOverflow ? 'not-allowed' : 'pointer'", "Object.keys(responses).length < dishes.length ? 'not-allowed' : 'pointer'"],
  ["Object.keys(responses).length < dishes.length || hasSnackOverflow ? .5 : 1", "Object.keys(responses).length < dishes.length ? .5 : 1"],
  ["hasSnackOverflow ? '\\u26a0\\ufe0f Max exceeded' : isLast ? 'Complete Survey \\u2713' : 'Save & Next \\u2192'", "isLast ? 'Complete Survey \\u2713' : 'Save & Next \\u2192'"],
];

for (const [oldStr, newStr] of pairs) {
  if (c.includes(oldStr)) {
    // Use replace, not replaceAll, to avoid affecting unrelated matches
    c = c.replace(oldStr, newStr);
    changes++;
    console.log(`✅ Replaced #${changes}: ${oldStr.substring(0, 50)}...`);
  }
}

// 3. Final verification
const terms = ['getDishLimit', 'getDishDefault', 'hasSnackOverflow'];
const found = terms.filter(t => c.includes(t));
if (found.length > 0) {
  console.error('ERROR: Still found:', found);
  for (const t of found) {
    const p = c.indexOf(t);
    console.log(`  ${t} at ${p}: ${c.substring(Math.max(0,p-30), p+60)}`);
  }
  process.exit(1);
}

writeFileSync('src/App.jsx', c, 'utf8');
console.log(`\n✅ COMPLETE! ${changes} replacements done, all references removed.`);
