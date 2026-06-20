import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Cloud, Terminal, CheckCircle2, XCircle, Loader2,
  Send, Trash2, AlertCircle, RefreshCw, ExternalLink
} from 'lucide-react'

const BACKEND = 'http://127.0.0.1:8000'

interface CLI {
  id: string
  name: string
  installed: boolean
  version: string | null
  install_url: string
}

interface Connection {
  connected: boolean
  identity?: string
  account?: string
  version?: string
}

interface TermLine {
  type: 'stdout' | 'stderr' | 'error' | 'start' | 'exit' | 'info'
  line?: string
  command?: string
  code?: number
  id: number
}

let lineId = 0

export default function CloudConsole() {
  const [clis, setClis] = useState<CLI[]>([])
  const [connections, setConnections] = useState<Record<string, Connection>>({})
  const [command, setCommand] = useState('')
  const [lines, setLines] = useState<TermLine[]>([])
  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(false)
  const termRef = useRef<HTMLDivElement>(null)

  const addLine = (line: TermLine) => {
    setLines(prev => [...prev.slice(-500), { ...line, id: lineId++ }])
  }

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const [cliResp, connResp] = await Promise.all([
        fetch(`${BACKEND}/api/cloud/clis`),
        fetch(`${BACKEND}/api/cloud/connections`),
      ])
      if (cliResp.ok) {
        const d = await cliResp.json()
        setClis(d.clis || [])
      }
      if (connResp.ok) {
        setConnections(await connResp.json())
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight
    }
  }, [lines])

  const runCommand = useCallback(async () => {
    const cmd = command.trim()
    if (!cmd || running) return
    setCommand('')
    setRunning(true)
    addLine({ type: 'info', line: `$ ${cmd}`, id: 0 })

    try {
      const resp = await fetch(`${BACKEND}/api/cloud/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      })

      if (!resp.ok) {
        const err = await resp.json()
        addLine({ type: 'error', line: err.detail || 'Command blocked', id: 0 })
        setRunning(false)
        return
      }

      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n')
        buf = parts.pop() ?? ''
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          const raw = part.slice(6).trim()
          if (raw === '[DONE]') break
          try {
            const event = JSON.parse(raw)
            if (event.type !== 'start') addLine({ ...event, id: 0 })
          } catch {}
        }
      }
    } catch (e: any) {
      addLine({ type: 'error', line: `Connection error: ${e.message}`, id: 0 })
    } finally {
      setRunning(false)
    }
  }, [command, running])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); runCommand() }
  }

  const installed = clis.filter(c => c.installed)
  const notInstalled = clis.filter(c => !c.installed)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Cloud className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-semibold text-text-primary">CLOUD CONTROL</span>
        </div>
        <button onClick={loadStatus}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* CLI Status grid */}
      <div className="px-3 py-2 border-b border-border flex-shrink-0">
        <p className="text-2xs text-text-muted mb-2">Installed CLIs</p>
        <div className="grid grid-cols-2 gap-1.5">
          {clis.map(cli => (
            <div
              key={cli.id}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-2xs ${
                cli.installed
                  ? 'bg-success/5 border-success/20 text-success'
                  : 'bg-bg-elevated border-border text-text-muted'
              }`}
            >
              {cli.installed
                ? <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                : <XCircle className="w-3 h-3 flex-shrink-0" />
              }
              <span className="truncate">{cli.name}</span>
              {!cli.installed && (
                <a href={cli.install_url} target="_blank" rel="noreferrer"
                  className="ml-auto flex-shrink-0 text-accent hover:text-accent-light">
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          ))}
        </div>

        {/* Active connections */}
        {Object.entries(connections).length > 0 && (
          <div className="mt-2 space-y-1">
            {Object.entries(connections).map(([service, conn]) => conn.connected && (
              <div key={service} className="flex items-center gap-2">
                <div className="status-dot online" />
                <span className="text-2xs text-text-secondary capitalize">{service}</span>
                <span className="text-2xs text-text-muted truncate">
                  {conn.identity || conn.account || conn.version || 'connected'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Terminal output */}
      <div
        ref={termRef}
        className="flex-1 overflow-y-auto p-3 font-mono bg-bg-base"
        style={{ fontSize: 11 }}
      >
        {lines.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
            <Terminal className="w-6 h-6 text-text-muted" />
            <p className="text-xs text-text-muted">Cloud terminal ready</p>
          </div>
        )}
        {lines.map(line => (
          <div
            key={line.id}
            className={`leading-5 ${
              line.type === 'stderr' || line.type === 'error' ? 'text-error/80'
              : line.type === 'info' ? 'text-accent-light'
              : line.type === 'exit' ? (line.code === 0 ? 'text-success/70' : 'text-error/70')
              : 'text-text-muted'
            }`}
          >
            {line.type === 'exit'
              ? `[exit ${line.code}]`
              : line.line || ''}
          </div>
        ))}
      </div>

      {/* Command input */}
      <div className="px-3 pb-3 pt-2 border-t border-border flex-shrink-0">
        <div className="flex gap-2 items-center bg-bg-elevated border border-border rounded-lg px-3 py-2
                        focus-within:border-accent/40 transition-colors">
          <span className="text-accent-light font-mono text-xs flex-shrink-0">$</span>
          <input
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="databricks workspace list | aws s3 ls | docker ps"
            className="flex-1 bg-transparent text-xs text-text-primary font-mono outline-none placeholder-text-muted"
            disabled={running}
          />
          {running
            ? <Loader2 className="w-4 h-4 text-accent animate-spin flex-shrink-0" />
            : <button onClick={runCommand} disabled={!command.trim()}
                className="text-text-muted hover:text-accent disabled:opacity-40 transition-colors">
                <Send className="w-3.5 h-3.5" />
              </button>
          }
        </div>
        <div className="flex justify-between mt-1">
          <p className="text-2xs text-text-muted">Allowlist: databricks · az · aws · gcloud · gh · docker · kubectl · git</p>
          <button onClick={() => setLines([])}
            className="text-2xs text-text-muted hover:text-error transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
