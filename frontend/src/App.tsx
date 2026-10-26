import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Cases from './pages/Cases'
import Evidence from './pages/Evidence'
import Timeline from './pages/Timeline'
import AIAnalysis from './pages/AIAnalysis'
import Tools from './pages/Tools'
import Reports from './pages/Reports'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/evidence" element={<Evidence />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/ai-analysis" element={<AIAnalysis />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/reports" element={<Reports />} />
      </Route>
    </Routes>
  )
}
