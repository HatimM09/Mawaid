import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode'
import { 
  Users, QrCode, Search, Printer, CheckCircle, XCircle, 
  ArrowLeft, RefreshCw, Smartphone, Scan, User, Clock,
  LayoutGrid, List, FileDown, Eye
} from 'lucide-react'
import { 
  T, PageWrap, AdminCard, PageTitle, Badge, Btn, Input, 
  Table, Spinner, Alert, Grid, SectionHeader, Modal, fmtDate, PackingTVView
} from './ui'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getWeekDate } from '../common/utils'

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
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
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
        defaultZoomValueIfSupported: 2,
        supportedScanTypes: [
          Html5QrcodeScanType.SCAN_TYPE_CAMERA,
          Html5QrcodeScanType.SCAN_TYPE_FILE
        ],
        experimentalFeatures: { useBarCodeDetectorIfSupported: true }
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
        .maybeSingle()
      
      if (uError || !user) {
        toast.error("User not found")
        return
      }

      // Show the TV View pop-up directly
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const today = days[new Date().getDay()]
      const h = new Date().getHours()
      const m = new Date().getMinutes()
      const mealName = (h < 15 || (h === 15 && m < 30)) ? 'lunch' : 'dinner'
      const dayKey = today.substring(0, 3).toLowerCase()
      const mealKey = mealName === 'lunch' ? 'l' : 'd'
      
      const weekId = getWeekDate()
      const { data: submission } = await supabase
        .from('survey_submissions_flat')
        .select('*')
        .eq('user_id', userId)
        .eq('week_id', weekId)
        .maybeSingle()

      const dishRes = {}
      if (submission && submission[`${dayKey}_${mealKey}_status`] === 'Applied') {
        // Simple mapping for display
        const { data: menuRow } = await supabase.from('weekly_menu').select('*').eq('day_name', today.charAt(0).toUpperCase() + today.slice(1)).eq('week_start', getWeekDate()).maybeSingle()
        if (menuRow) {
          const dishList = (menuRow[mealName] || '').split(',').map(s => s.trim()).filter(Boolean)
          dishList.forEach((dish, idx) => {
            const val = submission[`${dayKey}_${mealKey}_dish_${idx + 1}`]
            if (val !== undefined && val !== null) {
              dishRes[dish] = val === 'Yes' ? 'yes' : (val === 'No' ? 'no' : val)
            }
          })
        }
      }

      setScanResult({
        ...user,
        status: submission ? submission[`${dayKey}_${mealKey}_status`] : 'Not Submitted',
        dishResponses: dishRes,
        currentDay: today,
        currentMeal: mealName,
        meal: mealName,
        day: today
      })
      
      toast.success(`Scanned: ${user.name}`)
      // Removed auto-navigate to stay in the TV View pop-up
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }



  const filteredUsers = users.filter(u => 
    (u.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (u.thali_number || '').toString().includes(search)
  )

  const printQR = (u) => {
    const canvas = document.createElement('canvas');
    const w = 1500, h = 798;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const logo = new Image();
    logo.src = '/al-mawaid.png';
    logo.onload = () => {
      const logoCx = 250, logoCy = 220, logoR = 170;
      ctx.save();
      ctx.beginPath();
      ctx.arc(logoCx, logoCy, logoR, 0, Math.PI * 2);
      ctx.clip();
      const s = Math.max((logoR * 2) / logo.width, (logoR * 2) / logo.height);
      const dw = logo.width * s, dh = logo.height * s;
      ctx.drawImage(logo, logoCx - dw / 2, logoCy - dh / 2, dw, dh);
      ctx.restore();

      const thaliText = `${u.thali_number || '—'}`;
      ctx.font = '900 120px "DM Sans", sans-serif';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(thaliText, 250, 520);

      const qrCanvas = document.getElementById(`qr-canvas-${u.user_id}`);
      if (qrCanvas) {
        const qrSize = 480;
        ctx.drawImage(qrCanvas, w - qrSize - 120, (h - qrSize) / 2, qrSize, qrSize);
      }

      const dataUrl = canvas.toDataURL('image/png');
      
      const printWindow = window.open('', '_blank', 'width=1500,height=798');
      if (!printWindow) {
        toast.error("Popup blocked! Please allow popups to print.");
        return;
      }
      
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Thali Sticker #${u.thali_number}</title>
            <style>
              @page {
                size: 150mm 79.8mm;
                margin: 0;
              }
              html, body {
                margin: 0;
                padding: 0;
                width: 150mm;
                height: 79.8mm;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #fff;
              }
              img {
                width: 150mm;
                height: 79.8mm;
                display: block;
              }
            </style>
          </head>
          <body>
            <img src="${dataUrl}" />
            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 300);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    };
  };

  const triggerBulkPDF = async () => {
    if (users.length === 0) {
      toast.error("No users to export")
      return
    }
    
    setIsGeneratingPDF(true)
    const toastId = toast.loading("Generating Bulk PDF...")
    
    try {
      if (!window.jspdf) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
          script.onload = resolve
          script.onerror = reject
          document.head.appendChild(script)
        })
      }

      const { jsPDF } = window.jspdf
      const doc = new jsPDF('l', 'mm', 'a4')
      const stickerW = 150, stickerH = 79.8
      
      for (let i = 0; i < users.length; i++) {
        const u = users[i]
        const pageIndex = Math.floor(i / 3)
        const itemOnPage = i % 3
        
        if (i > 0 && itemOnPage === 0) doc.addPage()
        
        const canvas = document.createElement('canvas')
        const w = 1500, h = 798
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        
        const logo = new Image()
        logo.src = '/al-mawaid.png'
        await new Promise(r => { logo.onload = r; logo.onerror = r })
        const logoCx = 250, logoCy = 220, logoR = 170
        ctx.save()
        ctx.beginPath()
        ctx.arc(logoCx, logoCy, logoR, 0, Math.PI * 2)
        ctx.clip()
        const s = Math.max((logoR * 2) / logo.width, (logoR * 2) / logo.height)
        ctx.drawImage(logo, logoCx - (logo.width * s) / 2, logoCy - (logo.height * s) / 2, logo.width * s, logo.height * s)
        ctx.restore()
        
        ctx.font = '900 120px "DM Sans", sans-serif'
        ctx.fillStyle = '#000000'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${u.thali_number || '—'}`, 250, 520)
        
        const qrCanvas = document.getElementById(`qr-canvas-${u.user_id}`)
        if (qrCanvas) {
          const qrSize = 480
          ctx.drawImage(qrCanvas, w - qrSize - 120, (h - qrSize) / 2, qrSize, qrSize)
        }
        
        const stickerY = 10 + itemOnPage * (stickerH + 5)
        doc.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', (297 - stickerW) / 2, stickerY, stickerW, stickerH)
        
        if (itemOnPage < 2) {
          doc.setLineDash([2, 2], 0)
          doc.line(10, stickerY + stickerH + 2.5, 287, stickerY + stickerH + 2.5)
        }
      }
      
      doc.save(`Al-Mawaid_Stickers_${new Date().toISOString().split('T')[0]}.pdf`)
      toast.success("PDF Downloaded!", { id: toastId })
    } catch (e) {
      console.error(e)
      toast.error("Failed to generate PDF", { id: toastId })
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const downloadSticker = (u, format = 'png') => {
    const canvas = document.createElement('canvas');
    const w = 1500, h = 798;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const logo = new Image();
    logo.src = '/al-mawaid.png';
    logo.onload = () => {
      const logoCx = 250, logoCy = 220, logoR = 170;
      ctx.save();
      ctx.beginPath();
      ctx.arc(logoCx, logoCy, logoR, 0, Math.PI * 2);
      ctx.clip();
      const s = Math.max((logoR * 2) / logo.width, (logoR * 2) / logo.height);
      const dw = logo.width * s, dh = logo.height * s;
      ctx.drawImage(logo, logoCx - dw / 2, logoCy - dh / 2, dw, dh);
      ctx.restore();

      const thaliText = `${u.thali_number || '—'}`;
      ctx.font = '900 120px "DM Sans", sans-serif';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(thaliText, 250, 520);

      const qrCanvas = document.getElementById(`qr-canvas-${u.user_id}`);
      if (qrCanvas) {
        const qrSize = 480;
        ctx.drawImage(qrCanvas, w - qrSize - 120, (h - qrSize) / 2, qrSize, qrSize);
      }

      if (format === 'pdf') {
        const generatePDF = async () => {
          if (!window.jspdf) {
            await new Promise((resolve, reject) => {
              const script = document.createElement('script')
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
              script.onload = resolve
              script.onerror = reject
              document.head.appendChild(script)
            })
          }
          const { jsPDF } = window.jspdf
          const doc = new jsPDF('l', 'mm', [150, 79.8])
          doc.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 150, 79.8)
          doc.save(`Sticker_${u.thali_number}_${u.name}.pdf`)
        }
        generatePDF().catch(err => {
          console.error(err)
          toast.error("Failed to generate PDF")
        })
      } else {
        const link = document.createElement('a');
        link.download = `Sticker_${u.thali_number}_${u.name}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
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
           <Btn onClick={triggerBulkPDF} disabled={isGeneratingPDF} variant="outline" style={{ border: `1.5px solid ${T.accent}`, minWidth: 220 }}>
             {isGeneratingPDF ? <RefreshCw size={18} className="spin" /> : <FileDown size={18} />}
             {isGeneratingPDF ? 'Generating PDF...' : 'Download Bulk PDF (2 per Page)'}
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
            <PackingTVView 
              user={scanResult} 
              onClose={() => {
                setScanResult(null)
                startScanner()
              }} 
            />
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 280 }}>
              <Search style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: T.textSub }} size={20} />
              <input 
                type="text" 
                name="searchQR"
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
                 width: '375px', height: '200px', 
                 background: '#fff', 
                 color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                 boxSizing: 'border-box', border: '1px solid #eee', position: 'relative',
                 overflow: 'hidden', padding: '0 30px', borderRadius: 12
               }}>
                 {/* Left: Logo + Thali */}
                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 2 }}>
                   <div style={{ 
                     width: 110, height: 110, borderRadius: '50%', overflow: 'hidden',
                     border: '1px solid #eee', flexShrink: 0
                   }}>
                     <img src="/al-mawaid.png" alt="Al Mawaid" style={{ 
                       width: '100%', height: '100%', objectFit: 'cover'
                     }} />
                   </div>
                   <div style={{ fontSize: '22pt', fontWeight: 900, color: '#000' }}>{selectedUser.thali_number || '—'}</div>
                 </div>
                 
                 {/* Right: QR Code */}
                 <div style={{ 
                   background: '#fff', padding: '3mm', borderRadius: '4mm',
                   border: '1px solid #eee', display: 'inline-block',
                   position: 'relative', zIndex: 2,
                   boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                 }}>
                   <QRCodeSVG value={`ALMAWAID:${selectedUser.user_id}`} size={94.5} level="H" includeMargin={false} />
                 </div>
               </div>
            </div>
            
            <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Btn variant="outline" style={{ flex: 1, minWidth: '100px', borderRadius: 16 }} onClick={() => setSelectedUser(null)}>Dismiss</Btn>
              <Btn variant="outline" style={{ flex: 1, minWidth: '110px', borderRadius: 16 }} onClick={() => downloadSticker(selectedUser, 'png')}>
                Save PNG
              </Btn>
              <Btn variant="outline" style={{ flex: 1, minWidth: '110px', borderRadius: 16 }} onClick={() => downloadSticker(selectedUser, 'pdf')}>
                Save PDF
              </Btn>
              <Btn style={{ flex: 1, minWidth: '130px', borderRadius: 16, background: T.accentGrad }} onClick={() => printQR(selectedUser)}>
                <Printer size={18} /> Print Sticker
              </Btn>
            </div>
            
      {/* Hidden QR codes for PDF generation */}
      <div style={{ display: 'none' }}>
        {users.map(u => (
          <QRCodeCanvas 
            key={`qr-${u.user_id}`}
            id={`qr-canvas-${u.user_id}`}
            value={`ALMAWAID:${u.user_id}`} 
            size={512} 
            level="H" 
          />
        ))}
      </div>
          </div>
        )}
      </Modal>

      {/* Bulk Print Hidden View - Always in DOM but hidden by CSS */}
      <div id="bulk-print-area" className={isBulkPrinting ? 'active' : ''}>
        {users.map((u, idx) => (
          <div key={u.user_id} className="bulk-sticker-item">
            <div className="sticker-landscape">
               <img src="/al-mawaid.png" alt="" className="sticker-bg" />
               <div className="thali-label">#{u.thali_number || '—'}</div>
               <div className="qr-container">
                 <QRCodeSVG value={`ALMAWAID:${u.user_id}`} size={94.5} level="H" />
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
          @page { size: A4 landscape; margin: 0; }
          html, body { height: 100%; margin: 0 !important; padding: 0 !important; overflow: hidden; }
          
          body * { display: none !important; }
          
          #bulk-print-area.active, 
          #bulk-print-area.active * { 
            display: block !important; 
            visibility: visible !important;
          }
          
          #bulk-print-area.active {
            display: flex !important;
            flex-direction: column;
            align-items: center;
            width: 297mm;
            background: white !important;
            position: absolute;
            top: 0;
            left: 0;
          }
          
          .bulk-sticker-item {
            width: 297mm;
            height: 93mm;
            display: flex !important;
            align-items: center;
            justify-content: center;
            page-break-inside: avoid;
            position: relative;
          }

          #printable-area, 
          #printable-area * { 
            display: flex !important; 
            visibility: visible !important;
          }
          
          #printable-area {
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 150mm !important;
            height: 79.8mm !important;
          }
          
          .sticker-landscape {
            width: 150mm;
            height: 79.8mm;
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            padding: 0 8mm;
            position: relative;
            background: #fff;
            border: 0.1mm solid #eee;
            page-break-inside: avoid;
            overflow: hidden;
          }

          .sticker-bg {
            position: absolute;
            width: 80mm;
            height: 80mm;
            object-fit: cover;
            top: 50%;
            left: 15mm;
            transform: translateY(-50%);
            border-radius: 50%;
            z-index: 1;
            display: block !important;
            clip-path: circle(50%);
          }

          .thali-label {
            position: relative;
            z-index: 2;
            font-size: 24pt;
            font-weight: 900;
            margin-top: 30mm;
            display: block !important;
          }

          .qr-container {
            background: #fff;
            padding: 3mm;
            border-radius: 4mm;
            position: relative;
            z-index: 2;
            display: block !important;
          }
      `}</style>
    </PageWrap>
  )
}
