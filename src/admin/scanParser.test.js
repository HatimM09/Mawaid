import { describe, it, expect } from 'vitest'
import { extractScanTarget, cleanThaliComparable, resolveScannedUser } from './scanParser'

describe('scanParser', () => {
  describe('extractScanTarget', () => {
    it('extracts target from standard ALMAWAID prefix', () => {
      expect(extractScanTarget('ALMAWAID:123')).toBe('123')
      expect(extractScanTarget('ALMAWAID: 42')).toBe('42')
      expect(extractScanTarget('almawaid:U99')).toBe('U99')
    })

    it('extracts target from partial or messy scanner input', () => {
      expect(extractScanTarget(':123')).toBe('123')
      expect(extractScanTarget('#123')).toBe('123')
      expect(extractScanTarget('ALMAWAID:#042')).toBe('042')
      expect(extractScanTarget('xALMAWAID:500')).toBe('500')
    })

    it('extracts target from URL query parameters', () => {
      expect(extractScanTarget('https://al-mawaid.web.app/post?thali=88')).toBe('88')
      expect(extractScanTarget('https://al-mawaid.vercel.app/survey-tracking?scan=999')).toBe('999')
      expect(extractScanTarget('https://al-mawaid.web.app/pay?userId=user_abc')).toBe('user_abc')
    })
  })

  describe('cleanThaliComparable', () => {
    it('normalizes zero-padded and prefixed thalis', () => {
      expect(cleanThaliComparable('#042')).toBe('42')
      expect(cleanThaliComparable('042')).toBe('42')
      expect(cleanThaliComparable('42')).toBe('42')
      expect(cleanThaliComparable('A-12')).toBe('a12')
    })
  })

  describe('resolveScannedUser with cachedUsers', () => {
    const cachedUsers = [
      { user_id: 'usr_1', thali_number: '42', name: 'User 1' },
      { user_id: 'usr_2', thali_number: '105', name: 'User 2' },
      { user_id: 'usr_3', thali_number: '007', name: 'User 3' }
    ]

    it('resolves user 1 on first scan', async () => {
      const u = await resolveScannedUser('ALMAWAID:42', cachedUsers)
      expect(u).not.toBeNull()
      expect(u.name).toBe('User 1')
    })

    it('resolves user 2 on consecutive second scan without shutting down', async () => {
      const u = await resolveScannedUser('ALMAWAID:105', cachedUsers)
      expect(u).not.toBeNull()
      expect(u.name).toBe('User 2')
    })

    it('resolves user 3 with zero-padded number 007 or 7', async () => {
      const u1 = await resolveScannedUser('ALMAWAID:7', cachedUsers)
      expect(u1).not.toBeNull()
      expect(u1.name).toBe('User 3')

      const u2 = await resolveScannedUser('ALMAWAID:007', cachedUsers)
      expect(u2).not.toBeNull()
      expect(u2.name).toBe('User 3')
    })
  })
})
