import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../../shared/api'
import type { User } from '../../shared/types'

type AuthContextValue = {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (displayName: string, email: string, password: string) => Promise<void>
  updateUser: (user: User) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api<{ user: User }>('/api/auth/me')
      .then(({ user: current }) => { if (active) setUser(current) })
      .catch(() => { if (active) setUser(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async signIn(email, password) {
      const result = await api<{ user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      setUser(result.user)
    },
    async signUp(displayName, email, password) {
      const result = await api<{ user: User }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ displayName, email, password }) })
      setUser(result.user)
    },
    updateUser(nextUser) { setUser(nextUser) },
    async signOut() {
      try {
        await api('/api/auth/logout', { method: 'POST' })
      } finally {
        setUser(null)
      }
    },
  }), [loading, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
