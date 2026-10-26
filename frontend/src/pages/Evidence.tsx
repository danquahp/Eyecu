import { useState, type ReactNode } from 'react'
import { Eye, RefreshCw, Sparkles, UploadCloud, WifiOff, X } from 'lucide-react'
import Topbar from '../components/Topbar'
import StatusBadge from '../components/StatusBadge'
import FileBrowser from '../components/FileBrowser'
import FilePreview from '../components/FilePreview'
import { api, type Evidence as EvidenceItem, type GroundTruthLabel } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { formatBytes, formatTimestamp, shortHash } from '../lib/format'

const BROWSABLE_TYPES = new Set(['Disk Image', 'Mobile Extraction'])

const EVIDENCE_TYPES = ['Disk Image', 'Memory Dump', 'File Set', 'Mobile Extraction'] as const

// tools are built to handle each evidence type 
// reads metadata inside individual files
const TOOLS_BY_TYPE: Record<(typeof EVIDENCE_TYPES)[number], string[]> = {
  'Disk Image': ['Sleuth Kit'],
  'Memory Dump': ['Volatility'],
  'File Set': ['ExifTool', 'YARA', 'Bulk Extractor'],
  'Mobile Extraction': ['Sleuth Kit'],
}

export default function Evidence() {
  const [refresh, setRefresh] = useState(0)
  const { data: evidence } = usePoll(() => api.evidence(), 3000, [refresh])
  const { data: cases } = usePoll(api.cases, 10000)
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<EvidenceItem | null>(null)

  return (
    <div>
      <Topbar title="Evidence" description="Acquired artefacts found forensic tool integrations" />

      <div className="px-8 py-6">
            <div className="mb-4 flex items-center justify-between">
                 <p className="text-xs font-mono uppercase tracking-wider text-ink-500">
            {evidence?.length ?? 0} items · {formatBytes(evidence?.reduce((s, e) => s + e.size_bytes, 0) ?? 0)} total
             </p>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 border border-ink-700 px-3.5 py-2 text-sm text-ink-100 hover:border-ink-500"
          >
        <UploadCloud size={15} />
            Ingest Evidence
          </button>
            </div>

        {evidence && evidence.length === 0 ? (
          <div className="border border-dashed border-ink-800 px-5 py-16 text-center">
            <p className="text-sm text-ink-400">No evidence has been ingested yet.</p>
          </div>
        ) : (
          <div className="border border-ink-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-left text-[11px] font-mono uppercase tracking-wider text-ink-500">
                  <th className="px-5 py-3 font-medium">Evidence</th>
                  <th className="px-5 py-3 font-medium">Case</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Size</th>
                  <th className="px-5 py-3 font-medium">Tools</th>
                  <th className="px-5 py-3 font-medium">Hash</th>
                  <th className="px-5 py-3 font-medium">Ingested</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {
                evidence?.map((e) => 
                (
                  <tr
                    key={e.id}
                    onClick={() => setSelected(e)}
                    className="cursor-pointer border-b border-ink-900 last:border-0 hover:bg-ink-900/50"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-mono text-ink-100">{e.name}</p>
                      <p className="text-xs text-ink-500">{e.id}</p>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-ink-400">{e.case_id}</td>
                    <td className="px-5 py-3.5 text-ink-300">{e.type}</td>
                    <td className="px-5 py-3.5 font-mono text-ink-300">{formatBytes(e.size_bytes)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {e.tools.map(
                          (t) =>
                         (
                          <span
                            key={t}
                            className="rounded-sm border border-ink-700 px-1.5 py-0.5 text-[11px] font-mono text-ink-300"
                          >
                            {t}
                          </span>
                        )
                      )
                        }
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-ink-500">{shortHash(e.sha256)}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-ink-500">{formatTimestamp(e.ingested)}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={e.status} />
                    </td>
                  </tr>
                ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <IngestModal
        
          cases={cases ?? []}
          
          onClose={
            () => 
            setModalOpen(false)
          }
          

          onIngested={
            () => 
              {
            setModalOpen(false)
            setRefresh((a) => a + 1)
          }
        }
        />
      )}

      {selected && <EvidenceDetailModal evidenceId={selected.id} onClose={() => setSelected(null)} />}
    </div>
  )
}

function EvidenceDetailModal({ evidenceId, onClose }: { evidenceId: string; onClose: () => void }) {
  const { data: evidence } = usePoll(() => api.evidenceItem(evidenceId), 2000, [evidenceId])

  const { data: jobs } = usePoll(() => api.jobs(evidenceId), 2000, [evidenceId])

  const { data: findings } = usePoll(() => api.findingsForEvidence(evidenceId), 3000, [evidenceId])
  
  
  const [showPreview, setShowPreview] = useState(false)

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 backdrop-blur-sm p-6">
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col border border-ink-700 bg-ink-950">
             <div className="flex items-center justify-between border-b border-ink-800 px-6 py-4">
            <div>
            <h3 className="font-mono text-sm font-semibold text-ink-0">{evidence?.name ?? evidenceId}</h3>
            <p className="text-xs text-ink-500">{evidenceId}</p>
             </div>
             <button onClick={onClose} className="text-ink-400 hover:text-ink-0">
             <X size={16} />
             </button>
      </div>

        <div className="overflow-y-auto px-6 py-5">
          {evidence && (
            <>
              
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Field label="Case" value={evidence.case_id} />
                <Field label="Status" value={<StatusBadge status={evidence.status} />} />
                <Field label="Type" value={evidence.type} />
                <Field label="Tools" value={evidence.tools.join(', ')} />
                <Field label="Size" value={formatBytes(evidence.size_bytes)} />
                <Field label="Ingested" value={formatTimestamp(evidence.ingested)} />
                <Field label="SHA-256" value={<span className="font-mono text-xs break-all">{evidence.sha256}</span>} />
          </div>

              <div className="mt-4 flex items-center gap-3">
                {!BROWSABLE_TYPES.has(evidence.type) && (
                  <button
                    onClick=
                    {
                      () => 
                      setShowPreview(true)
                    }
                    className="flex items-center gap-1.5 border border-ink-700 
                    px-3 py-1.5 text-xs text-ink-200 
                    hover:border-ink-500"
                  >
                    <Eye size={13} />
                    Preview file
                  </button>
                )}
                <LabelPicker evidenceId={evidenceId} label={evidence.ground_truth_label} />
              </div>

              <div className="mt-6 border-t border-ink-900 pt-5">
                <EvidenceNarrative evidenceId={evidenceId} />
              </div>

              {BROWSABLE_TYPES.has(evidence.type) && (
                <div className="mt-6 border-t border-ink-900 pt-5">
                    <h4 className="mb-2 text-xs font-mono 
                    uppercase tracking-wider text-ink-500">Browse Files</h4>
                  <FileBrowser evidenceId={evidenceId} />
                </div>
              )}

          <div className="mt-6 border-t border-ink-900 pt-5">
                  <h4 className="mb-2 text-xs font-mono uppercase tracking-wider text-ink-500">
                      Jobs {jobs ? `(${jobs.length})` : ''}
                  </h4>
                {jobs && jobs.length > 0 ? (
                  <div className="space-y-3">
                    {jobs.map((job) => 
                    {
                      let metadata: unknown = null
                      let metadataError: string | null = null
                      if (job.result_metadata) {
                        try {
                          metadata = JSON.parse(job.result_metadata)
                        } 
                        catch {
                          metadataError = 'Could not parse metadata'
                        }
                      }
                      return (
                        <div key={job.id} className="border border-ink-800 px-4 py-3 text-sm">
                          
                           <div className="flex items-center justify-between">
                             <span className="font-mono text-xs uppercase tracking-wider text-ink-300">{job.tool}</span>
                            <StatusBadge status={job.status} />
                           </div>
                              <p className="mt-2 text-ink-300">{job.log || 'No log output yet.'}</p>
                          {job.error && <p className="mt-2 text-ink-100">Error: {job.error}</p>}

                          {metadataError && <p className="mt-2 text-xs text-ink-500">{metadataError}</p>}
                          
                          {metadata !== null && !metadataError && (
                            <pre className="mt-2 max-h-48 overflow-auto border border-ink-800 bg-ink-900/50 p-3 font-mono text-xs text-ink-300">
                              {JSON.stringify(metadata, null, 2)}
                            </pre>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-ink-500">No jobs recorded.</p>
                )}
              </div>




              <div className="mt-6 border-t border-ink-900 pt-5">

                <h4 className="mb-2 text-xs font-mono uppercase tracking-wider text-ink-500">
                  Findings {findings ? `(${findings.length})` : ''}
                </h4>
                
                
                {findings && findings.length > 0 ? (
                  <div className="space-y-2">
                    {
                    findings.map((f) => (

                      <div key={f.id} className="border border-ink-800 px-4 py-3 text-sm">
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono uppercase tracking-wider text-ink-500">
                            {f.type} · {f.source}
                          </span>
                          <StatusBadge status={f.severity} />
                        </div>
                        
                        <p className="mt-1.5 text-ink-200">{f.description}</p>
                      </div>
                    ))
                    }
                  </div>
                ) : (
                  <p className="text-sm text-ink-500">No findings found</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {
      showPreview && evidence && (
        <FilePreview evidenceId={evidenceId} name={evidence.name} onClose={() => setShowPreview(false)} />
      )}
    </div>
  )
}

function EvidenceNarrative({ evidenceId }: { evidenceId: string }) {
  const { data: summary } = usePoll(() => api.getEvidenceSummary(evidenceId), 5000, [evidenceId])
  const { data: llmStatus } = usePoll(api.llmStatus, 10000)
  
  
const [generating, setGenerating] = useState(false)
  const [error, setError] = useState <string | null> (null)

  async function regenerate() {
    setGenerating(true)
    setError(null)
    try {
      await api.generateEvidenceSummary(evidenceId)
    }
     catch (err) 
     {
      setError(err instanceof Error ? err.message : String(err))
    } 
    finally
     {
      setGenerating(false)
    }
  }

  return (
    <div className="border border-ink-800">
      
      <div className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
        
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-ink-400" />
          <h4 className="text-xs font-mono uppercase tracking-wider text-ink-500">AI Summary</h4>
        </div>
        
        {llmStatus?.available === false ? (
          <span className="flex items-center gap-1.5 text-xs font-mono text-ink-500">
              <WifiOff size={12} />
            local model unreachable
          </span>
        ) : (
          <button
            onClick={regenerate}
            disabled={generating}
            className="flex items-center gap-1.5 border border-ink-700 px-2.5 py-1 text-xs text-ink-200 hover:border-ink-500 disabled:opacity-40"
          >
            <RefreshCw size={11} className={generating ? 'animate-spin' : ''} />
               {generating ? 'Generating...' : summary ? 'Regenerate' : 'Generate'}
          </button>
        )}
      </div>
      
      
      <div className="px-4 py-3.5">
        {error && <p className="text-sm text-ink-300">{error}</p>}
        
        {!error && !summary && !generating && (
          <p className="text-sm text-ink-500">No AI summary generated for this evidence</p>
        )}

        {summary && (
          <>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-200">{summary.content}</p>
            <p className="mt-2 font-mono text-[11px] text-ink-600">Generated {formatTimestamp(summary.generated_at)}</p>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  
  return (
    <div>
      <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500">{label}</p>
      <div className="mt-0.5 text-ink-100">{value}</div>
    </div>
  )

}

function LabelPicker({ evidenceId, label }: { evidenceId: string; label: GroundTruthLabel | null }) {
  const [saving, setSaving] = useState(false)

  async function change(value: string) {
    setSaving(true)
    try {
      await api.setEvidenceLabel(evidenceId, value === '' ? null : (value as GroundTruthLabel))
    } 
    finally 
    {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono uppercase tracking-wider text-ink-500">Training label:</span>
      
      
      <select
        value={label ?? ''}
        onChange={(e) => change(e.target.value)}
        disabled={saving}
        className="border border-ink-700 bg-ink-900 px-2 py-1 text-xs 
        text-ink-100 focus:border-ink-400 focus:outline-none disabled:opacity-40"
      >
        <option value="">Unlabelled</option>
        <option value="benign">Benign</option>
        <option value="suspicious">Suspicious</option>
        <option value="malicious">Malicious</option>
      </select>
    </div>
  )
}

function IngestModal({
  cases,
  onClose,
  onIngested,
}: {
  cases: { id: string; name: string }[]
  onClose: () => void
  onIngested: () => void
}) {
  const [caseId, setCaseId] = useState(cases[0]?.id ?? '')

  const [type, setType] = useState<(typeof EVIDENCE_TYPES)[number]>('File Set')
  
  const availableTools = TOOLS_BY_TYPE[type]
  const [selectedTools, setSelectedTools] = useState<string[]>(availableTools)

  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)


  const [error, setError] = useState<string | null>(null)

  function toggleTool(tool: string) {
    setSelectedTools((prev) => (prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]))
  }

  async function submit() {
    if (!file || !caseId || selectedTools.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      await api.ingestEvidence({ caseId, type, tools: selectedTools, file })
      onIngested()
    } 
    catch (err) 
    {
      setError(err 
        instanceof Error ? err.message : String(err))
    } 
    finally
    {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 backdrop-blur-sm">
        <div className="w-full max-w-md border border-ink-700 bg-ink-950 p-6">
           <div className="mb-5 flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight text-ink-0">Ingest Evidence</h3>
          
          <button onClick={onClose} className="text-ink-400 hover:text-ink-0">
            <X size={16} />
          </button>

        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-ink-500">Case</label>
            <select
              value={caseId}
              onChange={
                (e) => 
                setCaseId(e.target.value)
              }
              className="w-full border border-ink-700 bg-ink-900 px-3 
              py-2 text-sm text-ink-100 focus:border-ink-400 focus:outline-none"
            >
              {cases.map((c) =>
              (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-ink-500">Type</label>
            
            <select
              value={type}
              onChange={(e) => 
                {
                const nextType = e.target.value as (typeof EVIDENCE_TYPES)[number]
                setType(nextType)
                setSelectedTools(TOOLS_BY_TYPE[nextType])
              }}
              className="w-full border border-ink-700 bg-ink-900 px-3 py-2 text-sm 
              text-ink-100 focus:border-ink-400 focus:outline-none"
            >
              {EVIDENCE_TYPES.map(
                (t) => 
              (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

          </div>

          <div>
            <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-ink-500">
              Tools 
            </label>
            <div className="space-y-1.5 border border-ink-700 bg-ink-900 p-3">
              {availableTools.map(
                (t) => 
                  (
                <label key={t} className="flex items-center gap-2.5 text-sm text-ink-100">
                  
                  <input
                    type="checkbox"
                    checked={selectedTools.includes(t)}
                    onChange={() => toggleTool(t)}
                    className="h-3.5 w-3.5 accent-white"
                  />
                  {t}
                </label>
              )
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-ink-500">File</label>
            
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full border border-ink-700 bg-ink-900 px-3 py-2 
              text-sm text-ink-300 file:mr-3 file:border-0 file:bg-ink-0 file:px-2.5 file:py-1 file:text-xs
               file:font-medium file:text-ink-950"
            />

          </div>

          {error && <p className="text-xs text-ink-300">{error}</p>}

          <button
            onClick={submit}
            disabled={!file || !caseId || selectedTools.length === 0 || submitting}
            className="w-full bg-ink-0 py-2.5 text-sm font-medium text-ink-950 
            hover:bg-ink-100 disabled:opacity-40">
            {submitting
              ? 'Uploading…'
              : `Ingest${selectedTools.length > 1 ? ` (${selectedTools.length} tools)` : ''}`}
          </button>
        </div>
      
      </div>
    </div>
  )
}
