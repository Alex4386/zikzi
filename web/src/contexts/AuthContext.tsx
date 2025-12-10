import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '../lib/api'

interface User {
  id: string
  username: string
  email: string
  display_name: string
  is_admin: boolean
  allow_ipp_password: boolean
}

interface AuthContextType {
  token: string | null
  user: User | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string, displayName: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for token in URL (OIDC callback)
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken) {
      setToken(urlToken)
      localStorage.setItem('token', urlToken)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    if (token) {
      api.setToken(token)
      api.getCurrentUser()
        .then(setUser)
        .catch(() => {
          setToken(null)
          localStorage.removeItem('token')
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [token])

  const login = async (username: string, password: string) => {
    const response = await api.login(username, password)
    setToken(response.access_token)
    localStorage.setItem('token', response.access_token)
  }

  const register = async (username: string, email: string, password: string, displayName: string) => {
    const response = await api.register(username, email, password, displayName)
    setToken(response.access_token)
    localStorage.setItem('token', response.access_token)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
  }

  const refreshUser = async () => {
    if (token) {
      try {
        const userData = await api.getCurrentUser()
        setUser(userData)
      } catch {
        // Ignore errors during refresh
      }
    }
  }

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
