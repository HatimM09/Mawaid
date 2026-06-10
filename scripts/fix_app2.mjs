import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appPath = resolve(__dirname, '..', 'src', 'App.jsx');

let content = readFileSync(appPath, 'utf8');
console.log('File length:', content.length);

// Find exact remaining occurrences
const findAll = (str, sub) => {
  const positions = [];
  let pos = str.indexOf(sub);
  while (pos >= 0) {
    positions.push(pos);
    pos = str.indexOf(sub, pos + 1);
  }
  return positions;
};

['getDishLimit', 'getDishDefault', 'hasSnackOverflow'].forEach(name => {
  const positions = findAll(content, name);
  console.log(`${name} occurs ${positions.length} times at:`, positions.map(p => `${p}->${content.substring(p, p + 80)}`));
});

// Directly find and remove the entire helper block
// Look for the pattern around position 32160
const snippetStart = content.indexOf('f >0, else 99)');
if (snippetStart >= 0) {
  const blockStart = content.lastIndexOf('\n', snippetStart - 1) + 1;
  const blockEnd = content.indexOf('\n\n  return (', snippetStart);
  console.log('Found helper block from', blockStart, 'to', blockEnd);
  if (blockEnd >= 0) {
    const replacement = '  // Snack dish count input (unlimited - max removed)\n\n  return (';
    content = content.substring(0, blockStart) + replacement + content.substring(blockEnd + '\n\n  return ('.length);
    console.log('✅ Removed helper functions block');
  }
}

// Check remaining
let remaining = [];
['getDishLimit', 'getDishDefault', 'hasSnackOverflow'].forEach(name => {
  if (content.includes(name)) {
    remaining.push(name);
    const pos = content.indexOf(name);
    console.log(`Remaining ${name} at ${pos}:`, content.substring(Math.max(0, pos - 30), pos + 30));
  }
});

if (remaining.length > 0) {
  console.error('Still remaining:', remaining);
  process.exit(1);
}

writeFileSync(appPath, content, 'utf8');
console.log('✅ App.jsx updated successfully!');
