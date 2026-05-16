// src/MainRouter.jsx
// Fixed: imports route to correct admin files
import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import App from './App'
import AdminLayout from './admin/AdminLayout'
import AdminRoute from './admin/AdminRoute'
import Dashboard from './admin/Dashboard'
import UsersPage from './admin/UsersPage'
import SurveysPage from './admin/SurveysPage'
import DailySurveyTracking from './admin/DailySurveyTracking'
import FeedbackAdminPage from './admin/FeedbackAdminPage'
import RequestsAdminPage from './admin/RequestsAdminPage'
import QueriesAdminPage from './admin/QueriesAdminPage'
import StaffPage from './admin/StaffPage'
import SettingsPage from './admin/SettingsPage'
import InventoryPage from './admin/InventoryPage'
import NotificationsAdminPage from './admin/NotificationsAdminPage'
import QRManagement from './admin/QRManagement'
import { AuthProvider } from './admin/context'

export default function MainRouter() {
  return (
    <AuthProvider>
    <Router>
      <Routes>
        {/* Admin area — password guarded */}
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="qr-portal" element={<QRManagement />} />
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
      </Routes>
    </Router>
    </AuthProvider>
  )
}