import React from 'react'

const useThemeSkeleton = () => {
  const t = typeof useTheme !== 'undefined'
    ? { textSub: 'var(--text-tertiary)', border: 'var(--border-light)', accent: 'var(--accent-primary)', bg: 'var(--bg-deep)', card: 'var(--bg-surface)' }
    : { textSub: 'rgba(255,255,255,0.72)', border: 'rgba(255,255,255,0.1)', accent: '#D4AF37', bg: '#0a0d14', card: 'rgba(255,255,255,0.04)' }
  return t
}

const bar = {
  background: 'var(--border-light)',
  animation: 'skeletonPulse 1.5s ease-in-out infinite',
}

export const Skl = ({ w = '100%', h = 14, r, style = {} }) => (
  <div style={{ height: h, width: w, borderRadius: r ?? h / 2, ...bar, ...style }} />
)

export const SklBox = ({ w = '100%', h = 80, style = {} }) => (
  <div style={{
    height: h, width: w, borderRadius: 12,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-light)',
    animation: 'skeletonPulse 1.6s ease-in-out infinite',
    ...style
  }} />
)

export const SklCard = ({ style = {}, children }) => (
  <div style={{
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-light)',
    borderRadius: 20, padding: 'clamp(20px, 4vw, 28px)',
    ...style
  }}>
    {children}
  </div>
)

