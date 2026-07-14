// Supabase Edge Function: Admin Auth Operations
// Replaces the Firebase Cloud Function `supabaseAdminAuth`
// Requires `SUPABASE_SERVICE_ROLE_KEY` secret set in Supabase dashboard

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://pquusffhuholbnlmuyen.supabase.co'
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

serve(async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })

  try {
    if (!SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ data: null, error: { message: 'Service role key not configured' } }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { action, p_email, p_password, p_user_id, p_metadata } = await req.json()

    if (action === 'delete_user') {
      if (!p_user_id) throw new Error('User ID is required')
      const { error } = await supabaseAdmin.auth.admin.deleteUser(p_user_id)
      if (error) throw error
      return new Response(JSON.stringify({ data: { deleted: true }, error: null }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } })
    }

    if (action === 'create_user') {
      if (!p_email) throw new Error('Email is required')
      if (!p_password || p_password.length < 6) throw new Error('Password must be at least 6 characters')
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: p_email, password: p_password,
        email_confirm: true,
        user_metadata: p_metadata || {},
      })
      if (error) throw error
      return new Response(JSON.stringify({ data: data.user.id, error: null }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } })
    }

    if (action === 'update_user') {
      if (!p_user_id) throw new Error('User ID is required')
      const updates = {}
      if (p_email) updates.email = p_email
      if (p_password) updates.password = p_password
      if (p_metadata) updates.user_metadata = p_metadata
      if (Object.keys(updates).length) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(p_user_id, updates)
        if (error) throw error
      }
      return new Response(JSON.stringify({ data: { updated: true }, error: null }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } })
    }

    if (action === 'reset_password') {
      if (!p_email) throw new Error('Email is required')
      const { error } = await supabaseAdmin.auth.admin.resetPasswordForEmail(p_email)
      if (error) throw error
      return new Response(JSON.stringify({ data: true, error: null }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } })
    }

    throw new Error(`Unknown action: ${action}`)
  } catch (err) {
    return new Response(JSON.stringify({ data: null, error: { message: err.message } }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } })
  }
})
