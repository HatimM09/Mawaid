// src/admin/InventoryPage.jsx
import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { 
  Outlet, useLocation, useOutletContext 
} from 'react-router-dom'
import {
  Package, Plus, ArrowUpRight, ArrowDownRight,
  History, AlertTriangle, RefreshCw, X, Search
} from 'lucide-react'
import {
  T, PageWrap, PageTitle, AdminCard, Table,
  Badge, Btn, Spinner, StatCard, Grid,
  Input, Select, Alert
} from './ui'

const CATEGORIES = [
  { id: 1, name: 'Pulses', icon: '🌾' },
  { id: 2, name: 'Grains', icon: '🌽' },
  { id: 3, name: 'Spices', icon: '🌶️' },
  { id: 4, name: 'Oils & Fats', icon: '🫙' },
  { id: 5, name: 'Meat & Poultry', icon: '🍖' },
  { id: 6, name: 'Vegetables', icon: '🥦' },
  { id: 7, name: 'Miscellaneous', icon: '📦' },
]

const ModalOverlay = ({ onClose, children }) => (
  <div
    onClick={e => { if (e.target === e.currentTarget) onClose() }}
    style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(16px) saturate(1.5)', padding: 20
    }}
  >
    <AdminCard style={{ width: '100%', maxWidth: 440, position: 'relative' }}>
      {children}
    </AdminCard>
  </div>
)

