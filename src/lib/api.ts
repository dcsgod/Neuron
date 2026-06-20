// In Tauri (desktop), the backend runs on a fixed port.
// In Docker/web, the frontend is served FROM the backend — use relative paths.
const BACKEND: string = import.meta.env.VITE_BACKEND_URL !== undefined
  ? (import.meta.env.VITE_BACKEND_URL as string)
  : 'http://127.0.0.1:8000'

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  extension?: string
  children?: FileNode[]
  size?: number
}

// ─── File API ─────────────────────────────────────────────────────

export async function fetchFileTree(root: string): Promise<FileNode[]> {
  const resp = await fetch(`${BACKEND}/api/files/tree?root=${encodeURIComponent(root)}`)
  if (!resp.ok) throw new Error(`Failed to fetch tree: ${resp.statusText}`)
  return resp.json()
}

export async function fetchFileContent(path: string): Promise<string> {
  const resp = await fetch(`${BACKEND}/api/files/content?path=${encodeURIComponent(path)}`)
  if (!resp.ok) throw new Error(`Failed to read file: ${resp.statusText}`)
  const data = await resp.json()
  return data.content
}

export async function saveFileContent(path: string, content: string): Promise<void> {
  const resp = await fetch(`${BACKEND}/api/files/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  })
  if (!resp.ok) throw new Error(`Failed to save file: ${resp.statusText}`)
}

// ─── Models / Health ──────────────────────────────────────────────

export async function fetchModels(): Promise<string[]> {
  try {
    const resp = await fetch(`${BACKEND}/api/chat/models`)
    if (!resp.ok) return []
    const data = await resp.json()
    return data.models ?? []
  } catch {
    return []
  }
}

export async function fetchHealth(): Promise<any> {
  try {
    const resp = await fetch(`${BACKEND}/api/health`)
    if (!resp.ok) return null
    return resp.json()
  } catch {
    return null
  }
}

export async function fetchFullHealth(): Promise<any> {
  try {
    const resp = await fetch(`${BACKEND}/api/health/full`)
    if (!resp.ok) return null
    return resp.json()
  } catch {
    return null
  }
}

// ─── SSE helper ───────────────────────────────────────────────────

async function* _streamSSE(
  url: string,
  body: object
): AsyncGenerator<any> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    yield { type: 'error', content: `Backend error: ${resp.statusText}` }
    return
  }

  const reader = resp.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (raw === '[DONE]') return
      try {
        yield JSON.parse(raw)
      } catch {
        // skip malformed
      }
    }
  }
}

// ─── Chat ─────────────────────────────────────────────────────────

export interface ChatMessagePayload {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function* streamChat(
  messages: ChatMessagePayload[],
  model?: string | null
): AsyncGenerator<{ type: string; content?: string; stats?: any; model?: string }> {
  yield* _streamSSE(`${BACKEND}/api/chat`, { messages, model: model ?? null, stream: true })
}

// ─── Agent ────────────────────────────────────────────────────────

export interface AgentRunPayload {
  message: string
  agent_type?: string
  project_root: string
  active_file?: string | null
  model?: string | null
  conversation_history?: ChatMessagePayload[]
}

export async function* streamAgent(
  payload: AgentRunPayload
): AsyncGenerator<any> {
  yield* _streamSSE(`${BACKEND}/api/agents/run`, payload)
}

export async function submitReward(
  traceId: string,
  projectRoot: string,
  accepted: boolean,
  successScore = 1.0
): Promise<void> {
  await fetch(`${BACKEND}/api/agents/reward`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trace_id: traceId,
      project_root: projectRoot,
      accepted,
      success_score: successScore,
    }),
  })
}

// ─── Research ─────────────────────────────────────────────────────

export interface ResearchPayload {
  url?: string
  text?: string
  project_root: string
  task: 'summarize' | 'extract_algorithm' | 'generate_code'
  save_to_memory: boolean
}

export async function* streamResearch(payload: ResearchPayload): AsyncGenerator<any> {
  yield* _streamSSE(`${BACKEND}/api/research/extract`, payload)
}

// ─── Notebooks ────────────────────────────────────────────────────

export async function fetchNotebook(path: string): Promise<any> {
  const resp = await fetch(`${BACKEND}/api/notebooks/parse?path=${encodeURIComponent(path)}`)
  if (!resp.ok) throw new Error(`Failed to parse notebook: ${resp.statusText}`)
  return resp.json()
}

export async function saveNotebook(path: string, notebook: object): Promise<void> {
  const resp = await fetch(`${BACKEND}/api/notebooks/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, notebook }),
  })
  if (!resp.ok) throw new Error(`Failed to save notebook: ${resp.statusText}`)
}

export async function* streamExecuteCell(
  code: string,
  projectRoot: string,
  timeout = 60
): AsyncGenerator<any> {
  yield* _streamSSE(`${BACKEND}/api/notebooks/execute`, {
    code,
    project_root: projectRoot,
    timeout,
  })
}

// ─── Optimizer ────────────────────────────────────────────────────

export async function fetchOptimizationReport(projectRoot: string): Promise<any> {
  try {
    const resp = await fetch(
      `${BACKEND}/api/optimizer/report?project_root=${encodeURIComponent(projectRoot)}`
    )
    if (!resp.ok) return null
    return resp.json()
  } catch {
    return null
  }
}
