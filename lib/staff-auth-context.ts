import { createContext } from 'react'

export interface StaffAuthContextType {
  isAuthenticated: boolean
  exemptUntilPrint: boolean
  lastAuthTime: number | null
  setAuthenticated: (value: boolean) => void
  setExemptUntilPrint: (value: boolean) => void
  updateAuthTime: () => void
}

export const StaffAuthContext = createContext<StaffAuthContextType>({
  isAuthenticated: false,
  exemptUntilPrint: false,
  lastAuthTime: null,
  setAuthenticated: () => {},
  setExemptUntilPrint: () => {},
  updateAuthTime: () => {},
})

// Constants
export const AUTH_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes
export const AUTH_STORAGE_KEY = 'staffAuthState'
export const AUTH_EXEMPT_KEY = 'staffAuthExempt'

export interface AuthState {
  isAuthenticated: boolean
  exemptUntilPrint: boolean
  lastAuthTime: number | null
}

export const getAuthState = (): AuthState => {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // ignore parse errors
  }
  return {
    isAuthenticated: false,
    exemptUntilPrint: false,
    lastAuthTime: null,
  }
}

export const setAuthState = (state: AuthState) => {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore storage errors
  }
}

export const clearAuthState = () => {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(AUTH_EXEMPT_KEY)
  } catch {
    // ignore storage errors
  }
}

export const isAuthExpired = (lastAuthTime: number | null): boolean => {
  if (!lastAuthTime) return true
  return Date.now() - lastAuthTime > AUTH_TIMEOUT_MS
}
