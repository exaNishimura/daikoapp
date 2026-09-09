import { createContext, useContext, useEffect, useState } from 'react'
import {
  canUseDevAuthBypass,
  clearDevAuthBypass,
  createDevBypassSession,
  markDevAuthBypass,
  shouldActivateDevAuthBypass,
} from '@/lib/devAuth'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

function initialDevBypassSession() {
  return shouldActivateDevAuthBypass() ? createDevBypassSession() : null
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(initialDevBypassSession)
  const [loading, setLoading] = useState(() => !shouldActivateDevAuthBypass())

  useEffect(() => {
    if (!supabase) {
      if (!shouldActivateDevAuthBypass()) {
        setLoading(false)
      }
      return
    }

    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      if (data.session) {
        setSession(data.session)
      } else if (shouldActivateDevAuthBypass()) {
        setSession(createDevBypassSession())
      } else {
        setSession(null)
      }
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return
      if (newSession) {
        setSession(newSession)
        return
      }
      setSession(shouldActivateDevAuthBypass() ? createDevBypassSession() : null)
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

  const loginWithDevBypass = () => {
    if (!canUseDevAuthBypass()) {
      return {
        success: false,
        error: '開発用ログインは localhost の開発サーバーでのみ使えます',
      }
    }
    markDevAuthBypass()
    setSession(createDevBypassSession())
    return { success: true }
  }

  const logout = async () => {
    clearDevAuthBypass()
    if (supabase) {
      await supabase.auth.signOut()
    }
    setSession(null)
  }

  const value = {
    session,
    user: session?.user ?? null,
    isAuthenticated: !!session,
    isDevBypass: session?.access_token === 'dev-bypass',
    loading,
    sendMagicLink,
    loginWithDevBypass,
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
