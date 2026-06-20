import { useState, useEffect } from 'react'
import {
  Stethoscope, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, Cpu, HardDrive, Package, Zap, Server
} from 'lucide-react'
import { fetchFullHealth } from '@/lib/api'

interface PackageInfo {
  name: string
  module: string
  version: string | null
  installed: boolean
}

interface GpuInfo {
  name: string
  memory_total_mb: number
  memory_used_mb: number
  memory_free_mb: number
  utilization_pct: number
}

interface FullHealth {
  status: string
  python_version: string
  ollama_running: boolean
  ollama_models: string[]
  cuda_available: boolean
  cuda_version: string | null
  disk_free_gb: number
  issues: string[]
  packages: PackageInfo[]
  gpu_info: { gpus: GpuInfo[] }
  mlflow_running: boolean
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded-full ${
      ok ? 'bg-success/15 text-success' : 'bg-error/15 text-error'
    }`}>
      {ok ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
      {label}
    </span>
  )
}

function SectionHeader({ icon: Icon, label }: { icon: React.ComponentType<any>; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon className="w-3.5 h-3.5 text-accent" />
      <span className="text-xs font-semibold text-text-primary">{label}</span>
    </div>
  )
}

export default function EnvironmentPanel() {
  const [health, setHealth] = useState<FullHealth | null>(null)
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const data = await fetchFullHealth()
      setHealth(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-green-400" />
          <span className="text-xs font-semibold text-text-primary">Environment Doctor</span>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!health ? (
        <div className="flex items-center justify-center flex-1 text-text-muted text-xs">
          {loading ? 'Checking environment…' : 'Click refresh to run checks'}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">

          {/* Overall status */}
          <div className={`rounded-lg p-3 border ${
            health.status === 'ok'
              ? 'border-success/30 bg-success/5'
              : 'border-warning/30 bg-warning/5'
          }`}>
            <div className="flex items-center gap-2">
              {health.status === 'ok'
                ? <CheckCircle2 className="w-4 h-4 text-success" />
                : <AlertTriangle className="w-4 h-4 text-warning" />
              }
              <span className="text-xs font-semibold text-text-primary">
                {health.status === 'ok' ? 'Environment healthy' : `${health.issues.length} issue${health.issues.length > 1 ? 's' : ''} found`}
              </span>
            </div>
            {health.issues.length > 0 && (
              <ul className="mt-2 space-y-1">
                {health.issues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-2xs text-warning">
                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    {issue}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* System */}
          <div>
            <SectionHeader icon={Cpu} label="System" />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between bg-bg-elevated rounded-md px-2.5 py-1.5">
                <span className="text-xs text-text-secondary">Python</span>
                <span className="text-xs text-text-primary font-mono">{health.python_version}</span>
              </div>
              <div className="flex items-center justify-between bg-bg-elevated rounded-md px-2.5 py-1.5">
                <span className="text-xs text-text-secondary">Ollama</span>
                <StatusBadge ok={health.ollama_running} label={health.ollama_running ? `${health.ollama_models.length} models` : 'Offline'} />
              </div>
              <div className="flex items-center justify-between bg-bg-elevated rounded-md px-2.5 py-1.5">
                <span className="text-xs text-text-secondary">CUDA</span>
                <StatusBadge ok={health.cuda_available} label={health.cuda_available ? health.cuda_version ?? 'Available' : 'Not found'} />
              </div>
              <div className="flex items-center justify-between bg-bg-elevated rounded-md px-2.5 py-1.5">
                <span className="text-xs text-text-secondary">MLflow</span>
                <StatusBadge ok={health.mlflow_running} label={health.mlflow_running ? 'Running' : 'Stopped'} />
              </div>
            </div>
          </div>

          {/* Disk */}
          <div>
            <SectionHeader icon={HardDrive} label="Storage" />
            <div className="bg-bg-elevated rounded-md p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-text-secondary">Free disk space</span>
                <span className={`text-xs font-semibold ${health.disk_free_gb < 5 ? 'text-error' : health.disk_free_gb < 20 ? 'text-warning' : 'text-success'}`}>
                  {health.disk_free_gb} GB
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-bg-high overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    health.disk_free_gb < 5 ? 'bg-error' : health.disk_free_gb < 20 ? 'bg-warning' : 'bg-success'
                  }`}
                  style={{ width: `${Math.min((health.disk_free_gb / 100) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* GPU */}
          {health.gpu_info.gpus.length > 0 && (
            <div>
              <SectionHeader icon={Zap} label="GPU" />
              {health.gpu_info.gpus.map((gpu, i) => {
                const usedPct = Math.round((gpu.memory_used_mb / gpu.memory_total_mb) * 100)
                return (
                  <div key={i} className="bg-bg-elevated rounded-md p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-text-primary truncate max-w-36">{gpu.name}</span>
                      <span className={`text-xs ${gpu.utilization_pct > 80 ? 'text-warning' : 'text-success'}`}>
                        {gpu.utilization_pct}% util
                      </span>
                    </div>
                    <div>
                      <div className="flex justify-between text-2xs text-text-muted mb-1">
                        <span>VRAM</span>
                        <span>{gpu.memory_used_mb} / {gpu.memory_total_mb} MB</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-bg-high overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${usedPct > 85 ? 'bg-error' : usedPct > 65 ? 'bg-warning' : 'bg-accent'}`}
                          style={{ width: `${usedPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Ollama models */}
          {health.ollama_models.length > 0 && (
            <div>
              <SectionHeader icon={Server} label="Local Models" />
              <div className="space-y-1">
                {health.ollama_models.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 bg-bg-elevated rounded-md px-2.5 py-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" />
                    <span className="text-xs text-text-secondary font-mono truncate">{m}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Packages */}
          {health.packages && health.packages.length > 0 && (
            <div>
              <SectionHeader icon={Package} label="ML Packages" />
              <div className="space-y-1">
                {health.packages.map(pkg => (
                  <div key={pkg.module} className="flex items-center justify-between bg-bg-elevated rounded-md px-2.5 py-1.5">
                    <span className="text-xs text-text-secondary">{pkg.name}</span>
                    {pkg.installed
                      ? <span className="text-2xs text-success font-mono">{pkg.version}</span>
                      : <span className="text-2xs text-error">not installed</span>
                    }
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
