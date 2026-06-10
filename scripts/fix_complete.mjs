import { readFileSync, writeFileSync } from 'fs';

let c = readFileSync('src/App.jsx', 'utf8');
let count = 0;

const replaceAll = (oldS, newS) => {
  let n = 0;
  while (c.includes(oldS)) {
    c = c.replace(oldS, newS);
    n++;
    count++;
  }
  if (n > 0) console.log(`  "${oldS.substring(0,50)}" → replaced ${n}x`);
};

// 1. Remove the helper functions & overflow check block
replaceAll(
  '  // Helper to compute effective max per dish (uses snack_default if >0, else 99)\n  const getDishLimit = (idx) => { const v = snackDefaults?.[`dish_${idx + 1}`] ?? 0; return v > 0 ? v : 99; }\n  const getDishDefault = (idx) => (snackDefaults?.[`dish_${idx + 1}`] ?? 0) > 0 ? (snackDefaults?.[`dish_${idx + 1}`] ?? 0) : 0\n\n  // Check if any snack count exceeds its default limit\n  const hasSnackOverflow = currentMeal === \'lunch\' && dishes.some((dish, idx) => {\n    if (idx <= 3 && typeof responses[dish] === \'number\') {\n      return responses[dish] > getDishLimit(idx);\n    }\n    return false;\n  })',
  ''
);

// Also handle the case where the comment was already changed but functions remain
replaceAll(
  '  // Snack dish count input (unlimited - max removed)\n  const getDishLimit',
  '  // Snack dish count input (unlimited - max removed)\n  //'
);
replaceAll('const getDishLimit =', '// REMOVED: getDishLimit =');
replaceAll('const getDishDefault =', '// REMOVED: getDishDefault =');

// 2. Replace snack dish input label
replaceAll('Count (max {getDishLimit(idx)}):', 'Count:');

// 3. Replace snack dish input value/default
replaceAll(
  'max={getDishLimit(idx)} value={typeof responses[dish] === \'number\' ? responses[dish] : getDishDefault(idx)}',
  'value={typeof responses[dish] === \'number\' ? responses[dish] : 0}'
);

// 4. Replace Math.min constraint
replaceAll('Math.min(val, getDishLimit(idx))', 'val');

// 5. Button: remove hasSnackOverflow from disabled
replaceAll(
  'loading || Object.keys(responses).length < dishes.length || hasSnackOverflow',
  'loading || Object.keys(responses).length < dishes.length'
);

// 6. Button style conditions with hasSnackOverflow
replaceAll(
  'Object.keys(responses).length < dishes.length || hasSnackOverflow ? t.border : t.accentGrad',
  'Object.keys(responses).length < dishes.length ? t.border : t.accentGrad'
);
replaceAll(
  "Object.keys(responses).length < dishes.length || hasSnackOverflow ? 'not-allowed' : 'pointer'",
  "Object.keys(responses).length < dishes.length ? 'not-allowed' : 'pointer'"
);
replaceAll(
  'Object.keys(responses).length < dishes.length || hasSnackOverflow ? .5 : 1',
  'Object.keys(responses).length < dishes.length ? .5 : 1'
);

// 7. Button text - hasSnackOverflow conditional
replaceAll(
  "hasSnackOverflow ? '\u26a0\ufe0f Max exceeded' : isLast ? 'Complete Survey \u2713' : 'Save & Next \u2192'",
  "isLast ? 'Complete Survey \u2713' : 'Save & Next \u2192'"
);
replaceAll("hasSnackOverflow ? '⚠️ Max exceeded' : ", "");

// 8. Final catch-all for any remaining inline references
replaceAll('|| hasSnackOverflow', '');
replaceAll('hasSnackOverflow', 'false');

// Final check
const terms = ['getDishLimit', 'getDishDefault', 'hasSnackOverflow'];
const found = [];
for (const t of terms) {
  let p = -1;
  while ((p = c.indexOf(t, p + 1)) >= 0) {
    found.push({ term: t, pos: p, ctx: c.substring(Math.max(0, p - 20), p + 60) });
  }
}

if (found.length > 0) {
  console.error(`\n⚠️ ${found.length} reference(s) still remain:`);
  for (const f of found) {
    console.error(`  ${f.term} at ${f.pos}: ${f.ctx}`);
  }
  process.exit(1);
}

writeFileSync('src/App.jsx', c, 'utf8');
console.log(`\n✅ DONE! ${count} total replacements made. App.jsx is clean.`);
