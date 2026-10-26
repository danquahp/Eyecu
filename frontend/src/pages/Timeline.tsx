import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import Topbar from '../components/Topbar'
import { api } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { formatTimestamp } from '../lib/format'

export default function Timeline() {
  // updates cases data every 10s 
  const { data: cases } = usePoll(api.cases, 10000)
  const [caseId, setCaseId] = useState<string>('')

// this useEffect function picks the first case once it is loaded only when the if statement is satisfied and reruns once there is 
//chane on cases or caseid
  useEffect(
    () =>
     {
    if (!caseId && cases && cases.length > 0) setCaseId(cases[0].id)
  }, [cases, caseId])

  const { data: events } = usePoll(
       () => 
        (caseId ? api.timeline(caseId) :
         Promise.resolve([])), 3000, [caseId]
        )

  return (
    <div>
      <Topbar title="Timeline" />

      <div className="px-8 py-6">
        <div className="mb-6">
          <select
            value={caseId}
            onChange={
              (e) => 
              setCaseId(e.target.value)
            }
            className="border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-100 focus:border-ink-400 focus:outline-none"
          >
            {cases?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} — {c.name}
              </option>
            ))}
          </select>
        </div>

        {events && events.length === 0 && (
          <div className="border border-dashed border-ink-800 px-5 py-16 text-center">
               <p className="text-sm text-ink-400">No timeline events for this case</p>
          </div>
        )}

        <div className="relative border-l border-ink-800 pl-8">

          {events?.map((event) => 
          (
            <div key={event.id} className="relative mb-8 last:mb-0">

              <span className={`absolute -left-[37px] top-1 flex h-4 w-4 items-center justify-center rounded-full border ${
                  event.ai_correlated ? 'border-ink-0 bg-ink-0' : 'border-ink-600 bg-ink-950'
                }`}>
                {event.ai_correlated && <Sparkles size={9} className="text-ink-950" />}
              </span>
              <div className="border border-ink-800 bg-ink-900/40 px-5 py-4">
                   <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-ink-500">{formatTimestamp(event.time)}</span>
                  <span className="rounded-sm border border-ink-700 px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider text-ink-300">
                    {event.tool}
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink-100">{event.description}</p>
                {event.ai_correlated && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-mono text-ink-400">
                    <Sparkles size={11} />
                    AI-correlated with adjacent tool output
                  </p>
                )}
              </div>
            </div>
          )
          )
          }
        </div>
      </div>
    </div>
  )
}
