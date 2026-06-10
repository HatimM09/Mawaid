const fs = require('fs');
let a = fs.readFileSync('src/App.jsx', 'utf8');
const NL = a.includes('\r') ? '\r\n' : '\n';

// ========================
// 1. Replace RecentRequestsList
// ========================
const recentStart = 99917;
const recentEnd = 101933;

const newRecent = [
'function RecentRequestsList() {',
'  const t = useTheme(), { user } = useAuth()',
'  const [requests, setRequests] = useState([])',
'  const [loading, setLoading] = useState(true)',
'  const [helpline, setHelpline] = useState(\'\')',
'',
'  useEffect(() => {',
"    supabase.from('app_settings').select('*').eq('key', 'helpline_number').maybeSingle()",
'      .then(({ data }) => { if (data) setHelpline(data.value) })',
'    const fetch = async () => {',
"      const { data } = await supabase.from('thali_requests')",
"        .select('*')",
"        .eq('user_id', user.id)",
'        .order(\'created_at\', { ascending: false })',
'        .limit(15)',
'',
'      // Show only pending requests; resolved ones move to Profile -> My Requests',
"      const pending = (data || []).filter(r => r.status === 'pending' || !r.status).slice(0, 5)",
'      setRequests(pending)',
'      setLoading(false)',
'    }',
'    fetch()',
'  }, [user.id])',
'',
"  const statusColor = (s) => s === 'pending' ? '#d4882a' : s === 'approved' ? '#5eba82' : '#e05555'",
'',
'  const whatsappShare = (r) => {',
"    const helplineClean = helpline ? helpline.replace(/[^0-9]/g, '') : ''",
'    if (!helplineClean) return',
"    const typeLabel = r.request_type === 'resume' ? 'Resume Thali' : r.request_type === 'stop' ? 'Stop Thali' : r.request_type === 'extra' ? 'Extra Food' : r.request_type === 'miqaat' ? 'Miqaat' : 'Request'",
'    const dateStr = r.from_date ? ` (From: ${new Date(r.from_date).toLocaleDateString(\'en-GB\', { day: \'numeric\', month: \'short\' })}${r.to_date ? ` To: ${new Date(r.to_date).toLocaleDateString(\'en-GB\', { day: \'numeric\', month: \'short\' })}` : \'\'})` : \'\'',
'    const details = r.details ? ` - ${r.details}` : \'\'',
'    const msg = `Al-Mawaid: ${typeLabel}${dateStr}${details} [Status: pending]`',
"    window.open(`https://wa.me/${helplineClean}?text=${encodeURIComponent(msg)}`, '_blank')",
'  }',
'',
'  if (loading) return <Spinner />',
'  if (requests.length === 0) return <div style={{ textAlign: \'center\', padding: 20, color: t.textSub, fontSize: 13, opacity: 0.6 }}>No pending requests.</div>',
'',
'  return (',
"    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>",
'      {requests.map(r => (',
"        <div key={r.id} style={{ padding: '12px 14px', borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>",
'          <div>',
'            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, fontFamily: "\'DM Sans\',sans-serif" }}>',
"              {r.request_type === 'resume' ? '▶️ Resume' : r.request_type === 'stop' ? '⏹️ Stop' : r.request_type === 'extra' ? '➕ Extra' : '🕌 Miqaat'}",
'            </div>',
'            <div style={{ fontSize: 11, color: t.textSub, marginTop: 2, fontFamily: "\'DM Sans\',sans-serif\" }}>{new Date(r.created_at).toLocaleDateString()}</div>',
'          </div>',
"          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>",
'            <div style={{ fontSize: 10, fontWeight: 800, padding: \'4px 10px\', borderRadius: 20, background: `${statusColor(r.status)}15`, color: statusColor(r.status), border: `1px solid ${statusColor(r.status)}30`, textTransform: \'uppercase\' }}>',
'              {r.status || \'PENDING\'}',
'            </div>',
'            {helpline && (',
'              <button onClick={() => whatsappShare(r)}',
"                title=\"Share on WhatsApp\"",
"                style={{ padding: '6px 8px', borderRadius: 8, border: 'none', background: '#25D36615', color: '#25D366', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, flexShrink: 0, transition: 'all 0.2s' }}",
"                onMouseEnter={e => e.currentTarget.style.background = '#25D36625'}",
"                onMouseLeave={e => e.currentTarget.style.background = '#25D36615'}",
'              >',
'                <MessageCircle size={14} />',
'              </button>',
'            )}',
'          </div>',
'        </div>',
'      ))}',
'    </div>',
'  )',
'}
'].join(NL);

a = a.substring(0, recentStart) + newRecent + a.substring(recentEnd);
console.log('1. Updated RecentRequestsList');

// ========================
// 2. Replace MyRequestsPage
// ========================
const myreqStart = 127608;

// Find function end by counting braces
let funcBodyStart = a.indexOf('{', myreqStart) + 1;
let depth = 1;
let endIdx = funcBodyStart;
while (depth > 0 && endIdx < a.length) {
  if (a[endIdx] === '{') depth++;
  else if (a[endIdx] === '}') depth--;
  endIdx++;
}

const newMyReq = [
'function MyRequestsPage({ onBack }) {',
'  const t = useTheme(), { user } = useAuth()',
'  const [requests, setRequests] = useState([])',
'  const [loading, setLoading] = useState(true)',
'  const [expandedMonth, setExpandedMonth] = useState(null)',
"  const [helpline, setHelpline] = useState('')",
'',
'  useEffect(() => {',
"    supabase.from('app_settings').select('*').eq('key', 'helpline_number').maybeSingle()",
'      .then(({ data }) => { if (data) setHelpline(data.value) })',
'    const fetchRequests = async () => {',
'      const { data, error } = await supabase',
"        .from('thali_requests')",
"        .select('*')",
"        .eq('user_id', user.id)",
'        .order(\'created_at\', { ascending: false })',
'      if (!error) setRequests(data || [])',
'      setLoading(false)',
'      if (data?.length > 0) {',
"        const mk = getMonthKey(new Date().toISOString());",
'        setExpandedMonth(mk);',
'      }',
'    }',
'    fetchRequests()',
'  }, [user.id])',
'',
'  const getMonthKey = (d) => {',
'    const date = new Date(d);',
'    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, \'0\')}`',
'  }',
'  const getMonthLabel = (mk) => {',
"    const [y, m] = mk.split('-');",
"    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];",
'    return `${months[parseInt(m) - 1]} ${y}`;',
'  }',
'',
'  const typeLabel = (type) => {',
'    const labels = { resume: "\'▶️ Resume Thali\'", stop: "\'⏹️ Stop Thali\'", miqaat: "\'🕌 Miqaat Pirsu\'", extra: "\'➕ Extra Food\'" }',
'    return labels[type] || type',
'  }',
"  const statusColor = (s) => s === 'pending' ? '#d4882a' : s === 'approved' ? '#5eba82' : '#e05555'",
'',
'  const whatsappShare = (r) => {',
"    const h = helpline ? helpline.replace(/[^0-9]/g, '') : ''",
'    if (!h) return',
"    const tl = r.request_type === 'resume' ? 'Resume Thali' : r.request_type === 'stop' ? 'Stop Thali' : r.request_type === 'extra' ? 'Extra Food' : r.request_type === 'miqaat' ? 'Miqaat' : 'Request'",
'    const ds = r.from_date ? ` (From: ${new Date(r.from_date).toLocaleDateString(\'en-GB\', { day: \'numeric\', month: \'short\' })}${r.to_date ? ` To: ${new Date(r.to_date).toLocaleDateString(\'en-GB\', { day: \'numeric\', month: \'short\' })}` : \'\'})` : \'\'',
'    const dt = r.details ? ` - ${r.details}` : \'\'',
'    const msg = `Al-Mawaid: ${tl}${ds}${dt} [Status: ${r.status || \'pending\'}]`',
"    window.open(`https://wa.me/${h}?text=${encodeURIComponent(msg)}`, '_blank')",
'  }',
'',
'  // Group by month, then by type within each month',
'  const grouped = {};',
'  requests.forEach(r => {',
'    const mk = getMonthKey(r.created_at);',
'    if (!grouped[mk]) grouped[mk] = {};',
"    const type = r.request_type || 'other';",
'    if (!grouped[mk][type]) grouped[mk][type] = [];',
'    grouped[mk][type].push(r);',
'  });',
'  const monthKeys = Object.keys(grouped).sort().reverse();',
'  const typeOrder = [\'resume\', \'stop\', \'miqaat\', \'extra\'];',
"  const typeEmoji = (t) => t === 'resume' ? '▶️' : t === 'stop' ? '⏹️' : t === 'miqaat' ? '🕌' : t === 'ext
