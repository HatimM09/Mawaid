import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/App.jsx','r',encoding='utf-8') as f:
    s = f.read()

changes = 0
N = chr(10)

# 1. SurveyModal: Replace percentage buttons with conditional number input
old = '''                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {[0, 25, 50, 100].map(pct => (
                      <button key={pct} onClick={() => setResponses(prev => ({ ...prev, [dish]: pct }))}
                        style={{ padding: '16px 4px', borderRadius: 14, border: `2px solid ${responses[dish] === pct ? t.accent : t.border}`, background: responses[dish] === pct ? t.accentBg : 'transparent', color: responses[dish] === pct ? t.accent : t.text, fontSize: 18, fontWeight: 800, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: '0.2s' }}>
                        {pct}%
                      </button>
                    ))}
                  </div>'''

new1 = '''                ) : currentMeal === 'lunch' && (idx <= 1 || (idx === 2 && !isPortionItem(dish))) ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: t.textSub, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: "'DM Sans',sans-serif"}}>Count:</span>
                    <input type="number" min="0" max="99" value={typeof responses[dish] === 'number' ? responses[dish] : 0}
                      onChange={e => setResponses(prev => ({ ...prev, [dish]: parseInt(e.target.value, 10) || 0 }))}
                      style={{ width: 70, padding: '8px 10px', borderRadius: 9, border: `1.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 15, fontWeight: 700, textAlign: 'center', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}
                      aria-label="Portion count" />
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {[0, 25, 50, 100].map(pct => (
                      <button key={pct} onClick={() => setResponses(prev => ({ ...prev, [dish]: pct }))}
                        style={{ padding: '16px 4px', borderRadius: 14, border: `2px solid ${responses[dish] === pct ? t.accent : t.border}`, background: responses[dish] === pct ? t.accentBg : 'transparent', color: responses[dish] === pct ? t.accent : t.text, fontSize: 18, fontWeight: 800, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: '0.2s' }}>
                        {pct}%
                      </button>
                    ))}
                  </div>'''

if old in s and 'currentMeal' not in s:
    s = s.replace(old, new1, 1)
    changes += 1
    print('1. SurveyModal lunch number input applied')
else:
    print('1. SurveyModal: already applied or pattern not found')

# 2. DailySurveyModal: Replace first occurrence only
old2 = '''                    <div style={{ display: 'flex', gap: 6 }}>
                      {[0, 25, 50, 100].map(pct => (
                        <button key={pct} onClick={() => setResponses(prev => ({ ...prev, [dish]: pct }))}
                          style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1.5px solid ${responses[dish] === pct ? t.accent : t.border}`, background: responses[dish] === pct ? t.accentBg : 'transparent', color: responses[dish] === pct ? t.accent : t.textSub, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>{pct}%</button>
                      ))}
                    </div>'''

new2 = '''                    {idx !== undefined && (idx <= 1 || (idx === 2 && !isPortionItem(dish))) ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: t.textSub, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: "'DM Sans',sans-serif"}}>Count:</span>
                        <input type="number" min="0" max="99" value={typeof responses[dish] === 'number' ? responses[dish] : 0}
                          onChange={e => setResponses(prev => ({ ...prev, [dish]: parseInt(e.target.value, 10) || 0 }))}
                          style={{ width: 60, padding: '8px 8px', borderRadius: 9, border: `1.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, fontWeight: 700, textAlign: 'center', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}
                          aria-label="Portion count" />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[0, 25, 50, 100].map(pct => (
                          <button key={pct} onClick={() => setResponses(prev => ({ ...prev, [dish]: pct }))}
                            style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1.5px solid ${responses[dish] === pct ? t.accent : t.border}`, background: responses[dish] === pct ? t.accentBg : 'transparent', color: responses[dish] === pct ? t.accent : t.textSub, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>{pct}%</button>
                        ))}
                      </div>
                    )'''

count2 = s.count(old2)
if count2 >= 1 and 'idx !== undefined' not in s:
    idx2 = s.find(old2)
    s = s[:idx2] + new2 + s[idx2 + len(old2):]
    changes += 1
    print(f'2. DailySurveyModal lunch: replaced 1 of {count2} occurrences')
else:
    print(f'2. DailySurveyModal: found {count2}, already applied={chr(34) + chr(105) + chr(100) + chr(120) + chr(32) + chr(33) + chr(61) + chr(61) in s}')

# 3. Add idx to menu.lunch.map
old3 = '{menu.lunch.map(dish => ('
new3 = '{menu.lunch.map((dish, idx) => ('
if old3 in s and 'menu.lunch.map((dish, idx)' not in s:
    s = s.replace(old3, new3, 1)
    changes += 1
    print('3. Added idx to menu.lunch.map')
else:
    print('3. idx already added or not found')

# Save
with open('src/App.jsx','w',encoding='utf-8') as f:
    f.write(s)
print(f'Done: {changes} changes')
