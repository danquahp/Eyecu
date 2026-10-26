import { FolderOpen, HardDrive, Sparkles, AlertTriangle } from 'lucide-react'
import Topbar from '../components/Topbar'
import StatCard from '../components/StatCard'


import StatusBadge from '../components/StatusBadge'
import { api } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { formatBytes } from '../lib/format'

export default function Dashboard() {
  const { data: cases } = usePoll(api.cases, 5000)
  const { data: evidence } = usePoll(() => api.evidence(), 3000)

  const { data: findings } = usePoll(() => api.findings(), 3000)


  const { data: tools } = usePoll(api.tools, 5000)

  const activeCases = cases?.filter((c) => c.status === 'active').length ?? 0

  const totalBytes = evidence?.reduce((sum, e) => sum + e.size_bytes, 0) ?? 0

  const highSeverity = findings?.filter((f) => f.severity === 'high').length ?? 0

  const connectedTools = tools?.filter((t) => t.connected).length ?? 0

  return (
    <div>
      <Topbar title="Dashboard" description="Cross-tool overview and ai flagged activity" />

      <div className="space-y-8 px-8 py-6">
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Active Cases" value={activeCases} icon={FolderOpen} sub={`${cases?.length ?? 0} total`} /> 

          <StatCard label="Evidence Ingested" value={formatBytes(totalBytes)} icon={HardDrive} sub={`${evidence?.length ?? 0} items`} />
          
          <StatCard label="High confidence Findings" value={highSeverity} icon={AlertTriangle} sub="requires review" />
          
          <StatCard label="Tools Connected" value={`${connectedTools}/${tools?.length ?? 0}`} icon={Sparkles} sub="integration status" />
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 border border-ink-800">

            <div className="flex items-center justify-between border-b border-ink-800 px-5 py-3.5">
              <h2 className="text-sm font-semibold tracking-tight text-ink-0">Recent Evidence</h2>
              <a href="/evidence" className="text-xs font-mono text-ink-400 hover:text-ink-0">
                View all →
              </a>
            </div>


            {evidence && evidence.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-500">No evidence ingested yet</p>
            ) : (
              <table className="w-full text-sm">
                
                <thead>
                  <tr className="border-b border-ink-800 text-left text-[11px] font-mono uppercase tracking-wider text-ink-500">
                    <th className="px-5 py-2.5 font-medium">Evidence</th>
                    <th className="px-5 py-2.5 font-medium">Tool</th>
                    <th className="px-5 py-2.5 font-medium">Size</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {evidence?.slice(0, 5).map(
                    (e) =>
                   (
                    <tr key={e.id} className="border-b border-ink-900 last:border-0 hover:bg-ink-900/50">
                        <td className="px-5 py-3">
                          <p className="font-mono text-ink-100">{e.name}</p>
                          <p className="text-xs text-ink-500">{e.case_id}</p>
                        </td>
                        <td className="px-5 py-3 text-ink-300">{e.tools.join(', ')}</td>
                         <td className="px-5 py-3 font-mono text-ink-300">{formatBytes(e.size_bytes)}</td>
                        <td className="px-5 py-3">
                        <StatusBadge status={e.status} />
                      </td>
                    </tr>
                  )
                  )}
                </tbody>

              </table>
            )}
          </div>

          <div className="border border-ink-800">
            
            <div className="flex items-center justify-between border-b border-ink-800 px-5 py-3.5">
              <h2 className="text-sm font-semibold tracking-tight text-ink-0">Ai Findings</h2>
              <a href="/ai-analysis" className="text-xs font-mono text-ink-400 hover:text-ink-0">
                View all →
              </a>
            </div>

            {findings && findings.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-500">No findings yet.</p>
            ) : (
              <div className="divide-y divide-ink-900">
                
                {findings?.slice(0, 4).map(
                  (f) => 
                (
                  <div key={f.id} className="px-5 py-3.5">

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono uppercase tracking-wider text-ink-500">{f.type}</span>
                      <StatusBadge status={f.severity} />
                    </div>

                    <p className="mt-1.5 text-sm text-ink-200">{f.description}</p>

                    <p className="mt-1.5 text-xs font-mono text-ink-500">
                      {f.confidence}% confidence {f.source}
                    </p>
                  </div>
                )
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border border-ink-800">
          
          <div className="border-b border-ink-800 px-5 py-3.5">
            <h2 className="text-sm font-semibold tracking-tight text-ink-0">Tool Integration Status</h2>
          </div>

          <div className="grid grid-cols-5 divide-x divide-ink-800">
            
            {tools?.map(
              (t) => 
            (
              <div key={t.name} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink-0">{t.name}</p>
                  <span className={`h-2 w-2 rounded-full ${t.connected ? 'bg-ink-0' : 'bg-ink-700'}`} />
                </div>
                <p className="mt-1 text-xs font-mono text-ink-500">v{t.version}</p>
                <p className="mt-2 text-xs text-ink-400">{t.connected ? `${t.jobs_active} active jobs` : t.detail}</p>
              </div>
            )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
