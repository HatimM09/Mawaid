// src/lib/paymentGateway.js
// ═════════════════════════════════════════════════════════════════════════════
// Official Payment Gateway Integration (Razorpay / Certified Aggregators)
// Resolves Google Pay "risky transaction" error by using RBI-certified merchant rails.
// Zero setup fee, zero annual maintenance fee, and direct bank settlement.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Dynamically loads the official Razorpay checkout script.
 */
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false)
    if (window.Razorpay) return resolve(true)

    const existingScript = document.getElementById('razorpay-checkout-js')
    if (existingScript) {
      existingScript.onload = () => resolve(true)
      return
    }

    const script = document.createElement('script')
    script.id = 'razorpay-checkout-js'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => {
      console.warn('[paymentGateway] Failed to load Razorpay checkout script.')
      resolve(false)
    }
    document.body.appendChild(script)
  })
}

/**
 * Launches the official Razorpay checkout modal with native Google Pay support.
 *
 * @param {Object} params
 * @param {string} params.keyId - Razorpay Key ID (rzp_live_... or rzp_test_...)
 * @param {number} params.amount - Amount in INR (e.g. 400 or 1500)
 * @param {string} params.currency - Default 'INR'
 * @param {string} params.name - Business / Organization name (e.g. 'Al-Mawaid')
 * @param {string} params.description - Payment description
 * @param {Object} params.user - User details { name, email, phone, thali_number }
 * @param {Function} params.onSuccess - Callback on payment success (receives response)
 * @param {Function} params.onFailure - Callback on payment failure or dismissal
 */
export async function openRazorpayCheckout({
  keyId,
  amount,
  currency = 'INR',
  name = 'Al-Mawaid',
  description = 'Monthly Thali Contribution',
  user = {},
  onSuccess,
  onFailure
}) {
  if (!keyId) {
    throw new Error('Razorpay Key ID is not configured.')
  }

  const loaded = await loadRazorpayScript()
  if (!loaded || !window.Razorpay) {
    throw new Error('Could not load secure payment gateway. Please check your internet connection.')
  }

  const numericAmount = Math.max(1, Math.round(Number(amount) * 100)) // Amount in Paise (e.g. 40000 for ₹400)

  return new Promise((resolve, reject) => {
    const options = {
      key: keyId.trim(),
      amount: numericAmount,
      currency: currency || 'INR',
      name: name || 'Al-Mawaid',
      description: description || 'Monthly Thali Contribution',
      image: '/al-mawaid.png',
      notes: {
        thali_number: String(user?.thali_number || ''),
        user_id: String(user?.user_id || user?.id || '')
      },
      prefill: {
        name: user?.name || '',
        email: user?.email || '',
        contact: user?.phone || '6375250267'
      },
      theme: {
        color: '#10b981',
        backdrop_color: 'rgba(0, 0, 0, 0.7)'
      },
      handler: function (response) {
        if (onSuccess) onSuccess(response)
        resolve(response)
      },
      modal: {
        ondismiss: function () {
          const err = { dismissed: true, message: 'Payment cancelled by user.' }
          if (onFailure) onFailure(err)
          resolve(err)
        }
      }
    }

    try {
      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', function (response) {
        const err = response.error || { message: 'Payment failed' }
        if (onFailure) onFailure(err)
        reject(err)
      })
      rzp.open()
    } catch (err) {
      if (onFailure) onFailure(err)
      reject(err)
    }
  })
}
