const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.jsx');
let content = fs.readFileSync(filePath, 'utf8');
let changes = 0;

// Replace 1: the shared textarea block (after the meal cards, before Btn)
const oldTextarea = `<div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: t.textSub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Your Comments</label>
          <textarea
            name="feedback"
            value={lunchComment}
            onChange={e => { setLunchComment(e.target.value); setDinnerComment(e.target.value) }}
            placeholder="Tell us what you liked or how we can improve..."
            style={{ width: '100%', padding: '14px 16px', borderRadius: 16, background: t.inputBg, border: \`1px solid \${t.border}\`, color: t.text, fontSize: 14, resize: 'none', outline: 'none', fontFamily: "'DM Sans',sans-serif", minHeight: 80, boxSizing: 'border-box', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}
          />
        </div>`;

if (content.includes(oldTextarea)) {
  content = content.replace(oldTextarea, '');
  changes++;
  console.log('1. Removed shared textarea block');
} else {
  console.log('1. Shared textarea block NOT found - skipping');
}

// Replace 2: add comment field inside each meal card
const oldMealEnd = `                )}
              </div>
            )`;
const newMealEnd = `                )}
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

// Use lastIndexOf to find the last occurrence (inside the meal card .map, not other places)
const lastIdx = content.lastIndexOf(oldMealEnd);
if (lastIdx !== -1) {
  content = content.substring(0, lastIdx) + newMealEnd + content.substring(lastIdx + oldMealEnd.length);
  changes++;
  console.log('2. Added comment fields inside meal cards');
} else {
  console.log('2. Meal card end pattern NOT found - skipping');
}

// Replace 3: the submission line
const oldSubmit = `        comment: (lunchComment || dinnerComment).trim(),`;
const newSubmit = `        lunch_comment: lunchComment.trim() || null,\n        dinner_comment: dinnerComment.trim() || null,`;

if (content.includes(oldSubmit)) {
  content = content.replace(oldSubmit, newSubmit);
  changes++;
  console.log('3. Updated submission payload');
} else {
  console.log('3. Old submission line NOT found - skipping');
}

fs.writeFileSync(filePath, content);
console.log('\\nDone! Made', changes, 'change(s)');
