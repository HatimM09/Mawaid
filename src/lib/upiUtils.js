// src/lib/upiUtils.js
// ═════════════════════════════════════════════════════════════════════════════
// NPCI Universal Standard UPI Payment & Direct Transfer Engine
// 100% Free, Zero Gateway Fees, Compatible with Personal VPAs & Business Handles
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Generates an official NPCI-compliant UPI URI.
 *
 * CRITICAL FIX FOR GOOGLE PAY & AXIS BANK DECLINES:
 * Never inject a dynamic `tr` (Transaction Reference) parameter unless an actual
 * Payment Gateway backend registered it with the acquiring bank.
 * Passing a fake `tr` causes Axis Bank / Google Pay to treat the static payment
 * as an unverified e-commerce order and decline it immediately after UPI PIN entry!
 */
export function generateUpiString({
  upiId = '6375250267@okbizaxis',
  payeeName = 'Al Mawaid',
  amount = null,
  note = 'Monthly Thali Contribution',
  mc = null,
  tr = null
}) {
  const cleanUpi = String(upiId || '6375250267@okbizaxis').trim()
  const cleanName = String(payeeName || 'Al Mawaid').trim()

  const params = new URLSearchParams()
  params.set('pa', cleanUpi)
  params.set('pn', cleanName)
  params.set('cu', 'INR')

  // Amount formatted with strictly 2 decimals
  if (amount && Number(amount) > 0) {
    params.set('am', Number(amount).toFixed(2))
  }

  // Clean transaction note (alphanumeric only, max 30 chars, no special characters that break intent URLs)
  if (note) {
    const cleanNote = String(note)
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .substring(0, 30)
      .trim()
    if (cleanNote) params.set('tn', cleanNote)
  }

  // Only attach `mc` if explicitly passed by admin AND valid 4-digit code (not '0000')
  if (mc && String(mc).trim().length === 4 && String(mc).trim() !== '0000') {
    params.set('mc', String(mc).trim())
  }

  // Only attach `tr` if explicitly passed by a real merchant order engine
  if (tr && String(tr).trim()) {
    params.set('tr', String(tr).trim())
  }

  return `upi://pay?${params.toString()}`
}

/**
 * Builds targeted deep-link URLs for specific UPI apps.
 */
export function buildTargetedUpiUri(upiUri, app = 'upi') {
  if (!upiUri) return ''
  const queryStr = upiUri.replace(/^upi:\/\/pay\?/, '')

  switch (app) {
    case 'gpay':
      // tez:// launches Google Pay directly on Android / iOS
      return `tez://upi/pay?${queryStr}`

    case 'phonepe':
      return `phonepe://pay?${queryStr}`

    case 'paytm':
      return `paytmmp://pay?${queryStr}`

    case 'bhim':
      return `upi://pay?${queryStr}`

    case 'cred':
      return `credpay://upi/pay?${queryStr}`

    case 'upi':
    default:
      return upiUri
  }
}

/**
 * Launches the selected UPI app or native chooser.
 */
export async function launchUpiApp(uri, app = 'upi', amount = null, helpline = '6375250267') {
  if (!uri) return false

  if (app === 'whatsapp') {
    const amtStr = amount ? ` ₹${amount}` : ''
    const waPhone = String(helpline || '916375250267').replace(/[^0-9]/g, '')
    const targetPhone = waPhone.startsWith('91') ? waPhone : `91${waPhone}`
    const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(
      `Salam! I want to pay my monthly Thali dues${amtStr}. Please share payment details or verify my transfer.`
    )}`
    window.location.href = waUrl
    return true
  }

  const targetUri = buildTargetedUpiUri(uri, app)
  const universalUri = uri.startsWith('upi://') ? uri : `upi://pay?${uri.replace(/^[a-z]+:\/\/[^?]*\?/, '')}`

  // 1. If running inside Capacitor Native Android Shell
  if (typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()) {
    try {
      const { AppLauncher } = await import('@capacitor/app-launcher')
      const { completed } = await AppLauncher.openUrl({ url: targetUri })
      if (completed) return true
    } catch (err) {
      console.warn('[launchUpiApp] Targeted openUrl failed, trying universal upi://', err)
      try {
        const { AppLauncher } = await import('@capacitor/app-launcher')
        const { completed } = await AppLauncher.openUrl({ url: universalUri })
        if (completed) return true
      } catch (e) {
        console.warn('[launchUpiApp] Universal AppLauncher failed:', e)
      }
    }
  }

  // 2. Browser Navigation via invisible anchor click with fallback
  try {
    const a = document.createElement('a')
    a.href = targetUri
    a.rel = 'noopener noreferrer'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    return true
  } catch {
    // 3. Fallback direct window location
    try {
      window.location.href = targetUri
      return true
    } catch {
      window.location.href = universalUri
      return true
    }
  }
}

/**
 * Extracts a clean 12-digit UPI Reference / UTR number from raw text,
 * bank SMS, or pasted strings.
 */
export function extractUtrNumber(input) {
  if (!input) return ''
  const str = String(input).trim()
  // Look for any 12-digit number sequence
  const match = str.match(/\b\d{12}\b/)
  if (match) return match[0]
  // Fallback: strip spaces and non-alphanumeric, limit to 16 chars
  return str.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)
}

/**
 * Formats a clean WhatsApp confirmation message for the member to send
 * to the treasurer / admin right after transferring money.
 */
export function buildWhatsAppProofMessage({
  memberName = 'Member',
  thaliNumber = '',
  amount = 1500,
  utr = '',
  monthLabel = ''
}) {
  const thaliStr = thaliNumber ? `Thali #${thaliNumber}` : ''
  const monthStr = monthLabel ? `for ${monthLabel}` : ''
  const formattedAmt = Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

  return `Salam! I have transferred ₹${formattedAmt} ${monthStr} via UPI.\n\n` +
    `👤 Member: ${memberName} ${thaliStr}\n` +
    `💰 Amount: ₹${formattedAmt}\n` +
    `🔢 UPI Ref (UTR): ${utr || 'Direct Transfer'}\n` +
    `📅 Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}\n\n` +
    `Please confirm receipt in Al-Mawaid. Shukran!`
}
