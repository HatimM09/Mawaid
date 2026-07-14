import React from 'react'
import { Navigate } from 'react-router-dom'
import { useOutletContext } from 'react-router-dom'

export default function RequireRole({ roles, children }) {
  const { role } = useOutletContext()
  if (!roles.includes(role)) return <Navigate to="/admin" replace />
  return children
}
