// ══════════════════════════════════════════════════════════════
// AL-MAWAID — Firebase Client (direct Firebase SDK access)
// Firestore DB, Cloud Functions, Cloudinary Storage
// Auth is handled by Supabase (see supabaseClient.js)
// ══════════════════════════════════════════════════════════════
import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, startAfter, endBefore, limitToLast, documentId,
  onSnapshot, getCountFromServer, serverTimestamp, writeBatch
} from 'firebase/firestore'
import { supabaseClient } from './supabaseClient'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCFQqTnz_CiVIKtDW4XH6CswPAm_KwN6jc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "al-mawaid-8ffef.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "al-mawaid-8ffef",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "al-mawaid-8ffef.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "333277268731",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:333277268731:web:9f7ba7f8f279a47f94be5e",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-J5D0YKG986"
}

const app = initializeApp(firebaseConfig)
export const auth = supabaseClient.auth
export const db = getFirestore(app)
export const API_KEY = firebaseConfig.apiKey

// ── Cloudinary config ──
const CLOUDINARY = {
  cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'hlkkskmr',
  uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'al-mawaid-unsigned',
}

// ── Collection name mapping (Supabase → Firestore) ──
export const C = {
  user_stats: 'userStats', staff: 'staff', khidmat_guzaar: 'khidmatGuzar',
  weekly_menu: 'weeklyMenu', survey_submissions_flat: 'surveySubmissions',
  daily_feedback: 'dailyFeedback', thali_requests: 'thaliRequests',
  queries: 'queries', notices: 'notices', inventory: 'inventory',
  inventory_log: 'inventoryLog', app_settings: 'appSettings',
  push_subscriptions: 'pushSubscriptions', notifications: 'notifications',
  broadcast_templates: 'broadcastTemplates', broadcast_schedule: 'broadcastSchedule',
}

// ── Helper: get Firestore collection reference from supabase-style name ──
export const getCol = (table) => collection(db, C[table] || table)

// ── Helper: get Firestore doc reference by id ──
export const getDocRef = (table, id) => doc(db, C[table] || table, id)

// ── Auth is handled by Supabase (src/lib/supabaseClient.js) ──
// All auth methods are available via supabase.auth.* or the `auth` export

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

// ── Functions helper ──

export async function invokeFunction(name, body = {}) {
  const baseUrl = import.meta.env.DEV
    ? '/cloudfunctions'
    : `https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net`
  const url = `${baseUrl}/${name}`
  try {
    const { data: { session } } = await auth.getSession()
    const token = session?.access_token
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    })
    return res.ok
      ? { data: await res.json(), error: null }
      : { data: null, error: new Error((await res.json()).error || 'Function error') }
  } catch (e) {
    return { data: null, error: e }
  }
}

// ── RPC helpers (admin user management) ──

/** Create Supabase Auth user (client-side sign-up) */
export async function rpcCreateUser(email, password, metadata = {}) {
  if (!email) return { data: null, error: new Error('Email is required') }
  if (!password || password.length < 6) return { data: null, error: new Error('Password must be at least 6 characters') }

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email, password,
      options: { data: metadata }
    })
    if (error) {
      if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
        return { data: null, error: new Error(`Email "${email}" already exists. Use a different email or reset the password.`) }
      }
      return { data: null, error }
    }
    if (!data.user) return { data: null, error: new Error('Failed to create user. The user may need to confirm their email.') }
    return { data: data.user.id, error: null }
  } catch (e) {
    return { data: null, error: e }
  }
}

/** Update user profile (Firestore only — Auth email/password changes require Supabase Dashboard or Blaze plan) */
export async function rpcUpdateUser(payload) {
  const { p_user_id } = payload
  if (!p_user_id) return { data: null, error: new Error('User ID is required') }

  try {
    const { data, error } = await invokeFunction('supabaseAdminAuth', { action: 'update_user', ...payload })
    if (!error) return { data, error: null }
  } catch (_) {}

  return { data: { updated: true, note: 'Auth changes skipped (requires service_role key). Firestore data updated.' }, error: null }
}

