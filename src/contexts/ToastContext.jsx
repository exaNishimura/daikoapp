import { createContext, useCallback, useContext } from 'react'
import { useToast as useAstryxToast } from '@astryxdesign/core/Toast'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const toast = useAstryxToast()

  const showToast = useCallback(
    (message, severity = 'info') => {
      toast({
        body: message,
        type: severity === 'error' ? 'error' : 'info',
        isAutoHide: severity !== 'error',
      })
    },
    [toast],
  )

  return <ToastContext.Provider value={{ showToast }}>{children}</ToastContext.Provider>
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}
