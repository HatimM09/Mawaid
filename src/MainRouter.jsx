// src/MainRouter.jsx - Code-split all admin pages for faster initial load
import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import App from './App'
import AdminLayout from './admin/AdminLayout'
import AdminRoute from './admin/AdminRoute'

// Code-split all admin pages - loaded on demand
const Dashboard = lazy(() => import('./admin/Dashboard'))
const UsersPage = lazy(() => import('./admin/UsersPage'))
const SurveysPage = lazy(() => import('./admin/SurveysPage'))
const DailySurveyTracking = lazy(() => import('./admin/DailySurveyTracking'))
const FeedbackAdminPage = lazy(() => import('./admin/FeedbackAdminPage'))
const RequestsAdminPage = lazy(() => import('./admin/RequestsAdminPage'))
const QueriesAdminPage = lazy(() => import('./admin/QueriesAdminPage'))
const StaffPage = lazy(() => import('./admin/StaffPage'))
const SettingsPage = lazy(() => import('./admin/SettingsPage'))
const InventoryPage = lazy(() => import('./admin/InventoryPage'))
const NotificationsAdminPage = lazy(() => import('./admin/NotificationsAdminPage'))
const KhidmatPortal = lazy(() => import('./admin/KhidmatPortal'))
const InventoryManagerPortal = lazy(() => import('./admin/InventoryManagerPortal'))

const LoadingFallback = () => (
  <div style={{
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0a0d14', color: '#f0f4f8', fontFamily: "'Inter', sans-serif"
  }}>
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%', margin: '0 auto 20px',
        border: '3px solid rgba(197,160,89,0.15)', borderTopColor: '#c5a059',
        animation: 'spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ fontSize: 14, color: 'rgba(240,244,248,0.55)', margin: 0 }}>Loading portal…</p>
    </div>
  </div>
)

export default function MainRouter() {
  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Admin area — password guarded */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="surveys" element={<SurveysPage />} />
              <Route path="survey-tracking" element={<DailySurveyTracking />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="feedback" element={<FeedbackAdminPage />} />
              <Route path="requests" element={<RequestsAdminPage />} />
              <Route path="queries" element={<QueriesAdminPage />} />
              <Route path="staff" element={<StaffPage />} />
              <Route path="notifications" element={<NotificationsAdminPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>

          {/* Public user app or fallback */}
          <Route path="/*" element={<App />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  )
}