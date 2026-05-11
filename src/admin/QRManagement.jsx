import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { 
  Users, QrCode, Search, Printer, CheckCircle, XCircle, 
  ArrowLeft, RefreshCw, Smartphone, Scan, User, Clock,
  LayoutGrid, List, FileDown, Eye
} from 'lucide-react'
import { 
  T, PageWrap, AdminCard, PageTitle, Badge, Btn, Input, 
  Table, Spinner, Alert, Grid, SectionHeader, Modal, fmtDate
} from './ui'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'

export default function QRManagement() {
  const [activeTab, setActiveTab] = useState('scan') // 'scan' | 'generate'
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [scanResult, setScanResult] = useState(null)
  const [isScanning, setIsScanning] = useState(false)
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'
  const [isBulkPrinting, setIsBulkPrinting] = useState(false)
  const navigate = useNavigate()
  const scannerRef = useRef(null)

  const scanBuffer = useRef('')
  const scanTimeout = useRef(null)

  useEffect(() => {
    loadUsers()

    // Global Hardware Scanner Listener
    const handleKeyDown = (e) => {
      // Clear buffer on Enter
      if (e.key === 'Enter') {
        if (scanBuffer.current.startsWith('ALMAWAID:')) {
          onScanSuccess(scanBuffer.current)
        }
        scanBuffer.current = ''
        return
      }

      // Append character to buffer
      if (e.key.length === 1) {
        scanBuffer.current += e.key
      }

      // Reset buffer if no keys for 50ms (typical of human typing)
      if (scanTimeout.current) clearTimeout(scanTimeout.current)
      scanTimeout.current = setTimeout(() => {
        if (!scanBuffer.current.includes(':')) {
           scanBuffer.current = ''
        }
      }, 50)
    }

    window.addEventListener('keydown', handleKeyDown)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.error("Failed to clear scanner", e))
      }
    }
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .order('thali_number', { ascending: true })
    
    if (error) toast.error('Failed to load users')
    else setUsers(data || [])
    setLoading(false)
  }

  // --- SCANNING LOGIC ---
  const startScanner = () => {
    setIsScanning(true)
    setScanResult(null)
    
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner("reader", { 
        fps: 20, 
        qrbox: { width: 280, height: 280 },
        rememberLastUsedCamera: true,
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
        showZoomSliderIfSupported: true,
        defaultZoomValueIfSupported: 2
      }, false)
      
      scanner.render(onScanSuccess, onScanFailure)
      scannerRef.current = scanner
    }, 100)
  }

  const onScanSuccess = async (decodedText) => {
    try {
      if (!decodedText.startsWith('ALMAWAID:')) {
        toast.error("Invalid QR Code format")
        return
      }
      
      const userId = decodedText.split(':')[1]
      await processScan(userId)
      
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.error(e))
        setIsScanning(false)
      }
    } catch (e) {
      toast.error("Error processing QR code")
    }
  }

  const onScanFailure = () => {}

  const processScan = async (userId) => {
    setLoading(true)
    try {
      const { data: user, error: uError } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single()
      
      if (uError || !user) {
        toast.error("User not found")
        return
      }

      const today = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()]
      const meal = new Date().getHours() < 16 ? 'l' : 'd'
      const statusKey = `${today}_${meal}_status`
      const weekId = getMonday(new Date()).toISOString().split('T')[0]

      const { data: submission } = await supabase
        .from('survey_submissions_flat')
        .select('*')
        .eq('user_id', userId)
        .eq('week_id', weekId)
        .single()

      setScanResult({
        user,
        status: submission ? submission[statusKey] : 'Not Submitted',
        meal: meal === 'l' ? 'Lunch' : 'Dinner',
        time: new Date().toLocaleTimeString()
      })
      
      toast.success(`Scanned: ${user.name}`)
      
      setTimeout(() => {
        navigate(`/admin/surveys?userId=${userId}`)
      }, 800)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const getMonday = (d) => {
    d = new Date(d)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff))
  }

  const filteredUsers = users.filter(u => 
    (u.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (u.thali_number || '').toString().includes(search)
  )

  const printQR = () => {
    window.print()
  }

  const triggerBulkPDF = () => {
    if (users.length === 0) {
      toast.error("No users to export")
      return
    }
    setIsBulkPrinting(true)
    setTimeout(() => {
      window.print()
      setIsBulkPrinting(false)
    }, 1000)
  }

  const downloadSticker = (u) => {
    const canvas = document.createElement('canvas');
    const size = 1062; // ~9cm at 300 DPI
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background Circle
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Load Logo
    const logo = new Image();
    logo.src = '/al-mawaid.png';
    logo.onload = () => {
      // Draw Logo as BG - Full Spread (Full Bleed)
      const scale = Math.max(size / logo.width, size / logo.height);
      const drawWidth = logo.width * scale;
      const drawHeight = logo.height * scale;
      const drawX = (size - drawWidth) / 2;
      const drawY = (size - drawHeight) / 2;
      
      ctx.globalAlpha = 1.0;
      ctx.drawImage(logo, drawX, drawY, drawWidth, drawHeight);

      // Draw QR Code in a clear white box for perfect scanning
      const qrCanvas = document.getElementById('hidden-qr-canvas');
      if (qrCanvas) {
        const qrSize = 295;
        const quietZone = 35; // ~3mm
        ctx.fillStyle = '#ffffff';
        // Rounded box for QR
        const boxSize = qrSize + quietZone * 2;
        const boxX = (size - boxSize) / 2;
        const boxY = size * 0.35;
        
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxSize, boxSize, 40);
        ctx.fill();
        ctx.drawImage(qrCanvas, (size - qrSize) / 2, boxY + quietZone, qrSize, qrSize);
      }

      // Draw Thali Number in a white capsule
      const thaliText = `#${u.thali_number}`;
      ctx.font = '900 130px "DM Sans", sans-serif';
      const textWidth = ctx.measureText(thaliText).width;
      
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect((size - textWidth - 100) / 2, size * 0.75, textWidth + 100, 180, 90);
      ctx.fill();
      
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.fillText(thaliText, size / 2, size * 0.88);

      // Download
      const link = document.createElement('a');
      link.download = `Sticker_${u.thali_number}_${u.name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
  }

  return (
    <PageWrap>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/admin')} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: T.textSub, width: 44, height: 44, borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', background: T.accentGrad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>QR Identity Hub</h1>
            <p style={{ margin: 0, color: T.textSub, fontSize: 13, fontWeight: 500 }}>Secure member scanning & ID generation</p>
          </div>
        </div>
        <Btn variant="outline" onClick={loadUsers} style={{ height: 44, width: 44, padding: 0 }}><RefreshCw size={18} /></Btn>
      </div>

      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: 6, borderRadius: 16, border: '1px solid var(--border-glass)', marginBottom: 32 }}>
        <button 
          onClick={() => setActiveTab('scan')}
          style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 800, transition: '0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: activeTab === 'scan' ? T.accentGrad : 'transparent', color: activeTab === 'scan' ? '#fff' : T.textSub }}
        >
          <Scan size={18} /> Scanner
        </button>
        <Btn 
          variant={activeTab === 'generate' ? 'primary' : 'outline'} 
          onClick={() => setActiveTab('generate')}
          style={{ flex: 1 }}
        >
          <QrCode size={18} /> Generator
        </Btn>
      </div>

      {activeTab === 'generate' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
           <Btn onClick={triggerBulkPDF} variant="outline" style={{ border: `1.5px solid ${T.accent}` }}>
             <FileDown size={18} /> Bulk PDF Export (2 per Page)
           </Btn>
        </div>
      )}

      {activeTab === 'scan' ? (
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          {!isScanning && !scanResult && (
            <AdminCard style={{ textAlign: 'center', padding: '80px 40px', border: '2px dashed var(--border-glass)', background: 'rgba(255,255,255,0.01)' }}>
              <div style={{ width: 100, height: 100, borderRadius: 32, background: 'rgba(212, 175, 55, 0.08)', border: '1px solid rgba(212, 175, 55, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', transform: 'rotate(-5deg)' }}>
                <Smartphone size={48} color="var(--accent-gold)" />
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>Ready to Scan</h2>
              <p style={{ color: T.textSub, maxWidth: 350, margin: '0 auto 40px', lineHeight: 1.7, fontSize: 15 }}>
                Point your camera at a member's Thali QR code to instantly check their meal status.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                <Btn onClick={startScanner} size="lg" style={{ height: 60, padding: '0 40px', fontSize: 18, borderRadius: 20 }}>Launch Scanner</Btn>
                <Btn variant="ghost" onClick={() => {
                   navigate('/admin/surveys?userId=demo-id')
                   toast.success("Navigating to Distribution Tracking...")
                }} style={{ fontSize: 13, color: T.accent }}>
                  <Eye size={14} /> Watch Distribution UI Demo
                </Btn>
              </div>
            </AdminCard>
          )}

          {isScanning && (
            <AdminCard style={{ padding: 0, overflow: 'hidden', position: 'relative', borderRadius: 24, border: '2px solid var(--border-glass)' }}>
              <div id="reader" style={{ width: '100%', minHeight: 400 }}></div>
              <div style={{ padding: 24, textAlign: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}>
                <Btn variant="outline" size="sm" onClick={() => {
                  if (scannerRef.current) scannerRef.current.clear().catch(e => console.error(e))
                  setIsScanning(false)
                }}>Close Scanner</Btn>
              </div>
            </AdminCard>
          )}

          {scanResult && (
            <div style={{ animation: 'slideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}>
              <AdminCard style={{ 
                border: `2px solid ${scanResult.status === 'Applied' ? '#10b981' : '#f43f5e'}`,
                background: scanResult.status === 'Applied' ? 'rgba(16, 185, 129, 0.03)' : 'rgba(244, 63, 94, 0.03)',
                boxShadow: `0 32px 64px -12px ${scanResult.status === 'Applied' ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)'}`,
                padding: 32
              }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                   <div style={{ 
                     width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px',
                     background: scanResult.status === 'Applied' ? '#10b981' : '#f43f5e',
                     display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                     boxShadow: `0 0 30px ${scanResult.status === 'Applied' ? '#10b98140' : '#f43f5e40'}`
                   }}>
                     {scanResult.status === 'Applied' ? <CheckCircle size={40} /> : <XCircle size={40} />}
                   </div>
                   <div style={{ fontSize: 13, fontWeight: 900, color: T.accent, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Thali #{scanResult.user.thali_number}</div>
                   <h2 style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>{scanResult.user.name}</h2>
                </div>

                <Grid cols={2} style={{ marginBottom: 32 }}>
                  <div style={{ padding: 20, borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: T.textSub, marginBottom: 8, fontWeight: 800, textTransform: 'uppercase' }}>Session</div>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{scanResult.meal}</div>
                  </div>
                  <div style={{ padding: 20, borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: T.textSub, marginBottom: 8, fontWeight: 800, textTransform: 'uppercase' }}>Status</div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: scanResult.status === 'Applied' ? '#10b981' : '#f43f5e' }}>{scanResult.status === 'Applied' ? 'CONFIRMED' : 'NO ENTRY'}</div>
                  </div>
                </Grid>

                <p style={{ textAlign: 'center', color: T.textSub, fontSize: 13, marginBottom: 32 }}>Redirecting to detailed survey view...</p>
                
                <Btn variant="outline" style={{ width: '100%', height: 54, borderRadius: 16 }} onClick={startScanner}>
                  <RefreshCw size={18} /> Scan Another
                </Btn>
              </AdminCard>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 280 }}>
              <Search style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: T.textSub }} size={20} />
              <input 
                type="text" 
                placeholder="Search by name or thali number..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '16px 16px 16px 52px', borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', color: T.text, outline: 'none', fontSize: 15, fontWeight: 500 }}
              />
            </div>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 14, border: '1px solid var(--border-glass)' }}>
              <button onClick={() => setViewMode('grid')} style={{ padding: 10, borderRadius: 10, border: 'none', background: viewMode === 'grid' ? 'rgba(255,255,255,0.1)' : 'transparent', color: viewMode === 'grid' ? '#fff' : T.textSub, cursor: 'pointer' }}><LayoutGrid size={18} /></button>
              <button onClick={() => setViewMode('list')} style={{ padding: 10, borderRadius: 10, border: 'none', background: viewMode === 'list' ? 'rgba(255,255,255,0.1)' : 'transparent', color: viewMode === 'list' ? '#fff' : T.textSub, cursor: 'pointer' }}><List size={18} /></button>
            </div>
          </div>

          {loading ? <Spinner /> : (
            viewMode === 'grid' ? (
              <Grid cols={4}>
                {filteredUsers.map(u => (
                  <AdminCard key={u.user_id} style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', textAlign: 'center', padding: 24, transition: '0.3s', cursor: 'pointer', border: '1.5px solid var(--border-glass)' }} className="hover-lift" onClick={() => setSelectedUser(u)}>
                    <div style={{ position: 'relative', background: '#fff', padding: 12, borderRadius: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
                      <QRCodeSVG value={`ALMAWAID:${u.user_id}`} size={120} level="H" />
                    </div>
                    <div>
                      <Badge color={T.accent} style={{ marginBottom: 8, fontSize: 10 }}>THALI #{u.thali_number}</Badge>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{u.name}</div>
                    </div>
                    <Btn variant="outline" size="sm" style={{ width: '100%', borderRadius: 10, fontSize: 11, fontWeight: 800 }}>
                      <Printer size={14} /> PRINT LABEL
                    </Btn>
                  </AdminCard>
                ))}
              </Grid>
            ) : (
              <AdminCard style={{ padding: 0, overflow: 'hidden' }}>
                <Table 
                  headers={['Thali', 'Name', 'User ID', 'Actions']} 
                  rows={filteredUsers.map(u => [
                    <Badge color={T.accent}>#{u.thali_number}</Badge>,
                    <div style={{ fontWeight: 800 }}>{u.name}</div>,
                    <code style={{ fontSize: 10, opacity: 0.6 }}>{u.user_id}</code>,
                    <div style={{ display: 'flex', gap: 8 }}>
                       <Btn variant="ghost" size="sm" onClick={() => setSelectedUser(u)}><Printer size={16} /></Btn>
                       <Btn variant="ghost" size="sm" onClick={() => navigate(`/admin/surveys?userId=${u.user_id}`)}><Eye size={16} /></Btn>
                    </div>
                  ])} 
                />
              </AdminCard>
            )
          )}
        </div>
      )}

      {/* Print Modal */}
      <Modal 
        isOpen={!!selectedUser} 
        onClose={() => setSelectedUser(null)} 
        title="Identity Sticker Label"
        maxWidth={500}
      >
        {selectedUser && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
               <div id="printable-area" style={{ 
                 width: '9cm', height: '9cm', 
                 background: '#fff', borderRadius: '50%', 
                 color: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                 boxSizing: 'border-box', border: '1px solid #eee', position: 'relative',
                 overflow: 'hidden'
               }}>
                 {/* Al Mawaid Logo - Full Spread Background */}
                 <img src="/al-mawaid.png" alt="Al Mawaid" style={{ 
                   position: 'absolute', width: '100%', height: '100%', 
                   objectFit: 'cover', opacity: 1,
                   top: 0, left: 0, zIndex: 1
                 }} />
                 
                 {/* QR Code Container on top */}
                 <div style={{ 
                   background: '#fff', padding: '3mm', borderRadius: '4mm',
                   border: '1px solid #eee', display: 'inline-block',
                   position: 'relative', zIndex: 2, marginBottom: '0.4cm',
                   boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                 }}>
                   <QRCodeSVG value={`ALMAWAID:${selectedUser.user_id}`} size={94.5} level="H" includeMargin={false} />
                 </div>
                 
                 {/* Thali Number Capsule */}
                 <div style={{ 
                   position: 'relative', zIndex: 2, background: '#fff', 
                   padding: '4px 24px', borderRadius: '40px',
                   boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                 }}>
                   <div style={{ fontSize: '28pt', fontWeight: 900, color: '#000' }}>#{selectedUser.thali_number}</div>
                 </div>
               </div>
            </div>
            
            <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
              <Btn variant="outline" style={{ flex: 1, borderRadius: 16 }} onClick={() => setSelectedUser(null)}>Dismiss</Btn>
              <Btn variant="outline" style={{ flex: 1, borderRadius: 16 }} onClick={() => downloadSticker(selectedUser)}>
                <FileDown size={18} /> Download
              </Btn>
              <Btn style={{ flex: 1, borderRadius: 16, background: T.accentGrad }} onClick={printQR}><Printer size={18} /> Print Sticker</Btn>
            </div>
            
            {/* Hidden QR for Canvas Download */}
            <div style={{ display: 'none' }}>
              <QRCodeCanvas 
                id="hidden-qr-canvas"
                value={`ALMAWAID:${selectedUser.user_id}`} 
                size={295} 
                level="H" 
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Print Hidden View - Always in DOM but hidden by CSS */}
      <div id="bulk-print-area" className={isBulkPrinting ? 'active' : ''}>
        {users.map((u, idx) => (
          <div key={u.user_id} className="bulk-sticker-item">
            <div className="sticker-circle">
               <img src="/al-mawaid.png" alt="" className="sticker-bg" />
               <div className="qr-container">
                 <QRCodeSVG value={`ALMAWAID:${u.user_id}`} size={94.5} level="H" />
               </div>
               <div className="thali-capsule">
                 #{u.thali_number}
               </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        #reader { border: none !important; background: transparent !important; }
        #reader video { border-radius: 20px !important; }
        
        .hover-lift:hover {
          transform: translateY(-8px);
          border-color: var(--accent-gold) !important;
          box-shadow: 0 20px 40px rgba(212, 175, 55, 0.15) !important;
        }

        #bulk-print-area {
          display: none;
        }
        #bulk-print-area.active {
          display: block;
        }
        
        @media print {
          @page { size: A4; margin: 0; }
          html, body { height: 100%; margin: 0 !important; padding: 0 !important; overflow: hidden; }
          
          /* Hide everything by default */
          body * { display: none !important; }
          
          /* Show bulk print area if active */
          #bulk-print-area.active, 
          #bulk-print-area.active * { 
            display: block !important; 
            visibility: visible !important;
          }
          
          #bulk-print-area.active {
            display: flex !important;
            flex-direction: column;
            align-items: center;
            width: 210mm;
            background: white !important;
            position: absolute;
            top: 0;
            left: 0;
          }
          
          .bulk-sticker-item {
            width: 210mm;
            height: 148.5mm; /* Half of A4 height */
            display: flex !important;
            align-items: center;
            justify-content: center;
            page-break-inside: avoid;
            position: relative;
            border-bottom: 0.1mm dashed #eee; /* Cut line */
          }

          /* Show single printable area if it exists */
          #printable-area, 
          #printable-area * { 
            display: block !important; 
            visibility: visible !important;
          }
          
          #printable-area {
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 9cm !important;
            height: 9cm !important;
            display: flex !important;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          
          .bulk-sticker-item {
            width: 90mm;
            height: 90mm;
            display: flex !important;
            align-items: center;
            justify-content: center;
            page-break-inside: avoid;
            position: relative;
          }
          
          .sticker-circle {
            width: 90mm;
            height: 90mm;
            border-radius: 50%;
            overflow: hidden;
            position: relative;
            background: #fff;
            border: 0.1mm solid #eee;
            display: flex !important;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }

          .sticker-bg {
            position: absolute;
            width: 100%;
            height: 100%;
            object-fit: cover;
            top: 0;
            left: 0;
            z-index: 1;
            display: block !important;
          }

          .qr-container {
            background: #fff;
            padding: 3mm;
            border-radius: 4mm;
            position: relative;
            z-index: 2;
            margin-bottom: 4mm;
            display: block !important;
          }

          .thali-capsule {
            background: #fff;
            padding: 2mm 8mm;
            border-radius: 10mm;
            font-size: 28pt;
            font-weight: 900;
            position: relative;
            z-index: 2;
            display: block !important;
          }
        }
      `}</style>
    </PageWrap>
  )
}
