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
import FeedbackAdminPage from './admin/FeedbackAdminPage'
import RequestsAdminPage from './admin/RequestsAdminPage'
import QueriesAdminPage from './admin/QueriesAdminPage'
import StaffPage from './admin/StaffPage'
import SettingsPage from './admin/SettingsPage'

import { AuthProvider } from './admin/context'

export default function MainRouter() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
        {/* Public user app */}
        <Route path="/*" element={<App />} />

        {/* Admin area — password guarded */}
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index         element={<Dashboard />} />
            <Route path="users"    element={<UsersPage />} />
            <Route path="surveys"  element={<SurveysPage />} />
            <Route path="feedback" element={<FeedbackAdminPage />} />
            <Route path="requests" element={<RequestsAdminPage />} />
            <Route path="queries"  element={<QueriesAdminPage />} />
            <Route path="staff"    element={<StaffPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}
