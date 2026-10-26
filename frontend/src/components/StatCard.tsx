import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string,
  value: string | number,
  icon: LucideIcon,
  sub?: string,
  trend?: 'up' | 'down' | 'flat'
}

export default function StatCard({ label, value, icon: Icon, sub, trend }: StatCardProps) {
  
  
  return (
    
    <div className="border border-ink-800 bg-ink-900/60 p-5 transition-colors hover:border-ink-600">
      
      <div className="flex items-start justify-between">
          <span className="text-xs font-mono uppercase tracking-widest text-ink-400">{label}</span>
          <Icon size={16} strokeWidth={1.75} className="text-ink-400" />
      </div>


      <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-ink-0">{value}</span>
            {trend && (
            <span className={`text-xs font-mono ${trend === 'up' ? 'text-ink-0' : trend === 'down' ? 'text-ink-400' : 'text-ink-500'}`}>
            {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'}
            </span>
        )}
      </div>


      {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
    </div>
  )
}
