import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appPath = resolve(__dirname, '..', 'src', 'App.jsx');

let content = readFileSync(appPath, 'utf8');

// 1. Remove max(99) snack dish helpers
const oldHelpers = `  // Helper to compute effective max per dish (uses snack_default if >0, else 99)
  const getDishLimit = (idx) => { const v = snackDefaults?.[\`dish_\${idx + 1}\`] ?? 0; return v > 0 ? v : 99; }
  const getDishDefault = (idx) => (snackDefaults?.[\`dish_\${idx + 1}\`] ?? 0) > 0 ? (snackDefaults?.[\`dish_\${idx + 1}\`] ?? 0) : 0

  // Check if any snack count exceeds its default limit
  const hasSnackOverflow = currentMeal === 'lunch' && dishes.some((dish, idx) => {
    if (idx <= 3 && typeof responses[dish] === 'number') {
      return responses[dish] > getDishLimit(idx);
    }
    return false;
  })`;

const newHelpers = `  // Snack dish count input (unlimited - max removed)`;

content = content.replace(oldHelpers, newHelpers);

// 2. Fix the snack dish input UI - remove max label and constraint
const oldInput = `                    <span style={{ fontSize: 12, color: t.textSub, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: "'DM Sans',sans-serif"}}>Count (max {getDishLimit(idx)}):</span>
                    <input type="number" name="portionCount" min="0" max={getDishLimit(idx)} value={typeof responses[dish] === 'number' ? responses[dish] : getDishDefault(idx)}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setResponses(prev => ({ ...prev, [dish]: Math.min(val, getDishLimit(idx)) }));
                      }}
                      style={{ width: 70, padding: '8px 10px', borderRadius: 9, border: \`1.5px solid \${t.border}\`, background: t.inputBg, color: t.text, fontSize: 15, fontWeight: 700, textAlign: 'center', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}
                      aria-label="Portion count" />`;

const newInput = `                    <span style={{ fontSize: 12, color: t.textSub, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: "'DM Sans',sans-serif"}}>Count:</span>
                    <input type="number" name="portionCount" min="0" value={typeof responses[dish] === 'number' ? responses[dish] : 0}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setResponses(prev => ({ ...prev, [dish]: val }));
                      }}
                      style={{ width: 70, padding: '8px 10px', borderRadius: 9, border: \`1.5px solid \${t.border}\`, background: t.inputBg, color: t.text, fontSize: 15, fontWeight: 700, textAlign: 'center', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}
                      aria-label="Portion count" />`;

content = content.replace(oldInput, newInput);

// 3. Fix the submit button - remove hasSnackOverflow
const oldButton = `            <button onClick={handleNext} disabled={loading || Object.keys(responses).length < dishes.length || hasSnackOverflow}
              style={{ width: '100%', padding: 13, borderRadius: 11, border: 'none', marginTop: 6, background: Object.keys(responses).length < dishes.length || hasSnackOverflow ? t.border : t.accentGrad, color: '#fff', fontSize: 14, fontWeight: 700, cursor: Object.keys(responses).length < dishes.length || hasSnackOverflow ? 'not-allowed' : 'pointer', opacity: Object.keys(responses).length < dishes.length || hasSnackOverflow ? .5 : 1, fontFamily: "'DM Sans',sans-serif" }}>
              {loading ? 'Saving…' : hasSnackOverflow ? '⚠️ Max exceeded' : isLast ? 'Complete Survey ✓' : 'Save & Next →'}
            </button>`;

const newButton = `            <button onClick={handleNext} disabled={loading || Object.keys(responses).length < dishes.length}
              style={{ width: '100%', padding: 13, borderRadius: 11, border: 'none', marginTop: 6, background: Object.keys(responses).length < dishes.length ? t.border : t.accentGrad, color: '#fff', fontSize: 14, fontWeight: 700, cursor: Object.keys(responses).length < dishes.length ? 'not-allowed' : 'pointer', opacity: Object.keys(responses).length < dishes.length ? .5 : 1, fontFamily: "'DM Sans',sans-serif" }}>
              {loading ? 'Saving…' : isLast ? 'Complete Survey ✓' : 'Save & Next →'}
            </button>`;

content = content.replace(oldButton, newButton);

if (content.includes('getDishLimit') || content.includes('hasSnackOverflow') || content.includes('getDishDefault')) {
  console.error('ERROR: Some references were not fully replaced!');
  process.exit(1);
}

writeFileSync(appPath, content, 'utf8');
console.log('✅ App.jsx updated successfully - max(99) and overflow check removed');
