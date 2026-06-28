#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add resumeMealType and stopMealType state variables
old_states = "  const [resumeFrom, setResumeFrom] = useState('')\n  const [resumeTo, setResumeTo] = useState('')\n  const [stopFrom, setStopFrom] = useState('')\n  const [stopTo, setStopTo] = useState('')"
new_states = "  const [resumeFrom, setResumeFrom] = useState('')\n  const [resumeTo, setResumeTo] = useState('')\n  const [resumeMealType, setResumeMealType] = useState(null)\n  const [stopFrom, setStopFrom] = useState('')\n  const [stopTo, setStopTo] = useState('')\n  const [stopMealType, setStopMealType] = useState(null)"
if old_states in content:
    content = content.replace(old_states, new_states)
    print("States updated")
else:
    print("States NOT found - checking...")
    if "resumeMealType" in content:
        print("Already has resumeMealType - skipping")

# 2. Update resetAll
old_reset = "const resetAll = () => { setResumeFrom(''); setResumeTo(''); setStopFrom(''); setStopTo(''); setMiqaatOption(null); setExtraItems([{ name: '', qty: 1 }]); setError(''); setSuccess('') }"
new_reset = "const resetAll = () => { setResumeFrom(''); setResumeTo(''); setResumeMealType(null); setStopFrom(''); setStopTo(''); setStopMealType(null); setMiqaatOption(null); setExtraItems([{ name: '', qty: 1 }]); setError(''); setSuccess('') }"
if old_reset in content:
    content = content.replace(old_reset, new_reset)
    print("resetAll updated")
elif "resumeMealType" in content and "setResumeMealType(null)" in content:
    print("resetAll already updated")

# 3. Update handleSubmit resume
old_submit_resume = "      if (type === 'resume') { if (!resumeFrom) throw new Error('Please select a date'); payload = { ...payload, from_date: resumeFrom, to_date: null } }"
new_submit_resume = "      if (type === 'resume') {\n        if (!resumeMealType) throw new Error('Please select a meal option (Lunch, Dinner, or Both)')\n        if (!resumeFrom) throw new Error('Please select a date')\n        payload = { ...payload, from_date: resumeFrom, to_date: null, meal_type: resumeMealType }\n      }"
if old_submit_resume in content:
    content = content.replace(old_submit_resume, new_submit_resume)
    print("handleSubmit resume updated")
elif "meal_type: resumeMealType" in content:
    print("handleSubmit resume already updated")

# 4. Update handleSubmit stop
old_submit_stop = "      else if (type === 'stop') { if (!stopFrom || !stopTo) throw new Error('Please select both dates'); payload = { ...payload, from_date: stopFrom, to_date: stopTo } }"
new_submit_stop = "      else if (type === 'stop') {\n        if (!stopMealType) throw new Error('Please select a meal option (Lunch, Dinner, or Both)')\n        if (!stopFrom || !stopTo) throw new Error('Please select both dates')\n        payload = { ...payload, from_date: stopFrom, to_date: stopTo, meal_type: stopMealType }\n      }"
if old_submit_stop in content:
    content = content.replace(old_submit_stop, new_submit_stop)
    print("handleSubmit stop updated")
elif "meal_type: stopMealType" in content:
    print("handleSubmit stop already updated")

# 5. Replace Resume Thali UI with meal selection
old_resume_ui_start = "        {activeRequest === 'resume' && ("
old_resume_ui_end = "        )}"

resume_idx = content.find(old_resume_ui_start)
if resume_idx >= 0:
    end_idx = content.find(old_resume_ui_end, resume_idx)
    if end_idx >= 0:
        end_idx += len(old_resume_ui_end)
        old_resume_ui = content[resume_idx:end_idx]
        
        new_resume_ui = """        {activeRequest === 'resume' && (
          <div style={{ padding: '0 16px 16px' }}>
            {!resumeMealType ? (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>SELECT MEAL TO RESUME</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['lunch', 'dinner', 'both'].map(m => (
                    <button key={m} onClick={() => setResumeMealType(m)}
                      style={{ flex: 1, padding: '12px 8px', borderRadius: 11, border: '1.5px solid ${t.border}', background: t.inputBg, color: t.text, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", textTransform: 'capitalize' }}>
                      {m === 'both' ? 'Both' : m}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: t.accentBg, border: '1px solid ${t.accentBorder}', textAlign: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>Meal: {resumeMealType === 'both' ? 'Both (Lunch & Dinner)' : resumeMealType.charAt(0).toUpperCase() + resumeMealType.slice(1)}</span>
                  <button onClick={() => setResumeMealType(null)} style={{ marginLeft: 10, background: 'none', border: 'none', color: t.textSub, cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>Change</button>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>RESUME FROM</label>
                  <input type="date" name="resumeFrom" value={resumeFrom} min={today} onChange={e => setResumeFrom(e.target.value)} style={inp} />
                </div>
                {error && <ErrorBanner msg={error} />}
                <button onClick={() => handleSubmit('resume')} disabled={submitting} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : t.accentGrad, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>{submitting ? 'Submitting...' : 'Submit Resume Request'}</button>
              </>
            )}
          </div>
        )}"""
        
        content = content[:resume_idx] + new_resume_ui + content[end_idx:]
        print("Resume UI replaced")
    else:
        print("Resume UI end not found")
else:
    print("Resume UI start not found")

# 6. Replace Stop Thali UI with meal selection
old_stop_ui_start = "        {activeRequest === 'stop' && ("
stop_idx = content.find(old_stop_ui_start)
if stop_idx >= 0:
    end_idx = content.find(old_resume_ui_end, stop_idx)
    if end_idx >= 0:
        end_idx += len(old_resume_ui_end)
        old_stop_ui = content[stop_idx:end_idx]
        
        new_stop_ui = """        {activeRequest === 'stop' && (
          <div style={{ padding: '0 16px 16px' }}>
            {!stopMealType ? (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>SELECT MEAL TO STOP</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['lunch', 'dinner', 'both'].map(m => (
                    <button key={m} onClick={() => setStopMealType(m)}
                      style={{ flex: 1, padding: '12px 8px', borderRadius: 11, border: '1.5px solid ${t.border}', background: t.inputBg, color: t.text, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", textTransform: 'capitalize' }}>
                      {m === 'both' ? 'Both' : m}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: t.accentBg, border: '1px solid ${t.accentBorder}', textAlign: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>Meal: {stopMealType === 'both' ? 'Both (Lunch & Dinner)' : stopMealType.charAt(0).toUpperCase() + stopMealType.slice(1)}</span>
                  <button onClick={() => setStopMealType(null)} style={{ marginLeft: 10, background: 'none', border: 'none', color: t.textSub, cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>Change</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div><label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>FROM</label><input type="date" name="stopFrom" value={stopFrom} min={today} onChange={e => setStopFrom(e.target.value)} style={inp} /></div>
                  <div><label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>TO</label><input type="date" name="stopTo" value={stopTo} min={stopFrom || today} onChange={e => setStopTo(e.target.value)} style={inp} /></div>
                </div>
                {error && <ErrorBanner msg={error} />}
                <button onClick={() => handleSubmit('stop')} disabled={submitting} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : 'linear-gradient(135deg,#e05555,#c03030)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>{submitting ? 'Submitting...' : 'Submit Stop Request'}</button>
              </>
            )}
          </div>
        )}"""
        
        content = content[:stop_idx] + new_stop_ui + content[end_idx:]
        print("Stop UI replaced")
    else:
        print("Stop UI end not found")
else:
    print("Stop UI start not found")

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("All changes saved!")
