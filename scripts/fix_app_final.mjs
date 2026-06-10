import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appPath = resolve(__dirname, '..', 'src', 'App.jsx');

let content = readFileSync(appPath, 'utf8');

// Find the helper functions block and remove it
// The pattern starts with "  const getDishLimit" and ends with "  })"
const startMarker = '  const getDishLimit = (idx) => { const v = snackDefaults?.[`dish_${idx + 1}`] ?? 0; return v > 0 ? v : 99; }';
const idx = content.indexOf(startMarker);
if (idx >= 0) {
  // Find the end - look for "  })\n\n  return (" after the block
  const endMarker = '  })\n\n  return (';
  const endIdx = content.indexOf(endMarker, idx);
  if (endIdx >= 0) {
    // Remove from startMarker to the end of "  })" (before the "\n\n  return (")
    const blockStart = idx;
    const blockEnd = endIdx + endMarker.indexOf('\n\n  return (');
    const before = content.substring(0, blockStart);
    const after = content.substring(blockEnd);  // starts with "\n\n  return ("
    content = before + after;
    console.log('✅ Helper block removed successfully');
  } else {
    console.error('ERROR: Could not find end marker');
    process.exit(1);
  }
} else {
  console.log('Helper block not found - already removed?');
}

// Now also replace any remaining references to hasSnackOverflow and getDishLimit/getDishDefault in JSX

// Remove hasSnackOverflow from button disabled prop
content = content.replace(
  "loading || Object.keys(responses).length < dishes.length || hasSnackOverflow",
  "loading || Object.keys(responses).length < dishes.length"
);
console.log('✅ Button disabled check updated');

// Remove hasSnackOverflow from button style conditions
const stylePatterns = [
  ["Object.keys(responses).length < dishes.length || hasSnackOverflow ? t.border : t.accentGrad", "Object.keys(responses).length < dishes.length ? t.border : t.accentGrad"],
  ["Object.keys(responses).length < dishes.length || hasSnackOverflow ? 'not-allowed' : 'pointer'", "Object.keys(responses).length < dishes.length ? 'not-allowed' : 'pointer'"],
  ["Object.keys(responses).length < dishes.length || hasSnackOverflow ? .5 : 1", "Object.keys(responses).length < dishes.length ? .5 : 1"],
  ["hasSnackOverflow ? '⚠️ Max exceeded' : isLast ? 'Complete Survey ✓' : 'Save & Next →'", "isLast ? 'Complete Survey ✓' : 'Save & Next →'"]
];

for (const [old, replacement] of stylePatterns) {
  if (content.includes(old)) {
    content = content.replaceAll(old, replacement);
    console.log(`✅ Replaced: "${old.substring(0, 40)}..."`);
  }
}

// Verify no remaining references
const remaining = [];
for (const name of ['getDishLimit', 'getDishDefault', 'hasSnackOverflow']) {
  if (content.includes(name)) {
    remaining.push(name);
    const pos = content.indexOf(name);
    console.log(`⚠️ Remaining ${name} at ${pos}:`, content.substring(Math.max(0, pos - 20), pos + 80));
  }
}

if (remaining.length > 0) {
  console.error('ERROR: Some references remain:', remaining.join(', '));
  process.exit(1);
}

writeFileSync(appPath, content, 'utf8');
console.log('\n✅ All changes applied successfully!');