export const HomePageSkeleton = () => (
  <main style={{ flex: 1, padding: '16px 16px calc(110px + env(safe-area-inset-bottom, 20px))', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
    <SklCard style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, padding: '14px 16px', borderRadius: 18 }}>
      <Skl w={46} h={46} r="50%" />
      <div style={{ flex: 1 }}>
        <Skl w="50%" h={16} r={6} style={{ marginBottom: 6 }} />
        <Skl w="30%" h={12} r={6} />
      </div>
      <Skl w={44} h={44} r={12} />
    </SklCard>
    <SklCard style={{ marginBottom: 20, padding: 24, borderRadius: 24 }}>
      <Skl w="40%" h={10} r={6} style={{ marginBottom: 12 }} />
      <Skl w="65%" h={22} r={8} style={{ marginBottom: 8 }} />
      <Skl w="80%" h={12} r={6} style={{ marginBottom: 16 }} />
      <Skl w="45%" h={48} r={16} />
    </SklCard>
    <SklCard style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Skl w={36} h={36} r={10} />
        <Skl w="50%" h={18} r={8} />
      </div>
      {[1, 2].map(i => (
        <div key={i} style={{ padding: 20, borderRadius: 20, border: '1px solid var(--border-light)', marginBottom: 16 }}>
          <Skl w="25%" h={11} r={6} style={{ marginBottom: 8 }} />
          <Skl w="70%" h={14} r={6} style={{ marginBottom: 16 }} />
          <Skl w="30%" h={11} r={6} style={{ marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(n => <Skl key={n} w={28} h={28} r={4} />)}
          </div>
          <div style={{ marginTop: 16 }}>
            <Skl w="20%" h={10} r={6} style={{ marginBottom: 8 }} />
            <Skl w="100%" h={60} r={12} />
          </div>
        </div>
      ))}
      <Skl w="100%" h={52} r={16} />
    </SklCard>
  </main>
)

export const WeeklyMenuSkeleton = () => (
  <main style={{ flex: 1, padding: '16px 16px calc(110px + env(safe-area-inset-bottom, 20px))', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
    <SklCard style={{ marginBottom: 24, padding: 24, borderRadius: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Skl w={40} h={40} r={14} />
        <div>
          <Skl w="40%" h={10} r={6} style={{ marginBottom: 6 }} />
          <Skl w="60%" h={22} r={8} />
        </div>
      </div>
    </SklCard>
    {[1, 2, 3, 4, 5, 6].map(i => (
      <SklCard key={i} style={{ marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Skl w={36} h={36} r={10} />
          <div style={{ flex: 1 }}>
            <Skl w="35%" h={15} r={6} style={{ marginBottom: 4 }} />
            <Skl w="50%" h={11} r={6} />
          </div>
          <Skl w={24} h={24} r={6} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <SklBox h={80} style={{ flex: 1, borderRadius: 12 }} />
          <SklBox h={80} style={{ flex: 1, borderRadius: 12 }} />
        </div>
      </SklCard>
    ))}
  </main>
)

export const ProfileSkeleton = () => (
  <main style={{ flex: 1, padding: '16px 16px 120px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
    <SklCard style={{ textAlign: 'center', marginBottom: 20, padding: 32 }}>
      <Skl w={84} h={84} r="50%" style={{ margin: '0 auto 14px' }} />
      <Skl w="55%" h={22} r={8} style={{ margin: '0 auto 8px' }} />
      <Skl w="45%" h={13} r={6} style={{ margin: '0 auto 6px' }} />
      <Skl w="35%" h={24} r={20} style={{ margin: '0 auto' }} />
    </SklCard>
    <Skl w="25%" h={12} r={6} style={{ marginBottom: 20 }} />
    {[1, 2, 3, 4, 5, 6].map(i => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, padding: '13px 16px', borderRadius: 14, border: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}>
        <Skl w={42} h={42} r={12} />
        <div style={{ flex: 1 }}>
          <Skl w="45%" h={14} r={6} style={{ marginBottom: 4 }} />
          <Skl w="55%" h={11} r={6} />
        </div>
        <Skl w={15} h={15} r={4} />
      </div>
    ))}
  </main>
)

export const ListPageSkeleton = ({ title = '', count = 5 }) => (
  <main style={{ flex: 1, padding: '16px 16px 160px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
    {title && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Skl w={36} h={36} r={10} />
        <Skl w="40%" h={20} r={8} />
      </div>
    )}
    {[1, 2, 3, 4, 5].slice(0, count).map(i => (
      <div key={i} style={{ marginBottom: 12, padding: 16, borderRadius: 16, border: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Skl w="35%" h={13} r={6} />
          <Skl w="20%" h={13} r={6} />
        </div>
        <Skl w="75%" h={14} r={6} style={{ marginBottom: 4 }} />
        <Skl w="45%" h={12} r={6} />
      </div>
    ))}
  </main>
)

export const RequestsSkeleton = ({ title = 'My Requests' }) => (
  <main style={{ flex: 1, padding: '16px 16px 160px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <Skl w={36} h={36} r={10} />
      <Skl w="40%" h={20} r={8} />
    </div>
    <div style={{ display: 'flex', gap: 4, marginBottom: 18, padding: 5, borderRadius: 13, border: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}>
      {[1, 2, 3, 4].map(i => <Skl key={i} w="25%" h={32} r={9} />)}
    </div>
    {[1, 2, 3].map(i => (
      <div key={i} style={{ marginBottom: 12, padding: 16, borderRadius: 16, border: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Skl w="30%" h={14} r={6} />
              <Skl w="18%" h={16} r={20} />
            </div>
            <Skl w="50%" h={11} r={6} />
          </div>
        </div>
        <Skl w="60%" h={11} r={6} style={{ marginTop: 8 }} />
      </div>
    ))}
  </main>
)

export const NotificationsSkeleton = () => (
  <main style={{ flex: 1, padding: '16px 16px 120px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <Skl w={36} h={36} r={10} />
      <Skl w="30%" h={20} r={8} />
    </div>
    <div style={{ marginBottom: 20, padding: 18, borderRadius: 18, border: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <Skl w={44} h={44} r={14} />
        <div style={{ flex: 1 }}>
          <Skl w="45%" h={13} r={6} style={{ marginBottom: 6 }} />
          <Skl w="80%" h={11} r={6} />
        </div>
      </div>
    </div>
    <Skl w="20%" h={11} r={6} style={{ marginBottom: 12, marginLeft: 4 }} />
    {[1, 2, 3].map(i => (
      <div key={i} style={{ marginBottom: 10, borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Skl w={40} h={40} r={12} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Skl w="25%" h={11} r={6} />
                <Skl w="15%" h={10} r={6} />
              </div>
              <Skl w="60%" h={14} r={6} style={{ marginBottom: 4 }} />
              <Skl w="90%" h={11} r={6} />
            </div>
          </div>
        </div>
      </div>
    ))}
  </main>
)

export const KhidmatTeamSkeleton = () => (
  <main style={{ flex: 1, padding: '16px 16px 120px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <Skl w={36} h={36} r={10} />
      <Skl w="40%" h={20} r={8} />
    </div>
    <SklCard style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Skl w={60} h={60} r={16} />
        <div style={{ flex: 1 }}>
          <Skl w="35%" h={14} r={6} style={{ marginBottom: 4 }} />
          <Skl w="50%" h={11} r={6} />
          <Skl w="40%" h={11} r={6} style={{ marginTop: 4 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <Skl w="50%" h={40} r={12} />
        <Skl w="50%" h={40} r={12} />
      </div>
    </SklCard>
    <Skl w="100%" h={20} r={12} style={{ marginBottom: 16 }} />
    {[1, 2, 3].map(i => (
      <SklCard key={i} style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Skl w={60} h={60} r="50%" />
          <div style={{ flex: 1 }}>
            <Skl w="35%" h={16} r={6} style={{ marginBottom: 6 }} />
            <Skl w="25%" h={18} r={20} style={{ marginBottom: 4 }} />
            <Skl w="40%" h={11} r={6} />
          </div>
        </div>
      </SklCard>
    ))}
  </main>
)

export const AdminDashboardSkeleton = () => (
  <div style={{ padding: '0 clamp(12px, 4vw, 40px) 40px', maxWidth: 1400, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
    <div style={{ marginBottom: 40 }}>
      <Skl w="35%" h={40} r={10} style={{ marginBottom: 8 }} />
      <Skl w="25%" h={16} r={8} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 24 }}>
      {[1, 2, 3, 4].map(i => (
        <SklBox key={i} h={100} style={{ borderRadius: 20, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 20 }}>
          <Skl w="35%" h={10} style={{ marginBottom: 12 }} />
          <Skl w="55%" h={24} r={6} />
        </SklBox>
      ))}
    </div>
    <SklBox h={60} style={{ marginBottom: 4 }}>
      <div style={{ padding: 20 }}>
        <Skl w="30%" h={12} />
      </div>
    </SklBox>
    {[1, 2, 3, 4, 5].map(i => (
      <SklBox key={i} h={50} style={{ borderRadius: 0, borderTop: 'none' }}>
        <div style={{ padding: '16px 20px', display: 'flex', gap: 16 }}>
          <Skl w="25%" h={12} />
          <Skl w="20%" h={12} />
          <Skl w="35%" h={12} />
          <Skl w="15%" h={12} />
        </div>
      </SklBox>
    ))}
  </div>
)

export const AdminTableSkeleton = ({ rows = 5 }) => (
  <div style={{ padding: '0 clamp(12px, 4vw, 40px) 40px', maxWidth: 1400, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
    <div style={{ marginBottom: 32 }}>
      <Skl w="30%" h={32} r={8} />
    </div>
    <SklBox h={60} style={{ marginBottom: 4 }}>
      <div style={{ padding: 20 }}>
        <Skl w="25%" h={12} />
      </div>
    </SklBox>
    {Array.from({ length: rows }).map((_, i) => (
      <SklBox key={i} h={50} style={{ borderRadius: 0, borderTop: 'none' }}>
        <div style={{ padding: '16px 20px', display: 'flex', gap: 16 }}>
          <Skl w="20%" h={12} />
          <Skl w="25%" h={12} />
          <Skl w="15%" h={12} />
          <Skl w="30%" h={12} />
          <Skl w="10%" h={12} />
        </div>
      </SklBox>
    ))}
  </div>
)
