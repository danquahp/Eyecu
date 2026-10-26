import { useState } from 'react'
import { Search, Bell, Plus } from 'lucide-react'
import CaseModal from './CaseModal'

export default function Topbar({ title, description }: { title: string; description?: string }) {
  
    const [newCaseOpen, setNewCaseOpen] = useState(false)

  return (
    <header className="flex items-center justify-between border-b border-ink-800 bg-ink-950/80 px-8 py-5 backdrop-blur">
      
      <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-0">{title}</h1>
           {description && <p className="mt-0.5 text-sm text-ink-400">{description}</p>}
      </div>

      <div className="flex items-center gap-3">
        
        <div className="flex items-center gap-2 rounded-sm border border-ink-700 bg-ink-900 px-3 py-2">
          <Search size={14} className="text-ink-500" />
          <input
            placeholder="Search cases, evidence, hashes…"
            className="w-56 bg-transparent text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none"
          />
        </div>


        <button className="relative rounded-sm border border-ink-700 p-2 text-ink-300 hover:border-ink-500 hover:text-ink-0">
            <Bell size={16} />
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-ink-0" />
        </button>


        <button
          onClick=
          {
            () => setNewCaseOpen(true)
          }
          className="flex items-center gap-1.5 rounded-sm bg-ink-0 px-3.5 
          py-2 text-sm font-medium text-ink-950 hover:bg-ink-100">
          <Plus size={15} strokeWidth={2.25} />
          New Case
        </button>
      </div>
      {newCaseOpen && <CaseModal onClose={() => setNewCaseOpen(false)} />}
    </header>
  )
}