/** Delete user (Firestore + try Supabase Auth via Cloud Function) */
export async function rpcDeleteUser(payload) {
  const { p_user_id } = payload
  if (!p_user_id) return { data: null, error: new Error('User ID is required') }

  try {
    const { error } = await invokeFunction('supabaseAdminAuth', { action: 'delete_user', p_user_id })
    if (!error) return { data: { deleted: true }, error: null }
  } catch (_) {}

  try {
    await deleteDoc(doc(db, C.user_stats, p_user_id))
    const cleanup = async () => {
      try {
        const queries = [
          query(collection(db, C.notifications), where('user_id', '==', p_user_id)),
          query(collection(db, C.push_subscriptions), where('user_id', '==', p_user_id)),
          query(collection(db, C.survey_submissions_flat), where('user_id', '==', p_user_id)),
          query(collection(db, C.thali_requests), where('user_id', '==', p_user_id)),
          query(collection(db, C.daily_feedback), where('user_id', '==', p_user_id)),
        ]
        const snapshots = await Promise.all(queries.map(q => getDocs(q)))
        await Promise.allSettled(snapshots.flatMap(snap => snap.docs.map(d => deleteDoc(d.ref))))
      } catch (e) { console.warn('Cleanup error (non-fatal):', e) }
    }
    cleanup()
    return { data: { deleted: true, note: 'Firestore data deleted. Auth user remains in Supabase.' }, error: null }
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

/** Generic RPC call */
export async function rpc(name, args) {
  return invokeFunction(`rpc-${name}`, args)
}

// ── Realtime channel helper (Firestore onSnapshot) ──

export function createChannel(name) {
  const subs = []
  return {
    on(type, config, cb) {
      if (type === 'postgres_changes') {
        const t = C[config.table] || config.table
        let cons = []
        if (config.filter) {
          const m = config.filter.match(/(\w+)=eq\.(.+)/)
          if (m) cons.push(where(m[1], '==', m[2]))
        }
        const q = cons.length ? query(collection(db, t), ...cons) : collection(db, t)
        subs.push(onSnapshot(q, (snap) => {
          snap.docChanges().forEach(c => {
            let et = c.type === 'added' ? 'INSERT' : c.type === 'modified' ? 'UPDATE' : 'DELETE'
            if (config.event === '*' || config.event === et) {
              cb({ new: { id: c.doc.id, ...c.doc.data() }, old: {}, eventType: et })
            }
          })
        }))
      }
      return this
    },
    subscribe(cb) { if (cb) cb('SUBSCRIBED'); return this },
    unsubscribe() { subs.forEach(u => u()); subs.length = 0 }
  }
}

export function removeChannel(ch) {
  if (ch?.unsubscribe) ch.unsubscribe()
}

// ── Query builder (for backward compat, converts chained calls to Firestore) ──

export class Q {
  constructor(table) {
    this.t = C[table] || table
    this.w = []
    this.o = []
    this.l = null
    this.f = null
    this.i = this.u = this.d = this.ups = null
    this.sc = this.ms = false
    this.cn = false
    this.sf = null
    this._or = null
    this.r = null
    this.joins = []
  }
  select(s, o) {
    if (o?.count === 'exact') this.cn = true
    if (s && s !== '*') {
      this.sf = null; this.joins = []
      const joinRegex = /(\w+)\s*\(([^)]*)\)/g; let match; let remaining = s
      while ((match = joinRegex.exec(s)) !== null) {
        this.joins.push({ table: match[1].trim(), fields: match[2].trim() })
        remaining = remaining.replace(match[0], '')
      }
      const fields = remaining.split(',').map(x => x.trim()).filter(Boolean)
      if (fields.length > 0 && !fields.includes('*')) this.sf = fields
    }
    return this
  }
  eq(k, v) { return this._w(k, '==', v) }
  neq(k, v) { return this._w(k, '!=', v) }
  gt(k, v) { return this._w(k, '>', v) }
  gte(k, v) { return this._w(k, '>=', v) }
  lt(k, v) { return this._w(k, '<', v) }
  lte(k, v) { return this._w(k, '<=', v) }
  is(k, v) { return v === null ? this._w(k, '==', null) : this }
  not(k, op, v) { return op === 'is' && v === null ? this._w(k, '!=', null) : this }
  in(k, v) { this.w.push({ k, o: 'in', v }); return this }
  contains(k, v) { this.w.push({ k, o: 'array-contains', v }); return this }
  ilike(k, v) { this.w.push({ k, o: 'ilike', v }); return this }
  like(k, v) { return this.ilike(k, v) }
  or(s) { this._or = s; return this }
  range(start, end) { this.r = [start, end]; return this }
  order(k, o) { this.o.push({ k, d: o?.ascending === false ? 'desc' : 'asc' }); return this }
  limit(n) { this.l = n; return this }
  single() { this.sc = true; return this }
  maybeSingle() { this.ms = true; return this }
  insert(d) { this.i = d; return this }
  update(d) { this.u = d; return this }
  delete() { this.d = true; return this }
  upsert(d, o) { this.ups = { d, o }; return this }
  onConflict() { return this }
  _w(k, o, v) { this.w.push({ k, o, v }); return this }

  async _exec() {
    const col = collection(db, this.t)
    let cons = []
    for (const c of this.w) {
      if (c.k === 'id') {
        if (c.o === '!=' && c.v === -1) continue
        cons.push(where(documentId(), c.o, String(c.v)))
        continue
      }
      if (c.o === 'in') cons.push(where(c.k, 'in', c.v))
      else if (c.o === 'array-contains') cons.push(where(c.k, 'array-contains', c.v))
      else if (c.o === 'ilike') {}
      else cons.push(where(c.k, c.o, c.v))
    }
    for (const o of this.o) cons.push(orderBy(o.k, o.d))
    if (this.r) { const end = this.r[1]; cons.push(limit(end + 1)) }
    else if (this.l) cons.push(limit(this.l))
    const ref = cons.length ? query(col, ...cons) : col
    const snap = await getDocs(ref)
    let res = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    if (this.r) res = res.slice(this.r[0], this.r[1] + 1)
    for (const c of this.w) {
      if (c.o === 'ilike') {
        const p = c.v.toLowerCase().replace(/%/g, '')
        res = res.filter(r => {
          const v = String(r[c.k] || '').toLowerCase()
          if (c.v.startsWith('%') && c.v.endsWith('%')) return v.includes(p)
          if (c.v.startsWith('%')) return v.endsWith(p)
          if (c.v.endsWith('%')) return v.startsWith(p)
          return v === p
        })
      }
    }
    if (this._or) {
      const parts = this._or.split(',').map(s => s.trim())
      res = res.filter(r => parts.some(cond => {
        const p = cond.split('.')
        if (p.length < 2) return false
        const f = p[0], op = p[1], val = p.slice(2).join('.')
        const a = r[f]
        if (op === 'eq') return String(a) === val
        if (op === 'is' && val === 'null') return a === null || a === undefined
        if (op === 'neq') return String(a) !== val
        return false
      }))
    }
    if (this.sf) res = res.map(r => {
      const o = {}
      this.sf.forEach(f => { if (f in r) o[f] = r[f] })
      return o
    })
    for (const join of this.joins) {
      const joinColName = C[join.table] || join.table
      const joinSnap = await getDocs(collection(db, joinColName))
      let joinData = joinSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      if (join.fields && join.fields !== '*') {
        const joinFields = join.fields.split(',').map(x => x.trim()).filter(Boolean)
        if (joinFields.length) joinData = joinData.map(r => {
          const o = {}
          joinFields.forEach(f => { if (f in r) o[f] = r[f] })
          return o
        })
      }
      if (this.t === C.survey_submissions_flat || this.t === 'surveySubmissions') {
        const map = {}
        joinData.forEach(jd => { map[jd.user_id] = jd })
        res = res.map(r => ({ ...r, [join.table]: map[r.user_id] || null }))
      } else {
        const map = {}
        joinData.forEach(jd => {
          if (!map[jd.user_id]) map[jd.user_id] = []
          map[jd.user_id].push(jd)
        })
        res = res.map(r => ({ ...r, [join.table]: map[r.user_id] || [] }))
      }
    }
    return res
  }

  _applyFieldFilter(items) {
    if (!this.sf) return items
    return items.map(r => {
      const o = {}
      this.sf.forEach(f => { if (f in r) o[f] = r[f] })
      return o
    })
  }
  _singleResult(data) {
    if (this.ms) return { data: data[0] || null, error: null, count: null }
    if (this.sc) return { data: data[0] || null, error: data.length === 0 ? { code: 'PGRST116', message: 'Not found' } : null, count: null }
    return { data, error: null, count: null }
  }

  then(resolve, reject) {
    const run = async () => {
      try {
        if (this.i) {
          const items = Array.isArray(this.i) ? this.i : [this.i]
          const out = []
          for (const item of items) {
            const ref = await addDoc(collection(db, this.t), { ...item, created_at: serverTimestamp() })
            out.push({ id: ref.id, ...item })
          }
          return this._singleResult(this._applyFieldFilter(out))
        }
        if (this.d) {
          if (this.w.length) {
            const res = await this._exec()
            for (const r of res) await deleteDoc(doc(db, this.t, r.id))
          }
          return { data: null, error: null, count: null }
        }
        if (this.u) {
          let out = []
          if (this.w.length) {
            const res = await this._exec()
            for (const r of res) await updateDoc(doc(db, this.t, r.id), { ...this.u, updated_at: serverTimestamp() })
            const ids = res.map(r => r.id)
            for (const id of ids) {
              const snap = await getDoc(doc(db, this.t, id))
              if (snap.exists()) out.push({ id: snap.id, ...snap.data() })
            }
          }
          return out.length ? this._singleResult(this._applyFieldFilter(out)) : { data: null, error: null, count: null }
        }
        if (this.ups) {
          const items = Array.isArray(this.ups.d) ? this.ups.d : [this.ups.d]
          const conflictF = (this.ups.o?.onConflict || 'id').split(',').map(s => s.trim())
          const out = []
          for (const item of items) {
            const missing = conflictF.some(f => item[f] === undefined || item[f] === null)
            if (missing) {
              const ref = await addDoc(collection(db, this.t), { ...item, created_at: serverTimestamp(), updated_at: serverTimestamp() })
              out.push({ id: ref.id, ...item })
              continue
            }
            const w = conflictF.map(f => where(f, '==', item[f]))
            const existing = await getDocs(query(collection(db, this.t), ...w))
            if (!existing.empty) {
              const e = existing.docs[0]
              await updateDoc(doc(db, this.t, e.id), { ...item, updated_at: serverTimestamp() })
              const snap = await getDoc(doc(db, this.t, e.id))
              out.push(snap.exists() ? { id: snap.id, ...snap.data() } : { id: e.id, ...item })
            } else {
              const ref = await addDoc(collection(db, this.t), { ...item, created_at: serverTimestamp(), updated_at: serverTimestamp() })
              out.push({ id: ref.id, ...item })
            }
          }
          return this._singleResult(this._applyFieldFilter(out))
        }
        let totalCount = null
        if (this.cn && !this.i && !this.u && !this.d && !this.ups) {
          const col = collection(db, this.t)
          let cons = []
          for (const c of this.w) {
            if (c.k === 'id') {
              if (c.o === '!=' && c.v === -1) continue
              cons.push(where(documentId(), c.o, String(c.v)))
              continue
            }
            if (c.o !== 'ilike' && c.o !== 'or') cons.push(where(c.k, c.o, c.v))
          }
          const ref = cons.length ? query(col, ...cons) : col
          const snap = await getCountFromServer(ref)
          totalCount = snap.data().count
        }
        const res = await this._exec()
        if (this.ms) return { data: res[0] || null, error: null, count: totalCount }
        if (this.sc) return { data: res[0] || null, error: res.length === 0 ? { code: 'PGRST116', message: 'Not found' } : null, count: totalCount }
        return { data: res, error: null, count: totalCount }
      } catch (err) {
        return { data: null, error: err, count: null }
      }
    }
    const p = run()
    p.then(resolve).catch(reject)
    return p
  }
  catch(reject) { return this.then(undefined, reject) }
  finally(fn) {
    return this.then(
      v => { fn(); return v },
      r => { fn(); throw r }
    )
  }
}

function proxyQ(q) {
  return new Proxy(q, {
    get(t, p) {
      if (p === 'then') return t.then.bind(t)
      if (typeof t[p] === 'function') return (...a) => { const r = t[p](...a); return r instanceof Q ? proxyQ(r) : r }
      return t[p]
    }
  })
}

// ── Exported supabase-compatible object (backward compat) ──
export const supabase = {
  from(table) { return proxyQ(new Q(table)) },
  get auth() { return supabaseClient.auth },
  get storage() { return fbStorage },
  get functions() { return { invoke: invokeFunction } },
  rpc: (name, args) => {
    if (name === 'admin_create_user') return rpcCreateUser(args.p_email, args.p_password, args.p_metadata)
    if (name === 'admin_update_user') return rpcUpdateUser(args)
    if (name === 'admin_delete_user') return rpcDeleteUser(args)
    if (name === 'admin_reset_password') return rpcResetPassword(args.p_email)
    return rpc(name, args)
  },
  channel: createChannel,
  removeChannel,
}
