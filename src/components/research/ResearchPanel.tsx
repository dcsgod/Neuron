import { useState, useRef, useCallback } from 'react'
import {
  BookOpen, Link2, FileText, Code2, Search,
  Loader2, CheckCircle2, Save, ChevronDown, ChevronUp, Sparkles
} from 'lucide-react'
import { useIDEStore } from '@/store/ideStore'
import { streamResearch } from '@/lib/api'

type Task = 'summarize' | 'extract_algorithm' | 'generate_code'

const TASKS: { id: Task; label: string; icon: React.ComponentType<any>; desc: string }[] = [
  { id: 'summarize',         label: 'Summarize',        icon: Search,    desc: 'Key contribution, method, results' },
  { id: 'extract_algorithm', label: 'Extract Algorithm', icon: Code2,     desc: 'Steps, equations, pseudocode' },
  { id: 'generate_code',     label: 'Generate Code',     icon: FileText,  desc: 'Starter Python implementation' },
]

export default function ResearchPanel() {
  const { rootPath } = useIDEStore()
  const [mode, setMode] = useState<'url' | 'text'>('url')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [task, setTask] = useState<Task>('summarize')
  const [saveToMemory, setSaveToMemory] = useState(true)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('')
  const [result, setResult] = useState('')
  const [saved, setSaved] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const handleRun = useCallback(async () => {
    const input = mode === 'url' ? url.trim() : text.trim()
    if (!input || running) return

    setRunning(true)
    setResult('')
    setSaved(false)
    setStatus('Starting…')
    setCollapsed(false)

    try {
      const payload = {
        url: mode === 'url' ? input : undefined,
        text: mode === 'text' ? input : undefined,
        project_root: rootPath,
        task,
        save_to_memory: saveToMemory && !!rootPath,
      }

      let accumulated = ''
      for await (const chunk of streamResearch(payload)) {
        if (chunk.type === 'status') {
          setStatus(chunk.message ?? '')
        } else if (chunk.type === 'token' && chunk.content) {
          accumulated += chunk.content
          setResult(accumulated)
          setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 0)
        } else if (chunk.type === 'done') {
          setSaved(chunk.saved ?? false)
          setStatus('Done')
        } else if (chunk.type === 'error') {
          setStatus(`Error: ${chunk.message}`)
        }
      }
    } catch (err: any) {
      setStatus(`Failed: ${err.message}`)
    } finally {
      setRunning(false)
    }
  }, [mode, url, text, task, saveToMemory, rootPath, running])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold text-text-primary">Research Mode</span>
        </div>
        <p className="text-2xs text-text-muted mt-0.5">
          Import papers, extract algorithms, generate code
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Input mode toggle */}
        <div className="flex rounded-lg bg-bg-elevated overflow-hidden border border-border">
          {(['url', 'text'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs transition-colors ${
                mode === m ? 'bg-accent/20 text-accent-light' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {m === 'url' ? <Link2 className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
              {m === 'url' ? 'URL' : 'Paste Text'}
            </button>
          ))}
        </div>

        {/* Input */}
        {mode === 'url' ? (
          <div>
            <label className="text-2xs text-text-muted mb-1 block">Paper / Doc URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://arxiv.org/abs/…"
              className="w-full bg-bg-elevated border border-border rounded-md px-2.5 py-1.5 text-xs text-text-primary placeholder-text-muted outline-none focus:border-accent/40 transition-colors"
            />
          </div>
        ) : (
          <div>
            <label className="text-2xs text-text-muted mb-1 block">Paste content</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste abstract, algorithm description, or full text…"
              rows={5}
              className="w-full bg-bg-elevated border border-border rounded-md px-2.5 py-1.5 text-xs text-text-primary placeholder-text-muted outline-none focus:border-accent/40 transition-colors resize-none"
            />
          </div>
        )}

        {/* Task selector */}
        <div>
          <label className="text-2xs text-text-muted mb-1.5 block">What to extract</label>
          <div className="space-y-1">
            {TASKS.map(({ id, label, icon: Icon, desc }) => (
              <button
                key={id}
                onClick={() => setTask(id)}
                className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-md border transition-all text-left ${
                  task === id
                    ? 'border-accent/40 bg-accent/10 text-text-primary'
                    : 'border-border bg-bg-elevated text-text-secondary hover:text-text-primary hover:border-accent/20'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${task === id ? 'text-accent-light' : 'text-text-muted'}`} />
                <div>
                  <div className="text-xs font-medium">{label}</div>
                  <div className="text-2xs text-text-muted">{desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Options */}
        {rootPath && (
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => setSaveToMemory(v => !v)}
              className={`w-8 h-4 rounded-full transition-colors flex items-center px-0.5 ${saveToMemory ? 'bg-accent' : 'bg-bg-high'}`}
            >
              <div className={`w-3 h-3 rounded-full bg-white transition-transform ${saveToMemory ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className="text-xs text-text-secondary">Save insights to project memory</span>
          </label>
        )}

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={running || !(mode === 'url' ? url.trim() : text.trim())}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-accent hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-all glow-accent"
        >
          {running
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing…</>
            : <><Sparkles className="w-3.5 h-3.5" /> Extract Insights</>
          }
        </button>

        {/* Status */}
        {status && (
          <div className={`flex items-center gap-1.5 text-2xs ${status.startsWith('Error') ? 'text-error' : status === 'Done' ? 'text-success' : 'text-text-muted'}`}>
            {status === 'Done'
              ? <CheckCircle2 className="w-3 h-3" />
              : running ? <Loader2 className="w-3 h-3 animate-spin" /> : null
            }
            {status}
            {saved && <span className="text-success ml-1 flex items-center gap-1"><Save className="w-3 h-3" /> Saved to memory</span>}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="rounded-md border border-border overflow-hidden">
            <div
              className="flex items-center justify-between px-2.5 py-1.5 bg-bg-elevated cursor-pointer"
              onClick={() => setCollapsed(c => !c)}
            >
              <span className="text-2xs font-medium text-text-secondary">Result</span>
              {collapsed
                ? <ChevronDown className="w-3 h-3 text-text-muted" />
                : <ChevronUp className="w-3 h-3 text-text-muted" />
              }
            </div>
            {!collapsed && (
              <div className="p-2.5 bg-bg-base max-h-96 overflow-y-auto">
                <pre className="text-xs text-text-secondary whitespace-pre-wrap font-sans leading-relaxed">
                  {result}
                </pre>
                <div ref={resultRef} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
