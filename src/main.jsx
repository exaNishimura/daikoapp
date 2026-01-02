import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import App from './App.jsx'
import './index.css'

// Google Places APIスクリプトを動的に読み込む
const loadGooglePlacesAPI = () => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    if (import.meta.env.DEV) {
      console.warn('⚠️ VITE_GOOGLE_MAPS_API_KEY is not set. Places Autocomplete will not work.')
    }
    return
  }

  // 既に読み込まれているかチェック
  if (window.google && window.google.maps && window.google.maps.places) {
    if (import.meta.env.DEV) {
      console.log('✅ Google Places API is already loaded')
    }
    return
  }

  // スクリプトが既に追加されているかチェック
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

// アプリ起動時にGoogle Places APIを読み込む
loadGooglePlacesAPI()

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#646cff',
    },
    secondary: {
      main: '#646cff',
    },
    background: {
      default: '#1a1a1a',
      paper: '#2a2a2a',
    },
    divider: 'rgba(255, 255, 255, 0.12)',
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#2a2a2a',
          color: '#ffffff',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#2a2a2a',
        },
      },
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)

