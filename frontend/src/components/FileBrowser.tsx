import { useEffect, useState } from 'react'
import {
  ChevronRight,
  File,
  FileText,
  Folder,
  FolderOpen,
  Home,
  Image,
  Layers,
  Music,
  Package,
  Search,
  Sheet,
  Trash2,
} from 'lucide-react'
import { api, type CategorizedEntry, type Job, type SearchHit, type TreeEntry } from '../lib/api'
import { formatBytes } from '../lib/format'
import FilePreview from './FilePreview'

interface Crumb {
  name: string
  inode?: string
}



const CATEGORY_ICONS: Record<string, typeof File> = {
  Images: Image,
  Documents: FileText,
  Spreadsheets: Sheet,
  Presentations: FileText,
  Unknown: File,
  Archives: Package,
  Executables: Package,
  'Audio/Video': Music,
  
}






const CATEGORY_ORDER = [
  'Documents',
  'Spreadsheets',
  'Presentations',
  'Unknown',
  'Images',
  'Archives',
  'Executables',
  'Audio/Video',
  
]

export default function FileBrowser({ evidenceId }: { evidenceId: string }) {


  const [mode, setMode] = useState<'tree' | 'categories' | 'features' | 'search'>('tree')

  return (
    <div className="border border-ink-800">
      <div className="flex items-center justify-between border-b border-ink-800 px-2 py-1.5">
        
        <div className="flex gap-1">
          <button
            onClick={() => setMode('tree')}
            className={`px-2.5 py-1 text-xs font-mono uppercase tracking-wider ${
              mode === 'tree' ? 'bg-ink-0 text-ink-950' : 'text-ink-400 hover:text-ink-0'
            }`}>
            Tree
          </button>


          <button
            onClick={() => setMode('categories')}
            className={`px-2.5 py-1 text-xs font-mono uppercase tracking-wider ${
              mode === 'categories' ? 'bg-ink-0 text-ink-950' : 'text-ink-400 hover:text-ink-0'
            }`}>
            By Type
          </button>


          <button
            onClick={() => setMode('features')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono uppercase tracking-wider ${
              mode === 'features' ? 'bg-ink-0 text-ink-950' : 'text-ink-400 hover:text-ink-0'
            }`}>

            <Layers size={11} />
            Bulk Extractor
          </button>


          <button
            onClick={() => setMode('search')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono uppercase tracking-wider ${
              mode === 'search' ? 'bg-ink-0 text-ink-950' : 'text-ink-400 hover:text-ink-0'
            }`}
          >
            <Search size={11} />
            Search
          </button>

        </div>
      </div>
      {mode === 'tree' && <TreeView evidenceId={evidenceId} />}

      {mode === 'categories' && <CategoryView evidenceId={evidenceId} />}
      
      {mode === 'features' && <FeaturesView evidenceId={evidenceId} />}
      
      {mode === 'search' && <SearchView evidenceId={evidenceId} />}

    </div>
  )
}

