import { describe, it, expect } from 'vitest'
import {
  generateUpiString,
  buildTargetedUpiUri,
  extractUtrNumber,
  buildWhatsAppProofMessage
} from './upiUtils'

describe('upiUtils', () => {
  describe('generateUpiString', () => {
    it('generates standard NPCI UPI URI with clean parameters without fake tr', () => {
      const uri = generateUpiString({
        upiId: '6375250267@okbizaxis',
        payeeName: 'Al Mawaid',
        amount: 400,
        note: 'Monthly Thali Contribution'
      })

      expect(uri).toContain('upi://pay?')
      expect(uri).toContain('pa=6375250267%40okbizaxis')
      expect(uri).toContain('pn=Al+Mawaid')
      expect(uri).toContain('am=400.00')
      expect(uri).toContain('cu=INR')
      expect(uri).toContain('tn=Monthly+Thali+Contribution')
      // CRITICAL: Must not contain fake tr that breaks Axis Bank and GPay after PIN
      expect(uri).not.toContain('tr=')
      // Must not contain forced mc unless explicitly passed
      expect(uri).not.toContain('mc=')
    })

    it('attaches explicit mc and tr only when provided', () => {
      const uri = generateUpiString({
        upiId: '6375250267@okaxis',
        payeeName: 'MURTUJA',
        amount: 1500,
        mc: '5812',
        tr: 'ORDER12345'
      })

      expect(uri).toContain('mc=5812')
      expect(uri).toContain('tr=ORDER12345')
      expect(uri).toContain('am=1500.00')
    })
  })

  describe('buildTargetedUpiUri', () => {
    const baseUri = 'upi://pay?pa=6375250267%40okbizaxis&pn=Al+Mawaid&am=400.00&cu=INR'

    it('returns tez:// for gpay', () => {
      const res = buildTargetedUpiUri(baseUri, 'gpay')
      expect(res).toContain('tez://upi/pay?')
      expect(res).toContain('pa=6375250267%40okbizaxis')
    })

    it('returns phonepe:// for phonepe', () => {
      const res = buildTargetedUpiUri(baseUri, 'phonepe')
      expect(res).toContain('phonepe://pay?')
    })

    it('returns paytmmp:// for paytm', () => {
      const res = buildTargetedUpiUri(baseUri, 'paytm')
      expect(res).toContain('paytmmp://pay?')
    })

    it('returns upi:// for universal upi', () => {
      const res = buildTargetedUpiUri(baseUri, 'upi')
      expect(res).toBe(baseUri)
    })
  })

  describe('extractUtrNumber', () => {
    it('extracts 12-digit UTR from bank SMS text', () => {
      const sms = 'Rs 400.00 debited from A/C XX1234 on 24-Nov-26. UPI Ref 432910394812. Not you?'
      expect(extractUtrNumber(sms)).toBe('432910394812')
    })

    it('cleans raw pasted string', () => {
      expect(extractUtrNumber('  432910394812  ')).toBe('432910394812')
      expect(extractUtrNumber('UTR: 532910394812')).toBe('532910394812')
    })
  })

  describe('buildWhatsAppProofMessage', () => {
    it('formats a clean member transfer proof message', () => {
      const msg = buildWhatsAppProofMessage({
        memberName: 'Hatim Mithai',
        thaliNumber: '108',
        amount: 400,
        utr: '432910394812',
        monthLabel: 'Nov 2026'
      })

      expect(msg).toContain('Hatim Mithai')
      expect(msg).toContain('Thali #108')
      expect(msg).toContain('400')
      expect(msg).toContain('432910394812')
      expect(msg).toContain('Nov 2026')
    })
  })
})
