import { describe, it, expect, vi } from 'vitest'
import { openRazorpayCheckout } from './paymentGateway'

describe('paymentGateway', () => {
  it('throws error if keyId is missing', async () => {
    await expect(openRazorpayCheckout({ keyId: '', amount: 400 })).rejects.toThrow(
      'Razorpay Key ID is not configured.'
    )
  })

  it('opens Razorpay with correct options when window.Razorpay is available', async () => {
    const mockOpen = vi.fn()
    const mockOn = vi.fn()
    let capturedOptions = null

    class MockRazorpay {
      constructor(options) {
        capturedOptions = options
        this.open = mockOpen
        this.on = mockOn
      }
    }
    window.Razorpay = MockRazorpay

    // Launch checkout
    const promise = openRazorpayCheckout({
      keyId: 'rzp_test_12345',
      amount: 400,
      name: 'Al-Mawaid',
      user: { name: 'Hatim', email: 'hatim@test.com', thali_number: '108' }
    })

    // Allow async loadRazorpayScript microtask to resolve
    await Promise.resolve()

    expect(capturedOptions).not.toBeNull()
    expect(capturedOptions.key).toBe('rzp_test_12345')
    expect(capturedOptions.amount).toBe(40000) // ₹400 in paise
    expect(capturedOptions.currency).toBe('INR')
    expect(capturedOptions.prefill.name).toBe('Hatim')
    expect(mockOpen).toHaveBeenCalled()

    // simulate user dismissal
    capturedOptions.modal.ondismiss()
    await expect(promise).resolves.toEqual({ dismissed: true, message: 'Payment cancelled by user.' })

    delete window.Razorpay
  })
})