function SearchView({ evidenceId }: { evidenceId: string }) {
  const [query, setQuery] = useState('')

  const [results, setResults] = useState<SearchHit[] | null>(null)
  
  const [loading, setLoading] = useState(false)
  
  const [error, setError] = useState<string | null>(null)
  
  const [preview, setPreview] = useState<SearchHit | null>(null)

  async function runSearch() {
    if (!query.trim()) return
    setLoading(true)
    setError(null)

    try {
      setResults(await api.searchEvidence(evidenceId, query.trim()))
    } 
    catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
     finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-ink-800 px-4 py-2.5">
        
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          placeholder="Search file names and contents (PDFs, Word docs, text)…"
          className="flex-1 bg-transparent font-mono text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none"/>
        
        <button
          onClick={runSearch}
          disabled={loading || !query.trim()}
          className="border border-ink-700 px-2.5 py-1 text-xs font-mono text-ink-200 hover:border-ink-500 disabled:opacity-40">
          {loading ? 'Searching…' : 'Search'}
        </button>


      </div>

      {error && <p className="px-4 py-6 text-center text-sm text-ink-400">{error}</p>}
      {loading && <p className="px-4 py-6 text-center text-sm text-ink-500">Scanning filenames and file contents…</p>}



      {!loading && results !== null && results.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-ink-500">No matches for "{query}".</p>
      )}

      {!loading && results && results.length > 0 && (
        <div>
            <p className="px-4 pt-3 font-mono text-xs text-ink-500">
            {results.length} match{results.length === 1 ? '' : 'es'}
            </p>


          <table className="w-full table-fixed text-sm">
            
            <tbody>
              {
              results.map((r) =>
               (
                <tr
                  key={`${r.inode}-${r.path}`}
                  onClick={() => setPreview(r)}
                  className="cursor-pointer border-t border-ink-900 hover:bg-ink-900/50"
                >
                  <td className="min-w-0 py-2.5 pl-4 pr-2 align-top">
                    <p className="truncate font-mono text-ink-100" title={r.path}>
                      {r.path}
                    </p>
                    {r.snippet && (
                      <p className="mt-1 truncate text-xs text-ink-400" title={r.snippet}>
                        {r.snippet}
                      </p>
                    )}
                  </td>
                  <td className="w-40 whitespace-nowrap px-2 py-2.5 align-top text-right">
                    <span className="rounded-sm border border-ink-700 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-ink-400">
                      {r.matched_in}
                    </span>
                    {r.deleted && (
                      <span className="ml-1.5 rounded-sm border border-ink-700 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-ink-400">
                        deleted
                      </span>
                    )}
                  </td>
                </tr>
              )
              )}
            </tbody>

          </table>


        </div>
      )}

      {preview && (

        <FilePreview
          evidenceId={evidenceId}
          inode={preview.inode}
          name={preview.path.split('/').pop() ?? preview.path}
          onClose={() => setPreview(null)}/>

      )}
    </div>
  )
}

