import { readFileSync, writeFileSync } from 'fs';
const c = readFileSync('src/App.jsx', 'utf8');

// Find the helper block start
const start = c.indexOf('  const getDishLimit = (idx)');
if (start < 0) { console.log('Block not found'); process.exit(1); }

// Find the end - look for "  })\n\n  return ("
const endBlock = '  })';
const afterStart = c.indexOf(endBlock, start + 50);
let end = c.indexOf('\n\n  return (', start);
if (end < 0) end = c.indexOf('\r\n\r\n  return (', start);

if (end < 0) {
  console.log('Could not find end marker. Content around start:');
  console.log(c.substring(start, start + 500));
  process.exit(1);
}

// Remove from 'start' to 'end' (end points to the \n before "  return (")
const modified = c.substring(0, start) + c.substring(end);

// Now do the remaining replacements
let result = modified;

// Button disabled
result = result.replace(
  "loading || Object.keys(responses).length < dishes.length || hasSnackOverflow",
  "loading || Object.keys(responses).length < dishes.length"
);
console.log('1. Button disabled done');

// Button style - background
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

// Verify
const remaining = ['getDishLimit', 'getDishDefault', 'hasSnackOverflow'].filter(n => result.includes(n));
if (remaining.length > 0) {
  console.log('Still remaining:', remaining);
  process.exit(1);
}

writeFileSync('src/App.jsx', result, 'utf8');
console.log('\n✅ All changes applied!');
