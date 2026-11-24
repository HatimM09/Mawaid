// src/admin/scanAudio.js — Pure browser audio chime & speech feedback for packaging TV views
let audioCtx = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return null
  if (!audioCtx) {
    try {
      audioCtx = new AudioContextClass()
    } catch {
      return null
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

/**
 * Play a synthesized audio cue:
 * - 'proceed': Pleasant ascending melodic double chime (587Hz -> 880Hz)
 * - 'skip' | 'stop': Gentle caution blip chord (440Hz -> 330Hz)
 * - 'neutral': Soft tick (660Hz)
 */
export function playScanSound(type = 'proceed') {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    if (type === 'proceed') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, now) // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08) // A5
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
      osc.start(now)
      osc.stop(now + 0.36)
    } else if (type === 'skip' || type === 'stop') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(440, now) // A4
      osc.frequency.setValueAtTime(329.63, now + 0.1) // E4
      gain.gain.setValueAtTime(0.22, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38)
      osc.start(now)
      osc.stop(now + 0.39)
    } else {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(659.25, now) // E5
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
      osc.start(now)
      osc.stop(now + 0.16)
    }
  } catch (e) {
    console.warn('Audio feedback failed:', e)
  }
}

/**
 * Voice synthesize scan dispatch status:
 * Allows packaging staff to hear dispatch decisions hands-free without looking at the screen.
 */
export function speakScanStatus(thaliNumber, status, meal = 'meal') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  try {
    window.speechSynthesis.cancel()
    const thaliStr = thaliNumber ? `Thali ${thaliNumber}. ` : ''
    let text = ''
    const s = String(status || '').toUpperCase()
    if (s.includes('APPLIED') || s.includes('PROCEED') || s.includes('YES')) {
      text = `${thaliStr}Proceed.`
    } else if (s.includes('SKIPPED') || s.includes('SKIP') || s.includes('NO')) {
      text = `${thaliStr}Skipped. Do not pack.`
    } else if (s.includes('STOP')) {
      text = `${thaliStr}Stop thali. No dispatch.`
    } else {
      text = `${thaliStr}Pending response.`
    }
    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = 1.05
    utter.pitch = 1.0
    utter.volume = 0.95
    window.speechSynthesis.speak(utter)
  } catch (e) {
    console.warn('Speech synthesis failed:', e)
  }
}
