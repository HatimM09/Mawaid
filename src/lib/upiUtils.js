// src/lib/upiUtils.js
// ═════════════════════════════════════════════════════════════════════════════
// NPCI Universal Standard UPI Payment & Direct P2P Transfer Engine
// 100% Free, Zero Gateway Fees, Compatible with Personal & Business Accounts
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Generates an official NPCI-compliant UPI URI.
 *
 * Supports both:
 * 1. Personal P2P (Savings account / Personal UPI): clean pa, pn, am, cu, tn.
 * 2. Google Pay Business (@okbizaxis): includes mc=5812 and valid tr to satisfy
 *    Google Pay Business merchant rail requirements.
 */
export function generateUpiString({
  upiId = '6375250267@okbizaxis',
  payeeName = 'Al Mawaid',
  amount = null,
  note = 'Monthly Thali Contribution',
  mc = '5812',
  tr = null,
  isMerchant = null
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

  // Detect whether this VPA is a Google Pay Business (@okbizaxis) or BharatPe merchant
  const isBizHandle = /@okbizaxis|@okmerchant|@bharatpe/i.test(cleanUpi)
  const shouldAttachMerchant = isMerchant !== null ? isMerchant : isBizHandle

  if (shouldAttachMerchant) {
    const validMc = mc && String(mc).trim().length === 4 ? String(mc).trim() : '5812'
    params.set('mc', validMc)
    const uniqueTr = tr ? String(tr).trim() : `ALM${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`
    params.set('tr', uniqueTr)
  }

  return `upi://pay?${params.toString()}`
}

/**
 * Builds targeted deep-link URLs for specific UPI apps.
 */
export function buildTargetedUpiUri(upiUri, app = 'upi') {
  if (!upiUri) return ''
  const queryStr = upiUri.replace(/^upi:\/\/pay\?/, '')
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)

  switch (app) {
    case 'gpay':
      // For Google Pay, standard upi:// with fallback or tez://
      if (isAndroid) {
        // Native intent launching for Google Pay
        return `tez://upi/pay?${queryStr}`
      }
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
      `Salam! I want to pay my monthly Thali dues${amtStr}. Please assist with payment verification.`
    )}`
    window.location.href = waUrl
    return true
  }

  const targetUri = buildTargetedUpiUri(uri, app)

  // 1. If running inside Capacitor Native Android Shell
  if (typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()) {
    try {
      const { AppLauncher } = await import('@capacitor/app-launcher')
      const { completed } = await AppLauncher.openUrl({ url: targetUri })
      if (completed) return true
    } catch (err) {
      console.warn('[launchUpiApp] Native AppLauncher failed, trying browser navigation:', err)
    }
  }

  // 2. Browser Navigation via invisible anchor click
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
    window.location.href = targetUri
    return true
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
