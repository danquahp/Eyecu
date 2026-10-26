import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-ink-950">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  )
}
