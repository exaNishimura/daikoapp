import { createTheme } from '@mui/material/styles'

/**
 * アプリ全体のデフォルトテーマ（ライト固定）。
 * ダークモードは使用しない。配車画面も同系統のライトトーン。
 */
export const appLightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#5b61e6',
      dark: '#4a50d6',
    },
    secondary: {
      main: '#5b61e6',
    },
    warning: {
      main: '#f59e0b',
      contrastText: '#3d2c00',
    },
    success: {
      main: '#16a34a',
      contrastText: '#ffffff',
    },
    info: {
      main: '#2563eb',
      contrastText: '#ffffff',
    },
    error: {
      main: '#dc2626',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f4f6f8',
      paper: '#ffffff',
    },
    text: {
      primary: '#1f2733',
      secondary: '#6b7280',
    },
    divider: '#e3e7ec',
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
    h6: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          color: '#1f2733',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#ffffff',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
  },
})
