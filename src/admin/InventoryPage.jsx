// src/admin/InventoryPage.jsx
import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { 
  Outlet, useLocation, useOutletContext 
} from 'react-router-dom'
import {
  Package, Plus, ArrowUpRight, ArrowDownRight,
  History, AlertTriangle, RefreshCw, X, Search,
  ShoppingCart, Box, Trash2, TrendingDown, TrendingUp, Layers, MousePointer2
} from 'lucide-react'
import {
  T, PageWrap, PageTitle, AdminCard, Table,
  Badge, Btn, Spinner, StatCard, Grid,
  Input, Select, Alert
} from './ui'

const CATEGORIES = [
  { id: 1, name: 'Pulses & Lentils', icon: '🌾' },
  { id: 2, name: 'Grains & Rice', icon: '🌽' },
  { id: 3, name: 'Spices & Condiments', icon: '🌶️' },
  { id: 4, name: 'Oils, Ghee & Fats', icon: '🫙' },
  { id: 5, name: 'Meat & Poultry', icon: '🍖' },
  { id: 6, name: 'Vegetables & Fruits', icon: '🥦' },
  { id: 7, name: 'Dairy & Eggs', icon: '🥛' },
  { id: 8, name: 'Dry Fruits & Nuts', icon: '🥜' },
  { id: 9, name: 'Cleaning & Hygiene', icon: '🧼' },
  { id: 10, name: 'Packaging & Disposable', icon: '🥡' },
  { id: 11, name: 'Miscellaneous & Groceries', icon: '📦' },
  { id: 12, name: 'Syrup & Juices', icon: '🍹' },
  { id: 13, name: 'Sauces & Dressings', icon: '🥫' },
  { id: 14, name: 'Crockery', icon: '🍽️' },
]

const CAT_ICONS = {
  1: '🌾', 2: '🍚', 3: '🌶️', 4: '🫙', 5: '🍗',
  6: '🥦', 7: '🥛', 8: '🥜', 9: '🧼', 10: '🥡',
  11: '📦', 12: '🍹', 13: '🥫', 14: '🍽️'
}

