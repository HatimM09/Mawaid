// scripts/generate-chime.mjs
// Generates Al-Mawaid notification chime variants as 16-bit mono WAV files.
// Usage:
//   node scripts/generate-chime.mjs            → writes all variants to public/sounds/preview/
//   node scripts/generate-chime.mjs soft-chime → installs that variant as the active chime
import fs from 'node:fs'
import path from 'node:path'

const SR = 44100

// Each note: freq, start(s), dur(s), amp — marimba-like: sine + soft 2nd harmonic, exponential decay
const renderWav = (notes, total) => {
  const N = Math.round(total * SR)
  const buf = Buffer.alloc(44 + N * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 2, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28)
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 2, 40)
  for (let i = 0; i < N; i++) {
    const t = i / SR
    let s = 0
    for (const n of notes) {
      const dt = t - n.start
      if (dt < 0) continue
      if (dt > n.dur) continue
      const decay = Math.exp(-dt * (n.decay ?? 7.5))
      const attack = dt < 0.012 ? dt / 0.012 : 1
      const fade = t > n.start + n.dur - 0.05 ? (n.start + n.dur - t) / 0.05 : 1
      s += n.amp * Math.sin(2 * Math.PI * n.freq * dt) * decay * attack * Math.max(0, fade)
      s += n.amp * (n.h2 ?? 0.25) * Math.sin(4 * Math.PI * n.freq * dt) * decay * attack * Math.max(0, fade)
    }
    s *= Math.min(1, (total - t) / 0.05) // always end at true silence
    let v = Math.max(-1, Math.min(1, s * 0.9))
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2)
  }
  return buf
}

export const VARIANTS = {
  // 1 · Soft two-tone chime (current default) — calm, premium feel
  'soft-chime': {
    total: 0.9,
    notes: [
      { freq: 987.77, start: 0.00, dur: 0.42, amp: 0.55 },  // B5
      { freq: 1318.51, start: 0.16, dur: 0.62, amp: 0.70 }, // E6
    ],
  },
  // 2 · Crisp double-ding — alert something arrived, brighter & shorter
  'crisp-ding': {
    total: 0.8,
    notes: [
      { freq: 987.77, start: 0.00, dur: 0.16, amp: 0.72, decay: 11, h2: 0.15 },  // B5
      { freq: 1318.51, start: 0.18, dur: 0.50, amp: 0.80, decay: 9 },            // E6
    ],
  },
  // 3 · Warm bell — lower, richer, distinctive "Al-Mawaid" identity
  'warm-bell': {
    total: 1.1,
    notes: [
      { freq: 783.99, start: 0.00, dur: 0.60, amp: 0.60, decay: 6.5, h2: 0.35 }, // G5
      { freq: 1046.50, start: 0.14, dur: 0.85, amp: 0.68, decay: 6.0, h2: 0.35 },// C6
    ],
  },
}

const previewDir = path.join('public', 'sounds', 'preview')
fs.mkdirSync(previewDir, { recursive: true })

const install = process.argv[2]
if (install) {
  const v = VARIANTS[install]
  if (!v) {
    console.error(`Unknown variant "${install}". Options: ${Object.keys(VARIANTS).join(', ')}`)
    process.exit(1)
  }
  const wav = renderWav(v.notes, v.total)
  fs.writeFileSync(path.join('android', 'app', 'src', 'main', 'res', 'raw', 'al_mawaid_chime.wav'), wav)
  fs.writeFileSync(path.join('public', 'sounds', 'al_mawaid_chime.wav'), wav)
  console.log(`✅ Installed "${install}" as the active chime (android res/raw + public/sounds)`)
} else {
  for (const [name, v] of Object.entries(VARIANTS)) {
    fs.writeFileSync(path.join(previewDir, `${name}.wav`), renderWav(v.notes, v.total))
    console.log(`generated preview/${name}.wav`)
  }
}
