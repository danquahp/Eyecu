import { useEffect, useState } from 'react'
import { Bug, Download, Fingerprint, ScanSearch, ShieldAlert, Tags, X } from 'lucide-react'
import { api, type AdHocRunResult, type IdentifyResult, type ReputationResult, type RunnableTool } from '../lib/api'
import { formatBytes } from '../lib/format'

interface Props {
  evidenceId: string
  inode?: string
  name: string
  onClose: () => void
}

type Kind = 'loading' | 'image' | 'pdf' | 'text' | 'docx' | 'sheet' | 'legacy-doc' | 'binary' | 'error'
      <div className="border-t border-ink-800 px-4 py-4">
        
      <div className="flex items-center gap-3 px-2">
          
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-600 text-xs font-mono text-ink-100">
            PO
          </div>

          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-ink-100">Papa Otu-Danquah</p>
            <p className="truncate text-[10px] font-mono text-ink-500">Investigator</p>
          </div>
        </div>

      </div>

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const LEGACY_DOC_TYPE = 'application/msword'

const SHEET_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel'
])

// HTML wrapped in a sandboxed scriptless iframe to act as a safety box that never allows the HTML touch the real page

function sandboxedDoc(bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: system-ui, sans-serif; color: #e5e5e5; background: #101010; padding: 16px; font-size: 13px; line-height: 1.5; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #3d3d3d; padding: 4px 8px; }
    img { max-width: 100%; }
  </style></head><body>${bodyHtml}</body></html>`
}

export default function FilePreview({ evidenceId, inode, name, onClose }: Props) {
  const [kind, setKind] = useState<Kind>('loading')
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [docHtml, setDocHtml] = useState<string | null>(null)
  const [sheetNote, setSheetNote] = useState('')
  const [size, setSize] = useState(0)
  const [error, setError] = useState('')

  const url = api.fileUrl(evidenceId, inode)

  useEffect(() => {
    let cancelled = false
    let localUrl: string | null = null

    async function load() {
      try {
        const res = await fetch(url)
        if (!res.ok) 
           throw new Error(`${res.status}`)
        const blob = await res.blob()
        if (cancelled) return
        setSize(blob.size)

        if (blob.type.startsWith('image/')) {
          localUrl = URL.createObjectURL(blob)
          setObjectUrl(localUrl)
          setKind('image')

        } else if (blob.type === 'application/pdf') {
          localUrl = URL.createObjectURL(blob)
          setObjectUrl(localUrl)
          setKind('pdf')

        } else if (blob.type === LEGACY_DOC_TYPE) {
          const { text: extracted } = await api.legacyDocText(evidenceId, inode)
          if (cancelled) return
          setText(extracted)
          setKind('legacy-doc')

        } else if (blob.type === DOCX_TYPE) {
          const mammoth = await import('mammoth/mammoth.browser')
          const arrayBuffer = await blob.arrayBuffer()
          const result = await mammoth.convertToHtml({ arrayBuffer })
          if (cancelled) return
          setDocHtml(result.value)
          setKind('docx')

        } else if (SHEET_TYPES.has(blob.type)) {
          const XLSX = await import('xlsx')
          const arrayBuffer = await blob.arrayBuffer()
          const workbook = XLSX.read(arrayBuffer, { type: 'array' })

          if (cancelled) return
          const firstSheetName = workbook.SheetNames[0]
          const html = XLSX.utils.sheet_to_html(workbook.Sheets[firstSheetName])
          setDocHtml(html)

          setSheetNote(
            workbook.SheetNames.length > 1
                ? `Showing "${firstSheetName}" (1 of ${workbook.SheetNames.length} sheets)`
                : `Sheet: ${firstSheetName}`,
          )

          setKind('sheet')
        } 
        else if (blob.type.startsWith('text/') || blob.type === 'application/json') 
          {
          setText(await blob.text())
          setKind('text')
        } 
        else {
          localUrl = URL.createObjectURL(blob)
          setObjectUrl(localUrl)
          setKind('binary')
        }
      } catch (err) {
        if (!cancelled) 
          {
          setError(err instanceof Error ? err.message : String(err))
          setKind('error')
        }
      }
    }

    load()
    return () => {
      cancelled = true
      if (localUrl) URL.revokeObjectURL(localUrl)
    }
  }, [url])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/90 p-6">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col border border-ink-700 bg-ink-950">
        <div className="flex items-center justify-between border-b border-ink-800 px-5 py-3.5">
          
          <p className="truncate font-mono text-sm text-ink-0">{name}</p>
          
          <div className="flex items-center gap-3">
            <a
              href={url}
              download={name}
              className="flex items-center gap-1.5 text-xs font-mono text-ink-400 hover:text-ink-0"
            >
          <Download size={13} />
              Download
            </a>
            <button onClick={onClose} className="text-ink-400 hover:text-ink-0">
              <X size={16} />
            </button>
          </div>

        </div>

        <div className="flex flex-1 items-center justify-center overflow-auto bg-ink-900/30 p-4">
          {kind === 'loading' && <p className="text-sm text-ink-500">Loading…</p>}
          {kind === 'error' && <p className="text-sm text-ink-300">Could not load file: {error}</p>}
          {kind === 'image' && objectUrl && (
           
           <img src={objectUrl} alt={name} className="max-h-[70vh] max-w-full object-contain" />

          )}
          {kind === 'pdf' && objectUrl && (
            <div className="flex h-[70vh] w-full flex-col">
              <iframe src={objectUrl} title={name} className="flex-1" />
              
              <a
                href={objectUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 self-center text-xs font-mono text-ink-400 hover:text-ink-0"
              >
                Open in new tab
              
              </a>
            </div>
          )}
          {kind === 'text' && (
            <pre className="max-h-[70vh] w-full overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-ink-200">
              {text}
            </pre>
          )}
          {kind === 'legacy-doc' && (
            <div className="w-full">
              
              <p className="mb-2 text-xs text-ink-500">
                Old binary .doc format — text only, no formatting, tables or images.
              </p>
              
              
              <pre className="max-h-[65vh] w-full overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-ink-200">
                {text}
              </pre>
            
            </div>
          )}

          {kind === 'docx' && docHtml && (
            
            <iframe
              srcDoc={sandboxedDoc(docHtml)}
              title={name}
              sandbox=""
              className="h-[70vh] w-full border-0 bg-ink-900/40"
            />

          )}

          {kind === 'sheet' && docHtml && (
            <div className="flex h-[70vh] w-full flex-col">

              {sheetNote && <p className="mb-2 font-mono text-xs text-ink-500">{sheetNote}</p>}
              
              <iframe
                srcDoc={sandboxedDoc(docHtml)}
                title={name}
                sandbox=""
                className="flex-1 border-0 bg-ink-900/40"/>

            </div>
          )}

          {kind === 'binary' && (
            <div className="text-center">

              <p className="text-sm text-ink-400">No inline preview for this file type</p>

              <p className="mt-1 font-mono text-xs text-ink-500">{formatBytes(size)}</p>
            
            </div>
          )}
        </div>

        {kind !== 'loading' && kind !== 'error' && <InvestigateBar evidenceId={evidenceId} inode={inode} />}
      </div>
    </div>
  )
}

type OpenPanel = 'identify' | 'reputation' | RunnableTool

const TOOL_LABEL: Partial<Record<RunnableTool, string>> = 
{
  yara: 'Scan with YARA',
  exiftool: 'Read Metadata',
}


const TOOL_ICON: Partial<Record<RunnableTool, typeof Bug>> = {
  yara: Bug,
  exiftool: Tags,
}

const FILE_PREVIEW_TOOLS: RunnableTool[] = ['yara', 'exiftool']


const SEVERITY_STYLE: Record<string, string> =
 {
  high: 'border-ink-0 text-ink-0',

  medium: 'border-ink-400 text-ink-200',
  low: 'border-ink-700 text-ink-400',
    }

function InvestigateBar({ evidenceId, inode }: { evidenceId: string; inode?: string }) {
  const [open, setOpen] = useState<OpenPanel | null>(null)
  const [identify, setIdentify] = useState<IdentifyResult | null>(null)

  const [reputation, setReputation] = useState<ReputationResult | null>(null)
  const [toolResults, setToolResults] = useState<Partial<Record<RunnableTool, AdHocRunResult>>>({})
  
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runIdentify() {
    setOpen('identify')
    if (identify) return
    setLoading(true)
    setError(null)
    try {
      setIdentify(await api.identifyFile(evidenceId, inode))
    } 
    catch (err)
     {
      setError(err instanceof Error ? err.message : String(err))
    } 
    finally {
      setLoading(false)
    }
  }

  async function runReputation() {
    setOpen('reputation')
    if (reputation) return
    setLoading(true)
    setError(null)
    try {
      setReputation(await api.checkReputation(evidenceId, inode))
    } 
    catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } 
    finally {
      setLoading(false)
    }
  }

  async function runTool(tool: RunnableTool) {
    setOpen(tool)
    if (toolResults[tool]) return

    setLoading(true)
    setError(null)
    try {
      const result = await api.runTool(evidenceId, tool, inode)
      setToolResults(
        (prev) => (
        { ...prev, [tool]: result })
      )
    } 
    catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } 
    finally {
      setLoading(false)
    }
  }

  const activeTool = open && open !== 'identify' && open !== 'reputation' ? toolResults[open] : null

  return (
    <div className="border-t border-ink-800 px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        
        <button
          onClick={runIdentify}
          className="flex items-center gap-1.5 border border-ink-700 px-2.5 py-1.5 text-xs text-ink-200 hover:border-ink-500">
          
          <ScanSearch size={12} />
          Identify Type
        </button>
        
        <button
          onClick={runReputation}
          className="flex items-center gap-1.5 border border-ink-700 px-2.5 py-1.5 text-xs text-ink-200 hover:border-ink-500">
          
          <ShieldAlert size={12} />
          Check Reputation
        </button>
        
        {FILE_PREVIEW_TOOLS.map(
          (tool) => {
          const Icon = TOOL_ICON[tool]!
          return (
            <button
              key={tool}
              onClick={() => runTool(tool)}
              className="flex items-center gap-1.5 border border-ink-700 px-2.5 py-1.5 text-xs text-ink-200 hover:border-ink-500">

              <Icon size={12} />
              {TOOL_LABEL[tool]}
            </button>
          )
        })}
      </div>

      {open && (
        <div className="mt-3 border border-ink-800 bg-ink-900/40 px-4 py-3 text-sm">
          {loading && <p className="text-ink-500">Running…</p>}

          {error && <p className="text-ink-300">{error}</p>}

          {open === 'identify' && identify && !loading && (
            <div>
              
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-ink-500">
                  <Fingerprint size={12} />
                  {identify.method === 'libmagic' ? 'Signature match' : 'Hex analysis'}
                </span>
                
                <span
                  className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
                    identify.confidence === 'high'
                      ? 'border-ink-0 text-ink-0'
                      : 'border-ink-700 text-ink-400'
                  }`}>
                    
                  {identify.confidence} confidence
                </span>
              </div>
              <p className="mt-2 text-ink-100">{identify.guess}</p>

              {identify.note && <p className="mt-1.5 text-xs text-ink-500">{identify.note}</p>}
            </div>
          )}

          {open === 'reputation' && reputation && !loading && (
            <div>
              {!reputation.configured ? (
                <p className="text-ink-400">{reputation.note}</p>

              ) : reputation.error ? (
                <p className="text-ink-300">{reputation.error}</p>

              ) : !reputation.known_to_virustotal ? (
                <p className="text-ink-400">{reputation.note}</p>

              ) : (
                <div>
                  <div className="flex items-center gap-4 font-mono text-xs">
                    
                    <span className="text-ink-0">
                      {reputation.malicious_votes}/{reputation.total_engines} engines flag this as malicious
                    
                  </span>

                  </div>
                  {reputation.detection_names && reputation.detection_names.length > 0 && (
                  
                  <p className="mt-1.5 text-xs text-ink-400">{reputation.detection_names.join(', ')}</p>
                  )}
                </div>
              )}
              {reputation.sha256 && (

                <p className="mt-2 font-mono text-[11px] text-ink-600 break-all">SHA-256: {reputation.sha256}</p>
              
              )}
            </div>
          )}

          {open !== 'identify' && open !== 'reputation' && activeTool && !loading && (
            <ToolResultView tool={open} result={activeTool} />
          )}
        </div>
      )}
    </div>
  )
}

