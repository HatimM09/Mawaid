import React, { createContext, useContext } from 'react'

export const AuthCtx = createContext()
export const useAuth = () => useContext(AuthCtx)

export const ThemeCtx = createContext()
export const useTheme = () => useContext(ThemeCtx)
