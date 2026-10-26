import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import Topbar from '../components/Topbar'
import StatusBadge from '../components/StatusBadge'
import CaseModal, { CASES_CHANGED_EVENT } from '../components/CaseModal'
import { api, type Case } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { formatTimestamp } from '../lib/format'

export default function Cases() {
  const [counter, setCounter] = useState(0)
  const [editing, setEditing] = useState<Case | null>(null)
  const { data: cases } = usePoll(api.cases, 5000, [counter])

  useEffect(() => {
    const bump = () => setCounter((n) => n + 1)
    window.addEventListener(CASES_CHANGED_EVENT, bump)

    return () => window.removeEventListener(CASES_CHANGED_EVENT, bump)
  }, 
  [])
  const { data: evidence } = usePoll(() => api.evidence(), 5000)

  const evidenceCount = (caseId: string) => evidence?.filter((e) => e.case_id === caseId).length ?? 0

  return (
    <div>
      <Topbar title="Cases" description="All investigations across the platform" />

      <div className="px-8 py-6">
        
        <div className="border border-ink-800">
          
          <table className="w-full text-sm">
            
            
            <thead>
              <tr className="border-b border-ink-800 text-left text-[11px] font-mono uppercase tracking-wider text-ink-500">
                <th className="px-5 py-3 font-medium">Case ID</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Investigator</th>
                <th className="px-5 py-3 font-medium">Opened</th>
                <th className="px-5 py-3 font-medium">Evidence</th>
                <th className="px-5 py-3 font-medium">Priority</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>


            <tbody>
              {cases?.map(
                (c) => 
              (
                <tr
                  key={c.id}
                  onClick={
                    () => setEditing(c)
                  }
                  className="cursor-pointer border-b border-ink-900 last:border-0 hover:bg-ink-900/50"
                >
                  <td className="px-5 py-3.5 font-mono text-ink-300">{c.id}</td>
                  <td className="px-5 py-3.5 font-medium text-ink-0">{c.name}</td>
                  <td className="px-5 py-3.5 text-ink-300">{c.investigator}</td>
                  <td className="px-5 py-3.5 font-mono text-ink-400">{formatTimestamp(c.opened)}</td>
                  <td className="px-5 py-3.5 font-mono text-ink-300">{evidenceCount(c.id)}</td>
                  
                  <td className="px-5 py-3.5">
                    <StatusBadge status={c.priority} />
                  </td>

                  <td className="px-5 py-3.5">
                    <StatusBadge status={c.status} />
                  </td>

                  <td className="px-5 py-3.5 text-right">
                    <ChevronRight size={16} className="ml-auto text-ink-500" />
                  </td>

                </tr>
              )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <CaseModal existing={editing} onClose={
        () => setEditing(null)} />}
    </div>
  )
}
