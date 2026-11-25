// src/admin/scanParser.js — Unified Precision Scanner Parser & User Resolver
import { supabase } from '../lib/firebaseClient'
import { playScanSound } from './scanAudio'

/**
 * Extracts the user identifier or thali number from any scanned raw string:
 * - ALMAWAID:123
 * - https://al-mawaid.web.app/post?thali=123 or ?userId=xyz
 * - JSON: {"thali": "123"} or {"user_id": "..."}
 * - Raw numbers / hash prefixed: #123, 042, 123
 * - UUIDs
 */
export function extractScanTarget(rawText) {
  if (!rawText) return ''
  let text = String(rawText).trim()

  // 1. Try URL parameter extraction
  if (text.startsWith('http://') || text.startsWith('https://')) {
    try {
      const url = new URL(text)
      const param = url.searchParams.get('userId') ||
                    url.searchParams.get('user_id') ||
                    url.searchParams.get('id') ||
                    url.searchParams.get('thali') ||
                    url.searchParams.get('thali_number') ||
                    url.searchParams.get('scan') ||
                    url.searchParams.get('u')
      if (param) return param.trim()
    } catch {}
  }

  // 2. Try JSON payload
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text)
      const val = parsed.userId || parsed.user_id || parsed.id || parsed.thali || parsed.thali_number
      if (val) return String(val).trim()
    } catch {}
  }

  // 3. Strip any ALMAWAID prefix (case-insensitive, handles partial prefix)
  text = text.replace(/^.*almawaid:\s*/i, '').trim()

  // 4. Strip leading/trailing colons, hashes, quotes, dashes, spaces
  text = text.replace(/^[:#"'`\s\-]+/, '').replace(/[:#"'`\s\-]+$/, '').trim()

  return text
}

/**
 * Cleans a thali number into a comparable string:
 * e.g. " #042 " -> "42", "A-12" -> "a12"
 */
export function cleanThaliComparable(val) {
  if (val == null) return ''
  const str = String(val).toLowerCase().replace(/[^a-z0-9]/g, '')
  // Strip leading zeroes for pure numbers (042 -> 42)
  if (/^\d+$/.test(str)) {
    return str.replace(/^0+/, '') || '0'
  }
  return str
}

/**
 * High-precision user lookup:
 * 1. Checks in-memory cached user list first (instant)
 * 2. Checks Supabase user_stats by user_id / id / thali_number / email
 * 3. Handles zero-stripped thali numbers (e.g. barcode scanner sends 0042 for thali 42)
 */
export async function resolveScannedUser(rawInput, cachedUsers = []) {
  if (!rawInput) return null
  const target = extractScanTarget(rawInput)
  if (!target) return null

  const compTarget = cleanThaliComparable(target)
  const normTarget = target.toLowerCase().trim()

  // 1. In-memory check against cachedUsers
  if (Array.isArray(cachedUsers) && cachedUsers.length > 0) {
    const match = cachedUsers.find(u => {
      if (!u) return false
      if (u.user_id && String(u.user_id).trim().toLowerCase() === normTarget) return true
      if (u.id && String(u.id).trim().toLowerCase() === normTarget) return true
      if (u.email && String(u.email).trim().toLowerCase() === normTarget) return true
      if (u.thali_number) {
        if (String(u.thali_number).trim().toLowerCase() === normTarget) return true
        if (compTarget && cleanThaliComparable(u.thali_number) === compTarget) return true
      }
      if (u.user_id && compTarget && cleanThaliComparable(u.user_id) === compTarget) return true
      return false
    })
    if (match) return match
  }

  // 2. Database direct lookup
  // Check user_id exact
  const { data: byUserId } = await supabase.from('user_stats').select('*').eq('user_id', target).maybeSingle()
  if (byUserId) return byUserId

  if (compTarget && compTarget !== target) {
    const { data: byCompUserId } = await supabase.from('user_stats').select('*').eq('user_id', compTarget).maybeSingle()
    if (byCompUserId) return byCompUserId
  }

  // Check UUID id
  if (/^[0-9a-f-]{30,}$/i.test(target)) {
    const { data: byId } = await supabase.from('user_stats').select('*').eq('id', target).maybeSingle()
    if (byId) return byId
  }

  // Check thali_number exact
  const { data: byThali } = await supabase.from('user_stats').select('*').eq('thali_number', target).maybeSingle()
  if (byThali) return byThali

  // Check thali_number with '#'
  const { data: byThaliHash } = await supabase.from('user_stats').select('*').eq('thali_number', `#${target}`).maybeSingle()
  if (byThaliHash) return byThaliHash

  if (compTarget && compTarget !== target) {
    const { data: byCompThali } = await supabase.from('user_stats').select('*').eq('thali_number', compTarget).maybeSingle()
    if (byCompThali) return byCompThali
    const { data: byCompThaliHash } = await supabase.from('user_stats').select('*').eq('thali_number', `#${compTarget}`).maybeSingle()
    if (byCompThaliHash) return byCompThaliHash
  }

  // Check email
  if (target.includes('@')) {
    const { data: byEmail } = await supabase.from('user_stats').select('*').ilike('email', target).maybeSingle()
    if (byEmail) return byEmail
  }

  // 3. Fallback: match against all users in user_stats for normalized thali / user_id
  const { data: allUsers } = await supabase.from('user_stats').select('*')
  if (allUsers && allUsers.length > 0) {
    const normMatch = allUsers.find(u => {
      if (u.thali_number && compTarget && cleanThaliComparable(u.thali_number) === compTarget) return true
      if (u.user_id && compTarget && cleanThaliComparable(u.user_id) === compTarget) return true
      if (u.email && u.email.toLowerCase().trim() === normTarget) return true
      return false
    })
    if (normMatch) return normMatch
  }

  return null
}
