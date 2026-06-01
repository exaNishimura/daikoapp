import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session ?? null)
        setLoading(false)
      }
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession ?? null)
      }
    })

    return () => {
      mounted = false
      subscription?.subscription?.unsubscribe()
    }
  }, [])

  const sendMagicLink = async (email) => {
    if (!supabase) {
      return { success: false, error: 'Supabaseクライアントが初期化されていません' }
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: window.location.origin,
      },
    })

    if (error) {
      const message = error.message?.includes('Signups not allowed')
        ? '登録されていないメールアドレスです'
        : error.message || 'マジックリンクの送信に失敗しました'
      return { success: false, error: message }
    }

    return { success: true }
  }

  const logout = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setSession(null)
  }

  const value = {
    session,
    user: session?.user ?? null,
    isAuthenticated: !!session,
    loading,
    sendMagicLink,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
