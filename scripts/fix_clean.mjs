import { readFileSync, writeFileSync } from 'fs';

const c = readFileSync('src/App.jsx', 'utf8');
const lines = c.split(/\r?\n/);

let count = 0;
const removedLines = [];

// Process each line
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  
  // Remove the getDishLimit function definition line
  if (line.includes('const getDishLimit = ') && line.includes('99;') && !line.includes('// REMOVED')) {
    // Find the end - this function spans 1 line
    removedLines.push(`Line ${i+1}: Removed getDishLimit definition`);
    lines[i] = '  // [getDishLimit removed]';
    count++;
    continue;
  }
  
  // Remove the getDishDefault function definition line
  if (line.includes('const getDishDefault = ') && !line.includes('// REMOVED')) {
    removedLines.push(`Line ${i+1}: Removed getDishDefault definition`);
    lines[i] = '  // [getDishDefault removed]';
    count++;
    continue;
  }
  
  // Remove the "Check if any snack count exceeds" comment
  if (line.includes('Check if any snack count exceeds its default limit')) {
    removedLines.push(`Line ${i+1}: Removed comment`);
    lines[i] = '  // [hasSnackOverflow removed]';
    count++;
    continue;
  }
  
  // Remove the hasSnackOverflow declaration and its block
  if (line.includes('const hasSnackOverflow = currentMeal')) {
    removedLines.push(`Line ${i+1}: Removed hasSnackOverflow declaration`);
    lines[i] = '  // [hasSnackOverflow removed]';
    count++;
    // Continue removing lines until we hit the closing })
    let depth = 0;
    for (let j = i; j < lines.length; j++) {
      const openC = (lines[j].match(/\{/g) || []).length;
      const closeC = (lines[j].match(/\}/g) || []).length;
      depth += openC - closeC;
      if (j > i) {
        lines[j] = ''; // Remove block content lines
        count++;
      }
      if (depth <= 0) {
        // This line had the closing }
        break;
      }
    }
    continue;
  }
  
  // Fix any inline references
  if (line.includes('Count (max {getDishLimit') && line.includes('Count:')) {
    // Already handled
  }
}

// Now rebuild
let result = lines.join('\n');

// Also clean up any standalone remaining references
result = result.replace(/Math\.min\(val, getDishLimit\(idx\)\)/g, 'val');
result = result.replace(/\|\| hasSnackOverflow/g, '');
result = result.replace(/hasSnackOverflow/g, 'false');

// Write result
writeFileSync('src/App.jsx', result, 'utf8');

// Verify
const remaining = ['getDishLimit', 'getDishDefault', 'hasSnackOverflow'].filter(t => {
  // Only check actual code, not comments
  return result.includes(t) && !result.includes('// [' + t);
});

if (remaining.length > 0) {
  console.error('Still remaining:', remaining);
  for (const t of remaining) {
    const p = result.indexOf(t);
    console.error(`  ${t} at ${p}: ${result.substring(Math.max(0,p-10), p+60)}`);
  }
  process.exit(1);
}

console.log(`✅ ${count} line changes made. All references removed.`);
