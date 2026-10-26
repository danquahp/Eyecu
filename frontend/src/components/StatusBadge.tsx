type Tone = 'neutral' | 'active' | 'warning' | 'critical' | 'muted'


const toneClasses: Record<Tone, string> = {
  neutral: 'border-ink-600 text-ink-100',
  active: 'border-ink-0 text-ink-0',
  warning: 'border-ink-300 text-ink-100 bg-ink-800',
  critical: 'border-ink-0 text-ink-950 bg-ink-0',
  muted: 'border-ink-700 text-ink-400',
}



const statusTone: Record<string, Tone> = {
  active: 'active',
  processing: 'active',
  running: 'active',
  queued: 'muted',
  complete: 'neutral',
  flagged: 'critical',
  failed: 'critical',
  review: 'warning',
  closed: 'muted',
  high: 'critical',
  medium: 'warning',
  low: 'muted',
}

export default function StatusBadge({ status, label }: { status: string; label?: string }) {
      const tone = statusTone[status] ?? 'neutral'
  
    return (
      <span
      className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[11px]
         font-mono uppercase tracking-wider ${toneClasses[tone]}`}
      >

      <span
        className={`h-1.5 w-1.5 rounded-full ${
          tone === 'critical' ? 'bg-ink-950' : tone === 'active' ? 
          'bg-ink-0 animate-pulse' : 'bg-current opacity-60'
        }`}/>

      {label ?? status}

      
    </span>
  )
}
