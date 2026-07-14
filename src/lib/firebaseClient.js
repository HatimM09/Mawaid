// ══════════════════════════════════════════════════════════════
// AL-MAWAID — Supabase Client with Firebase FCM only
// Database: Supabase PostgreSQL
// Auth: Supabase Auth
// Notifications: Firebase Cloud Messaging (FCM)
// Storage: Cloudinary
// ══════════════════════════════════════════════════════════════
import { supabaseClient } from './supabaseClient'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || 'https://pquusffhuholbnlmuyen.supabase.co').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxdXVzZmZodWhvbGJubG11eWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzEzOTAsImV4cCI6MjA5OTM0NzM5MH0.lp8jDk4UalHg5dJHIxTinhqaCJ-OA1RVwcDjM3KxcTo').trim()

// ── Cloudinary config ──
const CLOUDINARY = {
  cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'hlkkskmr',
  uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'al-mawaid-unsigned',
}

export const auth = supabaseClient.auth

// ── Storage helpers (Cloudinary) ──
export const fbStorage = {
  from() {
    return {
      upload: async (_path, file) => {
        const form = new FormData()
        form.append('file', file)
        form.append('upload_preset', CLOUDINARY.uploadPreset)
        try {
          const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/auto/upload`, { method: 'POST', body: form })
          const json = await res.json()
          if (json.error) return { data: null, error: new Error(json.error.message) }
          return { data: { path: json.public_id, url: json.secure_url }, error: null }
        } catch (e) {
          return { data: null, error: e }
        }
      },
      getPublicUrl: (path) => ({
        data: { publicUrl: `https://res.cloudinary.com/${CLOUDINARY.cloudName}/image/upload/${path}` }
      }),
      download: async (path) => ({
        data: `https://res.cloudinary.com/${CLOUDINARY.cloudName}/image/upload/${path}`,
        error: null
      }),
      remove: async () => ({ data: null, error: null }),
    }
  }
}

// ── RPC helpers (admin user management via Supabase) ──

/** Create Supabase Auth user (via Edge Function admin-auth to avoid signup rate limits) */
export async function rpcCreateUser(email, password, metadata = {}) {
  if (!email) return { data: null, error: new Error('Email is required') }
  if (!password || password.length < 6) return { data: null, error: new Error('Password must be at least 6 characters') }

  try {
    const { data: { session } } = await supabaseClient.auth.getSession()
    const fnUrl = `${SUPABASE_URL}/functions/v1/admin-auth`
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ action: 'create_user', p_email: email, p_password: password, p_metadata: metadata }),
    })
    const result = await res.json()
    if (result.error) {
      if (result.error.message?.includes('already registered') || result.error.message?.includes('already exists')) {
        return { data: null, error: new Error(`Email "${email}" already exists. Use a different email or reset the password.`) }
      }
      return { data: null, error: new Error(result.error.message) }
    }
    return { data: result.data, error: null }
  } catch (e) {
    return { data: null, error: e }
  }
}

/** Update user profile (Supabase Auth — tries Edge Function first, then falls back) */
export async function rpcUpdateUser(payload) {
  const { p_user_id, p_email, p_password, p_metadata } = payload
  if (!p_user_id) return { data: null, error: new Error('User ID is required') }

  try {
    const { data: { session } } = await supabaseClient.auth.getSession()
    if (!session) return { data: null, error: new Error('Not authenticated') }

    // Update user_stats regardless
    if (p_metadata?.name || p_email) {
      await supabaseClient.from('user_stats').upsert({
        user_id: p_user_id,
        name: p_metadata?.name || undefined,
        email: p_email || undefined,
      }, { onConflict: 'user_id' })
    }

    // Try Edge Function for admin-level auth changes
    const fnUrl = `${SUPABASE_URL}/functions/v1/admin-auth`
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: 'update_user', p_user_id, p_email, p_password, p_metadata }),
    })
    const result = await res.json()
    if (!result.error) return { data: result.data, error: null }
  } catch (_) {}

  // Fallback: self-update only
  try {
    const updates = {}
    if (p_email && session?.user?.id === p_user_id) {
      const { error: emailErr } = await supabaseClient.auth.updateUser({ email: p_email })
      if (!emailErr) updates.email = true
    }
    if (p_password && session?.user?.id === p_user_id) {
      const { error: passErr } = await supabaseClient.auth.updateUser({ password: p_password })
      if (!passErr) updates.password = true
    }
    return { data: { ...updates, note: 'Auth changes applied to current user only' }, error: null }
  } catch (e) {
    return { data: { updated: true, note: 'Auth changes skipped. User stats updated.' }, error: null }
  }
}

