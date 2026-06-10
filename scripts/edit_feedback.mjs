import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'src', 'App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize to LF for matching
const lf = content.replace(/\r\n/g, '\n');
let result = lf;
let changes = 0;

// Replace 1: Remove the shared textarea block (between the meal cards and Btn)
const oldTextareaStart = '<div style={{ marginBottom: 16 }}>\n          <label style={{ display: \'block\', fontSize: 10, fontWeight: 800, color: t.textSub, marginBottom: 8, textTransform: \'uppercase\', letterSpacing: \'0.1em\' }}>Your Comments</label>\n          <textarea\n            name="feedback"\n            value={lunchComment}\n            onChange={e => { setLunchComment(e.target.value); setDinnerComment(e.target.value) }}\n            placeholder="Tell us what you liked or how we can improve..."\n            style={{ width: \'100%\', padding: \'14px 16px\', borderRadius: 16, background: t.inputBg, border: `1px solid ${t.border}`, color: t.text, fontSize: 14, resize: \'none\', outline: \'none\', fontFamily: "\'DM Sans\',sans-serif", minHeight: 80, boxSizing: \'border-box\', boxShadow: \'inset 0 2px 4px rgba(0,0,0,0.05)\' }}\n          />\n        </div>';

const taIdx = result.indexOf(oldTextareaStart);
if (taIdx !== -1) {
  result = result.slice(0, taIdx) + result.slice(taIdx + oldTextareaStart.length);
  changes++;
  console.log('1. Removed shared textarea block');
} else {
  console.log('1. Textarea NOT found');
}

// Replace 2: Add comment field inside each meal card
const oldMealEnd = `{stars > 0 && <div style={{ fontSize: 14, fontWeight: 700, color: t.accent, opacity: 0.9, fontFamily: "'DM Sans',sans-serif" }}>{STAR_LABELS[stars]}</div>}
                  </div>
                )}
              </div>
            )`;
const newMealEnd = `{stars > 0 && <div style={{ fontSize: 14, fontWeight: 700, color: t.accent, opacity: 0.9, fontFamily: "'DM Sans',sans-serif" }}>{STAR_LABELS[stars]}</div>}
                  </div>
                )}
                {/* Separate comment field per meal */}
                <div style={{ marginTop: 16 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: t.textSub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{meal === 'lunch' ? 'Lunch' : 'Dinner'} Comment</label>
                  <textarea
                    name={\`\${meal}Comment\`}
                    value={meal === 'lunch' ? lunchComment : dinnerComment}
                    onChange={e => meal === 'lunch' ? setLunchComment(e.target.value) : setDinnerComment(e.target.value)}
                    placeholder={\`Tell us how \${meal} was...\`}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: t.inputBg, border: \`1px solid \${t.border}\`, color: t.text, fontSize: 13, resize: 'none', outline: 'none', fontFamily: "'DM Sans',sans-serif", minHeight: 60, boxSizing: 'border-box', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}
                  />
                </div>
              </div>
            )`;

const mealIdx = result.lastIndexOf(oldMealEnd);
if (mealIdx !== -1) {
  result = result.substring(0, mealIdx) + newMealEnd + result.substring(mealIdx + oldMealEnd.length);
  changes++;
  console.log('2. Added comment fields inside meal cards');
} else {
  console.log('2. Meal card end NOT found');
}

// Replace 3: the submission line
const oldSubmit = `        comment: (lunchComment || dinnerComment).trim(),`;
const newSubmit = `        lunch_comment: lunchComment.trim() || null,\n        dinner_comment: dinnerComment.trim() || null,`;

if (result.includes(oldSubmit)) {
  result = result.replace(oldSubmit, newSubmit);
  changes++;
  console.log('3. Updated submission payload');
} else {
  console.log('3. Old submission line NOT found - may already be changed');
}

// Convert back to CRLF
if (content.includes('\r\n')) {
  result = result.replace(/\n/g, '\r\n');
}
fs.writeFileSync(filePath, result);
console.log(`\nDone! Made ${changes} change(s)`);
