// src/admin/StaffPage.jsx
import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Plus, Trash2, RefreshCw, Shield } from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Table, Badge, Btn, Spinner, Alert, Input, fmtDate } from './ui'

export default function StaffPage() {
  const [loading, setLoading]   = useState(true)
  const [staff, setStaff]       = useState([])
  const [showAdd, setShowAdd]   = useState(false)
  const [form, setForm]         = useState({ name: '', email: '', role: 'khidmat_guzar', phone: '' })
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState({ text: '', type: 'success' })

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('staff').select('*').order('created_at', { ascending: false })
    setStaff(data || [])
    setLoading(false)
  }

  // ── REALTIME SUBSCRIPTION ──
  useEffect(() => {
    const channel = supabase
      .channel('staff-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, () => {
        load()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email) return setMsg({ text: 'Name and email are required.', type: 'error' })
    setSaving(true)
    
    // Sanitize role for database constraint
    const sanitizedForm = {
      ...form,
      role: form.role.toLowerCase().trim().replace(/\s+/g, '_')
    }

    const { error } = await supabase.from('staff').insert(sanitizedForm)
    setSaving(false)
    if (error) return setMsg({ text: `Database Error: ${error.message}. Please ensure the role is valid.`, type: 'error' })
    setMsg({ text: 'Staff member added successfully.', type: 'success' })
    setForm({ name: '', email: '', role: 'khidmat_guzar', phone: '' })
    setShowAdd(false)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Remove this staff member?')) return
    await supabase.from('staff').delete().eq('id', id)
    setStaff(prev => prev.filter(s => s.id !== id))
  }

  const ROLE_COLORS = {
    khidmat_guzar: '#c49c5a',
    khidmat: '#c49c5a',
    admin: '#5e9ce0',
    supervisor: '#9b8de0',
    inventory_manager: '#f59e0b',
    cook: '#5eba82',
  }

  const rows = staff.map(s => [
    <div>
      <div style={{ fontWeight: 600, color: T.text, fontSize: 14 }}>{s.name}</div>
      <div style={{ color: T.textSub, fontSize: 12 }}>{s.email}</div>
    </div>,
    <Badge color={ROLE_COLORS[s.role] || T.accent}>{(s.role || '').replace('_', ' ')}</Badge>,
    s.phone || '—',
    fmtDate(s.created_at),
    <Btn size="sm" variant="danger" onClick={() => handleDelete(s.id)}>
      <Trash2 size={13} />Remove
    </Btn>,
  ])

  return (
    <PageWrap>
      <PageTitle sub={`${staff.length} staff members`}>Staff / Khidmat Guzar</PageTitle>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20, gap: 10 }}>
        <Btn variant="outline" onClick={load}><RefreshCw size={15} />Refresh</Btn>
        <Btn onClick={() => setShowAdd(s => !s)}><Plus size={15} />Add Staff</Btn>
      </div>

      {msg.text && (
        <div style={{ marginBottom: 16 }}>
          <Alert msg={msg.text} type={msg.type} />
        </div>
      )}

      {/* Add Form */}
      {showAdd && (
        <AdminCard style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 18, display: 'flex', gap: 10, alignItems: 'center' }}>
            <Shield size={16} color={T.accent} />Add New Staff Member
          </div>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Input label="Full Name" name="staffName" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Hussain Bhai" required />
              <Input label="Email" name="staffEmail" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="hussain@email.com" required />
              <Input label="Phone" name="staffPhone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 99999 00000" />
              <div>
                <label htmlFor="staffRole" style={{ display: 'block', color: T.textSub, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Role</label>
                <select id="staffRole" name="staffRole" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}>
                  <option value="khidmat_guzar">Khidmat Guzar</option>
                  <option value="khidmat">Al-Mawaid Team (Khidmat)</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="inventory_manager">Inventory Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn type="button" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
              <Btn type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add Staff'}</Btn>
            </div>
          </form>
        </AdminCard>
      )}

      {loading ? <Spinner /> : (
        <AdminCard style={{ padding: 0 }}>
          <Table
            headers={['Member', 'Role', 'Phone', 'Added', 'Actions']}
            rows={rows}
            emptyMsg="No staff members yet. Add your first one above."
          />
        </AdminCard>
      )}
    </PageWrap>
  )
}
