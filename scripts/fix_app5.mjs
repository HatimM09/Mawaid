import { readFileSync, writeFileSync } from 'fs';
const c = readFileSync('src/App.jsx', 'utf8');

// Find the start marker
const start = c.indexOf('  const getDishLimit = (idx) => { const v = snackDefaults');
if (start < 0) { console.log('Block not found'); process.exit(1); }

// Find the end - look for "  return (" after the block
// The block ends with "  })" followed by two newlines and "  return ("
const retIdx = c.indexOf('  return (', start + 100);
if (retIdx < 0) { console.log('return ( not found'); process.exit(1); }

// Find the newlines before "  return ("
// Go backwards from retIdx to find where the block ends
let blockEnd = retIdx;
// Skip any whitespace/newlines before "  return ("
while (blockEnd > start && (c[blockEnd - 1] === '\n' || c[blockEnd - 1] === '\r' || c[blockEnd - 1] === ' ')) {
  blockEnd--;
}

// Remove from start to blockEnd (but keep the newline before "  return (")
const cleaned = c.substring(0, start) + c.substring(retIdx);

// Verify the functions are gone
if (cleaned.includes('const getDishLimit') || cleaned.includes('const getDishDefault') || cleaned.includes('const hasSnackOverflow')) {
  console.log('Block still present. Checking context...');
  console.log('Around start:', c.substring(start, start + 100));
  console.log('Around retIdx:', c.substring(retIdx - 20, retIdx + 30));
  process.exit(1);
}

console.log('✅ Helper block removed');

// Now do button replacements on cleaned
let result = cleaned;

// Button disabled
result = result.replace(
  "loading || Object.keys(responses).length < dishes.length || hasSnackOverflow",
  "loading || Object.keys(responses).length < dishes.length"
);
console.log('1. Button disabled done');

// Button style background
result = result.replace(
  "Object.keys(responses).length < dishes.length || hasSnackOverflow ? t.border : t.accentGrad",
  "Object.keys(responses).length < dishes.length ? t.border : t.accentGrad"
);
console.log('2. Button style bg done');

// Button cursor
result = result.replace(
  "Object.keys(responses).length < dishes.length || hasSnackOverflow ? 'not-allowed' : 'pointer'",
  "Object.keys(responses).length < dishes.length ? 'not-allowed' : 'pointer'"
);
console.log('3. Button cursor done');

// Button opacity
result = result.replace(
  "Object.keys(responses).length < dishes.length || hasSnackOverflow ? .5 : 1",
  "Object.keys(responses).length < dishes.length ? .5 : 1"
);
console.log('4. Button opacity done');

// Button text
result = result.replace(
  "hasSnackOverflow ? '⚠️ Max exceeded' : isLast ? 'Complete Survey ✓' : 'Save & Next →'",
  "isLast ? 'Complete Survey ✓' : 'Save & Next →'"
);
console.log('5. Button text done');

// Final verification
const remaining = [];
for (const n of ['getDishLimit', 'getDishDefault', 'hasSnackOverflow']) {
  if (result.includes(n)) {
    remaining.push(n);
    const p = result.indexOf(n);
    console.log(`⚠️ ${n} still at ${p}: ${result.substring(Math.max(0,p-10), p+60)}`);
  }
}

if (remaining.length > 0) {
  console.error('Still remaining:', remaining.join(', '));
  process.exit(1);
}

writeFileSync('src/App.jsx', result, 'utf8');
console.log('\n✅ All done! App.jsx updated successfully');
