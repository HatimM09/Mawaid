import { readFileSync, writeFileSync } from 'fs';

const c = readFileSync('src/App.jsx', 'utf8');
const lines = c.split('\n');

console.log('Total lines:', lines.length);

// Show lines 695-710
for (let i = 695; i < 710 && i < lines.length; i++) {
  console.log(`${i+1}: "${lines[i].replace(/\t/g, '\\t')}"`);
}

// Remove lines 697-707 (0-indexed: 696-706)
const removed = lines.splice(696, 11);
console.log('\nRemoved', removed.length, 'lines');

const result = lines.join('\n');

// Check for remaining actual references (not in comments)
const hasRealRef = (str) => {
  const idx = result.indexOf(str);
  if (idx < 0) return false;
  // Check if it's in a comment
  const lineStart = result.lastIndexOf('\n', idx);
  const line = result.substring(lineStart, result.indexOf('\n', idx));
  return !line.includes('// [') && !line.includes('// REMOVED');
};

const refs = ['getDishLimit', 'getDishDefault', 'hasSnackOverflow'].filter(hasRealRef);
if (refs.length > 0) {
  console.log('WARNING: Some real references remain:', refs);
}

writeFileSync('src/App.jsx', result, 'utf8');
console.log('✅ File written successfully');
