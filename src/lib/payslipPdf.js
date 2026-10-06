// src/lib/payslipPdf.js
// Generates a professional Al-Mawaid payment receipt / pay-slip PDF.
// jsPDF only (no autotable) — hand-drawn layout, print-friendly light theme.
import { jsPDF } from 'jspdf'

const GOLD = [184, 134, 11]
const GOLD_DEEP = [150, 116, 46]
const NAVY = [26, 31, 41]
const TEXT = [40, 44, 54]
const TEXT_SUB = [110, 116, 128]
const BORDER = [216, 213, 205]
const ROW_ALT = [247, 245, 240]
const WHITE = [255, 255, 255]
const GREEN = [22, 163, 74]

const inr = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtDateTime = (ts) => {
  try {
    const d = new Date(ts)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return String(ts || '')
  }
}

export function downloadPayslipPdf({ payment, memberName, thaliNumber, payeeUpi, payeeName, monthLabel }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a5' })
  const W = doc.internal.pageSize.getWidth()
  const M = 36
  let y = 0

  // ── Header band ──
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 86, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, 86, W, 4, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('Al-Mawaid', M, 36)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GOLD)
  doc.text('Daily Tiffin Service', M, 54)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('PAYMENT RECEIPT', W - M, 36, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(200, 200, 200)
  const receiptNo = 'AM-' + String(payment?.id || Date.now()).toString().replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase().padStart(8, '0')
  doc.text('Receipt: ' + receiptNo, W - M, 54, { align: 'right' })
  y = 118

  // ── Amount hero ──
  doc.setFillColor(...ROW_ALT)
  doc.roundedRect(M, y, W - M * 2, 64, 8, 8, 'F')
  doc.setTextColor(...TEXT_SUB)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('AMOUNT RECEIVED' + (monthLabel ? '  ·  ' + monthLabel : ''), M + 14, y + 22)
  doc.setTextColor(...GREEN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.text(inr(payment?.amount), M + 14, y + 50)
  const status = String(payment?.status || 'submitted').toLowerCase() === 'verified' ? 'VERIFIED' : 'RECORDED'
  doc.setFontSize(10)
  doc.setTextColor(...(status === 'VERIFIED' ? GREEN : GOLD_DEEP))
  doc.text(status, W - M - 14, y + 50, { align: 'right' })
  y += 84

  // ── Detail rows ──
  const rows = [
    ['Member', memberName || payment?.user_name || '—'],
    ['Thali Number', thaliNumber ? '#' + thaliNumber : '—'],
    ['Date & Time', fmtDateTime(payment?.created_at)],
    ['Paid To (UPI)', (payeeName ? payeeName + ' · ' : '') + (payeeUpi || payment?.upi_id || '—')],
    ['UTR / Reference', payment?.transaction_ref || '—'],
    ['Payment Mode', payment?.payment_method || 'UPI'],
    ['Remark', payment?.note || '—'],
  ]
  doc.setFontSize(10)
  rows.forEach(([k, v], i) => {
    const rh = 26
    if (i % 2 === 1) {
      doc.setFillColor(...ROW_ALT)
      doc.roundedRect(M, y, W - M * 2, rh, 4, 4, 'F')
    }
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...TEXT_SUB)
    doc.text(k, M + 12, y + 17)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...TEXT)
    const val = String(v ?? '—')
    doc.text(doc.splitTextToSize(val, W - M * 2 - 170)[0], M + 158, y + 17)
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.5)
    doc.line(M, y + rh, W - M, y + rh)
    y += rh
  })

  // ── Footer ──
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...TEXT_SUB)
  doc.text('This is a system-generated receipt for your thali contribution.', M, y)
  y += 14
  doc.text('Please preserve the UTR for any payment queries. Shukran!', M, y)
  y += 26
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(1.5)
  doc.line(M, y, M + 120, y)
  y += 14
  doc.setFontSize(9)
  doc.setTextColor(...TEXT)
  doc.text('Al-Mawaid Management', M, y)

  doc.save(`Al-Mawaid-Receipt-${receiptNo}.pdf`)
  return receiptNo
}
