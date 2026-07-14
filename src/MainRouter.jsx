// src/MainRouter.jsx - Code-split all admin pages for faster initial load
import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import App from './App'
import AdminLayout from './admin/AdminLayout'
import AdminRoute from './admin/AdminRoute'
import RequireRole from './admin/RequireRole'

// Code-split all admin pages - loaded on demand
const Dashboard = lazy(() => import('./admin/Dashboard'))
const UsersPage = lazy(() => import('./admin/UsersPage'))
const DailySurveyTracking = lazy(() => import('./admin/DailySurveyTracking'))
const SurveyDashboard = lazy(() => import('./admin/SurveyDashboard'))
import FeedbackAdminPage from './admin/FeedbackAdminPage'
const RequestsAdminPage = lazy(() => import('./admin/RequestsAdminPage'))
const QueriesAdminPage = lazy(() => import('./admin/QueriesAdminPage'))
const StaffPage = lazy(() => import('./admin/StaffPage'))
const SettingsPage = lazy(() => import('./admin/SettingsPage'))
const InventoryPage = lazy(() => import('./admin/InventoryPage'))
const NotificationsAdminPage = lazy(() => import('./admin/NotificationsAdminPage'))
const KhidmatPortal = lazy(() => import('./admin/KhidmatPortal'))
const InventoryManagerPortal = lazy(() => import('./admin/InventoryManagerPortal'))
const AutomationPage = lazy(() => import('./admin/AutomationPage'))

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
              <Route path="users" element={<RequireRole roles={['admin']}><UsersPage /></RequireRole>} />
              <Route path="survey-dashboard" element={<RequireRole roles={['admin']}><SurveyDashboard /></RequireRole>} />
              <Route path="survey-tracking" element={<RequireRole roles={['admin']}><DailySurveyTracking /></RequireRole>} />
              <Route path="inventory" element={<RequireRole roles={['admin', 'inventory_manager']}><InventoryPage /></RequireRole>} />
              <Route path="feedback" element={<RequireRole roles={['admin', 'khidmat_guzar', 'supervisor']}><FeedbackAdminPage /></RequireRole>} />
              <Route path="requests" element={<RequireRole roles={['admin', 'khidmat_guzar', 'supervisor']}><RequestsAdminPage /></RequireRole>} />
              <Route path="queries" element={<RequireRole roles={['admin', 'khidmat_guzar', 'supervisor']}><QueriesAdminPage /></RequireRole>} />
              <Route path="staff" element={<RequireRole roles={['admin']}><StaffPage /></RequireRole>} />
              <Route path="notifications" element={<RequireRole roles={['admin']}><NotificationsAdminPage /></RequireRole>} />
              <Route path="settings" element={<RequireRole roles={['admin']}><SettingsPage /></RequireRole>} />
              <Route path="automation" element={<RequireRole roles={['admin']}><AutomationPage /></RequireRole>} />
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