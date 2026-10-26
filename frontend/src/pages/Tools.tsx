import { useState } from 'react'
import { Wrench, Brain, RefreshCw } from 'lucide-react'
import Topbar from '../components/Topbar'
import { api } from '../lib/api'
import { usePoll } from '../lib/usePoll'

const descriptions: Record<string, string> = {
  Autopsy: 'Disk imaging',
  Volatility: 'Memory analysis',
  'Bulk Extractor': 'Carving of features (emails, URLs, binaries) from raw media.',
  ExifTool: 'Metadata extraction and file signature verification.',
  YARA: 'Pattern-matching for malware family and rule-based classification.',
}

const MIN_EXAMPLES = 20

export default function Tools() {
  //we check for updates on the connected tool every 5secs
  const { data: tools } = usePoll(api.tools, 5000)

  return (
    <div>
      <Topbar title="Tools" />

      <div className="grid grid-cols-2 gap-5 px-8 py-6">
        {tools?.map((t) => (
          <div key={t.name} className="border border-ink-800 px-6 py-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center border border-ink-700">
                  <Wrench size={16} className="text-ink-300" />
                </div>
                <div>
                  <p className="font-medium text-ink-0">{t.name}</p>
                  <p className="font-mono text-xs text-ink-500">{t.version}</p>
                </div>
              </div>
              <span
                className={`rounded-sm border px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider ${
                  t.connected ? 'border-ink-0 text-ink-0' : 'border-ink-700 text-ink-500'
                }`}
              >
                {t.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <p className="mt-4 text-sm text-ink-400">{descriptions[t.name]}</p>
            <div className="mt-5 flex items-center justify-between border-t border-ink-900 pt-4">
            </div>
          </div>
        ))}
      </div>

      <div className="px-8 pb-8">
        <MLClassifierPanel />
      </div>
    </div>
  )
}

//function 

function MLClassifierPanel() {
  const [Counter, setCounter] = useState(0)
  const { data: status } = usePoll(api.mlStatus, 5000, [Counter])
  const [training, setTraining] = useState(false)
  const [result, setResult] = useState<string | null>(null)


  //this function retrains the model when train model button is clicked
  async function train() {
    setTraining(true)
    setResult(null)
    try {
      const ans = await api.trainModel()
      setResult(ans.message)
      setCounter((i) => i + 1)
    } catch (err) {
      setResult(err instanceof Error ? err.message : String(err))
    } finally {
      setTraining(false)
    }
  }

  const total = status?.total_labelled ?? 0
  const counts = status?.labelled_counts
  const progressPct = Math.min(100, (total / MIN_EXAMPLES) * 100)
  const topFeatures = status?.feature_importances
    ? Object.entries(status.feature_importances)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : []

  return (
    <div className="border border-ink-800">
      <div className="flex items-center justify-between border-b border-ink-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center border border-ink-700">
            <Brain size={16} className="text-ink-300" />
          </div>
          <div>
            <p className="font-medium text-ink-0">Machine Learning Classifier</p>
            <p className="font-mono text-xs text-ink-500">
              {status?.is_trained ? `trained on ${status.n_training_examples} examples` : 'not trained yet'}
            </p>
          </div>
        </div>
        <span
          className={`rounded-sm border px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider ${
            status?.is_trained ? 'border-ink-0 text-ink-0' : 'border-ink-700 text-ink-500'
          }`}
        >
          {status?.is_trained ? 'Trained' : 'Not trained'}
        </span>
      </div>

      <div className="px-6 py-5">
        <p className="text-sm text-ink-400">
          Trained on your own evidence's findings once you've labelled examples
        </p>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-mono text-ink-500">
            <span>
              {total} / {MIN_EXAMPLES} examples
              {counts && ` (${counts.benign} benign, ${counts.suspicious} suspicious, ${counts.malicious} malicious)`}
            </span>
          </div>
        </div>

        {status?.is_trained && (
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-ink-900 pt-4 text-sm">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500">Cross-val F1 (macro)</p>
              <p className="mt-0.5 text-ink-100">
                {status.cv_f1_macro_mean?.toFixed(3)} ± {status.cv_f1_macro_std?.toFixed(3)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500">Classes</p>
              <p className="mt-0.5 text-ink-100">{status.classes?.join(', ')}</p>
            </div>
            {topFeatures.length > 0 && (
              <div className="col-span-2">
                <p className="mb-1.5 text-[11px] font-mono uppercase tracking-wider text-ink-500">
                  features by importance
                </p>
                <div className="space-y-1">
                  {topFeatures.map(([name, value]) => (
                    <div key={name} className="flex items-center gap-2 text-xs">
                      <span className="w-40 shrink-0 font-mono text-ink-400">{name}</span>
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-800">
                        <div className="h-full bg-ink-0" style={{ width: `${value * 100}%` }} />
                      </div>
                      <span className="w-10 shrink-0 font-mono text-ink-500">{(value * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {result && <p className="mt-4 text-sm text-ink-300">{result}</p>}

        <button
          onClick={train}
          disabled={training}
          className="mt-4 flex items-center gap-1.5 border border-ink-700 px-3.5 py-2 text-sm text-ink-100 hover:border-ink-500 disabled:opacity-40"
        >
          <RefreshCw size={14} className={training ? 'animate-spin' : ''} />
          {training ? 'Training…' : status?.is_trained ? 'Retrain Model' : 'Train Model'}
        </button>
      </div>
    </div>
  )
}
