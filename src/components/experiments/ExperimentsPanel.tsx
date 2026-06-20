import { useState, useEffect, useCallback } from 'react'
import {
  FlaskConical, Play, Square, ChevronRight, ChevronDown,
  BarChart3, RefreshCw, GitCompare, Zap, Clock, Trophy
} from 'lucide-react'
import { useIDEStore } from '@/store/ideStore'

const BACKEND = 'http://127.0.0.1:8000'

interface Experiment {
  experiment_id: string
  name: string
  lifecycle_stage: string
}

interface Run {
  run_id: string
  run_name: string
  status: string
  metrics: Record<string, number>
  params: Record<string, string>
  duration_ms: number
}

function MetricBadge({ label, value }: { label: string; value: number }) {
  const pct = Math.min(Math.max(value, 0), 1)
  const color = pct > 0.9 ? 'text-success' : pct > 0.7 ? 'text-accent-light' : 'text-warning'
  return (
    <div className="flex flex-col items-center bg-bg-elevated rounded-md px-2 py-1">
      <span className="text-2xs text-text-muted">{label}</span>
      <span className={`text-xs font-bold ${color}`}>
        {value < 1 ? `${(value * 100).toFixed(1)}%` : value.toFixed(3)}
      </span>
    </div>
  )
}

function RunRow({ run, rank, selected, onSelect }: {
  run: Run; rank: number; selected: boolean; onSelect: () => void
}) {
  const primaryMetric = Object.entries(run.metrics)[0]
  const statusColor = run.status === 'FINISHED' ? 'text-success'
    : run.status === 'RUNNING' ? 'text-warning'
    : 'text-error'

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-3 px-3 py-2.5 border-b border-border cursor-pointer
        transition-colors hover:bg-bg-elevated ${
          selected ? 'bg-accent/10 border-l-2 border-l-accent' : ''
        }`}
    >
      <span className="text-xs font-bold text-text-muted w-5">#{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary truncate">
          {run.run_name || run.run_id.slice(0, 8)}
        </p>
        <p className={`text-2xs ${statusColor}`}>{run.status}</p>
      </div>
      {primaryMetric && (
        <MetricBadge label={primaryMetric[0]} value={primaryMetric[1]} />
      )}
      <div className="flex items-center gap-1 text-2xs text-text-muted">
        <Clock className="w-3 h-3" />
        <span>{Math.round(run.duration_ms / 1000)}s</span>
      </div>
    </div>
  )
}

export default function ExperimentsPanel() {
  const { rootPath } = useIDEStore()
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [selectedExp, setSelectedExp] = useState<string | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [selectedRuns, setSelectedRuns] = useState<Set<string>>(new Set())
  const [mlflowRunning, setMlflowRunning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [comparison, setComparison] = useState<any>(null)

  const checkMlflow = useCallback(async () => {
    if (!rootPath) return
    try {
      const r = await fetch(`${BACKEND}/api/experiments/server/status`)
      if (r.ok) {
        const d = await r.json()
        setMlflowRunning(d.running)
      }
    } catch {}
  }, [rootPath])

  const loadExperiments = useCallback(async () => {
    if (!rootPath) return
    try {
      const r = await fetch(`${BACKEND}/api/experiments/list?project_root=${encodeURIComponent(rootPath)}`)
      if (r.ok) {
        const d = await r.json()
        setExperiments(d.experiments || [])
      }
    } catch {}
  }, [rootPath])

  const loadRuns = useCallback(async (expId: string) => {
    if (!rootPath) return
    setLoading(true)
    try {
      const r = await fetch(
        `${BACKEND}/api/experiments/runs?project_root=${encodeURIComponent(rootPath)}&experiment_id=${expId}`
      )
      if (r.ok) {
        const d = await r.json()
        setRuns(d.runs || [])
      }
    } catch {}
    setLoading(false)
  }, [rootPath])

  const startMlflow = useCallback(async () => {
    if (!rootPath) return
    try {
      await fetch(`${BACKEND}/api/experiments/server/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_root: rootPath, port: 5001 }),
      })
      setTimeout(checkMlflow, 2500)
    } catch {}
  }, [rootPath, checkMlflow])

  const compareSelected = useCallback(async () => {
    if (!rootPath || selectedRuns.size < 2) return
    try {
      const r = await fetch(`${BACKEND}/api/experiments/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_root: rootPath, run_ids: [...selectedRuns] }),
      })
      if (r.ok) setComparison(await r.json())
    } catch {}
  }, [rootPath, selectedRuns])

  useEffect(() => { checkMlflow(); loadExperiments() }, [checkMlflow, loadExperiments])
  useEffect(() => { if (selectedExp) loadRuns(selectedExp) }, [selectedExp, loadRuns])

  const toggleRunSelect = (runId: string) => {
    setSelectedRuns(prev => {
      const next = new Set(prev)
      if (next.has(runId)) next.delete(runId)
      else next.add(runId)
      return next
    })
  }

  if (!rootPath) {
    return (
      <div className="flex items-center justify-center h-48 text-center px-4">
        <p className="text-xs text-text-muted">Open a project to track experiments</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs font-semibold text-text-primary">EXPERIMENTS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`status-dot ${mlflowRunning ? 'online' : 'idle'}`} />
          {!mlflowRunning ? (
            <button onClick={startMlflow}
              className="flex items-center gap-1 px-2 py-0.5 text-2xs rounded bg-accent/20 text-accent-light hover:bg-accent/30 transition-colors">
              <Play className="w-2.5 h-2.5" /> Start MLflow
            </button>
          ) : (
            <a href="http://localhost:5001" target="_blank" rel="noreferrer"
               className="text-2xs text-accent-light hover:underline">Open UI ↗</a>
          )}
          <button onClick={loadExperiments}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Experiments list */}
      <div className="flex-shrink-0 border-b border-border">
        {experiments.length === 0 ? (
          <p className="px-3 py-3 text-xs text-text-muted">No experiments yet. Run some MLflow experiments to see them here.</p>
        ) : (
          experiments.map(exp => (
            <button
              key={exp.experiment_id}
              onClick={() => { setSelectedExp(exp.experiment_id); setComparison(null) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors
                hover:bg-bg-elevated border-b border-border last:border-0
                ${selectedExp === exp.experiment_id ? 'bg-accent/10' : ''}`}
            >
              <FlaskConical className="w-3 h-3 text-purple-400 flex-shrink-0" />
              <span className="text-xs text-text-secondary truncate">{exp.name}</span>
              <ChevronRight className="w-3 h-3 text-text-muted ml-auto flex-shrink-0" />
            </button>
          ))
        )}
      </div>

      {/* Runs */}
      {selectedExp && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-2xs text-text-muted">{runs.length} run{runs.length !== 1 ? 's' : ''}</span>
            {selectedRuns.size >= 2 && (
              <button onClick={compareSelected}
                className="flex items-center gap-1 px-2 py-0.5 text-2xs rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors">
                <GitCompare className="w-2.5 h-2.5" /> Compare ({selectedRuns.size})
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-4 h-4 animate-spin text-accent" />
            </div>
          ) : (
            runs.map((run, i) => (
              <RunRow
                key={run.run_id}
                run={run}
                rank={i + 1}
                selected={selectedRuns.has(run.run_id)}
                onSelect={() => toggleRunSelect(run.run_id)}
              />
            ))
          )}

          {/* Comparison view */}
          {comparison && comparison.diff && (
            <div className="p-3 border-t border-border">
              <p className="text-xs font-semibold text-text-primary mb-2">Run Diff</p>
              {Object.entries(comparison.diff.metrics || {}).map(([k, vals]: any) => (
                <div key={k} className="mb-2">
                  <p className="text-2xs text-text-muted mb-1">{k}</p>
                  <div className="flex gap-2">
                    {vals.map((v: number, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-bg-elevated rounded text-2xs text-text-primary">
                        {typeof v === 'number' ? v.toFixed(4) : v}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {Object.entries(comparison.diff.params || {}).map(([k, vals]: any) => (
                <div key={k} className="mb-2">
                  <p className="text-2xs text-text-muted mb-1">{k}</p>
                  <div className="flex gap-2 flex-wrap">
                    {vals.map((v: any, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-accent/10 border border-accent/20 rounded text-2xs text-accent-light">
                        {String(v)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
