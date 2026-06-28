import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const filePath = path.join(projectRoot, 'src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const DB = '${t.border}';
const DBA = '${t.accentBorder}';

// 1. Replace Resume Thali UI
const oldResume = [
  '        {activeRequest === \'resume\' && (',
  '          <div style={{ padding: \'0 16px 16px\' }}>',
  '            <div style={{ marginBottom: 12 }}>',
  '              <label style={{ display: \'block\', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: \'0.12em\', fontFamily: "\'DM Sans\',sans-serif" }}>RESUME FROM</label>',
  '              <input type="date" name="resumeFrom" value={resumeFrom} min={today} onChange={e => setResumeFrom(e.target.value)} style={inp} />',
  '            </div>',
  '            {error && <ErrorBanner msg={error} />}',
  '            <button onClick={() => handleSubmit(\'resume\')} disabled={submitting} style={{ width: \'100%\', padding: 12, borderRadius: 11, border: \'none\', background: submitting ? t.border : t.accentGrad, color: \'#fff\', fontWeight: 700, cursor: \'pointer\', fontSize: 14, fontFamily: "\'DM Sans\',sans-serif" }}>{submitting ? \'Submitting...\' : \'Submit Resume Request\'}</button>',
  '          </div>',
  '        )}'
].join('\n');

const newResume = [
  '        {activeRequest === \'resume\' && (',
  '          <div style={{ padding: \'0 16px 16px\' }}>',
  '            {!resumeMealType ? (',
  '              <div style={{ marginBottom: 12 }}>',
  '                <label style={{ display: \'block\', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: \'0.12em\', fontFamily: "\'DM Sans\',sans-serif" }}>SELECT MEAL TO RESUME</label>',
  '                <div style={{ display: \'flex\', gap: 8 }}>',
  '                  {[\'lunch\', \'dinner\', \'both\'].map(m => (',
  '                    <button key={m} onClick={() => setResumeMealType(m)}',
  '                      style={{ flex: 1, padding: \'12px 8px\', borderRadius: 11, border: \'1.5px solid ' + DB + '\', background: t.inputBg, color: t.text, fontWeight: 700, fontSize: 13, cursor: \'pointer\', fontFamily: "\'DM Sans\',sans-serif", textTransform: \'capitalize\' }}>',
  '                      {m === \'both\' ? \'Both\' : m}',
  '                    </button>',
  '                  ))}',
  '                </div>',
  '              </div>',
  '            ) : (',
  '              <>',
  '                <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: t.accentBg, border: \'1px solid ' + DBA + '\', textAlign: \'center\' }}>',
  '                  <span style={{ fontSize: 13, fontWeight: 700, color: t.accent, fontFamily: "\'DM Sans\',sans-serif" }}>Meal: {resumeMealType === \'both\' ? \'Both (Lunch & Dinner)\' : resumeMealType.charAt(0).toUpperCase() + resumeMealType.slice(1)}</span>',
  '                  <button onClick={() => setResumeMealType(null)} style={{ marginLeft: 10, background: \'none\', border: \'none\', color: t.textSub, cursor: \'pointer\', fontSize: 12, textDecoration: \'underline\' }}>Change</button>',
  '                </div>',
  '                <div style={{ marginBottom: 12 }}>',
  '                  <label style={{ display: \'block\', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: \'0.12em\', fontFamily: "\'DM Sans\',sans-serif" }}>RESUME FROM</label>',
  '                  <input type="date" name="resumeFrom" value={resumeFrom} min={today} onChange={e => setResumeFrom(e.target.value)} style={inp} />',
  '                </div>',
  '                {error && <ErrorBanner msg={error} />}',
  '                <button onClick={() => handleSubmit(\'resume\')} disabled={submitting} style={{ width: \'100%\', padding: 12, borderRadius: 11, border: \'none\', background: submitting ? t.border : t.accentGrad, color: \'#fff\', fontWeight: 700, cursor: \'pointer\', fontSize: 14, fontFamily: "\'DM Sans\',sans-serif" }}>{submitting ? \'Submitting...\' : \'Submit Resume Request\'}</button>',
  '              </>',
  '            )}',
  '          </div>',
  '        )}'
].join('\n');

console.log('Found old Resume UI:', content.includes(oldResume));
if (content.includes(oldResume)) {
  content = content.replace(oldResume, newResume);
  console.log('Resume UI replaced');
} else {
  const idx = content.indexOf('RESUME FROM');
  console.log('RESUME FROM at:', idx);
}

// 2. Replace Stop Thali UI
const oldStop = [
  '        {activeRequest === \'stop\' && (',
  '          <div style={{ padding: \'0 16px 16px\' }}>',
  '            <div style={{ display: \'grid\', gridTemplateColumns: \'1fr 1fr\', gap: 10, marginBottom: 12 }}>',
  '              <div><label style={{ display: \'block\', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: \'0.12em\', fontFamily: "\'DM Sans\',sans-serif" }}>FROM</label><input type="date" name="stopFrom" value={stopFrom} min={today} onChange={e => setStopFrom(e.target.value)} style={inp} /></div>',
  '              <div><label style={{ display: \'block\', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: \'0.12em\', fontFamily: "\'DM Sans\',sans-serif" }}>TO</label><input type="date" name="stopTo" value={stopTo} min={stopFrom || today} onChange={e => setStopTo(e.target.value)} style={inp} /></div>',
  '            </div>',
  '            {error && <ErrorBanner msg={error} />}',
  '            <button onClick={() => handleSubmit(\'stop\')} disabled={submitting} style={{ width: \'100%\', padding: 12, borderRadius: 11, border: \'none\', background: submitting ? t.border : \'linear-gradient(135deg,#e05555,#c03030)\', color: \'#fff\', fontWeight: 700, cursor: \'pointer\', fontSize: 14, fontFamily: "\'DM Sans\',sans-serif" }}>{submitting ? \'Submitting...\' : \'Submit Stop Request\'}</button>',
  '          </div>',
  '        )}'
].join('\n');

const newStop = [
  '        {activeRequest === \'stop\' && (',
  '          <div style={{ padding: \'0 16px 16px\' }}>',
  '            {!stopMealType ? (',
  '              <div style={{ marginBottom: 12 }}>',
  '                <label style={{ display: \'block\', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: \'0.12em\', fontFamily: "\'DM Sans\',sans-serif" }}>SELECT MEAL TO STOP</label>',
  '                <div style={{ display: \'flex\', gap: 8 }}>',
  '                  {[\'lunch\', \'dinner\', \'both\'].map(m => (',
  '                    <button key={m} onClick={() => setStopMealType(m)}',
  '                      style={{ flex: 1, padding: \'12px 8px\', borderRadius: 11, border: \'1.5px solid ' + DB + '\', background: t.inputBg, color: t.text, fontWeight: 700, fontSize: 13, cursor: \'pointer\', fontFamily: "\'DM Sans\',sans-serif", textTransform: \'capitalize\' }}>',
  '                      {m === \'both\' ? \'Both\' : m}',
  '                    </button>',
  '                  ))}',
  '                </div>',
  '              </div>',
  '            ) : (',
  '              <>',
  '                <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: t.accentBg, border: \'1px solid ' + DBA + '\', textAlign: \'center\' }}>',
  '                  <span style={{ fontSize: 13, fontWeight: 700, color: t.accent, fontFamily: "\'DM Sans\',sans-serif" }}>Meal: {stopMealType === \'both\' ? \'Both (Lunch & Dinner)\' : stopMealType.charAt(0).toUpperCase() + stopMealType.slice(1)}</span>',
  '                  <button onClick={() => setStopMealType(null)} style={{ marginLeft: 10, background: \'none\', border: \'none\', color: t.textSub, cursor: \'pointer\', fontSize: 12, textDecoration: \'underline\' }}>Change</button>',
  '                </div>',
  '                <div style={{ display: \'grid\', gridTemplateColumns: \'1fr 1fr\', gap: 10, marginBottom: 12 }}>',
  '                  <div><label style={{ display: \'block\', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: \'0.12em\', fontFamily: "\'DM Sans\',sans-serif" }}>FROM</label><input type="date" name="stopFrom" value={stopFrom} min={today} onChange={e => setStopFrom(e.target.value)} style={inp} /></div>',
  '                  <div><label style={{ display: \'block\', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: \'0.12em\', fontFamily: "\'DM Sans\',sans-serif" }}>TO</label><input type="date" name="stopTo" value={stopTo} min={stopFrom || today} onChange={e => setStopTo(e.target.value)} style={inp} /></div>',
  '                </div>',
  '                {error && <ErrorBanner msg={error} />}',
  '                <button onClick={() => handleSubmit(\'stop\')} disabled={submitting} style={{ width: \'100%\', padding: 12, borderRadius: 11, border: \'none\', background: submitting ? t.border : \'linear-gradient(135deg,#e05555,#c03030)\', color: \'#fff\', fontWeight: 700, cursor: \'pointer\', fontSize: 14, fontFamily: "\'DM Sans\',sans-serif" }}>{submitting ? \'Submitting...\' : \'Submit Stop Request\'}</button>',
  '              </>',
  '            )}',
  '          </div>',
  '        )}'
].join('\n');

console.log('Found old Stop UI:', content.includes(oldStop));
if (content.includes(oldStop)) {
  content = content.replace(oldStop, newStop);
  console.log('Stop UI replaced');
} else {
  const idx = content.indexOf('activeRequest === stop');
  console.log('activeRequest === stop at:', idx);
  if (idx > 0) console.log('Context:', content.substring(idx, idx + 200));
}

fs.writeFileSync(filePath, content);
console.log('Saved!');
