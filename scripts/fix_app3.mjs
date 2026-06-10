import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appPath = resolve(__dirname, '..', 'src', 'App.jsx');

let content = readFileSync(appPath, 'utf8');
const nl = '\r\n';

// The exact block to remove (with Windows line endings)
const blockToRemove = [
  `  const getDishLimit = (idx) => { const v = snackDefaults?.[\`dish_\${idx + 1}\`] ?? 0; return v > 0 ? v : 99; }`,
  `  const getDishDefault = (idx) => (snackDefaults?.[\`dish_\${idx + 1}\`] ?? 0) > 0 ? (snackDefaults?.[\`dish_\${idx + 1}\`] ?? 0) : 0`,
  ``,
  `  // Check if any snack count exceeds its default limit`,
  `  const hasSnackOverflow = currentMeal === 'lunch' && dishes.some((dish, idx) => {`,
  `    if (idx <= 3 && typeof responses[dish] === 'number') {`,
  `      return responses[dish] > getDishLimit(idx);`,
  `    }`,
  `    return false;`,
  `  })`,
].join(nl);

const idx = content.indexOf(blockToRemove);
if (idx >= 0) {
  content = content.substring(0, idx) + content.substring(idx + blockToRemove.length);
  console.log('✅ Helper functions block removed');
} else {
  // Try with \n only
  const blockN = blockToRemove.replace(/\r\n/g, '\n');
  const idx2 = content.indexOf(blockN);
  if (idx2 >= 0) {
    content = content.substring(0, idx2) + content.substring(idx2 + blockN.length);
    console.log('✅ Helper functions block removed (\\n version)');
  } else {
    console.log('Block not found. Checking what exists...');
    const startCheck = '  const getDishLimit';
    const si = content.indexOf(startCheck);
    if (si >= 0) {
      console.log('Found start at', si);
      console.log(content.substring(si, si + 450));
    } else {
      console.log('Start not found either');
    }
    process.exit(1);
  }
}

// Now replace any remaining references
const replacements = [
  // Button disabled
  ['loading || Object.keys(responses).length < dishes.length || hasSnackOverflow', 'loading || Object.keys(responses).length < dishes.length'],
  // hasSnackOverflow in button style
  ['Object.keys(responses).length < dishes.length || hasSnackOverflow ? t.border : t.accentGrad', 'Object.keys(responses).length < dishes.length ? t.border : t.accentGrad'],
  ["Object.keys(responses).length < dishes.length || hasSnackOverflow ? 'not-allowed' : 'pointer'", "Object.keys(responses).length < dishes.length ? 'not-allowed' : 'pointer'"],
  ["Object.keys(responses).length < dishes.length || hasSnackOverflow ? .5 : 1", "Object.keys(responses).length < dishes.length ? .5 : 1"],
  ["hasSnackOverflow ? '⚠️ Max exceeded' : isLast ? 'Complete Survey ✓' : 'Save & Next →'", "isLast ? 'Complete Survey ✓' : 'Save & Next →'"],
];

for (const [old, rep] of replacements) {
  if (content.includes(old)) {
    content = content.replaceAll(old, rep);
    console.log(`✅ Replaced: "${old.substring(0, 50)}..."`);
  }
}

// Final check
let hasRemaining = false;
for (const name of ['getDishLimit', 'getDishDefault', 'hasSnackOverflow']) {
  if (content.includes(name)) {
    hasRemaining = true;
    const p = content.indexOf(name);
    console.log(`⚠️ REMAINING ${name} at ${p}:`, content.substring(Math.max(0, p - 20), p + 50));
  }
}

if (hasRemaining) {
  console.error('ERROR: Some references could not be removed');
  process.exit(1);
}

writeFileSync(appPath, content, 'utf8');
console.log('\n✅ All done! App.jsx updated successfully');
