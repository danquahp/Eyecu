import { useEffect, useState } from 'react'
import { Sparkles, ShieldAlert, RefreshCw, WifiOff } from 'lucide-react'
import Topbar from '../components/Topbar'
import StatusBadge from '../components/StatusBadge'
import { api } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { formatTimestamp } from '../lib/format'

export default function AIAnalysis() {
  const { data: cases } = usePoll(api.cases, 10000)
  const { data: findings } = usePoll(() => api.findings(), 3000)
  const { data: llmStatus } = usePoll(api.llmStatus, 10000)
  const [caseId, setCaseId] = useState('')

  useEffect(() => {
    if (!caseId && cases && cases.length > 0) setCaseId(cases[0].id)
  }, [cases, caseId])

  return (
    <div>
      <Topbar title="AI Analysis" description="Evidence correlation, anomaly detection and signature-mismatch findings" />

      <div className="px-8 py-6">
        <div className="mb-6 border border-ink-800 bg-ink-900/40 px-5 py-4">
          
          <div className="flex items-start gap-3">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-ink-300" />
            <p className="text-sm text-ink-300">
              AI output is advisory. Every finding must undergo review by the investigator. It is not, on its
              own, an evidentiary conclusion.
            </p>
          </div>

        </div>

        <div className="mb-6">
          <select
            value={caseId}
            onChange=
            {
              (e) => setCaseId(e.target.value)
            }
            className="border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-100 focus:border-ink-400 focus:outline-none"
          >
            {cases?.map(
              (c) => (
              <option key={c.id} value={c.id}>
                {c.id} — {c.name}
              </option>
            ))}
          </select>

        </div>

        {caseId && <CaseNarrative caseId={caseId} available={llmStatus?.available ?? null} model={llmStatus?.model} />}

        {findings && findings.length === 0 && (

          <div className="border border-dashed border-ink-800 px-5 py-16 text-center">
               <p className="text-sm text-ink-400">No findings yet — ingest evidence to run the analysis pipeline.</p>
          </div>

        )}

        <div className="space-y-4">
          {findings?.map(
            (f) => (
            <div key={f.id} className="border border-ink-800 px-6 py-5">
                <div className="flex items-start justify-between gap-6">
                
                  <div className="flex items-center gap-3">
                  <Sparkles size={16} className="text-ink-400" />
                  
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider text-ink-500">
                      {f.type} · AI-{String(f.id).padStart(4, '0')}
                    </p>
                    <p className="mt-1 text-sm font-medium text-ink-0">{f.description}</p>
                  </div>

                </div>
                <StatusBadge status={f.severity} />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-ink-900 pt-4">
               
                <div className="flex items-center gap-6 text-xs font-mono text-ink-500">
                    <span>{f.case_id}</span>
                    <span>{formatTimestamp(f.timestamp)}</span>
                    
                    <span>Sources: {f.source}</span>
                </div>

              <div className="flex items-center gap-2">
                  
                  
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-800">
                    <div className="h-full bg-ink-0" style={{ width: `${f.confidence}%` }} />
                  </div>


                  <span className="font-mono text-xs text-ink-300">{f.confidence}%</span>

                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CaseNarrative({
  caseId,available,model}: {
  caseId: string
  available: boolean | null
  model?: string
}) {
  const { data: summary } = usePoll(() => api.getSummary(caseId), 5000, [caseId])

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function regenerate() {
    setGenerating(true)
    setError(null)
    try {
      await api.generateSummary(caseId)
    }
    catch (err)
     {
      setError(err instanceof Error ? err.message : String(err))
    } 
    finally {
      setGenerating(false)
    }
  }

  return (
    <div className="mb-6 border border-ink-800">
      <div className="flex items-center justify-between border-b border-ink-800 px-5 py-3.5">
        
        <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-ink-400" />
            <h2 className="text-sm font-semibold tracking-tight text-ink-0">AI Case Narrative</h2>
          {model && <span className="font-mono text-[11px] text-ink-500">({model}, local)</span>}
        </div>

        {available === false ? (
            <span className="flex items-center gap-1.5 text-xs font-mono text-ink-500">
            <WifiOff size={12} />
            local model unreachable
            </span>
        ) : (
          <button
            onClick={regenerate}
            disabled={generating}
            className="flex items-center gap-1.5 border border-ink-700 px-3 py-1.5
             text-xs text-ink-200 hover:border-ink-500 disabled:opacity-40"
          >
              <RefreshCw size={12} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Generating…' : summary ? 'Regenerate' : 'Generate'}
          </button>
        )}
      </div>  


      <div className="px-5 py-4">

        {error && <p className="text-sm text-ink-300">{error}</p>}
        {!error && !summary && !generating && (
          <p className="text-sm text-ink-500">No narrative generated yet for this case.</p>
        )}

        {summary && (
          <>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-200">{summary.content}</p>
            <p className="mt-3 font-mono text-[11px] text-ink-600">Generated {formatTimestamp(summary.generated_at)}</p>
          </>
        )}
        
      </div>
    </div>
  )
}
