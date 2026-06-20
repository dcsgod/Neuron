import { useState, useCallback, useEffect } from 'react'
import { Brain, BookOpen, FlaskConical, Database, ChevronRight,
  ChevronDown, RefreshCw, Edit3, Check, X, Layers } from 'lucide-react'
import { useIDEStore } from '@/store/ideStore'

const BACKEND = 'http://127.0.0.1:8000'

interface MemoryFile {
  name: string
  content: string
}

interface IndexStats {
  total_chunks: number
  status: string
}

// File icon for memory files
function memIcon(name: string) {
  if (name.includes('experiment')) return <FlaskConical className="w-3 h-3 text-purple-400" />
  if (name.includes('dataset')) return <Database className="w-3 h-3 text-green-400" />
  if (name.includes('model')) return <Layers className="w-3 h-3 text-blue-400" />
  return <BookOpen className="w-3 h-3 text-accent-light" />
}

// Editable memory card
function MemoryCard({ name, content, onSave }: {
  name: string
  content: string
  onSave: (name: string, value: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(content)

  const displayContent = content.length > 120 && !expanded
    ? content.slice(0, 120) + '…'
    : content

  const isJson = name.endsWith('.json')

  return (
    <div className="border border-border rounded-lg overflow-hidden mb-2 bg-bg-elevated">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-high transition-colors"
      >
        {memIcon(name)}
        <span className="text-xs font-medium text-text-secondary flex-1 text-left truncate">{name}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); setEditing(true); setExpanded(true) }}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-accent transition-colors"
          >
            <Edit3 className="w-3 h-3" />
          </button>
          {expanded ? <ChevronDown className="w-3 h-3 text-text-muted" />
                     : <ChevronRight className="w-3 h-3 text-text-muted" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {editing ? (
            <div className="p-2">
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="w-full bg-bg-base text-xs text-text-primary font-mono p-2 rounded border border-border
                           resize-none outline-none focus:border-accent/40 transition-colors"
                rows={8}
              />
              <div className="flex gap-2 mt-1.5">
                <button
                  onClick={() => { onSave(name, draft); setEditing(false) }}
                  className="flex items-center gap-1 px-2 py-1 text-2xs bg-success/20 text-success rounded hover:bg-success/30 transition-colors"
                >
                  <Check className="w-3 h-3" /> Save
                </button>
                <button
                  onClick={() => { setDraft(content); setEditing(false) }}
                  className="flex items-center gap-1 px-2 py-1 text-2xs bg-error/20 text-error rounded hover:bg-error/30 transition-colors"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="px-3 py-2">
              <pre className="text-2xs text-text-muted whitespace-pre-wrap font-mono leading-relaxed">
                {displayContent || '(empty)'}
              </pre>
              {!expanded && content.length > 120 && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-2xs text-accent hover:underline mt-1"
                >
                  Show more
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function MemoryPanel() {
  const { rootPath } = useIDEStore()
  const [memory, setMemory] = useState<Record<string, string>>({})
  const [indexStats, setIndexStats] = useState<IndexStats | null>(null)
  const [indexing, setIndexing] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadMemory = useCallback(async () => {
    if (!rootPath) return
    setLoading(true)
    try {
      const [memResp, statsResp] = await Promise.all([
        fetch(`${BACKEND}/api/context/memory?project_root=${encodeURIComponent(rootPath)}`),
        fetch(`${BACKEND}/api/context/index/stats?project_root=${encodeURIComponent(rootPath)}`),
      ])
      if (memResp.ok) {
        const data = await memResp.json()
        setMemory(data.memory ?? {})
      }
      if (statsResp.ok) {
        setIndexStats(await statsResp.json())
      }
    } catch {}
    setLoading(false)
  }, [rootPath])

  useEffect(() => { loadMemory() }, [loadMemory])

  const saveMemory = useCallback(async (filename: string, content: string) => {
    if (!rootPath) return
    try {
      await fetch(`${BACKEND}/api/context/memory/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_root: rootPath, filename, content }),
      })
      setMemory(m => ({ ...m, [filename]: content }))
    } catch {}
  }, [rootPath])

  const startIndexing = useCallback(async () => {
    if (!rootPath || indexing) return
    setIndexing(true)
    try {
      await fetch(`${BACKEND}/api/context/index?project_root=${encodeURIComponent(rootPath)}`, {
        method: 'POST',
      })
      // Poll for completion
      setTimeout(async () => {
        const resp = await fetch(`${BACKEND}/api/context/index/stats?project_root=${encodeURIComponent(rootPath)}`)
        if (resp.ok) setIndexStats(await resp.json())
        setIndexing(false)
      }, 5000)
    } catch { setIndexing(false) }
  }, [rootPath, indexing])

  if (!rootPath) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center px-4">
        <p className="text-xs text-text-muted">Open a project to view memory</p>
      </div>
    )
  }

  const memFiles = Object.entries(memory).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs font-semibold text-text-primary">.NEURON MEMORY</span>
        </div>
        <button
          onClick={loadMemory}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Index stats + button */}
      <div className="px-3 py-2 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-2xs text-text-muted">Vector Index</span>
          <div className={`status-dot ${indexStats?.status === 'ready' ? 'online' : 'idle'}`} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 token-bar-track">
            <div
              className="token-bar-fill"
              style={{ width: indexStats ? `${Math.min((indexStats.total_chunks / 500) * 100, 100)}%` : '0%' }}
            />
          </div>
          <span className="text-2xs text-text-muted">
            {indexStats?.total_chunks ?? 0} chunks
          </span>
        </div>
        <button
          onClick={startIndexing}
          disabled={indexing}
          className="w-full mt-2 py-1 text-2xs rounded-md bg-accent/10 hover:bg-accent/20 text-accent-light
                     border border-accent/20 transition-colors disabled:opacity-50"
        >
          {indexing ? '⟳ Indexing...' : '⚡ Index Project'}
        </button>
      </div>

      {/* Memory files */}
      <div className="flex-1 overflow-y-auto p-2">
        {memFiles.length === 0 ? (
          <p className="text-2xs text-text-muted text-center py-4">No memory files yet</p>
        ) : (
          memFiles.map(([name, content]) => (
            <MemoryCard key={name} name={name} content={content} onSave={saveMemory} />
          ))
        )}
      </div>
    </div>
  )
}
