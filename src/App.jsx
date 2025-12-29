import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { DispatchBoard } from './components/DispatchBoard'
import { ShiftCalendar } from './components/ShiftCalendar'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <nav style={{ 
          padding: '10px', 
          background: '#2a2a2a', 
          borderBottom: '1px solid #444',
          flexShrink: 0,
          zIndex: 1000
        }}>
          <Link to="/" style={{ color: '#fff', marginRight: '20px', textDecoration: 'none' }}>
            配車画面
          </Link>
          <Link to="/shift" style={{ color: '#fff', textDecoration: 'none' }}>
            シフト表
          </Link>
        </nav>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Routes>
            <Route path="/" element={<DispatchBoard />} />
            <Route path="/shift" element={<ShiftCalendar />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App

