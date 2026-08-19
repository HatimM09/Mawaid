// src/member/constants.js
// Re-exports shared DAYS from common/utils.js — single source of truth.
export { DAYS } from '../common/utils'

export const getTodayKey = () => {
  const map = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' }
  return map[new Date().getDay()] || 'monday'
}