function ToolResultView({ tool, result }: { tool: RunnableTool; result: AdHocRunResult }) {
  return (
    <div>
      <p className="text-ink-100">{result.log}</p>

      {result.findings.length > 0 && (
         <ul className="mt-2 space-y-1.5">
          {result.findings.map((f, i) => (
            <li key={i} className="flex items-start gap-2">
              
              <span
                className={`mt-0.5 shrink-0 rounded-sm border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${SEVERITY_STYLE[f.severity] ?? SEVERITY_STYLE.low}`}>
                {f.severity}
              </span>

              <span className="text-ink-200">{f.description}</span>
            </li>
          ))}
        </ul>
      )}

      {tool === 'exiftool' && <ExifToolMetadata metadata={result.metadata} />}
    </div>
  )
}

function ExifToolMetadata({ metadata }: { metadata: unknown }) {
  const records = metadata as Record<string, unknown>[] | null

  const record = records && records.length > 0 ? records[0] : null
  
  if (!record) return null

  const entries = Object.entries(record).filter(([key]) => key !== 'SourceFile')
  
  if (entries.length === 0) return null

  return (
    <div className="mt-3 max-h-48 overflow-auto">
      
      
      <table className="w-full font-mono text-[11px] text-ink-300">
        
        
        <tbody>
            {entries.map(([key, value]) => (
            <tr key={key} className="border-t border-ink-800">
              <td className="py-1 pr-3 align-top text-ink-500">{key}</td>
              <td className="py-1 align-top break-all">{String(value)}</td>
            </tr>
             ))}
        </tbody>
      
      </table>
    </div>
  )
}
