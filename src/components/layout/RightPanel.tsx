import { useState, useRef, useEffect, useCallback, useId } from 'react'
import {
  Send, Bot, ChevronDown, Settings2, Zap, Clock,
  CheckCircle2, Loader2, XCircle, Circle, Cpu,
  DollarSign, Activity, Trash2, ThumbsUp, ThumbsDown,
  ToggleLeft, ToggleRight, Brain
} from 'lucide-react'
import { useIDEStore } from '@/store/ideStore'
import { streamChat, streamAgent, submitReward } from '@/lib/api'
import type { ChatMessage } from '@/store/ideStore'

// ─── Typing indicator ──────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center py-2 px-1">
      {[0, 1, 2].map(i => (
        <div key={i} className="typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  )
}

// ─── Step trace item ───────────────────────────────────────────
function StepItem({ step }: { step: { description: string; status: string } }) {
  const icon = step.status === 'done'
    ? <CheckCircle2 className="w-3.5 h-3.5 text-success" />
    : step.status === 'running'
    ? <Loader2 className="w-3.5 h-3.5 text-warning animate-spin" />
    : step.status === 'error'
    ? <XCircle className="w-3.5 h-3.5 text-error" />
    : <Circle className="w-3.5 h-3.5 text-text-muted" />

  return (
    <div className="step-item">
      <div className={`step-icon ${step.status}`}>{icon}</div>
      <span className={`text-xs ${
        step.status === 'done' ? 'text-text-secondary' :
        step.status === 'running' ? 'text-warning' :
        step.status === 'error' ? 'text-error' :
        'text-text-muted'
      }`}>{step.description}</span>
    </div>
  )
}

// ─── Token Meter ───────────────────────────────────────────────
function TokenMeter() {
  const { tokenStats, selectedModel, agentState } = useIDEStore()
  const pct = Math.min(tokenStats.contextUsedPct, 100)
  const barClass = pct > 85 ? 'critical' : pct > 65 ? 'warning' : ''

  return (
    <div className="border-t border-border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3 h-3 text-accent" />
          <span className="text-xs font-medium text-accent-light truncate max-w-32">
            {selectedModel ?? 'No model'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className={`status-dot ${agentState.status === 'idle' ? 'idle' : agentState.status === 'thinking' ? 'thinking' : 'online'}`} />
          <span className="text-2xs text-text-muted capitalize">{agentState.status}</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-2xs text-text-muted">
          <span>Context Window</span>
          <span>
            {Math.round((pct / 100) * tokenStats.contextWindow / 1000)}K / {Math.round(tokenStats.contextWindow / 1000)}K
          </span>
        </div>
        <div className="token-bar-track">
          <div className={`token-bar-fill ${barClass}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="bg-bg-elevated rounded-md p-2">
          <div className="flex items-center gap-1 mb-0.5">
            <Zap className="w-2.5 h-2.5 text-accent" />
            <span className="text-2xs text-text-muted">Speed</span>
          </div>
          <span className="text-xs font-semibold text-text-primary">
            {tokenStats.tokensPerSec > 0 ? `${tokenStats.tokensPerSec} t/s` : '—'}
          </span>
        </div>
        <div className="bg-bg-elevated rounded-md p-2">
          <div className="flex items-center gap-1 mb-0.5">
            <Clock className="w-2.5 h-2.5 text-accent" />
            <span className="text-2xs text-text-muted">Latency</span>
          </div>
          <span className="text-xs font-semibold text-text-primary">
            {tokenStats.latencyMs > 0 ? `${(tokenStats.latencyMs / 1000).toFixed(1)}s` : '—'}
          </span>
        </div>
        <div className="bg-bg-elevated rounded-md p-2">
          <div className="flex items-center gap-1 mb-0.5">
            <Activity className="w-2.5 h-2.5 text-success" />
            <span className="text-2xs text-text-muted">Tokens</span>
          </div>
          <span className="text-xs font-semibold text-text-primary">
            {tokenStats.totalTokens > 0 ? tokenStats.totalTokens.toLocaleString() : '—'}
          </span>
        </div>
        <div className="bg-bg-elevated rounded-md p-2">
          <div className="flex items-center gap-1 mb-0.5">
            <DollarSign className="w-2.5 h-2.5 text-success" />
            <span className="text-2xs text-text-muted">Cost</span>
          </div>
          <span className="text-xs font-semibold text-success">$0 local</span>
        </div>
      </div>

      {/* Context saved % */}
      {agentState.contextSavedPct > 0 && (
        <div className="flex items-center justify-between bg-success/5 rounded-md px-2 py-1">
          <span className="text-2xs text-text-muted">Context saved</span>
          <span className="text-2xs font-semibold text-success">{agentState.contextSavedPct}%</span>
        </div>
      )}
    </div>
  )
}

// ─── Message bubble with feedback ─────────────────────────────
function MessageBubble({
  msg,
  isLast,
  onFeedback,
}: {
  msg: ChatMessage
  isLast: boolean
  onFeedback: (accepted: boolean) => void
}) {
  const isUser = msg.role === 'user'
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)

  const handleFeedback = (val: 'up' | 'down') => {
    setFeedback(val)
    onFeedback(val === 'up')
  }

  return (
    <div className={`chat-message ${msg.role} mb-3`}>
      {!isUser && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <Bot className="w-3.5 h-3.5 text-accent" />
          <span className="text-2xs text-text-muted font-medium">Neuron</span>
        </div>
      )}
      <div className={`bubble px-3 py-2 text-xs leading-relaxed ${isUser ? 'ml-8' : 'mr-4'}`}>
        <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
      </div>
      <div className={`flex items-center mt-1 gap-1 ${isUser ? 'justify-end mr-1' : 'ml-1'}`}>
        <span className="text-2xs text-text-muted">
          {new Date(msg.timestamp).toLocaleTimeString()}
        </span>
        {!isUser && isLast && msg.content && (
          <div className="flex items-center gap-0.5 ml-1">
            <button
              onClick={() => handleFeedback('up')}
              className={`p-0.5 rounded transition-colors ${feedback === 'up' ? 'text-success' : 'text-text-muted hover:text-success'}`}
              title="Helpful"
            >
              <ThumbsUp className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleFeedback('down')}
              className={`p-0.5 rounded transition-colors ${feedback === 'down' ? 'text-error' : 'text-text-muted hover:text-error'}`}
              title="Not helpful"
            >
              <ThumbsDown className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Agent Cockpit ─────────────────────────────────────────────
export default function RightPanel() {
  const {
    messages, addMessage, updateLastAssistantMessage, clearMessages,
    agentState, setAgentState, tokenStats, setTokenStats,
    availableModels, selectedModel, setSelectedModel,
    isStreaming, setIsStreaming,
    agentMode, setAgentMode,
    rootPath, openTabs, activeTabPath,
    lastTraceId, setLastTraceId,
  } = useIDEStore()

  const [input, setInput] = useState('')
  const [modelOpen, setModelOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputId = useId()

  const activeFile = openTabs.find(t => t.path === activeTabPath)?.path ?? null

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleFeedback = useCallback(async (accepted: boolean) => {
    if (!lastTraceId || !rootPath) return
    try {
      await submitReward(lastTraceId, rootPath, accepted, accepted ? 1.0 : 0.2)
    } catch {}
  }, [lastTraceId, rootPath])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    addMessage(userMsg)

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    addMessage(assistantMsg)

    setIsStreaming(true)
    setAgentState({ status: 'thinking', task: text, steps: [] })

    try {
      const history = [...messages, userMsg].map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }))

      let accumulated = ''

      if (agentMode) {
        // ── Agent mode (LangGraph with tools) ──────────────────────
        for await (const chunk of streamAgent({
          message: text,
          project_root: rootPath,
          active_file: activeFile,
          model: selectedModel === 'auto' ? null : selectedModel,
          conversation_history: history.slice(-6),
        })) {
          if (chunk.type === 'agent_selected') {
            setAgentState({ agentName: chunk.agent, status: 'running' })
          } else if (chunk.type === 'step_start') {
            const currentSteps = useIDEStore.getState().agentState.steps
            setAgentState({
              steps: [...currentSteps, {
                index: chunk.step.index,
                description: chunk.step.description,
                status: 'running',
                tokensUsed: 0,
              }]
            })
          } else if (chunk.type === 'step_done') {
            const currentSteps = useIDEStore.getState().agentState.steps
            setAgentState({
              steps: currentSteps.map(s =>
                s.index === chunk.step.index ? { ...s, status: 'done' } : s
              )
            })
          } else if (chunk.type === 'token' && chunk.content) {
            accumulated += chunk.content
            updateLastAssistantMessage(accumulated)
          } else if (chunk.type === 'done' && chunk.stats) {
            const s = chunk.stats
            setLastTraceId(s.trace_id ?? null)
            setTokenStats({
              totalTokens: s.tokens ?? 0,
              latencyMs: s.elapsed_ms ?? 0,
              contextUsedPct: 100 - (s.context_saved_pct ?? 0),
            })
            setAgentState({
              status: 'done',
              totalTokens: s.tokens ?? 0,
              contextSavedPct: s.context_saved_pct ?? 0,
            })
          } else if (chunk.type === 'error') {
            updateLastAssistantMessage(`⚠️ ${chunk.content}`)
            setAgentState({ status: 'error' })
          }
        }
      } else {
        // ── Direct chat mode ─────────────────────────────────────
        for await (const chunk of streamChat(history, selectedModel)) {
          if (chunk.type === 'token' && chunk.content) {
            accumulated += chunk.content
            updateLastAssistantMessage(accumulated)
          } else if (chunk.type === 'stats' && chunk.stats) {
            const s = chunk.stats
            setTokenStats({
              promptTokens: s.prompt_tokens,
              completionTokens: s.completion_tokens,
              totalTokens: s.total_tokens,
              tokensPerSec: s.tokens_per_sec,
              latencyMs: s.latency_ms,
              contextUsedPct: s.context_used_pct,
              contextWindow: s.context_window ?? 32768,
              costUsd: 0,
            })
          } else if (chunk.type === 'model_selected') {
            if (chunk.model) setSelectedModel(chunk.model)
          } else if (chunk.type === 'error') {
            updateLastAssistantMessage(`⚠️ ${chunk.content}`)
          }
        }
        setAgentState({ status: 'idle' })
      }

      if (agentState.status !== 'error') setAgentState({ status: 'idle' })
    } catch (err) {
      updateLastAssistantMessage('⚠️ Connection error. Is the backend running?')
      setAgentState({ status: 'error' })
    } finally {
      setIsStreaming(false)
    }
  }, [
    input, isStreaming, messages, selectedModel, agentMode,
    rootPath, activeFile, addMessage, updateLastAssistantMessage,
    setIsStreaming, setAgentState, setTokenStats, setSelectedModel,
    setLastTraceId, agentState.status,
  ])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full bg-bg-surface border-l border-border overflow-hidden" style={{ width: 360, minWidth: 320 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-accent/20 flex items-center justify-center">
            {agentMode ? <Brain className="w-3.5 h-3.5 text-accent-light" /> : <Bot className="w-3.5 h-3.5 text-accent-light" />}
          </div>
          <div>
            <p className="text-xs font-semibold text-text-primary">{agentState.agentName}</p>
            <p className="text-2xs text-text-muted capitalize">{agentState.status}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Agent mode toggle */}
          <button
            onClick={() => setAgentMode(!agentMode)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs transition-colors"
            title={agentMode ? 'Switch to direct chat' : 'Switch to agent mode'}
          >
            {agentMode
              ? <ToggleRight className="w-4 h-4 text-accent-light" />
              : <ToggleLeft className="w-4 h-4 text-text-muted" />
            }
            <span className={agentMode ? 'text-accent-light' : 'text-text-muted'}>
              {agentMode ? 'Agent' : 'Chat'}
            </span>
          </button>
          <button
            onClick={clearMessages}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            title="Clear chat"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors">
            <Settings2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Agent task strip */}
      {agentState.task && (
        <div className="px-3 py-2 bg-accent/5 border-b border-accent/10 flex-shrink-0">
          <p className="text-2xs text-text-muted mb-0.5">Task</p>
          <p className="text-xs text-accent-light truncate">{agentState.task}</p>
        </div>
      )}

      {/* Steps trace */}
      {agentState.steps.length > 0 && (
        <div className="px-3 py-2 border-b border-border flex-shrink-0 max-h-28 overflow-y-auto">
          {agentState.steps.map((step, i) => (
            <StepItem key={i} step={step} />
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary mb-1">
                {agentMode ? 'Agent ready' : 'Chat ready'}
              </p>
              <p className="text-2xs text-text-muted max-w-48">
                {agentMode
                  ? 'The agent reads your files, memory, and experiments before responding.'
                  : 'Direct chat with the local model. No project context.'
                }
              </p>
            </div>
            <div className="space-y-1.5 w-full max-w-52">
              {[
                'Profile this dataset',
                'Explain this model code',
                'What experiments have run?',
                'Optimize model accuracy',
              ].map(s => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="w-full text-left px-2.5 py-1.5 text-xs rounded-md bg-bg-elevated hover:bg-bg-high border border-border transition-colors text-text-muted hover:text-text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isLast={i === messages.length - 1}
                onFeedback={handleFeedback}
              />
            ))}
            {isStreaming && messages[messages.length - 1]?.role === 'assistant' && !messages[messages.length - 1]?.content && (
              <TypingIndicator />
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Token meter */}
      <TokenMeter />

      {/* Model picker */}
      {availableModels.length > 0 && (
        <div className="px-3 pb-2 flex-shrink-0 relative">
          <button
            onClick={() => setModelOpen(o => !o)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-bg-elevated border border-border hover:border-accent/40 text-xs text-text-secondary transition-colors"
          >
            <span className="truncate">{selectedModel ?? 'Auto-select model'}</span>
            <ChevronDown className="w-3 h-3 flex-shrink-0 ml-1" />
          </button>
          {modelOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-bg-elevated border border-border rounded-md shadow-panel z-50 overflow-hidden">
              <div className="text-2xs text-text-muted px-2.5 py-1.5 border-b border-border">
                Local Ollama Models
              </div>
              <div className="py-1 max-h-40 overflow-y-auto">
                <button
                  onClick={() => { setSelectedModel('auto'); setModelOpen(false) }}
                  className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-bg-high text-text-muted hover:text-text-primary transition-colors"
                >
                  🔀 Auto-route
                </button>
                {availableModels.map(m => (
                  <button
                    key={m}
                    onClick={() => { setSelectedModel(m); setModelOpen(false) }}
                    className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-bg-high transition-colors ${
                      selectedModel === m ? 'text-accent-light' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {selectedModel === m ? '✓ ' : ''}{m}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 flex-shrink-0">
        <div className="flex gap-2 items-end bg-bg-elevated border border-border rounded-xl px-3 py-2 focus-within:border-accent/40 transition-colors">
          <textarea
            id={inputId}
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={agentMode ? 'Ask the agent…' : 'Chat with model…'}
            rows={1}
            className="flex-1 bg-transparent text-xs text-text-primary placeholder-text-muted resize-none outline-none leading-relaxed max-h-28"
            style={{ scrollbarWidth: 'none' }}
            disabled={isStreaming}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="w-7 h-7 rounded-lg bg-accent hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all flex-shrink-0 glow-accent"
          >
            {isStreaming
              ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
              : <Send className="w-3.5 h-3.5 text-white" />
            }
          </button>
        </div>
        <p className="text-2xs text-text-muted mt-1.5 text-center">
          Enter to send · Shift+Enter for newline · 100% local
        </p>
      </div>
    </div>
  )
}