export default function InventoryPage({ role: roleProp }) {
  const context = useOutletContext()
  const role = roleProp || context?.role || 'khidmat'
  const isAdmin = role === 'admin' || role === 'inventory_manager'
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [activeTab, setActiveTab] = useState('stock')
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')

  const [showAdd, setShowAdd] = useState(false)
  const [showTx, setShowTx] = useState(null)
  const [txQty, setTxQty] = useState('')
  const [txNote, setTxNote] = useState('')
  const [newProduct, setNewProduct] = useState({
    name: '', category_id: 1, unit: 'kg', stock: 0, low_stock_threshold: 10
  })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('inventory').select('*')
    if (!error && data) {
      setProducts(data)
    } else {
      setProducts([
        { id: 101, name: 'Basmati Rice', category_id: 2, stock: 120, unit: 'kg', low_stock_threshold: 25 },
        { id: 102, name: 'Sunflower Oil', category_id: 4, stock: 45, unit: 'L', low_stock_threshold: 15 },
        { id: 103, name: 'Chana Dal', category_id: 1, stock: 8, unit: 'kg', low_stock_threshold: 12 },
        { id: 104, name: 'Sugar', category_id: 7, stock: 60, unit: 'kg', low_stock_threshold: 10 },
        { id: 105, name: 'Red Chili Powder', category_id: 3, stock: 3, unit: 'kg', low_stock_threshold: 5 },
      ])
    }
    const { data: logs } = await supabase.from('inventory_log').select('*').order('created_at', { ascending: false }).limit(50)
    setAuditLog(logs || [])
    setLoading(false)
  }

  const handleTransaction = async () => {
    const qty = parseFloat(txQty)
    if (!qty || qty <= 0) return alert('Please enter a valid quantity')
    const p = showTx.product
    const newStock = showTx.type === 'in' ? p.stock + qty : Math.max(0, p.stock - qty)
    setProducts(prev => prev.map(item => item.id === p.id ? { ...item, stock: newStock } : item))
    const logEntry = {
      product_id: p.id, product_name: p.name, type: showTx.type,
      qty, new_stock: newStock, note: txNote, created_at: new Date().toISOString()
    }
    setAuditLog(prev => [logEntry, ...prev])
    setShowTx(null); setTxQty(''); setTxNote('')
    await supabase.from('inventory').update({ stock: newStock }).eq('id', p.id)
    await supabase.from('inventory_log').insert([logEntry])
  }

  const handleAddProduct = async () => {
    if (!newProduct.name.trim()) return alert('Name is required')
    const id = Math.max(0, ...products.map(p => p.id)) + 1
    const item = { ...newProduct, id }
    setProducts(prev => [...prev, item])
    setShowAdd(false)
    setNewProduct({ name: '', category_id: 1, unit: 'kg', stock: 0, low_stock_threshold: 10 })
    await supabase.from('inventory').insert([item])
  }

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'all' || p.category_id === parseInt(catFilter)
    return matchSearch && matchCat
  })

  const lowStock = products.filter(p => p.stock <= p.low_stock_threshold)

  const stockRows = filtered.map(p => {
    const cat = CATEGORIES.find(c => c.id === p.category_id)
    const isLow = p.stock <= p.low_stock_threshold
    return [
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(212, 175, 55, 0.1)', border: '1px solid rgba(212, 175, 55, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
          {cat?.icon || '📦'}
        </div>
        <div>
          <div style={{ fontWeight: 700, color: T.text }}>{p.name}</div>
          <div style={{ fontSize: 11, color: T.textSub }}>{cat?.name}</div>
        </div>
      </div>,
      <div style={{ fontWeight: 800, fontSize: 16, color: isLow ? T.danger : T.text }}>
        {p.stock} <span style={{ fontSize: 11, fontWeight: 500, color: T.textSub }}>{p.unit}</span>
      </div>,
      <Badge color={isLow ? T.danger : T.success}>{isLow ? 'Low Stock' : 'Good'}</Badge>,
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn variant="outline" size="sm" onClick={() => setShowTx({ product: p, type: 'in' })} style={{ color: T.success }}>
          <ArrowUpRight size={14} /> {isAdmin ? 'In' : 'Refill'}
        </Btn>
        {isAdmin && (
          <Btn variant="outline" size="sm" onClick={() => setShowTx({ product: p, type: 'out' })} style={{ color: T.danger }}>
            <ArrowDownRight size={14} /> Out
          </Btn>
        )}
      </div>
    ]
  })

  const logRows = auditLog.map((l) => [
    <div style={{ fontWeight: 600 }}>{l.product_name}</div>,
    <Badge color={l.type === 'in' ? T.success : T.danger}>{l.type.toUpperCase()}</Badge>,
    <div style={{ fontWeight: 700 }}>{l.qty}</div>,
    <div style={{ fontSize: 12, color: T.textSub }}>{l.note || '—'}</div>,
    <div style={{ fontSize: 11, color: T.textSub }}>{new Date(l.created_at).toLocaleString('en-GB')}</div>
  ])

  return (
    <PageWrap>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <PageTitle sub="Real-time kitchen supplies and stock management">Kitchen Inventory</PageTitle>
        <div style={{ display: 'flex', gap: 12 }}>
          <Btn variant="outline" onClick={() => setActiveTab(activeTab === 'stock' ? 'log' : 'stock')}>
            {activeTab === 'stock' ? <><History size={16} /> View Audit Log</> : <><Package size={16} /> View Stock</>}
          </Btn>
          {isAdmin && <Btn onClick={() => setShowAdd(true)}><Plus size={16} /> Add New Item</Btn>}
        </div>
      </div>

      <Grid cols={3} style={{ marginBottom: 32 }}>
        <StatCard icon={<Package />} label="Total Items" value={products.length} />
        <StatCard icon={<AlertTriangle />} label="Low Stock Areas" value={lowStock.length} color={lowStock.length > 0 ? T.danger : T.success} />
        <StatCard icon={<ArrowUpRight />} label="Total Stock Value" value="Good" sub="Based on current levels" />
      </Grid>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', zIndex: 1, position: 'relative' }}>
        <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
          <Search size={18} color={T.textSub} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search items by name..."
            style={{ 
              width: '100%', padding: '14px 16px 14px 48px', borderRadius: 16, 
              background: 'rgba(15, 12, 8, 0.3)', border: '1px solid var(--border-glass)', 
              color: T.text, outline: 'none', backdropFilter: 'blur(10px)'
            }}
          />
        </div>
        <select
          value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ 
            padding: '0 16px', borderRadius: 16, background: 'rgba(15, 12, 8, 0.3)', 
            border: '1px solid var(--border-glass)', color: T.text, outline: 'none', 
            height: 48, minWidth: 160, backdropFilter: 'blur(10px)' 
          }}
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <Btn variant="outline" onClick={fetchData} style={{ height: 48, width: 48, padding: 0 }}><RefreshCw size={18} /></Btn>
      </div>

      <AdminCard style={{ padding: 0, overflow: 'hidden' }}>
        {activeTab === 'stock' ? (
          <Table headers={['Item Detail', 'Current Stock', 'Status', 'Actions']} rows={stockRows} emptyMsg="No inventory items found." />
        ) : (
          <Table headers={['Item', 'Type', 'Qty', 'Notes', 'Date & Time']} rows={logRows} emptyMsg="No transaction history yet." />
        )}
      </AdminCard>

      {/* Add Item Modal — inline to avoid import issues */}
      {showAdd && (
        <ModalOverlay onClose={() => setShowAdd(false)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.text }}>Add New Item</h3>
            <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: T.textSub, cursor: 'pointer', display: 'flex' }}>
              <X size={20} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input label="Item Name" placeholder="e.g. Basmati Rice" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} />
            <Select label="Category" value={newProduct.category_id} onChange={e => setNewProduct({ ...newProduct, category_id: e.target.value })}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </Select>
            <div style={{ display: 'flex', gap: 16 }}>
              <Select label="Unit" value={newProduct.unit} onChange={e => setNewProduct({ ...newProduct, unit: e.target.value })}>
                <option value="kg">kg</option>
                <option value="L">L</option>
                <option value="pcs">pcs</option>
                <option value="bag">bag</option>
              </Select>
              <Input label="Min Threshold" type="number" value={newProduct.low_stock_threshold} onChange={e => setNewProduct({ ...newProduct, low_stock_threshold: parseFloat(e.target.value) })} />
            </div>
            <Btn style={{ width: '100%', marginTop: 8 }} onClick={handleAddProduct}>Create Inventory Item</Btn>
          </div>
        </ModalOverlay>
      )}

      {/* Transaction Modal — inline to avoid import issues */}
      {showTx && (
        <ModalOverlay onClose={() => setShowTx(null)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: showTx.type === 'in' ? T.success : T.danger }}>
              {showTx.type === 'in' ? 'Stock In ↑' : 'Stock Out ↓'}
            </h3>
            <button onClick={() => setShowTx(null)} style={{ background: 'none', border: 'none', color: T.textSub, cursor: 'pointer', display: 'flex' }}>
              <X size={20} />
            </button>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: T.textSub, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Item</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{showTx.product.name}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input label={`Quantity (${showTx.product.unit})`} type="number" autoFocus value={txQty} onChange={e => setTxQty(e.target.value)} />
            <Input label="Transaction Note" placeholder="Supplier, Batch, Reason..." value={txNote} onChange={e => setTxNote(e.target.value)} />
            <Btn
              style={{ width: '100%', marginTop: 8, background: showTx.type === 'in' ? T.success : T.danger, color: '#fff' }}
              onClick={handleTransaction}
            >
              Confirm {showTx.type.toUpperCase()}
            </Btn>
          </div>
        </ModalOverlay>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        select { -webkit-appearance: none; cursor: pointer; }
      `}</style>
    </PageWrap>
  )
}
