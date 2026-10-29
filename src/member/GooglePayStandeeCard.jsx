import React from 'react'
import { QRCodeCanvas } from 'qrcode.react'

// Official NPCI UPI URI Specification Generator for Google Pay for Business Merchant
export const generateUpiString = ({
  upiId = '6375250267@okbizaxis',
  payeeName = 'Al Mawaid',
  amount,
  note = 'Monthly Thali Contribution',
  mc = '5812',
  aid = 'uGICAgKCipYeAPg'
}) => {
  const cleanUpi = (upiId || '6375250267@okbizaxis').trim()
  const cleanName = (payeeName || 'Al Mawaid').trim()
  const cleanMc = (mc && String(mc).trim().length === 4 ? String(mc).trim() : '5812')
  const cleanAid = (aid || 'uGICAgKCipYeAPg').trim()

  const params = new URLSearchParams({
    pa: cleanUpi,
    pn: cleanName,
    mc: cleanMc,
    aid: cleanAid,
    ver: '01',
    mode: '01',
    cu: 'INR'
  })

  if (amount && Number(amount) > 0) {
    params.set('am', Number(amount).toFixed(2))
  }
  if (note) {
    params.set('tn', note.trim())
  }

  return `upi://pay?${params.toString()}`
}

export default function GooglePayStandeeCard({
  upiUri,
  qrId = 'al-mawaid-standee-qr',
  payeeName = 'Al Mawaid',
  phoneNumber = '+91 63752 50267',
  upiId = '6375250267@okbizaxis',
  amount = null,
  size = 195,
  style = {}
}) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 360,
        margin: '0 auto',
        backgroundColor: '#ffffff',
        borderRadius: 24,
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.16), 0 2px 8px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
        border: '1px solid #e5e7eb',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Google Sans', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        color: '#202124',
        userSelect: 'none',
        position: 'relative',
        ...style
      }}
    >
      {/* ── 1. Google 4-Color Top Stripe ── */}
      <div style={{ display: 'flex', width: '100%', height: 9 }}>
        <div style={{ flex: 1, backgroundColor: '#4285F4' }} /> {/* Google Blue */}
        <div style={{ flex: 1, backgroundColor: '#34A853' }} /> {/* Google Green */}
        <div style={{ flex: 1, backgroundColor: '#FBBC05' }} /> {/* Google Yellow */}
        <div style={{ flex: 1, backgroundColor: '#EA4335' }} /> {/* Google Red */}
      </div>

      {/* ── 2. Card Content Area ── */}
      <div style={{ padding: '20px 22px 18px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        
        {/* Google Pay Logo Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 8 }}>
          {/* Authentic Google Pay G-Ribbon SVG */}
          <svg width="34" height="26" viewBox="0 0 60 46" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M17.8 7.3C14.6 3.9 9.3 3.9 6.1 7.3C2.8 10.7 2.8 16.3 6.1 19.7L18.9 33.1L24.8 26.9L17.8 19.7C16.2 18 16.2 15.3 17.8 13.6C19.4 12 22 12 23.6 13.6L27.6 17.8L33.5 11.6L29.5 7.4C26.3 4 21 4 17.8 7.3Z"
              fill="#4285F4"
            />
            <path
              d="M42.2 7.3C39 3.9 33.7 3.9 30.5 7.3L17.8 20.6L23.7 26.8L36.4 13.6C38 12 40.6 12 42.2 13.6C43.8 15.3 43.8 18 42.2 19.7L31.3 31.1L37.2 37.3L48.1 25.9C51.3 22.5 51.3 17 48.1 13.6C46.5 11.9 44.4 11 42.2 7.3Z"
              fill="#34A853"
            />
            <path
              d="M18.9 33.1C22.1 36.5 27.4 36.5 30.6 33.1L37.2 26.2L31.3 20L24.8 26.9L18.9 33.1Z"
              fill="#FBBC05"
            />
            <path
              d="M37.2 37.3C35.6 39 33.5 39.8 31.3 39.8C29.2 39.8 27.1 39 25.4 37.3L18.9 30.5L13 36.7L19.5 43.5C22.7 46.8 27.9 46.8 31.1 43.5L43.1 31.1L37.2 24.9L37.2 37.3Z"
              fill="#EA4335"
            />
          </svg>
          <span style={{ fontSize: 23, fontWeight: 700, color: '#3c4043', letterSpacing: '-0.3px', lineHeight: 1 }}>
            Google Pay
          </span>
        </div>

        {/* Payee Name */}
        <h2 style={{ margin: '4px 0 0', fontSize: 19, fontWeight: 700, color: '#202124', letterSpacing: '-0.2px' }}>
          {payeeName}
        </h2>

        {/* Payee Phone Number */}
        <div style={{ marginTop: 2, fontSize: 13.5, fontWeight: 500, color: '#5f6368', letterSpacing: '0.1px' }}>
          {phoneNumber}
        </div>

        {/* Scan & Pay label */}
        <div style={{ marginTop: 10, marginBottom: 10, fontSize: 14.5, fontWeight: 700, color: '#202124' }}>
          Scan &amp; pay
        </div>

        {/* Amount Badge if locked */}
        {amount && Number(amount) > 0 && (
          <div style={{
            marginBottom: 10, padding: '3px 12px', borderRadius: 20,
            backgroundColor: '#e6f4ea', border: '1px solid #ceead6',
            color: '#137333', fontSize: 12.5, fontWeight: 700
          }}>
            Paying ₹{Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </div>
        )}

        {/* QR Code Canvas */}
        <div style={{
          padding: 8,
          backgroundColor: '#ffffff',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #f1f3f4'
        }}>
          <QRCodeCanvas
            id={qrId}
            value={upiUri}
            size={size}
            level="M"
            includeMargin={false}
          />
        </div>

        {/* UPI ID string under QR */}
        <div style={{
          marginTop: 10,
          fontSize: 12,
          fontWeight: 600,
          color: '#3c4043',
          letterSpacing: '0.2px',
          fontFamily: "monospace, -apple-system, sans-serif"
        }}>
          UPI ID: {upiId}
        </div>

        {/* BHIM UPI Horizontal Divider Banner */}
        <div style={{
          width: '100%',
          marginTop: 12,
          paddingTop: 10,
          borderTop: '1px solid #f1f3f4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12
        }}>
          {/* BHIM Logo Vector */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 900, fontStyle: 'italic', color: '#374151', letterSpacing: '-0.5px' }}>
                BHIM
              </span>
              <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
                <polygon points="0,0 8,6 0,12" fill="#15803d" />
                <polygon points="2,2 8,6 2,10" fill="#f97316" />
              </svg>
            </div>
            <span style={{ fontSize: 5.5, fontWeight: 700, color: '#6b7280', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              Bharat Interface For Money
            </span>
          </div>

          {/* Thin Vertical Divider */}
          <div style={{ width: 1, height: 22, backgroundColor: '#d1d5db' }} />

          {/* UPI Logo Vector */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 900, fontStyle: 'italic', color: '#15803d', letterSpacing: '-0.3px' }}>
                UPI
              </span>
              <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
                <polygon points="0,0 8,6 0,12" fill="#f97316" />
                <polygon points="2,2 8,6 2,10" fill="#15803d" />
              </svg>
            </div>
            <span style={{ fontSize: 5.5, fontWeight: 700, color: '#6b7280', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              Unified Payments Interface
            </span>
          </div>
        </div>

        {/* ── Supported UPI Apps Pill Bar ── */}
        <div style={{
          width: '100%',
          marginTop: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          flexWrap: 'wrap',
          opacity: 0.95
        }}>
          {/* GPay */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 6, backgroundColor: '#f8fafc' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#4285F4' }}>G</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Pay</span>
          </div>

          {/* Paytm */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '2px 6px', borderRadius: 6, backgroundColor: '#f8fafc' }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: '#002970' }}>Pay</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: '#00baf2' }}>tm</span>
          </div>

          {/* PhonePe */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 6, backgroundColor: '#f8fafc' }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%', backgroundColor: '#5f259f',
              color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 900
            }}>
              पे
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#5f259f' }}>PhonePe</span>
          </div>

          {/* Amazon Pay */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 20, height: 20, borderRadius: '50%', backgroundColor: '#232f3e'
          }}>
            <span style={{ fontSize: 8.5, fontWeight: 800, color: '#ff9900' }}>pay</span>
          </div>
        </div>

      </div>
    </div>
  )
}
