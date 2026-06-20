import { useState, useRef } from 'react'
import { Trophy, Play, Loader2, Target, Database, BarChart3, CheckCircle2, XCircle, Zap } from 'lucide-react'

const BACKEND = 'http://127.0.0.1:8000'

interface ModelResult {
  model: string
  metrics: Record<string, number>
  primary_score: number
  train_time_ms: number
  status: 'success' | 'error'
  rank: number
  error?: string
}

const MEDAL = ['🥇', '🥈', '🥉']

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(score * 100, 100)
  const color = pct > 90 ? '#10b981' : pct > 75 ? '#7c3aed' : '#f59e0b'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 token-bar-track">
        <div className="token-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold" style={{ color }}>{pct.toFixed(1)}%</span>
    </div>
  )
}

export default function ModelArena() {
  const [filePath, setFilePath] = useState('')
  const [targetCol, setTargetCol] = useState('')
  const [taskType, setTaskType] = useState<'classification' | 'regression'>('classification')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ model: string; current: number; total: number } | null>(null)
  const [results, setResults] = useState<ModelResult[]>([])
  const [statusMsg, setStatusMsg] = useState('')
  const [metadata, setMetadata] = useState<any>(null)

  const startArena = async () => {
    if (!filePath || !targetCol) return
    setRunning(true)
    setResults([])
    setProgress(null)
    setStatusMsg('')
    setMetadata(null)

    try {
      const resp = await fetch(`${BACKEND}/api/arena/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath, target_col: targetCol, task_type: taskType }),
      })
      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') break
          try {
            const event = JSON.parse(raw)
            if (event.type === 'status') setStatusMsg(event.message)
            else if (event.type === 'progress') setProgress(event)
            else if (event.type === 'leaderboard') {
              setResults(event.results)
              setMetadata({ task_type: event.task_type, target: event.target, rows: event.rows, features: event.features, winner: event.winner })
            } else if (event.type === 'error') setStatusMsg(`Error: ${event.message}`)
          } catch {}
        }
      }
    } catch (e: any) {
      setStatusMsg(`Connection error: ${e.message}`)
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border flex-shrink-0">
        <Trophy className="w-3.5 h-3.5 text-yellow-400" />
        <span className="text-xs font-semibold text-text-primary">MODEL ARENA</span>
      </div>

      {/* Config */}
      <div className="p-3 border-b border-border flex-shrink-0 space-y-2">
        <div>
          <label className="text-2xs text-text-muted block mb-1">Dataset file path</label>
          <input
            value={filePath}
            onChange={e => setFilePath(e.target.value)}
            placeholder="C:/path/to/data.csv"
            className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-xs text-text-primary
                       outline-none focus:border-accent/40 transition-colors placeholder-text-muted"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-2xs text-text-muted block mb-1">Target column</label>
            <input
              value={targetCol}
              onChange={e => setTargetCol(e.target.value)}
              placeholder="label"
              className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-xs text-text-primary
                         outline-none focus:border-accent/40 transition-colors placeholder-text-muted"
            />
          </div>
          <div className="flex-1">
            <label className="text-2xs text-text-muted block mb-1">Task type</label>
            <select
              value={taskType}
              onChange={e => setTaskType(e.target.value as any)}
              className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-xs text-text-primary
                         outline-none focus:border-accent/40 transition-colors"
            >
              <option value="classification">Classification</option>
              <option value="regression">Regression</option>
            </select>
          </div>
        </div>
        <button
          onClick={startArena}
          disabled={running || !filePath || !targetCol}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-accent hover:bg-accent/80
                     disabled:opacity-40 text-white text-xs font-medium transition-all"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {running ? 'Running Arena...' : 'Start Arena'}
        </button>
      </div>

      {/* Progress */}
      {(running || statusMsg) && (
        <div className="px-3 py-2 border-b border-border flex-shrink-0">
          {progress && (
            <div className="mb-1.5">
              <div className="flex justify-between text-2xs text-text-muted mb-1">
                <span>Testing: {progress.model}</span>
                <span>{progress.current}/{progress.total}</span>
              </div>
              <div className="token-bar-track">
                <div className="token-bar-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
              </div>
            </div>
          )}
          {statusMsg && <p className="text-2xs text-text-muted">{statusMsg}</p>}
        </div>
      )}

      {/* Metadata */}
      {metadata && (
        <div className="flex items-center gap-3 px-3 py-2 bg-accent/5 border-b border-accent/10 flex-shrink-0">
          <div className="flex items-center gap-1">
            <Database className="w-3 h-3 text-accent" />
            <span className="text-2xs text-text-muted">{metadata.rows.toLocaleString()} rows</span>
          </div>
          <div className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3 text-accent" />
            <span className="text-2xs text-text-muted">{metadata.features} features</span>
          </div>
          <div className="flex items-center gap-1">
            <Target className="w-3 h-3 text-accent" />
            <span className="text-2xs text-text-muted">{metadata.target}</span>
          </div>
          {metadata.winner && (
            <span className="ml-auto text-2xs text-yellow-400 font-medium">🏆 {metadata.winner}</span>
          )}
        </div>
      )}

      {/* Leaderboard */}
      <div className="flex-1 overflow-y-auto">
        {results.length === 0 && !running && (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
            <Trophy className="w-6 h-6 text-text-muted opacity-40" />
            <p className="text-xs text-text-muted">Configure a dataset and run the arena</p>
          </div>
        )}
        {results.map((r, i) => (
          <div
            key={r.model}
            className={`px-3 py-3 border-b border-border ${
              i === 0 ? 'bg-yellow-400/5' : ''
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm">{MEDAL[i] ?? `#${r.rank}`}</span>
              <span className="text-xs font-semibold text-text-primary flex-1">{r.model}</span>
              {r.status === 'success'
                ? <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
                : <XCircle className="w-3.5 h-3.5 text-error flex-shrink-0" />
              }
            </div>
            {r.status === 'success' ? (
              <>
                <ScoreBar score={r.primary_score} />
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  {Object.entries(r.metrics).map(([k, v]) => (
                    <span key={k} className="text-2xs text-text-muted">
                      {k}: <span className="text-text-secondary">{typeof v === 'number' ? v.toFixed(4) : v}</span>
                    </span>
                  ))}
                  <span className="text-2xs text-text-muted ml-auto">
                    <Zap className="w-2.5 h-2.5 inline mr-0.5" />{r.train_time_ms}ms
                  </span>
                </div>
              </>
            ) : (
              <p className="text-2xs text-error">{r.error}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