const getProductIcon = (name = '', catId) => {
  const n = name.toLowerCase()
  if (n.includes('rice')) return '🍚'
  if (n.includes('flour') || n.includes('atta') || n.includes('wheat')) return '🌾'
  if (n.includes('dal') || n.includes('lentil') || n.includes('pulse')) return '🥣'
  if (n.includes('oil')) return '🛢️'
  if (n.includes('ghee') || n.includes('butter')) return '🧈'
  if (n.includes('chicken')) return '🍗'
  if (n.includes('meat') || n.includes('mutton')) return '🍖'
  if (n.includes('beef') || n.includes('steak')) return '🥩'
  if (n.includes('egg')) return '🥚'
  if (n.includes('milk') || n.includes('dairy')) return '🥛'
  if (n.includes('yogurt') || n.includes('curd') || n.includes('dahi')) return '🍦'
  if (n.includes('cheese')) return '🧀'
  if (n.includes('tea') || n.includes('chai')) return '☕'
  if (n.includes('coffee')) return '🥤'
  if (n.includes('sugar') || n.includes('sweet')) return '🧊'
  if (n.includes('salt')) return '🧂'
  if (n.includes('onion')) return '🧅'
  if (n.includes('tomato')) return '🍅'
  if (n.includes('potato')) return '🥔'
  if (n.includes('garlic')) return '🧄'
  if (n.includes('ginger')) return '🫚'
  if (n.includes('chilli') || n.includes('mirch')) return '🌶️'
  if (n.includes('coriander') || n.includes('herb') || n.includes('dhanya')) return '🌿'
  if (n.includes('lemon')) return '🍋'
  if (n.includes('fruit') || n.includes('apple')) return '🍎'
  if (n.includes('banana')) return '🍌'
  if (n.includes('mango')) return '🥭'
  if (n.includes('soap') || n.includes('clean') || n.includes('wash')) return '🧴'
  if (n.includes('napkin') || n.includes('tissue')) return '🧻'
  if (n.includes('foil') || n.includes('wrap')) return '🪙'
  if (n.includes('spoon') || n.includes('fork') || n.includes('plate')) return '🍴'
  if (n.includes('box') || n.includes('pack') || n.includes('container')) return '🥡'
  return CAT_ICONS[catId] || '📦'
}

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
  const canManageItems = role === 'admin' // Only admin can create new items
  const canEditStock = role === 'admin' || role === 'inventory_manager' || role === 'Inventory'
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [activeTab, setActiveTab] = useState('stock')
  
  // Control tab from props if needed
  useEffect(() => {
    if (roleProp === 'log') setActiveTab('log')
    else if (roleProp === 'stock') setActiveTab('stock')
  }, [roleProp])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')

  const [showAdd, setShowAdd] = useState(false)
  const [showTx, setShowTx] = useState(null)
  const [txQty, setTxQty] = useState('')
  const [txNote, setTxNote] = useState('')
  const [viewMode, setViewMode] = useState('grid') // Default to grid for 'dynamic' feel
  const [newProduct, setNewProduct] = useState({
    name: '', category_id: 1, subcategory: '', unit: 'kg', stock: 0, low_stock: 10
  })

  useEffect(() => {
    fetchData()

    // REALTIME SUBSCRIPTION
    const inventorySub = supabase
      .channel('inventory_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        fetchData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_log' }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(inventorySub)
    }
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('inventory').select('*')
    if (!error && data) {
      setProducts(data)
    } else {
      setProducts([])
      if (error) console.error("Inventory error:", error)
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
    const logEntry = {
      item_id: p.id,
      item_name: p.name,
      action: showTx.type === 'in' ? 'add' : 'remove',
      quantity: qty,
      old_stock: p.stock,
      new_stock: newStock,
      notes: txNote || ''
    }
    setShowTx(null); setTxQty(''); setTxNote('')
    
    // Update Supabase (Realtime will handle the state update)
    const { error: updErr } = await supabase.from('inventory').update({ stock: newStock }).eq('id', p.id)
    const { error: logErr } = await supabase.from('inventory_log').insert([logEntry])
    
    if (updErr || logErr) {
      console.error('Inventory Update Error:', updErr)
      console.error('Inventory Log Error:', logErr)
      alert(`Transaction failed: ${updErr?.message || logErr?.message || 'Unknown Error'}. Please check your permissions or connection.`)
      fetchData()
    }
  }

  const handleAddProduct = async () => {
    if (!newProduct.name.trim()) return alert('Name is required')
    
    // Don't set ID manually, let Supabase handle it
    const itemToInsert = { ...newProduct }
    delete itemToInsert.id // ensure no ID is sent
    
    setShowAdd(false)
    setNewProduct({ name: '', category_id: 1, subcategory: '', unit: 'kg', stock: 0, low_stock: 10 })
    
    const { error } = await supabase.from('inventory').insert([itemToInsert])
    if (error) {
      alert('Failed to add item: ' + error.message)
    }
    // Realtime will trigger fetchData()
  }

  const handleExportCSV = (days = null) => {
    let dataToExport = auditLog
    
    const exportNow = (logs) => {
      const headers = ['Product', 'Type', 'Quantity', 'Note', 'Date']
      const rows = logs.map(l => [
        l.item_name, 
        l.action?.toUpperCase(), 
        l.quantity, 
        l.notes || '', 
        new Date(l.created_at).toLocaleString('en-GB')
      ])
      const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `inventory_${days ? days + 'days' : 'recent'}_report_${new Date().toISOString().split('T')[0]}.csv`
      link.click()
    }

    if (days === 30) {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      supabase.from('inventory_log')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) exportNow(data)
          else alert('No data found for the last 30 days')
        })
    } else {
      exportNow(dataToExport)
    }
  }

  const handleResetAllStock = async () => {
    if (!window.confirm('⚠️ Are you sure you want to reset ALL stock levels to zero? This cannot be undone.')) return
    setLoading(true)
    const { error } = await supabase.from('inventory').update({ stock: 0 }).neq('id', -1)
    if (error) alert('Error: ' + error.message)
    else {
      alert('✅ All stock levels reset to zero.')
      fetchData()
    }
  }

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'all' || p.category_id === parseInt(catFilter)
    return matchSearch && matchCat
  })

  const lowStock = products.filter(p => p.stock <= p.low_stock_threshold)

  const stockRows = filtered.map(p => {
    const cat = CATEGORIES.find(c => c.id === p.category_id)
    const isLow = p.stock <= p.low_stock
    return [
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(212, 175, 55, 0.1)', border: '1px solid rgba(212, 175, 55, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
          {getProductIcon(p.name, p.category_id)}
        </div>
        <div>
          <div style={{ fontWeight: 700, color: T.text }}>{p.name}</div>
          <div style={{ fontSize: 11, color: T.textSub }}>{cat?.name} {p.subcategory ? `> ${p.subcategory}` : ''}</div>
        </div>
      </div>,
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
           <div style={{ fontWeight: 800, fontSize: 18, color: isLow ? T.danger : T.text }}>
            {p.stock} <span style={{ fontSize: 11, fontWeight: 500, color: T.textSub }}>{p.unit}</span>
          </div>
          <Badge color={p.stock === 0 ? T.danger : isLow ? T.warn : T.success}>
            {p.stock === 0 ? 'Out of Stock' : isLow ? 'Low Stock' : 'Good'}
          </Badge>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 10, overflow: 'hidden', position: 'relative', border: '1px solid var(--border-glass)' }}>
          <div style={{ 
            height: '100%', 
            width: `${Math.min(100, (p.stock / (p.low_stock * 2)) * 100)}%`, 
            background: p.stock === 0 ? T.danger : isLow ? T.warn : T.success,
            boxShadow: `0 0 10px ${p.stock === 0 ? T.danger : isLow ? T.warn : T.success}40`,
            transition: 'width 0.5s ease-out'
          }} />
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: T.textSub, marginTop: 4 }}>
          Threshold: {p.low_stock} {p.unit}
        </div>
      </div>,
      <div style={{ 
        display: 'flex', 
        background: 'rgba(0,0,0,0.3)', 
        borderRadius: 14, 
        padding: 5, 
        gap: 6,
        border: '1px solid var(--border-glass)'
      }}>
        <button 
          onClick={() => setShowTx({ product: p, type: 'in' })}
          className="stock-btn stock-in"
          style={{ 
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, color: '#fff',
            background: 'var(--accent-bg)', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <ArrowUpRight size={16} /> <span>{canEditStock ? 'In' : 'Add'}</span>
        </button>
        {canEditStock && (
          <button 
            onClick={() => setShowTx({ product: p, type: 'out' })}
            className="stock-btn stock-out"
            style={{ 
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, color: '#fff',
              background: 'var(--accent-bg)', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <ArrowDownRight size={16} /> <span>Out</span>
          </button>
        )}
      </div>
    ]
  })

  const logRows = auditLog.map((l) => {
    return [
      <div style={{ fontWeight: 600 }}>{l.item_name || `Item #${l.item_id}`}</div>,
      <Badge color={l.action === 'add' ? T.success : T.danger}>{l.action?.toUpperCase()}</Badge>,
      <div style={{ fontWeight: 700 }}>{l.quantity}</div>,
      <div style={{ fontSize: 12, color: T.textSub }}>{l.notes || '—'}</div>,
      <div style={{ fontSize: 11, color: T.textSub }}>{new Date(l.created_at).toLocaleString('en-GB')}</div>
    ]
  })

  return (
    <PageWrap>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <PageTitle>Inventory</PageTitle>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, border: '1px solid var(--border-glass)' }}>
            <button onClick={() => setViewMode('grid')} style={{ padding: '8px 10px', borderRadius: 8, border: 'none', background: viewMode === 'grid' ? T.accent : 'transparent', color: viewMode === 'grid' ? '#000' : T.textSub, cursor: 'pointer', fontWeight: 800, fontSize: 10 }}>GRID</button>
            <button onClick={() => setViewMode('table')} style={{ padding: '8px 10px', borderRadius: 8, border: 'none', background: viewMode === 'table' ? T.accent : 'transparent', color: viewMode === 'table' ? '#000' : T.textSub, cursor: 'pointer', fontWeight: 800, fontSize: 10 }}>LIST</button>
          </div>
          <Btn size="sm" variant="outline" onClick={() => setActiveTab(activeTab === 'stock' ? 'log' : 'stock')}>
            {activeTab === 'stock' ? <History size={14} /> : <Package size={14} />}
          </Btn>
          {canManageItems && (
            <Btn size="sm" variant="outline" onClick={handleResetAllStock} style={{ borderColor: T.danger, color: T.danger }}>
              Reset
            </Btn>
          )}
          {canManageItems && <Btn size="sm" onClick={() => setShowAdd(true)}><Plus size={14} /></Btn>}
        </div>
      </div>

      <Grid cols={3} style={{ marginBottom: 24 }}>
        <StatCard icon={<Package />} label="Stock Status" value="Good" color={T.success} />
        <StatCard icon={<Package />} label="Total Items" value={products.length} />
        <StatCard icon={<ArrowUpRight />} label="Supply Health" value="Active" color={T.success} />
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

      {activeTab === 'stock' ? (
        viewMode === 'grid' ? (
          <Grid cols={4} style={{ marginBottom: 40 }}>
            {filtered.map(p => {
              const cat = CATEGORIES.find(c => c.id === p.category_id)
              const isLow = p.stock <= p.low_stock_threshold
              return (
                <AdminCard key={p.id} style={{ 
                  padding: 24, display: 'flex', flexDirection: 'column', gap: 18, 
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
                  border: isLow ? `1.5px solid ${T.warn}50` : `1.5px solid ${T.borderGlass}`,
                  boxShadow: isLow ? `0 12px 32px ${T.warn}15` : '0 12px 48px rgba(0,0,0,0.45)',
                  background: isLow ? 'rgba(245, 158, 11, 0.03)' : T.card
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ 
                      width: 56, height: 56, borderRadius: 18, 
                      background: isLow ? 'rgba(245, 158, 11, 0.1)' : 'rgba(212, 175, 55, 0.08)', 
                      border: `1px solid ${isLow ? T.warn : T.borderActive}`, 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 
                    }}>
                      {getProductIcon(p.name, p.category_id)}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Badge color={p.stock === 0 ? T.danger : isLow ? T.warn : T.success}>
                        {p.stock === 0 ? 'Empty' : isLow ? 'Low' : 'Healthy'}
                      </Badge>
                      <div style={{ fontSize: 10, color: T.textSub, marginTop: 4, fontWeight: 700 }}>{p.unit.toUpperCase()}</div>
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 20, color: T.text, marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: T.textSub, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Layers size={12} /> {cat?.name}
                    </div>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                       <div style={{ fontSize: 28, fontWeight: 900, color: p.stock === 0 ? T.danger : isLow ? T.warn : T.accent, lineHeight: 1 }}>
                        {p.stock}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.textSub }}>Min: {p.low_stock}</div>
                    </div>
                    <div style={{ height: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${Math.min(100, (p.stock / (p.low_stock * 2)) * 100)}%`, 
                        background: p.stock === 0 ? T.danger : isLow ? T.warn : T.success,
                        boxShadow: `0 0 10px ${p.stock === 0 ? T.danger : isLow ? T.warn : T.success}40`,
                        transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                      }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: 14, padding: 5, gap: 6, border: '1px solid var(--border-glass)', marginTop: 8 }}>
                    <button onClick={() => setShowTx({ product: p, type: 'in' })} className="stock-btn stock-in" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 800, color: '#fff', background: 'rgba(255,255,255,0.05)' }}>
                      <TrendingUp size={16} /> In
                    </button>
                    {canEditStock && (
                      <button onClick={() => setShowTx({ product: p, type: 'out' })} className="stock-btn stock-out" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 800, color: '#fff', background: 'rgba(255,255,255,0.05)' }}>
                        <TrendingDown size={16} /> Out
                      </button>
                    )}
                  </div>
                </AdminCard>
              )
            })}
          </Grid>
        ) : (
          <AdminCard style={{ padding: 0, overflow: 'hidden' }}>
            <Table headers={['Item Detail', 'Current Stock', 'Status', 'Actions']} rows={stockRows} emptyMsg="No inventory items found." />
          </AdminCard>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.accent }}>Audit Logs & Reports</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn size="sm" variant="outline" onClick={() => handleExportCSV()}>Recent CSV</Btn>
              <Btn size="sm" onClick={() => handleExportCSV(30)}>1 Month CSV Report</Btn>
            </div>
          </div>
          
          <Grid cols={2}>
            <StatCard 
              icon={<ArrowUpRight />} 
              label="Total Stock In (Period)" 
              value={auditLog.filter(l => l.type === 'in').reduce((acc, curr) => acc + (curr.qty || 0), 0).toFixed(1)} 
              color={T.success} 
              sub="Total added to inventory"
            />
            <StatCard 
              icon={<ArrowDownRight />} 
              label="Total Stock Out (Period)" 
              value={auditLog.filter(l => l.type === 'out').reduce((acc, curr) => acc + (curr.qty || 0), 0).toFixed(1)} 
              color={T.danger} 
              sub="Total consumed/removed"
            />
          </Grid>

          <AdminCard style={{ padding: 0, overflow: 'hidden' }}>
            <Table headers={['Item', 'Type', 'Qty', 'Notes', 'Date & Time']} rows={logRows} emptyMsg="No transaction history yet." />
          </AdminCard>
        </div>
      )}

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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Input label="Item Name" placeholder="e.g. Basmati Rice" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} />
              <Select label="Category" value={newProduct.category_id} onChange={e => setNewProduct({ ...newProduct, category_id: parseInt(e.target.value) })}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </Select>
            </div>
            <Input label="Subcategory" placeholder="e.g. Basmati, Long Grain, Grade A" value={newProduct.subcategory} onChange={e => setNewProduct({ ...newProduct, subcategory: e.target.value })} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Select label="Unit (kg/pcs)" value={newProduct.unit} onChange={e => setNewProduct({ ...newProduct, unit: e.target.value })}>
                <option value="kg">kg</option>
                <option value="pcs">pcs</option>
                <option value="L">Litre</option>
                <option value="bag">bag</option>
                <option value="box">box</option>
              </Select>
              <Input label="Min Quantity" type="number" value={newProduct.low_stock} onChange={e => setNewProduct({ ...newProduct, low_stock: parseFloat(e.target.value) })} />
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
              style={{ width: '100%', marginTop: 16, height: 60, fontSize: 18, fontWeight: 800, background: showTx.type === 'in' ? T.success : T.danger, color: '#fff' }}
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
        .stock-btn:hover { background: rgba(255,255,255,0.05) !important; transform: translateY(-1px); }
        .stock-in:hover { color: #10b981 !important; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2); }
        .stock-out:hover { color: #ef4444 !important; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2); }
        .stock-btn:active { transform: translateY(0) scale(0.98); }
        @media (max-width: 1200px) {
          div[style*="gridTemplateColumns: 1fr 1fr 1fr 1fr"] {
            grid-template-columns: 1fr 1fr 1fr !important;
          }
        }
        @media (max-width: 900px) {
          div[style*="gridTemplateColumns: 1fr 1fr 1fr 1fr"] {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 600px) {
          .stock-btn span { display: none; }
          .stock-btn { padding: 10px 5px !important; }
        }
      `}</style>
    </PageWrap>
  )
}
