// src/lib/queryClient.js - Centralized React Query setup
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
    },
  },
})

// Query keys for consistent caching
export const queryKeys = {
  // Auth
  session: ['session'],
  user: (userId) => ['user', userId],
  
  // Surveys
  weeklyMenu: (weekId) => ['weeklyMenu', weekId],
  surveyResponses: (weekId, filters = {}) => ['surveyResponses', weekId, filters],
  surveyStats: (weekId) => ['surveyStats', weekId],
  userSurvey: (userId, weekId) => ['userSurvey', userId, weekId],
  
  // Users
  allUsers: ['users'],
  userStats: (userId) => ['userStats', userId],
  thaliUsers: ['thaliUsers'],
  
  // Inventory
  inventory: ['inventory'],
  inventoryLog: (limit = 50) => ['inventoryLog', limit],
  inventoryStats: ['inventoryStats'],
  
  // Requests
  thaliRequests: (filters = {}) => ['thaliRequests', filters],
  requestTypes: ['requestTypes'],
  
  // Queries (support tickets)
  queries: (filters = {}) => ['queries', filters],
  
  // Feedback
  dailyFeedback: (filters = {}) => ['dailyFeedback', filters],
  feedbackStats: ['feedbackStats'],
  
  // Settings
  appSettings: (key) => ['appSettings', key],
  allSettings: ['allSettings'],
  
  // Notices
  notices: ['notices'],
  
  // Dashboard
  dashboardStats: ['dashboardStats'],
  
  // Staff
  staff: ['staff'],
}