function TreeView({ evidenceId }: { evidenceId: string }) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ name: 'root', inode: undefined }])
  const [entries, setEntries] = useState<TreeEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)


  const [preview, setPreview] = useState<TreeEntry | null>(null)

  const current = crumbs[crumbs.length - 1]

  useEffect(() => {
    let cancelled = false
    setEntries(null)
    setError(null)

    api
      .tree(evidenceId, current.inode)
      .then(
        (data) => !cancelled && setEntries(data)
      )
      .catch(
        (err) => !cancelled && setError(err instanceof Error ? err.message : String(err))
      )

    return () => {
      cancelled = true
    }
   
  }, [evidenceId, current.inode])

  return (
    <div>

      <div className="flex items-center gap-1.5 border-b border-ink-800 px-4 py-2.5 text-xs font-mono">
        {crumbs.map((c, i) =>
         (
          <span key={i} className="flex items-center gap-1.5">

            {i > 0 && <ChevronRight size={12} className="text-ink-600" />}
            <button

              onClick={() => setCrumbs(crumbs.slice(0, i + 1))}
              className={`flex items-center gap-1 ${
                i === crumbs.length - 1 ? 'text-ink-0' : 'text-ink-500 hover:text-ink-200'
              }`}
    >
              {i === 0 && <Home size={12} />}
              {c.name}
            </button>
          </span>
        ))}
      </div>

      {error && <p className="px-4 py-6 text-center text-sm text-ink-400">{error}</p>}

      {!error && entries && entries.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-ink-500">Empty directory.</p>
      )}

      {!error && entries === null && <p className="px-4 py-6 text-center text-sm text-ink-500">Loading…</p>}

      {!error && entries && entries.length > 0 && (
      
      <table className="w-full table-fixed text-sm">
          <tbody>
            {entries.map((e) => (
              <tr
                key={e.inode}
                onClick={() => (e.is_dir ? setCrumbs([...crumbs, { name: e.name, inode: e.inode }]) : setPreview(e))}
                className="cursor-pointer border-b border-ink-900 last:border-0 hover:bg-ink-900/50"
              >
                <td className="w-8 px-4 py-2">
                  {e.is_dir ? (
                    <Folder size={14} className="text-ink-400" />
                  ) : (
                    <File size={14} className="text-ink-500" />
                  )}
                </td>
                <td className="min-w-0 truncate px-2 py-2 font-mono text-ink-100" title={e.name}>
                  {e.name}
                </td>
                <td className="w-24 px-2 py-2">
                  {e.deleted && (
                    <span className="rounded-sm border border-ink-700 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-ink-400">
                      deleted
                    </span>
                  )}
                </td>
                <td className="w-24 px-4 py-2 text-right font-mono text-xs text-ink-500">
                  {e.size !== null && !e.is_dir ? formatBytes(e.size) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

      )}

      {preview && (

        <FilePreview evidenceId={evidenceId} inode={preview.inode} name={preview.name} onClose={() => setPreview(null)} />
      
      )}
    </div>
  )
}

function CategoryView({ evidenceId }: { evidenceId: string }) {
  const [buckets, setBuckets] = useState<Record<string, CategorizedEntry[]> | null>(null)

  
  const [error, setError] = useState<string | null>(null)
  const [openCategory, setOpenCategory] = useState<string | null>(null)
  
  
  const [preview, setPreview] = useState<CategorizedEntry | null>(null)

  useEffect(
    () => {
    let cancelled = false
    api
      .categories(evidenceId)
      .then(
        (data) => !cancelled && setBuckets(data)
      )
      .catch(
        (err) => !cancelled && setError(err instanceof Error ? err.message : String(err))
      )
    return () => {
      cancelled = true
    }
  }, [evidenceId])

  if (error) return <p className="px-4 py-6 text-center text-sm text-ink-400">{error}</p>
  if (!buckets) return <p className="px-4 py-6 text-center text-sm text-ink-500">Scanning the whole image…</p>

  const deletedCount = Object.values(buckets)
    .flat()
    .filter(
      (e) => e.deleted).length
  const orderedCategories = [...CATEGORY_ORDER, ...Object.keys(buckets).filter((c) => !CATEGORY_ORDER.includes(c))]

  return (
    <div>

      <div className="divide-y divide-ink-900">
           {deletedCount > 0 && (
          <CategoryRow
            name="Deleted"
            icon={Trash2}
            count={deletedCount}
            open={openCategory === 'Deleted'}
            onToggle={
              () => setOpenCategory(openCategory === 'Deleted' ? null : 'Deleted')
            }
            entries={Object.values(buckets).flat().filter((e) => e.deleted)}
            onSelect={setPreview}/>

        )}

        {orderedCategories.map(
          (cat) => {
          
          const items = buckets[cat]
          if (!items || items.length === 0) return null
          
          return (
            <CategoryRow
              key={cat}
              name={cat}
              icon={CATEGORY_ICONS[cat] ?? File}
              count={items.length}
              open={openCategory === cat}
              onToggle={
                () => setOpenCategory(openCategory === cat ? null : cat)
              }
              entries={items}
              onSelect={setPreview}
            />
          )
        })}


      </div>

      {preview && (


        <FilePreview
          evidenceId={evidenceId}
          inode={preview.inode}
          name={preview.path.split('/').pop() ?? preview.path}
          onClose={() => setPreview(null)}
        />
      )}


    </div>
  )
}

interface BulkExtractorMetadata {
  feature_counts?: Record<string, number>
  top_domains?: { value: string; count: number }[]


  top_emails?: { value: string; count: number }[]
  recently_opened_files?: string[]
}

function FeaturesView({ evidenceId }: { evidenceId: string }) {
  const [jobs, setJobs] = useState<Job[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .jobs(evidenceId)
      .then(
        (data) => !cancelled && setJobs(data))
      .catch(
        (err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      cancelled = true
    }
  }, [evidenceId])

  if (error) return <p className="px-4 py-6 text-center text-sm text-ink-400">{error}</p>

  if (!jobs) return <p className="px-4 py-6 text-center text-sm text-ink-500">Loading…</p>

  const job = jobs.find((j) => j.tool === 'Bulk Extractor')

  if (!job) {
    return (


      <p className="px-4 py-6 text-center text-sm text-ink-500">
        No Bulk Extractor job on this evidence,only disk images get one automatically.
      </p>
    
  
  )
  }

  if (job.status === 'queued' || job.status === 'running') {
    return <p className="px-4 py-6 text-center text-sm text-ink-500">Bulk Extractor is carving features from this image…</p>
  }

  if (job.status === 'failed') {
    return <p className="px-4 py-6 text-center text-sm text-ink-400">Bulk Extractor failed: {job.error}</p>
  }



  let data: BulkExtractorMetadata | null = null
  try {
    data = job.result_metadata ? JSON.parse(job.result_metadata) : null
  } catch {
    data = null
  }
  if (!data) {
    return <p className="px-4 py-6 text-center text-sm text-ink-500">No extracted features recorded for this run.</p>
  }

  const counts = Object.entries(data.feature_counts ?? {}).filter(([, n]) => n > 0)

  return (
    <div className="px-4 py-4">
      <p className="mb-4 text-sm text-ink-200">{job.log}</p>

      {counts.length > 0 && (
        <div className="mb-4">

          <p className="text-xs font-mono uppercase tracking-wider text-ink-500">Feature counts</p>
          
          <div className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
            {counts.map(([name, n]) => (
              <div key={name} className="flex items-center justify-between gap-2 font-mono text-xs text-ink-300">
                
                <span className="min-w-0 truncate text-ink-500" title={name}>
                  {name}
                </span>

                <span className="shrink-0">{n}</span>

              </div>
            ))}
          </div>

        </div>
      )}

      {data.top_emails && data.top_emails.length > 0 && (
        <div className="mb-4">
          
          <p className="text-xs font-mono uppercase tracking-wider text-ink-500">Top email addresses</p>
          
          <ul className="mt-1.5 font-mono text-xs text-ink-300">
            {data.top_emails.slice(0, 15).map(
              (e) => (
              <li key={e.value} className="flex items-center justify-between gap-2">
                
                <span className="min-w-0 flex-1 truncate" title={e.value}>
                  {e.value}
                </span>
                <span className="shrink-0 text-ink-600">×{e.count}</span>
              
              </li>
            ))}
          </ul>

        </div>
      )}



      {data.top_domains && data.top_domains.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-mono uppercase tracking-wider text-ink-500">Top domains</p>
          <ul className="mt-1.5 font-mono text-xs text-ink-300">
            {data.top_domains.slice(0, 15).map((d) => (
                    <li key={d.value} className="flex items-center justify-between gap-2">
                     <span className="min-w-0 flex-1 truncate" title={d.value}>
                      {d.value}
                      </span>
                     <span className="shrink-0 text-ink-600">×{d.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}




      {data.recently_opened_files && data.recently_opened_files.length > 0 && (
        <div>
            <p className="text-xs font-mono uppercase tracking-wider text-ink-500">
            Recently opened files (carved .lnk)
            </p>
          <ul className="mt-1.5 max-h-40 overflow-auto font-mono text-[11px] text-ink-300">
            {data.recently_opened_files.map((p) => (
              <li key={p} className="truncate" title={p}>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function CategoryRow({
  name,
  icon: Icon,
  count,
  open,
  onToggle,
  entries,
  onSelect,
}: {
  name: string
  icon: typeof File
  count: number
  open: boolean
  onToggle: () => void
  entries: CategorizedEntry[]
  onSelect: (e: CategorizedEntry) => void
}) 
{
  return (
    <div>

      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-ink-900/50">
        
        <span className="flex items-center gap-2.5 text-ink-100">
          {open ? <FolderOpen size={14} className="text-ink-400" /> : <Icon size={14} className="text-ink-400" />}
          {name}
        </span>

        <span className="font-mono text-xs text-ink-500">{count}</span>

      </button>


      {open && (


        <table className="w-full table-fixed text-sm">
          <tbody>
            {entries.map((e) => (
              <tr
                key={`${e.inode}-${e.path}`}
                onClick={() => onSelect(e)}
                className="cursor-pointer border-t border-ink-900 bg-ink-900/20 hover:bg-ink-900/60"
              >
                <td className="min-w-0 truncate py-2 pl-10 pr-2 font-mono text-ink-200" title={e.path}>
                  {e.path}
                </td>
                <td className="w-24 px-2 py-2">
                  {e.deleted && (
                    <span className="rounded-sm border border-ink-700 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-ink-400">
                      deleted
                    </span>
                  )}
                </td>
                <td className="w-24 px-4 py-2 text-right font-mono text-xs text-ink-500">
                  {e.size !== null ? formatBytes(e.size) : ''}
                </td>
              </tr>
            ))}
          </tbody>

        </table>

        
      )}
    </div>
  )
}
