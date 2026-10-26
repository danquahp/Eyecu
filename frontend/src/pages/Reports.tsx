import { FileText, Download } from 'lucide-react'
import Topbar from '../components/Topbar'
import { api } from '../lib/api'
import { usePoll } from '../lib/usePoll'

export default function Reports() {
  const { data: cases } = usePoll(api.cases, 10000)
  const { data: evidence } = usePoll(() => api.evidence(), 10000)

  const evidenceCount = (caseId: string) => evidence?.filter((e) => e.case_id === caseId).length ?? 0

  return (
    <div>
      <Topbar title="Reports" description="Generated case summaries and exportable investigation reports" />

      <div className="px-8 py-6">
        <div className="border border-ink-800">
          {cases?.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between border-b border-ink-900 px-6 py-4 last:border-0 hover:bg-ink-900/50"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center border border-ink-700">
                  <FileText size={16} className="text-ink-300" />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink-0">{c.name} — Investigation Report</p>
                  <p className="font-mono text-xs text-ink-500">
                    {c.id} · {evidenceCount(c.id)} evidence items
                  </p>
                </div>
              </div>
              <button
                disabled
                title="Report generation not implemented yet"
                className="flex items-center gap-2 border border-ink-800 px-3.5 py-2 text-xs font-mono text-ink-600"
              >
                <Download size={13} />
                Export PDF
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
