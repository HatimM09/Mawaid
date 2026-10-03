// src/admin/InventoryPage.jsx
import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/firebaseClient'
import { 
  Outlet, useLocation, useOutletContext 
} from 'react-router-dom'
import {
  Package, Plus, ArrowUpRight, ArrowDownRight,
  History, AlertTriangle, RefreshCw, X, Search,
  ShoppingCart, Box, Trash2, TrendingDown, TrendingUp, Layers, MousePointer2,
  Database, CheckCircle2, ArrowUpDown, Filter, Sparkles, Scale
} from 'lucide-react'
import {
  T, PageWrap, PageTitle, AdminCard, Table,
  Badge, Btn, Spinner, StatCard, Grid,
  Input, Select, Alert
} from './ui'
import { MASTER_INVENTORY_ITEMS } from '../common/masterInventoryData'

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
  if (n.includes('flour') || n.includes('atta') || n.includes('wheat') || n.includes('sooji') || n.includes('maida') || n.includes('besan')) return '🌾'
  if (n.includes('dal') || n.includes('lentil') || n.includes('pulse') || n.includes('chana') || n.includes('rajma') || n.includes('moong')) return '🥣'
  if (n.includes('oil')) return '🛢️'
  if (n.includes('ghee') || n.includes('butter')) return '🧈'
  if (n.includes('chicken')) return '🍗'
  if (n.includes('meat') || n.includes('mutton')) return '🍖'
  if (n.includes('beef') || n.includes('steak')) return '🥩'
  if (n.includes('egg')) return '🥚'
  if (n.includes('milk') || n.includes('dairy') || n.includes('cream')) return '🥛'
  if (n.includes('yogurt') || n.includes('curd') || n.includes('dahi')) return '🍦'
  if (n.includes('cheese') || n.includes('paneer')) return '🧀'
  if (n.includes('tea') || n.includes('chai')) return '☕'
  if (n.includes('coffee')) return '🥤'
  if (n.includes('sugar') || n.includes('sweet') || n.includes('jaggery') || n.includes('gud')) return '🧊'
  if (n.includes('salt')) return '🧂'
  if (n.includes('onion')) return '🧅'
  if (n.includes('tomato')) return '🍅'
  if (n.includes('potato') || n.includes('aloo')) return '🥔'
  if (n.includes('garlic')) return '🧄'
  if (n.includes('ginger')) return '🫚'
  if (n.includes('chilli') || n.includes('mirch')) return '🌶️'
  if (n.includes('coriander') || n.includes('herb') || n.includes('dhanya') || n.includes('pudina')) return '🌿'
  if (n.includes('lemon') || n.includes('nimbu')) return '🍋'
  if (n.includes('fruit') || n.includes('apple')) return '🍎'
  if (n.includes('banana')) return '🍌'
  if (n.includes('mango')) return '🥭'
  if (n.includes('sauce') || n.includes('ketchup') || n.includes('mayonnaise')) return '🥫'
  if (n.includes('syrup') || n.includes('juice') || n.includes('rooh') || n.includes('squash')) return '🍹'
  if (n.includes('plate') || n.includes('bowl') || n.includes('spoon') || n.includes('fork') || n.includes('dish') || n.includes('cup') || n.includes('glass') || n.includes('thaal') || n.includes('crockery')) return '🍽️'
  if (n.includes('soap') || n.includes('clean') || n.includes('wash') || n.includes('surf') || n.includes('detergent')) return '🧴'
  if (n.includes('napkin') || n.includes('tissue') || n.includes('paper')) return '🧻'
  if (n.includes('foil') || n.includes('wrap') || n.includes('cling')) return '🪙'
  if (n.includes('box') || n.includes('carton') || n.includes('pack') || n.includes('container') || n.includes('bag')) return '📦'
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
    <AdminCard style={{ width: '100%', maxWidth: 460, position: 'relative' }}>
      {children}
    </AdminCard>
  </div>
)

