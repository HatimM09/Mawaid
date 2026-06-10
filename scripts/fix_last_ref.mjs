import { readFileSync, writeFileSync } from 'fs';

let c = readFileSync('src/App.jsx', 'utf8');

// Replace the max attribute and default value on the portion count input
const oldPart = 'max={getDishLimit(idx)} value={typeof responses[dish] === \'number\' ? responses[dish] : getDishDefault(idx)}';
const newPart = 'value={typeof responses[dish] === \'number\' ? responses[dish] : 0}';

if (c.includes(oldPart)) {
  c = c.replace(oldPart, newPart);
  console.log('✅ Fixed last getDishLimit/getDishDefault reference');
} else {
  // Try alternate escaping
  const altOld = 'max={getDishLimit(idx)} value={typeof responses[dish] === "number" ? responses[dish] : getDishDefault(idx)}';
  if (c.includes(altOld)) {
    c = c.replace(altOld, newPart);
    console.log('✅ Fixed last reference (alternate match)');
  } else {
    console.log('Pattern not found, checking line by line...');
    const lines = c.split('\n');
    let found = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('getDishLimit') || lines[i].includes('getDishDefault')) {
        console.log(`Line ${i + 1}: ${lines[i].substring(0, 150)}`);
        lines[i] = lines[i]
          .replace(/max=\{getDishLimit\(idx\)\} /g, '')
          .replace(/getDishDefault\(idx\)/g, '0');
        found = true;
      }
    }
    if (!found) {
      console.log('No references found - already clean?');
      console.log('Checking file for any occurrences...');
      const all = ['getDishLimit', 'getDishDefault'].filter(t => c.includes(t));
      console.log('Remaining:', all);
      if (all.length === 0) process.exit(0);
    }
    c = lines.join('\n');
  }
}

writeFileSync('src/App.jsx', c, 'utf8');

// Final verification
const remaining = ['getDishLimit', 'getDishDefault'].filter(t => c.includes(t));
if (remaining.length > 0) {
  console.log('⚠️ Still remaining:', remaining);
  process.exit(1);
}
console.log('✅ File is clean!');