/** Delete user (data cleanup, auth user must be deleted from Supabase dashboard) */
export async function rpcDeleteUser(payload) {
  const { p_user_id } = payload
  if (!p_user_id) return { data: null, error: new Error('User ID is required') }

  try {
    await supabaseClient.from('user_stats').delete().eq('user_id', p_user_id)
    await supabaseClient.from('notifications').delete().eq('user_id', p_user_id)
    await supabaseClient.from('push_subscriptions').delete().eq('user_id', p_user_id)
    await supabaseClient.from('survey_submissions_flat').delete().eq('user_id', p_user_id)
    await supabaseClient.from('thali_requests').delete().eq('user_id', p_user_id)
    await supabaseClient.from('daily_feedback').delete().eq('user_id', p_user_id)
    await supabaseClient.from('queries').delete().eq('user_id', p_user_id)
    return { data: { deleted: true, note: 'Data deleted. Auth user remains in Supabase (delete manually from dashboard).' }, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

/** Send password reset email via Supabase */
export async function rpcResetPassword(email) {
  if (!email) return { data: null, error: new Error('Email is required') }
  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email)
    if (error) return { data: null, error }
    return { data: true, error: null }
  } catch (e) {
    return { data: null, error: e }
  }
}

// ── Realtime channel helper (Supabase Realtime) ──

export function createChannel(name) {
  let channel = null
  const subs = []
  return {
    on(type, config, cb) {
      if (type === 'postgres_changes') {
        const table = config.table
        const filter = config.filter || ''
        const event = config.event || '*'
        if (!channel) {
          channel = supabaseClient.channel(name)
        }
        const sub = channel.on(
          'postgres_changes',
          { event, schema: 'public', table, filter },
          (payload) => cb({ new: payload.new, old: payload.old, eventType: payload.eventType })
        )
        subs.push(sub)
      }
      return this
    },
    subscribe(cb) {
      if (channel) {
        channel.subscribe((status) => {
          if (cb) cb(status === 'SUBSCRIBED' ? 'SUBSCRIBED' : status)
        })
      } else {
        if (cb) cb('SUBSCRIBED')
      }
      return this
    },
    unsubscribe() {
      if (channel) {
        supabaseClient.removeChannel(channel)
        channel = null
      }
      subs.length = 0
    }
  }
}

export function removeChannel(ch) {
  if (ch?.unsubscribe) ch.unsubscribe()
}

// ── Invoke Cloud Function helper (Supabase Edge Functions) ──
const FN_NAME_MAP = { 'sendPush': 'send-push' }

async function invokeFunction(name, body = {}) {
  const supabaseFnUrl = `${SUPABASE_URL}/functions/v1`
  const edgeFnName = FN_NAME_MAP[name]
  const isEdgeFn = !!edgeFnName
  const baseUrl = isEdgeFn
    ? supabaseFnUrl
    : import.meta.env.DEV
      ? '/cloudfunctions'
      : `https://us-central1-al-mawaid-8ffef.cloudfunctions.net`
  const url = `${baseUrl}/${edgeFnName || name}`
  try {
    const { data: { session } } = await supabaseClient.auth.getSession()
    const token = session?.access_token
    const headers = {
      'Content-Type': 'application/json',
    }
    // Supabase Edge Functions need the anon key for auth unless verify_jwt=false
    if (isEdgeFn) {
      headers['Authorization'] = `Bearer ${supabaseAnonKey}`
    } else if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
    return res.ok
      ? { data: await res.json(), error: null }
      : { data: null, error: new Error((await res.json()).error || 'Function error') }
  } catch (e) {
    return { data: null, error: e }
  }
}

// ── Custom Supabase client with RPC helpers ──
export const supabase = new Proxy(supabaseClient, {
  get(target, prop) {
    if (prop === 'rpc') {
      return (name, args) => {
        if (name === 'admin_create_user') return rpcCreateUser(args.p_email, args.p_password, args.p_metadata)
        if (name === 'admin_update_user') return rpcUpdateUser(args)
        if (name === 'admin_delete_user') return rpcDeleteUser(args)
        if (name === 'admin_reset_password') return rpcResetPassword(args.p_email)
        return target.rpc(name, args)
      }
    }
    if (prop === 'storage') return fbStorage
    if (prop === 'functions') return { invoke: invokeFunction }
    return target[prop]
  }
})
