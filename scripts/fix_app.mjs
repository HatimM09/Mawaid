import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appPath = resolve(__dirname, '..', 'src', 'App.jsx');

let content = readFileSync(appPath, 'utf8');
console.log('File length:', content.length);

// Check if getDishLimit exists
const hasGDL = content.includes('getDishLimit');
const hasHSO = content.includes('hasSnackOverflow');
console.log('has getDishLimit:', hasGDL, 'has hasSnackOverflow:', hasHSO);

// 1. Remove the helper functions and overflow check
// Find from "Helper to compute" through the closing of hasSnackOverflow
const helperStart = content.indexOf('  // Helper to compute effective max');
console.log('helperStart:', helperStart);

if (helperStart >= 0) {
  // The block to remove is 5 lines:
  // Line 1: // Helper to compute...
  // Line 2: const getDishLimit = ...
  // Line 3: const getDishDefault = ...
  // Line 4: (blank line)
  // Line 5: // Check if any snack count...
  // Line 6-12: const hasSnackOverflow = ... { ... }
  
  // Find the end - look for the blank line after hasSnackOverflow closing
  const afterHelper = content.indexOf('\n\n  return (', helperStart);
  console.log('afterHelper:', afterHelper);
  
  if (afterHelper >= 0) {
    const replacement = '\n  // Snack dish count input (unlimited - max removed)\n\n  return (';
    content = content.substring(0, helperStart) + replacement + content.substring(afterHelper + '\n\n  return ('.length);
    console.log('✅ Removed getDishLimit, getDishDefault, hasSnackOverflow');
  }
}

// 2. Fix the snack dish input - remove max label and constraint
const oldInput1 = 'Count (max {getDishLimit(idx)}):';
const newInput1 = 'Count:';
if (content.includes(oldInput1)) {
  content = content.replaceAll(oldInput1, newInput1);
  console.log('✅ Updated label from "Count (max ...)" to "Count:"');
}

const oldInput2 = 'max={getDishLimit(idx)} value={typeof responses[dish] === \'number\' ? responses[dish] : getDishDefault(idx)}';
const newInput2 = 'value={typeof responses[dish] === \'number\' ? responses[dish] : 0}';
if (content.includes(oldInput2)) {
  content = content.replaceAll(oldInput2, newInput2);
  console.log('✅ Removed max attribute from input');
}

const oldInput3 = 'Math.min(val, getDishLimit(idx))';
const newInput3 = 'val';
if (content.includes(oldInput3)) {
  content = content.replaceAll(oldInput3, newInput3);
  console.log('✅ Removed Math.min constraint');
}

// 3. Fix the submit button - remove hasSnackOverflow references
const oldBtnDisabled = 'Object.keys(responses).length < dishes.length || hasSnackOverflow';
const newBtnDisabled = 'Object.keys(responses).length < dishes.length';
if (content.includes(oldBtnDisabled)) {
  content = content.replaceAll(oldBtnDisabled, newBtnDisabled);
  console.log('✅ Removed hasSnackOverflow from button disabled');
}

const oldBtnStyle = 'Object.keys(responses).length < dishes.length || hasSnackOverflow ? t.border : t.accentGrad';
const newBtnStyle = 'Object.keys(responses).length < dishes.length ? t.border : t.accentGrad';
if (content.includes(oldBtnStyle)) {
  content = content.replaceAll(oldBtnStyle, newBtnStyle);
  console.log('✅ Removed hasSnackOverflow from button style');
}

const oldBtnCursor = "Object.keys(responses).length < dishes.length || hasSnackOverflow ? 'not-allowed' : 'pointer'";
const newBtnCursor = "Object.keys(responses).length < dishes.length ? 'not-allowed' : 'pointer'";
if (content.includes(oldBtnCursor)) {
  content = content.replaceAll(oldBtnCursor, newBtnCursor);
  console.log('✅ Removed hasSnackOverflow from button cursor');
}

const oldBtnOpacity = "Object.keys(responses).length < dishes.length || hasSnackOverflow ? .5 : 1";
const newBtnOpacity = "Object.keys(responses).length < dishes.length ? .5 : 1";
if (content.includes(oldBtnOpacity)) {
  content = content.replaceAll(oldBtnOpacity, newBtnOpacity);
  console.log('✅ Removed hasSnackOverflow from button opacity');
}

const oldBtnText = "hasSnackOverflow ? '\\u26a0\\ufe0f Max exceeded' : isLast ? 'Complete Survey \\u2713' : 'Save & Next \\u2192'";
const newBtnText = "isLast ? 'Complete Survey \\u2713' : 'Save & Next \\u2192'";
if (content.includes(oldBtnText)) {
  content = content.replaceAll(oldBtnText, newBtnText);
  console.log('✅ Removed hasSnackOverflow from button text');
}

// Verify no remaining references
const remainsGDL = content.includes('getDishLimit');
const remainsHSO = content.includes('hasSnackOverflow');
const remainsGDD = content.includes('getDishDefault');
console.log('Remaining references - getDishLimit:', remainsGDL, 'hasSnackOverflow:', remainsHSO, 'getDishDefault:', remainsGDD);

if (remainsGDL || remainsHSO || remainsGDD) {
  console.error('ERROR: Some references remain!');
  // Find what remains
  if (remainsGDL) console.log('getDishLimit found at:', content.indexOf('getDishLimit'));
  if (remainsHSO) console.log('hasSnackOverflow found at:', content.indexOf('hasSnackOverflow'));
  if (remainsGDD) console.log('getDishDefault found at:', content.indexOf('getDishDefault'));
  process.exit(1);
}

writeFileSync(appPath, content, 'utf8');
console.log('\\n✅ App.jsx updated successfully!');
