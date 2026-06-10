import { readFileSync, writeFileSync } from 'fs';

const c = readFileSync('src/App.jsx', 'utf8');
const lines = c.split('\n');

// Find and remove the broken hasSnackOverflow remnants
// Look for the pattern: lines with "[getDishDefault removed]" followed by broken function body
const startLine = lines.findIndex(l => l.includes('[getDishDefault removed]'));
const endLine = lines.findIndex(l => l.trim() === '})' && l.includes('}') && startLine >= 0 && lines.indexOf(l) > startLine);

console.log('Broken block from line', startLine+1, 'to', endLine+1);

if (startLine >= 0 && endLine > startLine) {
  // Remove lines from startLine to endLine (inclusive)
  lines.splice(startLine, endLine - startLine + 1);
  console.log('Removed', endLine - startLine + 1, 'lines');
}

// Now also find and remove the getDishLimit function definition if it still exists
const gdlLine = lines.findIndex(l => l.includes('const getDishLimit = ') && l.includes('99;'));
if (gdlLine >= 0) {
  console.log('Removing getDishLimit definition at line', gdlLine+1);
  lines.splice(gdlLine, 1);
}

// Find and remove the getDishDefault definition if it exists
const gddLine = lines.findIndex(l => l.includes('const getDishDefault = '));
if (gddLine >= 0) {
  console.log('Removing getDishDefault definition at line', gddLine+1);
  lines.splice(gddLine, 1);
}

// Also find the "// Snack dish count input" comment if it's now orphaned
const sdComment = lines.findIndex(l => l.includes('// Snack dish count input'));
if (sdComment >= 0) {
  // Check if it's followed by an empty line and "return ("
  const nextLine = sdComment + 1;
  if (nextLine < lines.length && lines[nextLine].trim() === '') {
    const afterBlank = nextLine + 1;
    if (afterBlank < lines.length && lines[afterBlank].trim().startsWith('return (')) {
      console.log('Removing orphaned snack dish comment at line', sdComment+1);
      lines.splice(sdComment, 1);
    }
  }
}

// Rebuild and write
const result = lines.join('\n');

// Verify no remaining bad references
const bad = ['getDishLimit', 'getDishDefault', 'hasSnackOverflow'].filter(t => result.includes(t));
if (bad.length > 0) {
  console.error('Still remaining:', bad);
  process.exit(1);
}

writeFileSync('src/App.jsx', result, 'utf8');
console.log('✅ Parse error fixed, all remnants removed');
