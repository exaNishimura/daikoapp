import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Theme } from '@astryxdesign/core/theme'
import { LinkProvider } from '@astryxdesign/core/Link'
import { InternationalizationProvider } from '@astryxdesign/core/i18n'
import jaJP from '@astryxdesign/core/locales/ja-JP.json'
import App from './App.jsx'
import { ToastProvider } from './contexts/ToastContext'
import { queryClient } from './lib/queryClient'
import { stoneTheme } from './theme/astryx/stoneTheme'
import { AstryxRouterLink } from './lib/astryxLink'
import './index.css'

const loadGooglePlacesAPI = () => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    if (import.meta.env.DEV) {
      console.warn('⚠️ VITE_GOOGLE_MAPS_API_KEY is not set. Places Autocomplete will not work.')
    }
    return
  }

  if (window.google && window.google.maps && window.google.maps.places) {
    if (import.meta.env.DEV) {
      console.log('✅ Google Places API is already loaded')
    }
    return
  }

  const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
  if (existingScript) {
    if (import.meta.env.DEV) {
      console.log('⏳ Google Places API script is already being loaded')
    }
    return
  }

  if (import.meta.env.DEV) {
    console.log('📡 Loading Google Places API...')
  }

  const script = document.createElement('script')
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=ja&loading=async`
  script.async = true
  script.defer = true
  script.onload = () => {
    if (import.meta.env.DEV) {
      console.log('✅ Google Places API loaded successfully')
    }
  }
  script.onerror = () => {
    if (import.meta.env.DEV) {
      console.error('❌ Failed to load Google Places API')
    }
  }
  document.head.appendChild(script)
}

loadGooglePlacesAPI()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Theme theme={stoneTheme} mode="light">
        <InternationalizationProvider locale="ja-JP" messages={{ 'ja-JP': jaJP }}>
          <LinkProvider component={AstryxRouterLink}>
            <ToastProvider>
              <App />
            </ToastProvider>
          </LinkProvider>
        </InternationalizationProvider>
      </Theme>
      {import.meta.env.DEV && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  </React.StrictMode>,
)
