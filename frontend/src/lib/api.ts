const API_BASE = 'http://localhost:8000/api'

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json() as Promise<T>
}

async function send<T>(method: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}`)
  return res.json() as Promise<T>
}

export interface Case {
  id: string
  name: string
  investigator: string
  timezone: string
  opened: string
  status: 'active' | 'review' | 'closed'
  priority: 'low' | 'medium' | 'high'
}

export type GroundTruthLabel = 'benign' | 'suspicious' | 'malicious'

export interface Evidence {
  id: string
  name: string
  case_id: string
  type: 'Disk Image' | 'Memory Dump' | 'File Set' | 'Mobile Extraction'
  size_bytes: number
  tools: string[]
  status: 'queued' | 'processing' | 'complete' | 'flagged' | 'failed'
  sha256: string | null
  stored_path: string
  ingested: string
  ground_truth_label: GroundTruthLabel | null
}

export interface CaseSummary {
  case_id: string
  content: string
  model: string
  generated_at: string
}

export interface EvidenceSummary {
  evidence_id: string
  content: string
  model: string
  generated_at: string
}

export interface LLMStatus {
  available: boolean
  model: string
}

export interface Finding {
  id: number
  case_id: string
  evidence_id: string | null
  type: 'Signature Mismatch' | 'Anomaly' | 'Correlation' | 'Suspicious Pattern'
  description: string
  source: string
  confidence: number
  severity: 'low' | 'medium' | 'high'
  timestamp: string
}

export interface TimelineEvent {
  id: number
  case_id: string
  time: string
  description: string
  tool: string
  ai_correlated: boolean
}

export interface ToolStatus {
  name: string
  connected: boolean
  version: string
  jobs_active: number
  detail: string | null
}

export interface Job {
  id: number
  evidence_id: string
  tool: string
  status: 'queued' | 'running' | 'complete' | 'failed'
  created_at: string
  started_at: string | null
  finished_at: string | null
  log: string
  error: string | null
  result_metadata: string | null
}

export interface MLStatus {
  is_trained: boolean
  labelled_counts: { benign: number; suspicious: number; malicious: number }
  total_labelled: number
  n_training_examples: number | null
  classes: string[] | null
  cv_f1_macro_mean: number | null
  cv_f1_macro_std: number | null
  feature_importances: Record<string, number> | null
}

export interface MLTrainResult {
  trained: boolean
  message: string
  n_examples: number
  label_counts: Record<string, number>
  cv_f1_mean: number | null
  cv_f1_std: number | null
}

export type CaseInput = Pick<Case, 'name' | 'investigator' | 'timezone' | 'priority' | 'status'>
export type NewCaseInput = CaseInput & { id: string }

export interface SearchHit {
  path: string
  inode: string
  deleted: boolean
  matched_in: 'filename' | 'content'
  snippet: string | null
}

export interface TreeEntry {
  name: string
  inode: string
  is_dir: boolean
  deleted: boolean
  size: number | null
  modified: string | null
}

export interface CategorizedEntry {
  path: string
  inode: string
  deleted: boolean
  size: number | null
  category: string
}

export interface IdentifyResult {
  method: string
  guess: string
  confidence: 'high' | 'low' | 'uncertain'
  size_bytes: number
  note: string | null
}

export interface ReputationResult {
  configured: boolean
  known_to_virustotal: boolean | null
  malicious_votes: number | null
  suspicious_votes: number | null
  harmless_votes: number | null
  undetected_votes: number | null
  total_engines: number | null
  detection_names: string[] | null
  names_seen: string[] | null
  note: string | null
  error: string | null
  sha256: string | null
}

export type RunnableTool = 'yara' | 'exiftool' | 'bulk_extractor'

export interface AdHocFinding {
  type: string
  description: string
  confidence: number
  severity: 'low' | 'medium' | 'high'
}

export interface AdHocRunResult {
  tool: string
  log: string
  findings: AdHocFinding[]
  metadata: unknown
}

export const api = {
  cases: () => request<Case[]>('/cases'),

  case: (id: string) => request<Case>(`/cases/${id}`),
  
  createCase: (input: NewCaseInput) => send<Case>('POST', '/cases', input),
  
  updateCase: (id: string, input: Partial<CaseInput>) => send<Case>('PATCH', `/cases/${id}`, input),
  
  evidence: (caseId?: string) => request<Evidence[]>(caseId ? `/evidence?case_id=${caseId}` : '/evidence'),
  
  evidenceItem: (id: string) => request<Evidence>(`/evidence/${id}`),
  
  tree: (evidenceId: string, inode?: string) =>
    request<TreeEntry[]>(`/evidence/${evidenceId}/tree${inode ? `?inode=${inode}` : ''}`),
  
  categories: (evidenceId: string) =>
    request<Record<string, CategorizedEntry[]>>(`/evidence/${evidenceId}/categories`),
  
  fileUrl: (evidenceId: string, inode?: string) =>
    `${API_BASE}/evidence/${evidenceId}/file${inode ? `?inode=${inode}` : ''}`,
  
  identifyFile: (evidenceId: string, inode?: string) =>
        request<IdentifyResult>(`/evidence/${evidenceId}/identify${inode ? `?inode=${inode}` : ''}`),
  
  checkReputation: (evidenceId: string, inode?: string) =>
    request<ReputationResult>(`/evidence/${evidenceId}/reputation${inode ? `?inode=${inode}` : ''}`),
  
  runTool: (evidenceId: string, tool: RunnableTool, inode?: string) =>
       request<AdHocRunResult>(`/evidence/${evidenceId}/run/${tool}${inode ? `?inode=${inode}` : ''}`),
  
  legacyDocText: (evidenceId: string, inode?: string) =>
     request<{ text: string }>(`/evidence/${evidenceId}/doctext${inode ? `?inode=${inode}` : ''}`),
  
  searchEvidence: (evidenceId: string, q: string) =>
       request<SearchHit[]>(`/evidence/${evidenceId}/search?q=${encodeURIComponent(q)}`),
  
  findings: (caseId?: string) => request<Finding[]>(caseId ? `/findings?case_id=${caseId}` : '/findings'),
  
  findingsForEvidence: (evidenceId: string) => request<Finding[]>(`/findings?evidence_id=${evidenceId}`),
  
  timeline: (caseId?: string) => request<TimelineEvent[]>(caseId ? `/timeline?case_id=${caseId}` : '/timeline'),
  
    tools: () => request<ToolStatus[]>('/tools'),
  
jobs: (evidenceId?: string) => request <Job[]> (evidenceId ? `/jobs?evidence_id=${evidenceId}` : '/jobs'),
  async ingestEvidence(params: { caseId: string; 
    type: string;
    tools: string[]; 
    file: File 
  }): 
  Promise<Evidence> {
    const form = new FormData()
    form.append('case_id', params.caseId)
    form.append('type', params.type)
    for (const tool of params.tools) form.append('tools', tool)
    form.append('file', params.file)
    
    const res = await fetch(`${API_BASE}/evidence`, { method: 'POST', body: form })
    if (!res.ok) throw new Error(`upload failed, ${res.status}`)
    return res.json()
  },
  
  
  
  setEvidenceLabel: (evidenceId: string, label: GroundTruthLabel | null) =>
    send<Evidence>('PATCH', `/evidence/${evidenceId}/label`, 
      { ground_truth_label: label }
    ),


  llmStatus: () => 
    request<LLMStatus>
  ('/cases/ai/status'),

  getSummary: (caseId: string) => request <CaseSummary | null>  (`/cases/${caseId}/summary`),

  generateSummary: (caseId: string) => send<CaseSummary>  ('POST', `/cases/${caseId}/summary`,
     {}),

  getEvidenceSummary: (evidenceId: string) => request<EvidenceSummary | null>(`/evidence/${evidenceId}/summary`),
  
  generateEvidenceSummary: (evidenceId: string) =>
    send<EvidenceSummary>(
      'POST', `/evidence/${evidenceId}/summary`,
       {}
      ),

  mlStatus: () => request <MLStatus>  ('/ml/status'),

  trainModel: () => send  <MLTrainResult>  ('POST', '/ml/train', 
    {}),
}
