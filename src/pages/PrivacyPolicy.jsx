import React from 'react'
import { ChevronLeft, Shield } from 'lucide-react'

const t = {
  bg: '#050505',
  bgGrad: 'radial-gradient(ellipse at 30% 0%, #1a1308 0%, #050505 60%)',
  card: 'rgba(212, 175, 55, 0.04)',
  border: 'rgba(212, 175, 55, 0.15)',
  accent: '#F0C239',
  accentGrad: 'linear-gradient(135deg, #F0C239 0%, #D4A017 50%, #B8860B 100%)',
  accentBg: 'rgba(240, 194, 57, 0.08)',
  accentBorder: 'rgba(240, 194, 57, 0.35)',
  text: '#FAF3E0',
  textSub: 'rgba(250, 243, 224, 0.72)',
  textBody: '#E8DCC8',
  geo: 'rgba(240, 194, 57, 0.04)',
}

const sections = [
  {
    title: 'Information We Collect',
    content: `We collect information you provide directly when using Al-Mawaid, including your name, email address, phone number, and thali (meal) preferences. We also collect survey responses, feedback submissions, and meal requests you submit through the app.

Automatically collected information includes device type, operating system version, app usage patterns, and crash reports to help us improve our service.`
  },
  {
    title: 'How We Use Your Information',
    content: `We use your information to:
• Process your meal surveys and requests
• Notify you about menu updates and announcements
• Improve our food service based on your feedback
• Communicate with you regarding your account and queries
• Ensure the security and proper functioning of the app`
  },
  {
    title: 'Data Sharing & Disclosure',
    content: `Al-Mawaid does not sell your personal information to third parties. We may share anonymized, aggregated data for operational analysis. Your meal preferences and survey responses are shared internally with our kitchen and service staff solely for the purpose of preparing and delivering your meals.

We may disclose information if required by law or to protect the rights, property, or safety of our users and service.`
  },
  {
    title: 'Data Storage & Security',
    content: `Your data is stored securely on encrypted servers using industry-standard practices. We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.

While we strive to protect your data, no method of electronic storage is 100% secure. We encourage you to use strong passwords and keep your login credentials confidential.`
  },
  {
    title: 'Your Rights & Choices',
    content: `You have the right to:
• Access, update, or delete your personal information
• Opt out of promotional notifications
• Withdraw consent for data processing at any time
• Request a copy of the data we hold about you

You can manage your preferences within the app's profile settings or contact us directly for assistance.`
  },
  {
    title: 'Third-Party Services',
    content: `Al-Mawaid uses Supabase for database management and Firebase for authentication and push notifications. These services have their own privacy policies governing data handling.

We also use Google Play Services for app distribution. Google's privacy policy applies to your use of the Google Play Store.`
  },
  {
    title: 'Changes to This Policy',
    content: `We may update this Privacy Policy from time to time. Changes will be posted within the app, and where appropriate, notified to you. Continued use of Al-Mawaid after changes constitutes acceptance of the updated policy.

This policy was last updated on July 22, 2026.`
  },
  {
    title: 'Contact Us',
    content: `If you have any questions, concerns, or requests regarding this Privacy Policy or your data, please contact us through the app's query system or reach out to our support team.`
  }
]

const GeoBg = () => (
  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.5 }}>
    <defs>
      <pattern id="geo-pol" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
        <path d="M24 2L46 24L24 46L2 24Z" fill="none" stroke={t.geo} strokeWidth="0.7" />
        <circle cx="24" cy="24" r="4.5" fill="none" stroke={t.geo} strokeWidth="0.5" />
        <circle cx="0" cy="0" r="2" fill={t.geo} /><circle cx="48" cy="0" r="2" fill={t.geo} />
        <circle cx="0" cy="48" r="2" fill={t.geo} /><circle cx="48" cy="48" r="2" fill={t.geo} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#geo-pol)" />
  </svg>
)

export default function PrivacyPolicy() {
  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      window.location.href = '/'
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: t.bgGrad,
      color: t.text,
      fontFamily: "'DM Sans','Segoe UI',-apple-system,sans-serif",
      position: 'relative',
      overflow: 'auto',
    }}>
      <GeoBg />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto', padding: 'calc(env(safe-area-inset-top, 16px) + 24px) 20px calc(40px + env(safe-area-inset-bottom))' }}>
        {/* Back button */}
        <button
          onClick={handleBack}
          style={{
            background: t.accentBg,
            border: `1px solid ${t.accentBorder}`,
            borderRadius: 14,
            padding: '10px 16px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            color: t.accent,
            fontWeight: 700,
            fontSize: 13,
            fontFamily: 'inherit',
            marginBottom: 28,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = t.accentBorder; e.currentTarget.style.color = '#000' }}
          onMouseLeave={e => { e.currentTarget.style.background = t.accentBg; e.currentTarget.style.color = t.accent }}
        >
          <ChevronLeft size={18} />
          Back
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: t.accentGrad,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: `0 12px 40px ${t.accent}30`,
          }}>
            <Shield size={32} color="#000" />
          </div>
          <h1 style={{
            fontFamily: "'Playfair Display',serif",
            fontSize: 32,
            fontWeight: 700,
            color: t.accent,
            margin: '0 0 8px',
            letterSpacing: '0.02em',
          }}>
            Privacy Policy
          </h1>
          <p style={{
            fontSize: 14,
            color: t.textSub,
            margin: 0,
            lineHeight: 1.6,
            maxWidth: 480,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            Al-Mawaid respects your privacy. This policy outlines how we collect, use, and protect your personal information.
          </p>
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {sections.map((section, i) => (
            <div
              key={i}
              style={{
                background: t.card,
                border: `1px solid ${t.border}`,
                borderRadius: 24,
                padding: '28px 32px',
                backdropFilter: 'blur(20px) saturate(2)',
                WebkitBackdropFilter: 'blur(20px) saturate(2)',
                boxShadow: `0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)`,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{
                position: 'absolute',
                top: 0, left: 0,
                width: '4px',
                height: '100%',
                background: t.accentGrad,
                borderRadius: '4px 0 0 4px',
                opacity: 0.6,
              }} />
              <h2 style={{
                fontFamily: "'Playfair Display',serif",
                fontSize: 20,
                fontWeight: 700,
                color: t.accent,
                margin: '0 0 14px',
                letterSpacing: '0.01em',
              }}>
                {section.title}
              </h2>
              <p style={{
                fontSize: 14.5,
                lineHeight: 1.8,
                color: t.textBody,
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}>
                {section.content}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 48, paddingTop: 24, borderTop: `1px solid ${t.border}` }}>
          <img
            src="/al-mawaid.png"
            alt="Al-Mawaid"
            style={{ width: 32, height: 32, objectFit: 'contain', marginBottom: 12, opacity: 0.6 }}
          />
          <p style={{ fontSize: 12, color: t.textSub, opacity: 0.5, margin: 0 }}>
            &copy; {new Date().getFullYear()} Al-Mawaid. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
