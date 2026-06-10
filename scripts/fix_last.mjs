import { readFileSync, writeFileSync } from 'fs';

let c = readFileSync('src/App.jsx', 'utf8');

// Remove the remaining hasSnackOverflow reference
// Find the exact occurrence and remove the surrounding text
const marker = '  // Check if any snack count exceeds its default limit';
const idx = c.indexOf(marker);
if (idx >= 0) {
  // Find the end of this block - it ends with "  })" followed by "\n\n  return ("
  const endBlock = c.indexOf('  })', idx);
  const beforeReturn = c.indexOf('  return (', endBlock);
  // Remove from marker to before "  return ("
  c = c.substring(0, idx) + c.substring(beforeReturn);
  console.log('✅ Block removed');
} else {
  console.log('Marker not found, trying direct cleanup...');
  // Directly check and remove any remaining references
}

// Direct string-by-string cleanup for any remaining button references
const cleanups = [
  ['|| hasSnackOverflow', ''],
  ['hasSnackOverflow ? ', ''],
  ["'\\u26a0\\ufe0f Max exceeded' : ", ''],
  ['hasSnackOverflow', 'false /* was hasSnackOverflow */'],
];

for (const [oldS, newS] of cleanups) {
  while (c.includes(oldS)) {
    const pi = c.indexOf(oldS);
    console.log(`Found "${oldS}" at ${pi}: ${c.substring(Math.max(0,pi-20), pi+50)}`);
    c = c.replace(oldS, newS);
  }
}

// Final check
const remaining = ['getDishLimit', 'getDishDefault', 'hasSnackOverflow'].filter(t => c.includes(t));
if (remaining.length > 0) {
  console.error('Still remaining:', remaining);
  process.exit(1);
}

writeFileSync('src/App.jsx', c, 'utf8');
console.log('\n✅ All cleaned up!');
