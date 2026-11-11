'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const STORAGE_KEY = 'admin_token'
const TOKEN_VALUE = 'ACTIVO'
// Password is kept client-side for this MVP (no auth server).
const ADMIN_PASSWORD = 'fiesta2026'

interface AuthContextValue {
  isAuthenticated: boolean
  login: (password: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [checked, setChecked] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY)
    const auth = token === TOKEN_VALUE
    setIsAuthenticated(auth)
    setChecked(true)
    if (!auth && pathname !== '/login') {
      router.replace('/login')
    }
  }, [])

  // Redirect away from login when already authenticated
  useEffect(() => {
    if (checked && isAuthenticated && pathname === '/login') {
      router.replace('/home')
    }
  }, [checked, isAuthenticated, pathname])

  function login(password: string): boolean {
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem(STORAGE_KEY, TOKEN_VALUE)
      setIsAuthenticated(true)
      return true
    }
    return false
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    setIsAuthenticated(false)
    router.replace('/login')
  }

  // Block render until we've checked localStorage to avoid flash
  if (!checked) return null

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
