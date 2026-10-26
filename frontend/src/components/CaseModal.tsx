import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { api, type Case, type CaseInput } from '../lib/api'

export const CASES_CHANGED_EVENT = 'eyecu:cases changed'

const inputClass =
  'w-full border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-100 focus:border-ink-400 focus:outline-none'


const labelClass = 'mb-1.5 block text-xs font-mono uppercase tracking-wider text-ink-500'

const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

const TIMEZONES: string[] =
  typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [BROWSER_TIMEZONE, 'UTC']


export default function CaseModal({
  existing,
  onClose,
  onSaved,
}: {
  existing?: Case
  onClose: () => void
  onSaved?: (c: Case) => void
}) 

{

  const [caseId, setCaseId] = useState(existing?.id ?? '')

  const [form, setForm] = useState<CaseInput>({
    name: existing?.name ?? '',
    investigator: existing?.investigator ?? '',
    timezone: existing?.timezone ?? BROWSER_TIMEZONE,
    priority: existing?.priority ?? 'medium',
    status: existing?.status ?? 'active',
  })


  const [saving, setSaving] = useState(false)
  
  const [error, setError] = useState<string | null>(null)

  const valid = caseId.trim() !== '' && form.name.trim() !== '' && form.investigator.trim() !== ''

  async function save() {
    if (!valid) return
    setSaving(true)
    setError(null)
    try {
      const payload = { ...form, name: form.name.trim(), investigator: form.investigator.trim() }
      const saved = existing
        ? await api.updateCase(existing.id, payload)
        : await api.createCase({ ...payload, id: caseId.trim() })
      window.dispatchEvent(new Event(CASES_CHANGED_EVENT))
      onSaved?.(saved)
      onClose()
    } 
    catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 backdrop-blur-sm">
      
      <div className="w-full max-w-md border border-ink-700 bg-ink-950 p-6">
        
        <div className="mb-5 flex items-center justify-between">
          
            <h3 className="text-sm font-semibold tracking-tight text-ink-0">
            {existing ? `Edit ${existing.id}` : 'New Case'}
            </h3>
          < button onClick={onClose} className="text-ink-400 hover:text-ink-0">
            <X size={16} />
            </button>
        
        
        </div>

        <div className="space-y-4">
          < div>
            <label className={labelClass}>Case number</label>
          <input
              autoFocus={!existing}
              value={caseId}
              disabled={!!existing}
              onChange={(e) => setCaseId(e.target.value)}
              className={`${inputClass} ${existing ? 'opacity-50' : ''} font-mono`}
              placeholder="e.g. CS-2026-014"
            />
          </div>
          
          <div>


            <label className={labelClass}>Case name</label>
                <input
                  autoFocus={!!existing}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                placeholder="e.g. Operation Greyline"
              />
          </div>
          <div>
            <label className={labelClass}>Investigator</label>
            
            <input
              value={form.investigator}
              onChange={(e) => setForm({ ...form, investigator: e.target.value })}
              className={inputClass}
              placeholder="Full name"
            />


          </div>
          
          
          <div>
            
            <label className={labelClass}>Time zone</label>
            
            <select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className={inputClass}>


              {!TIMEZONES.includes(form.timezone) && <option value={form.timezone}>{form.timezone}</option>}
              
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}


            </select>
            <p className="mt-1 text-[11px] text-ink-600">
              Reference zone to know this case's timestamps. Disk image times are often in the
              acquisition machine's local time, not yours.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">

            <div>
              <label className={labelClass}>Priority</label>
              
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as CaseInput['priority'] })}
                className={inputClass}
              >

                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>

              </select>
            </div>
            
            
            <div>
              <label className={labelClass}>Status</label>
              
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as CaseInput['status'] })}
                className={inputClass}
              >


                <option value="active">Active</option>
                <option value="review">Review</option>
                <option value="closed">Closed</option>
              </select>

            </div>
          </div>

          {error && <p className="text-xs text-ink-300">{error}</p>}

          <button
            onClick={save}
            disabled={!valid || saving}
            className="w-full bg-ink-0 py-2.5 text-sm font-medium text-ink-950 hover:bg-ink-100 disabled:opacity-40"
          >


            {saving ? 'Saving' : existing ? 'Save changes' : 'Create case'}
          </button>
        </div>


      </div>
    </div>,

    
    document.body,
  )
}