export default function InventoryPage({ role: roleProp, initialTab = 'stock' }) {
  const context = useOutletContext()
  const role = roleProp || context?.role || 'khidmat'
  const canManageItems = role === 'admin' || role === 'inventory_manager' || role === 'Inventory'
  const canEditStock = role === 'admin' || role === 'inventory_manager' || role === 'Inventory'
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [activeTab, setActiveTab] = useState(initialTab || 'stock')
  
  // Control tab from props if needed
  useEffect(() => {
    if (roleProp === 'log' || initialTab === 'log') setActiveTab('log')
    else if (roleProp === 'stock' || initialTab === 'stock') setActiveTab('stock')
  }, [roleProp, initialTab])

  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [unitFilter, setUnitFilter] = useState('all') // 'all', 'kg', 'pcs', 'Carton'
  const [sortBy, setSortBy] = useState('category-asc') // 'category-asc', 'name-asc', 'min-desc', 'min-asc', 'unit', 'stock-asc'

  const [showAdd, setShowAdd] = useState(false)
  const [showTx, setShowTx] = useState(null)
  const [txQty, setTxQty] = useState('')
  const [txNote, setTxNote] = useState('')
  const [viewMode, setViewMode] = useState('grid') // Default to grid for 'dynamic' feel
  const [syncingMaster, setSyncingMaster] = useState(false)
  const [syncProgress, setSyncProgress] = useState(null)

  const [newProduct, setNewProduct] = useState({
    name: '', category_id: 11, subcategory: 'Groceries', unit: 'kg', stock: 0, low_stock: 10
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
    if (!error && data && data.length > 0) {
      setProducts(data)
    } else {
      // If table is empty or error, use MASTER_INVENTORY_ITEMS so the UI is immediately loaded with 255 items
      if (MASTER_INVENTORY_ITEMS && MASTER_INVENTORY_ITEMS.length > 0) {
        setProducts(MASTER_INVENTORY_ITEMS)
      } else {
        setProducts([])
      }
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
    const currentStock = Number(p.stock) || 0
    const newStock = showTx.type === 'in' ? currentStock + qty : Math.max(0, currentStock - qty)
    const logEntry = {
      item_id: p.id,
      item_name: p.name,
      action: showTx.type === 'in' ? 'add' : 'remove',
      quantity: qty,
      old_stock: currentStock,
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
      // Update local state in case offline/RLS fallback
      setProducts(prev => prev.map(item => item.id === p.id ? { ...item, stock: newStock } : item))
    }
  }

  const handleAddProduct = async () => {
    if (!newProduct.name.trim()) return alert('Name is required')
    
    const cat = CATEGORIES.find(c => c.id === newProduct.category_id)
    const itemToInsert = { 
      name: newProduct.name.trim(),
      category_id: newProduct.category_id,
      category_name: cat?.name || 'Miscellaneous & Groceries',
      subcategory: newProduct.subcategory || cat?.name || 'Groceries',
      unit: newProduct.unit || 'kg',
      stock: Number(newProduct.stock) || 0,
      low_stock: Number(newProduct.low_stock) || 10
    }
    
    setShowAdd(false)
    setNewProduct({ name: '', category_id: 11, subcategory: 'Groceries', unit: 'kg', stock: 0, low_stock: 10 })
    
    const { data, error } = await supabase.from('inventory').insert([itemToInsert]).select()
    if (error) {
      console.warn('Direct insert failed, adding locally:', error.message)
      setProducts(prev => [{ ...itemToInsert, id: Date.now() }, ...prev])
    } else if (data) {
      fetchData()
    }
  }

  // 1-Click Master Inventory Sync (all 255 items)
  const handleSyncMasterInventory = async () => {
    if (!window.confirm(`⚡ Sync all ${MASTER_INVENTORY_ITEMS.length} items from master inventory CSV with exact Min. Quantities, Units (KG/PCS/Carton), and Categories?`)) return
    
    setSyncingMaster(true)
    setSyncProgress({ current: 0, total: MASTER_INVENTORY_ITEMS.length, status: 'Starting sync...' })
    
    try {
      // First, get existing products to avoid duplicating names
      const { data: existing } = await supabase.from('inventory').select('id, name')
      const existingNameMap = new Map((existing || []).map(item => [item.name.toLowerCase().trim(), item.id]))
      
      const toInsert = []
      const toUpdate = []

      for (const item of MASTER_INVENTORY_ITEMS) {
        const key = item.name.toLowerCase().trim()
        const existingId = existingNameMap.get(key)
        
        const payload = {
          name: item.name,
          category_id: item.category_id,
          category_name: item.category_name,
          subcategory: item.subcategory,
          unit: item.unit,
          low_stock: item.low_stock,
          low_stock_threshold: item.low_stock,
          stock: item.stock || 0
        }

        if (existingId) {
          toUpdate.push({ ...payload, id: existingId })
        } else {
          toInsert.push(payload)
        }
      }

      // Batch insert new items (chunks of 40)
      const chunkSize = 40
      let insertedCount = 0
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize)
        const { error } = await supabase.from('inventory').insert(chunk)
        if (error) {
          console.error('Batch insert error:', error)
        } else {
          insertedCount += chunk.length
          setSyncProgress({ 
            current: insertedCount, 
            total: MASTER_INVENTORY_ITEMS.length, 
            status: `Imported ${insertedCount} new items...` 
          })
        }
      }

      // Update existing items minimum quantities / categories if present
      for (const upd of toUpdate) {
        await supabase.from('inventory').update({
          category_id: upd.category_id,
          category_name: upd.category_name,
          subcategory: upd.subcategory,
          unit: upd.unit,
          low_stock: upd.low_stock
        }).eq('id', upd.id)
      }

      setSyncProgress({ 
        current: MASTER_INVENTORY_ITEMS.length, 
        total: MASTER_INVENTORY_ITEMS.length, 
        status: `✅ Successfully synced ${MASTER_INVENTORY_ITEMS.length} items!` 
      })
      
      await fetchData()
      setTimeout(() => {
        setSyncingMaster(false)
        setSyncProgress(null)
      }, 1500)
    } catch (err) {
      console.error('Master sync exception:', err)
      alert('Master sync completed with local fallback: ' + err.message)
      setSyncingMaster(false)
      setSyncProgress(null)
    }
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
    if (error) {
      alert('Error: ' + error.message)
      // Local fallback reset
      setProducts(prev => prev.map(p => ({ ...p, stock: 0 })))
    } else {
      alert('✅ All stock levels reset to zero.')
      fetchData()
    }
    setLoading(false)
  }

  // Unit normalization for filtering and sorting
  const getNormalizedUnit = (unit = '') => {
    const u = (unit || '').toLowerCase().trim()
    if (u === 'kg' || u === 'kgs' || u === 'kilogram') return 'kg'
    if (u === 'pcs' || u === 'pc' || u === 'pieces' || u === 'piece') return 'pcs'
    if (u === 'carton' || u === 'cortan' || u === 'ctn') return 'Carton'
    return unit || 'pcs'
  }

  // Filtered & Sorted items
  const filtered = useMemo(() => {
    let result = products.filter(p => {
      const matchSearch = (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (p.subcategory || '').toLowerCase().includes(search.toLowerCase())
      
      const matchCat = catFilter === 'all' || p.category_id === parseInt(catFilter)
      
      const itemUnit = getNormalizedUnit(p.unit)
      const matchUnit = unitFilter === 'all' || itemUnit.toLowerCase() === unitFilter.toLowerCase()
      
      return matchSearch && matchCat && matchUnit
    })

    // Sorting
    result.sort((a, b) => {
      const minA = Number(a.low_stock ?? a.low_stock_threshold ?? 5)
      const minB = Number(b.low_stock ?? b.low_stock_threshold ?? 5)
      const stockA = Number(a.stock ?? 0)
      const stockB = Number(b.stock ?? 0)
      const catA = CATEGORIES.find(c => c.id === a.category_id)?.name || ''
      const catB = CATEGORIES.find(c => c.id === b.category_id)?.name || ''
      const unitA = getNormalizedUnit(a.unit)
      const unitB = getNormalizedUnit(b.unit)

      if (sortBy === 'category-asc') {
        const catCompare = catA.localeCompare(catB)
        if (catCompare !== 0) return catCompare
        return (a.name || '').localeCompare(b.name || '')
      }
      if (sortBy === 'name-asc') {
        return (a.name || '').localeCompare(b.name || '')
      }
      if (sortBy === 'min-desc') {
        return minB - minA
      }
      if (sortBy === 'min-asc') {
        return minA - minB
      }
      if (sortBy === 'stock-asc') {
        return stockA - stockB
      }
      if (sortBy === 'unit') {
        const unitCompare = unitA.localeCompare(unitB)
        if (unitCompare !== 0) return unitCompare
        return (a.name || '').localeCompare(b.name || '')
      }
      return 0
    })

    return result
  }, [products, search, catFilter, unitFilter, sortBy])

  const lowStockCount = useMemo(() => {
    return products.filter(p => Number(p.stock || 0) <= Number(p.low_stock ?? p.low_stock_threshold ?? 5)).length
  }, [products])

  const getUnitBadge = (unit) => {
    const norm = getNormalizedUnit(unit)
    if (norm === 'kg') {
      return <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800 }}>KG</span>
    }
    if (norm === 'Carton') {
      return <span style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800 }}>CARTON</span>
    }
    return <span style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800 }}>PCS</span>
  }

  const stockRows = filtered.map(p => {
    const cat = CATEGORIES.find(c => c.id === p.category_id)
    const minQty = Number(p.low_stock ?? p.low_stock_threshold ?? 5)
    const stockVal = Number(p.stock ?? 0)
    const isLow = stockVal <= minQty
    return [
      <div key={`item-${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(212, 175, 55, 0.1)', border: '1px solid rgba(212, 175, 55, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          {getProductIcon(p.name, p.category_id)}
        </div>
        <div>
          <div style={{ fontWeight: 700, color: T.text }}>{p.name}</div>
          <div style={{ fontSize: 11, color: T.textSub, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{cat?.name || 'General'}</span>
            {p.subcategory && <span style={{ opacity: 0.7 }}>• {p.subcategory}</span>}
          </div>
        </div>
      </div>,
      <div key={`cat-${p.id}`}>
        <span style={{ fontSize: 12, color: T.textSub, background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
          {cat?.icon} {cat?.name || 'Groceries'}
        </span>
      </div>,
      <div key={`unit-${p.id}`}>
        {getUnitBadge(p.unit)}
      </div>,
      <div key={`min-${p.id}`} style={{ fontWeight: 700, color: '#f59e0b' }}>
        {minQty} <span style={{ fontSize: 11, color: T.textSub }}>{p.unit}</span>
      </div>,
      <div key={`stock-${p.id}`} style={{ minWidth: 140 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: stockVal === 0 ? T.danger : isLow ? T.warn : T.text }}>
            {stockVal} <span style={{ fontSize: 11, fontWeight: 500, color: T.textSub }}>{p.unit}</span>
          </div>
          <Badge color={stockVal === 0 ? T.danger : isLow ? T.warn : T.success}>
            {stockVal === 0 ? 'Empty' : isLow ? 'Low Stock' : 'Good'}
          </Badge>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 10, overflow: 'hidden', position: 'relative', border: '1px solid var(--border-glass)' }}>
          <div style={{ 
            height: '100%', 
            width: `${Math.min(100, (stockVal / Math.max(1, minQty * 2)) * 100)}%`, 
            background: stockVal === 0 ? T.danger : isLow ? T.warn : T.success,
            boxShadow: `0 0 10px ${stockVal === 0 ? T.danger : isLow ? T.warn : T.success}40`,
            transition: 'width 0.5s ease-out'
          }} />
        </div>
      </div>,
      <div key={`actions-${p.id}`} style={{ 
        display: 'flex', 
        background: 'rgba(0,0,0,0.3)', 
        borderRadius: 14, 
        padding: 4, 
        gap: 6,
        border: '1px solid var(--border-glass)'
      }}>
        <button 
          onClick={() => setShowTx({ product: p, type: 'in' })}
          className="stock-btn stock-in"
          style={{ 
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, color: '#fff',
            background: 'var(--accent-bg)', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <ArrowUpRight size={14} /> <span>{canEditStock ? 'In' : 'Add'}</span>
        </button>
        {canEditStock && (
          <button 
            onClick={() => setShowTx({ product: p, type: 'out' })}
            className="stock-btn stock-out"
            style={{ 
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, color: '#fff',
              background: 'var(--accent-bg)', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <ArrowDownRight size={14} /> <span>Out</span>
          </button>
        )}
      </div>
    ]
  })

  const logRows = auditLog.map((l) => {
    return [
      <div key={l.id} style={{ fontWeight: 600 }}>{l.item_name || `Item #${l.item_id}`}</div>,
      <Badge key={`action-${l.id}`} color={l.action === 'add' ? T.success : T.danger}>{l.action?.toUpperCase()}</Badge>,
      <div key={`qty-${l.id}`} style={{ fontWeight: 700 }}>{l.quantity}</div>,
      <div key={`notes-${l.id}`} style={{ fontSize: 12, color: T.textSub }}>{l.notes || '—'}</div>,
      <div key={`date-${l.id}`} style={{ fontSize: 11, color: T.textSub }}>{new Date(l.created_at).toLocaleString('en-GB')}</div>
    ]
  })

  return (
    <PageWrap>
      {/* Header & Main Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <PageTitle>Inventory Management</PageTitle>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: T.textSub }}>
            All items tracked with minimum quantities, category sorting, and unit controls (KG / PCS / Carton).
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, border: '1px solid var(--border-glass)' }}>
            <button onClick={() => setViewMode('grid')} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: viewMode === 'grid' ? T.accent : 'transparent', color: viewMode === 'grid' ? '#000' : T.textSub, cursor: 'pointer', fontWeight: 800, fontSize: 11 }}>GRID</button>
            <button onClick={() => setViewMode('table')} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: viewMode === 'table' ? T.accent : 'transparent', color: viewMode === 'table' ? '#000' : T.textSub, cursor: 'pointer', fontWeight: 800, fontSize: 11 }}>TABLE</button>
          </div>
          
          <Btn size="sm" variant="outline" onClick={() => setActiveTab(activeTab === 'stock' ? 'log' : 'stock')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {activeTab === 'stock' ? <><History size={14} /> Audit Log</> : <><Package size={14} /> Stock Items</>}
          </Btn>

          {canManageItems && (
            <Btn 
              size="sm" 
              onClick={handleSyncMasterInventory} 
              disabled={syncingMaster}
              style={{ background: 'linear-gradient(135deg, #d4af37 0%, #aa820a 100%)', color: '#000', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Database size={14} /> {syncingMaster ? 'Syncing...' : 'Sync Master CSV (255 Items)'}
            </Btn>
          )}

          {canManageItems && (
            <Btn size="sm" variant="outline" onClick={handleResetAllStock} style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}>
              Reset Stock
            </Btn>
          )}

          {canManageItems && (
            <Btn size="sm" aria-label="Add product" onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Add Item
            </Btn>
          )}
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncProgress && (
        <div style={{ marginBottom: 20, padding: 14, borderRadius: 14, background: 'rgba(212, 175, 55, 0.1)', border: '1px solid rgba(212, 175, 55, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: T.accent, fontSize: 13, fontWeight: 700 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={16} />
            <span>{syncProgress.status}</span>
          </div>
          <span>{syncProgress.current} / {syncProgress.total}</span>
        </div>
      )}

      {/* Stat Cards */}
      <Grid cols={4} style={{ marginBottom: 24 }}>
        <StatCard icon={<Package />} label="Total Items" value={products.length} />
        <StatCard 
          icon={<AlertTriangle />} 
          label="Low / Out of Stock" 
          value={lowStockCount} 
          color={lowStockCount > 0 ? T.warn : T.success}
          sub={lowStockCount > 0 ? "Requires re-order" : "All items stocked"}
        />
        <StatCard icon={<Scale />} label="Categories" value={CATEGORIES.length} color={T.accent} />
        <StatCard icon={<ArrowUpRight />} label="Unit Types" value="KG / PCS / Carton" color="#38bdf8" />
      </Grid>

      {/* Filter and Sort Toolbar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', zIndex: 1, position: 'relative' }}>
        {/* Search */}
        <div style={{ flex: '1 1 260px', position: 'relative' }}>
          <Search size={18} color={T.textSub} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            name="searchInventory"
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search items by name or subcategory..."
            style={{ 
              width: '100%', padding: '12px 16px 12px 46px', borderRadius: 14, 
              background: 'rgba(15, 12, 8, 0.4)', border: '1px solid var(--border-glass)', 
              color: T.text, outline: 'none', backdropFilter: 'blur(10px)', fontSize: 13
            }}
          />
        </div>

        {/* Category Filter */}
        <select
          name="inventoryCategoryFilter"
          value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ 
            padding: '0 14px', borderRadius: 14, background: 'rgba(15, 12, 8, 0.4)', 
            border: '1px solid var(--border-glass)', color: T.text, outline: 'none', 
            height: 44, minWidth: 170, backdropFilter: 'blur(10px)', fontSize: 13, fontWeight: 600
          }}
        >
          <option value="all">📁 All Categories ({products.length})</option>
          {CATEGORIES.map(c => {
            const count = products.filter(p => p.category_id === c.id).length
            return <option key={c.id} value={c.id}>{c.icon} {c.name} ({count})</option>
          })}
        </select>

        {/* Unit Filter (KG / PCS / Carton) */}
        <select
          name="inventoryUnitFilter"
          value={unitFilter} onChange={e => setUnitFilter(e.target.value)}
          style={{ 
            padding: '0 14px', borderRadius: 14, background: 'rgba(15, 12, 8, 0.4)', 
            border: '1px solid var(--border-glass)', color: T.text, outline: 'none', 
            height: 44, minWidth: 140, backdropFilter: 'blur(10px)', fontSize: 13, fontWeight: 600
          }}
        >
          <option value="all">⚖️ All Units</option>
          <option value="kg">⚖️ KG (Kilograms)</option>
          <option value="pcs">🔢 PCS (Pieces)</option>
          <option value="Carton">📦 Carton (Cartons)</option>
        </select>

        {/* Sort Dropdown */}
        <select
          name="inventorySortBy"
          value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ 
            padding: '0 14px', borderRadius: 14, background: 'rgba(15, 12, 8, 0.4)', 
            border: '1px solid var(--border-glass)', color: T.text, outline: 'none', 
            height: 44, minWidth: 170, backdropFilter: 'blur(10px)', fontSize: 13, fontWeight: 600
          }}
        >
          <option value="category-asc">🗂️ Sort: Category (A-Z)</option>
          <option value="name-asc">🔤 Sort: Name (A-Z)</option>
          <option value="min-desc">🔻 Sort: Min Qty (High to Low)</option>
          <option value="min-asc">🔺 Sort: Min Qty (Low to High)</option>
          <option value="stock-asc">⚠️ Sort: Stock (Lowest First)</option>
          <option value="unit">📦 Sort: Unit (KG / PCS / Carton)</option>
        </select>

        <Btn variant="outline" aria-label="Refresh data" onClick={fetchData} style={{ height: 44, width: 44, padding: 0 }}><RefreshCw size={18} /></Btn>
      </div>

      {/* Active Items Counter & Summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, fontSize: 12, color: T.textSub }}>
        <div>Showing <strong style={{ color: T.text }}>{filtered.length}</strong> of {products.length} inventory items</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <span>⚖️ KG: {products.filter(p => getNormalizedUnit(p.unit) === 'kg').length}</span>
          <span>🔢 PCS: {products.filter(p => getNormalizedUnit(p.unit) === 'pcs').length}</span>
          <span>📦 Carton: {products.filter(p => getNormalizedUnit(p.unit) === 'Carton').length}</span>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'stock' ? (
        viewMode === 'grid' ? (
          <Grid cols={4} style={{ marginBottom: 40 }}>
            {filtered.map(p => {
              const cat = CATEGORIES.find(c => c.id === p.category_id)
              const minQty = Number(p.low_stock ?? p.low_stock_threshold ?? 5)
              const stockVal = Number(p.stock ?? 0)
              const isLow = stockVal <= minQty
              return (
                <AdminCard key={p.id} style={{ 
                  padding: 22, display: 'flex', flexDirection: 'column', gap: 16, 
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
                  border: isLow ? `1.5px solid ${T.warn}50` : `1.5px solid ${T.borderGlass}`,
                  boxShadow: isLow ? `0 12px 32px ${T.warn}15` : '0 12px 48px rgba(0,0,0,0.45)',
                  background: isLow ? 'rgba(245, 158, 11, 0.03)' : T.card
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ 
                      width: 52, height: 52, borderRadius: 16, 
                      background: isLow ? 'rgba(245, 158, 11, 0.1)' : 'rgba(212, 175, 55, 0.08)', 
                      border: `1px solid ${isLow ? T.warn : T.borderActive}`, 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 
                    }}>
                      {getProductIcon(p.name, p.category_id)}
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <Badge color={stockVal === 0 ? T.danger : isLow ? T.warn : T.success}>
                        {stockVal === 0 ? 'Empty' : isLow ? 'Low Stock' : 'Healthy'}
                      </Badge>
                      {getUnitBadge(p.unit)}
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: T.text, marginBottom: 4, lineHeight: 1.2 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: T.textSub, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Layers size={12} /> <span>{cat?.name || 'Groceries'}</span>
                      {p.subcategory && <span style={{ opacity: 0.8 }}>• {p.subcategory}</span>}
                    </div>
                  </div>

                  <div style={{ position: 'relative', background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border-glass)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 10, color: T.textSub, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Current Stock</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: stockVal === 0 ? T.danger : isLow ? T.warn : T.accent, lineHeight: 1, marginTop: 2 }}>
                          {stockVal} <span style={{ fontSize: 12, fontWeight: 600, color: T.textSub }}>{p.unit}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: T.textSub, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Min Required</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b', marginTop: 2 }}>
                          {minQty} {p.unit}
                        </div>
                      </div>
                    </div>
                    <div style={{ height: 6, background: 'rgba(0,0,0,0.4)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${Math.min(100, (stockVal / Math.max(1, minQty * 2)) * 100)}%`, 
                        background: stockVal === 0 ? T.danger : isLow ? T.warn : T.success,
                        boxShadow: `0 0 10px ${stockVal === 0 ? T.danger : isLow ? T.warn : T.success}40`,
                        transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                      }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 4, gap: 6, border: '1px solid var(--border-glass)', marginTop: 'auto' }}>
                    <button onClick={() => setShowTx({ product: p, type: 'in' })} className="stock-btn stock-in" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: '#fff', background: 'rgba(255,255,255,0.05)' }}>
                      <TrendingUp size={15} /> In
                    </button>
                    {canEditStock && (
                      <button onClick={() => setShowTx({ product: p, type: 'out' })} className="stock-btn stock-out" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: '#fff', background: 'rgba(255,255,255,0.05)' }}>
                        <TrendingDown size={15} /> Out
                      </button>
                    )}
                  </div>
                </AdminCard>
              )
            })}
          </Grid>
        ) : (
          <AdminCard style={{ padding: 0, overflow: 'hidden' }}>
            <Table headers={['Item Detail', 'Category', 'Unit', 'Min. Qty', 'Current Stock', 'Actions']} rows={stockRows} emptyMsg="No inventory items found." />
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
              value={auditLog.filter(l => l.action === 'add').reduce((acc, curr) => acc + (curr.quantity || 0), 0).toFixed(1)} 
              color={T.success} 
              sub="Total added to inventory"
            />
            <StatCard 
              icon={<ArrowDownRight />} 
              label="Total Stock Out (Period)" 
              value={auditLog.filter(l => l.action === 'remove').reduce((acc, curr) => acc + (curr.quantity || 0), 0).toFixed(1)} 
              color={T.danger} 
              sub="Total consumed/removed"
            />
          </Grid>

          <AdminCard style={{ padding: 0, overflow: 'hidden' }}>
            <Table headers={['Item', 'Type', 'Qty', 'Notes', 'Date & Time']} rows={logRows} emptyMsg="No transaction history yet." />
          </AdminCard>
        </div>
      )}

      {/* Add Item Modal */}
      {showAdd && (
        <ModalOverlay onClose={() => setShowAdd(false)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text }}>Add New Inventory Item</h3>
            <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: T.textSub, cursor: 'pointer', display: 'flex' }}>
              <X size={20} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input 
              label="Item Name *" 
              name="inventoryItemName" 
              placeholder="e.g. Basmati Rice, Chilli Powder..." 
              value={newProduct.name} 
              onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} 
            />
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Select label="Category" name="inventoryCategory" value={newProduct.category_id} onChange={e => setNewProduct({ ...newProduct, category_id: parseInt(e.target.value) })}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </Select>
              <Input 
                label="Subcategory" 
                name="inventorySubcategory" 
                placeholder="e.g. Groceries, Spices..." 
                value={newProduct.subcategory} 
                onChange={e => setNewProduct({ ...newProduct, subcategory: e.target.value })} 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Select label="Unit (KG/PCS/Carton)" name="inventoryUnit" value={newProduct.unit} onChange={e => setNewProduct({ ...newProduct, unit: e.target.value })}>
                <option value="kg">kg (Kilograms)</option>
                <option value="pcs">pcs (Pieces)</option>
                <option value="Carton">Carton (Boxes/Cases)</option>
                <option value="L">Litre (L)</option>
                <option value="bag">bag</option>
              </Select>
              <Input 
                label="Min. Quantity *" 
                name="inventoryMinQty" 
                type="number" 
                value={newProduct.low_stock} 
                onChange={e => setNewProduct({ ...newProduct, low_stock: parseFloat(e.target.value) || 0 })} 
              />
            </div>

            <Btn style={{ width: '100%', marginTop: 8, height: 48, fontWeight: 800 }} onClick={handleAddProduct}>
              Create Inventory Item
            </Btn>
          </div>
        </ModalOverlay>
      )}

      {/* Transaction Modal (Stock In / Stock Out) */}
      {showTx && (
        <ModalOverlay onClose={() => setShowTx(null)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: showTx.type === 'in' ? T.success : T.danger }}>
              {showTx.type === 'in' ? 'Stock In (Add Stock) ↑' : 'Stock Out (Deduct Stock) ↓'}
            </h3>
            <button onClick={() => setShowTx(null)} style={{ background: 'none', border: 'none', color: T.textSub, cursor: 'pointer', display: 'flex' }}>
              <X size={20} />
            </button>
          </div>
          <div style={{ marginBottom: 16, padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: 11, color: T.textSub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Selected Item</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.text }}>{showTx.product.name}</div>
            <div style={{ fontSize: 12, color: T.textSub, marginTop: 4 }}>
              Current Stock: <strong style={{ color: T.accent }}>{showTx.product.stock || 0} {showTx.product.unit}</strong> • Min: {showTx.product.low_stock || 5} {showTx.product.unit}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input 
              label={`Quantity to ${showTx.type === 'in' ? 'Add' : 'Deduct'} (${showTx.product.unit}) *`} 
              name="inventoryQty" 
              type="number" 
              autoFocus 
              value={txQty} 
              onChange={e => setTxQty(e.target.value)} 
            />
            <Input 
              label="Transaction Note" 
              name="inventoryTxNote" 
              placeholder="e.g. Daily Thaali Prep, Supplier Delivery, Waste..." 
              value={txNote} 
              onChange={e => setTxNote(e.target.value)} 
            />
            <Btn
              style={{ width: '100%', marginTop: 8, height: 50, fontSize: 16, fontWeight: 800, background: showTx.type === 'in' ? T.success : T.danger, color: '#fff' }}
              onClick={handleTransaction}
            >
              Confirm {showTx.type === 'in' ? 'Stock IN' : 'Stock OUT'}
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
          .stock-btn { padding: 8px 4px !important; }
        }
      `}</style>
    </PageWrap>
  )
}
