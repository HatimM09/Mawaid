import { describe, it, expect } from 'vitest'
import { getCurrentMealByTime } from './utils'

describe('getCurrentMealByTime', () => {
  it('returns lunch before 12:00 PM', () => {
    const morning = new Date('2026-11-25T09:30:00')
    expect(getCurrentMealByTime(morning)).toBe('lunch')

    const justBeforeNoon = new Date('2026-11-25T11:59:59')
    expect(getCurrentMealByTime(justBeforeNoon)).toBe('lunch')
  })

  it('returns dinner from 12:00 PM till 7:00 PM (19:00)', () => {
    const noon = new Date('2026-11-25T12:00:00')
    expect(getCurrentMealByTime(noon)).toBe('dinner')

    const afternoon = new Date('2026-11-25T14:30:00')
    expect(getCurrentMealByTime(afternoon)).toBe('dinner')

    const evening = new Date('2026-11-25T18:59:59')
    expect(getCurrentMealByTime(evening)).toBe('dinner')
  })

  it('returns lunch after 7:00 PM (19:00) for next day meal preparation', () => {
    const eveningSeven = new Date('2026-11-25T19:00:00')
    expect(getCurrentMealByTime(eveningSeven)).toBe('lunch')

    const night = new Date('2026-11-25T21:45:00')
    expect(getCurrentMealByTime(night)).toBe('lunch')
  })
})
