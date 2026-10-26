import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderOpen,
  HardDrive,
  GitBranch,
  Sparkles,
  Wrench,
  FileText,
  ScanEye,
} from 'lucide-react'




const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/cases', label: 'Cases', icon: FolderOpen },
  { to: '/evidence', label: 'Evidence', icon: HardDrive },
  { to: '/timeline', label: 'Timeline', icon: GitBranch },
  { to: '/ai-analysis', label: 'AI Analysis', icon: Sparkles },
  { to: '/tools', label: 'Tool Integrations', icon: Wrench },
  { to: '/reports', label: 'Reports', icon: FileText },
]

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-ink-800 bg-ink-950">
      
      <div className="flex items-center gap-2.5 border-b border-ink-800 px-6 py-5">
        
        <ScanEye size={22} strokeWidth={1.75} className="text-ink-0" />
       
       <div>
          <p className="text-sm font-bold tracking-[0.2em] text-ink-0">EYECU</p>
          <p className="text-[10px] font-mono uppercase tracking-wider text-ink-500">Forensic Platform</p>
        </div>

      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {nav.map(({ to, label, icon: Icon, end }) => 
        (
          
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-ink-0 text-ink-950 font-medium'
                  : 'text-ink-300 hover:bg-ink-800 hover:text-ink-0'
              }`
            }
          >
            <Icon size={16} strokeWidth={1.75} />
            {label}
          </NavLink>


        ))}
      </nav>


    </aside>
  )
}
