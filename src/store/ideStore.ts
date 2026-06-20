import { create } from 'zustand'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  traceId?: string
}

export interface FileTab {
  path: string
  name: string
  content: string
  language: string
  isDirty: boolean
}

export interface TokenStats {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  tokensPerSec: number
  latencyMs: number
  contextUsedPct: number
  contextWindow: number
  costUsd: number
}

export interface AgentStep {
  index: number
  description: string
  status: 'pending' | 'running' | 'done' | 'error'
  tokensUsed: number
}

export interface AgentState {
  agentName: string
  task: string
  status: 'idle' | 'thinking' | 'running' | 'done' | 'error'
  steps: AgentStep[]
  confidence: number
  totalTokens: number
  contextSavedPct: number
}

export interface HealthInfo {
  status: string
  pythonVersion: string
  ollamaRunning: boolean
  ollamaModels: string[]
  cudaAvailable: boolean
  cudaVersion: string | null
  diskFreeGb: number
  issues: string[]
}

export interface NotebookCell {
  id: string
  cell_type: 'code' | 'markdown' | 'raw'
  source: string
  outputs: { type: string; text: string }[]
  execution_count: number | null
  isRunning?: boolean
  runOutput?: string
  runError?: string
}

export interface NotebookState {
  cells: NotebookCell[]
  metadata: Record<string, any>
  nbformat: number
  isDirty: boolean
}

export interface IDEStore {
  // Project
  rootPath: string
  setRootPath: (path: string) => void

  // Tabs
  openTabs: FileTab[]
  activeTabPath: string | null
  openFile: (tab: FileTab) => void
  closeTab: (path: string) => void
  setActiveTab: (path: string) => void
  updateTabContent: (path: string, content: string) => void
  markTabClean: (path: string) => void

  // Chat
  messages: ChatMessage[]
  addMessage: (msg: ChatMessage) => void
  updateLastAssistantMessage: (content: string) => void
  clearMessages: () => void

  // Agent mode (agent LangGraph vs direct chat)
  agentMode: boolean
  setAgentMode: (v: boolean) => void
  lastTraceId: string | null
  setLastTraceId: (id: string | null) => void

  // Agent
  agentState: AgentState
  setAgentState: (state: Partial<AgentState>) => void

  // Token Stats
  tokenStats: TokenStats
  setTokenStats: (stats: Partial<TokenStats>) => void

  // Models
  availableModels: string[]
  selectedModel: string | null
  setAvailableModels: (models: string[]) => void
  setSelectedModel: (model: string) => void

  // Health
  health: HealthInfo | null
  setHealth: (h: HealthInfo) => void

  // Notebooks
  notebooks: Record<string, NotebookState>   // keyed by file path
  setNotebook: (path: string, nb: NotebookState) => void
  updateNotebookCell: (path: string, cellId: string, update: Partial<NotebookCell>) => void
  markNotebookDirty: (path: string) => void

  // UI state
  leftPanelWidth: number
  rightPanelWidth: number
  isStreaming: boolean
  setIsStreaming: (v: boolean) => void
}

const defaultAgent: AgentState = {
  agentName: 'Code Agent',
  task: '',
  status: 'idle',
  steps: [],
  confidence: 0,
  totalTokens: 0,
  contextSavedPct: 0,
}

const defaultTokenStats: TokenStats = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  tokensPerSec: 0,
  latencyMs: 0,
  contextUsedPct: 0,
  contextWindow: 32768,
  costUsd: 0,
}

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    py: 'python', ts: 'typescript', tsx: 'typescript', js: 'javascript',
    jsx: 'javascript', json: 'json', md: 'markdown', yaml: 'yaml',
    yml: 'yaml', sh: 'shell', bash: 'shell', html: 'html', css: 'css',
    sql: 'sql', rs: 'rust', go: 'go', csv: 'plaintext', txt: 'plaintext',
    ipynb: 'json', toml: 'toml', ini: 'ini', env: 'plaintext',
  }
  return map[ext] ?? 'plaintext'
}

export const useIDEStore = create<IDEStore>((set, get) => ({
  rootPath: '',
  setRootPath: (path) => set({ rootPath: path }),

  openTabs: [],
  activeTabPath: null,
  openFile: (tab) => {
    const existing = get().openTabs.find(t => t.path === tab.path)
    if (existing) {
      set({ activeTabPath: tab.path })
      return
    }
    set(state => ({
      openTabs: [...state.openTabs, { ...tab, language: getLanguage(tab.name) }],
      activeTabPath: tab.path,
    }))
  },
  closeTab: (path) => {
    const tabs = get().openTabs.filter(t => t.path !== path)
    const active = get().activeTabPath === path
      ? (tabs.length > 0 ? tabs[tabs.length - 1].path : null)
      : get().activeTabPath
    set({ openTabs: tabs, activeTabPath: active })
  },
  setActiveTab: (path) => set({ activeTabPath: path }),
  updateTabContent: (path, content) => {
    set(state => ({
      openTabs: state.openTabs.map(t =>
        t.path === path ? { ...t, content, isDirty: true } : t
      ),
    }))
  },
  markTabClean: (path) => {
    set(state => ({
      openTabs: state.openTabs.map(t =>
        t.path === path ? { ...t, isDirty: false } : t
      ),
    }))
  },

  messages: [],
  addMessage: (msg) => set(state => ({ messages: [...state.messages, msg] })),
  updateLastAssistantMessage: (content) => {
    set(state => {
      const msgs = [...state.messages]
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          msgs[i] = { ...msgs[i], content }
          return { messages: msgs }
        }
      }
      return state
    })
  },
  clearMessages: () => set({ messages: [] }),

  agentMode: true,
  setAgentMode: (v) => set({ agentMode: v }),
  lastTraceId: null,
  setLastTraceId: (id) => set({ lastTraceId: id }),

  agentState: defaultAgent,
  setAgentState: (partial) => set(state => {
    // If partial.steps is provided alongside other keys, merge fully.
    // This also handles function-style updates when called internally.
    const merged = { ...state.agentState, ...partial }
    return { agentState: merged }
  }),

  tokenStats: defaultTokenStats,
  setTokenStats: (partial) => set(state => ({
    tokenStats: { ...state.tokenStats, ...partial }
  })),

  availableModels: [],
  selectedModel: null,
  setAvailableModels: (models) => set({ availableModels: models }),
  setSelectedModel: (model) => set({ selectedModel: model }),

  health: null,
  setHealth: (h) => set({ health: h }),

  notebooks: {},
  setNotebook: (path, nb) => set(state => ({
    notebooks: { ...state.notebooks, [path]: nb },
  })),
  updateNotebookCell: (path, cellId, update) => set(state => {
    const nb = state.notebooks[path]
    if (!nb) return state
    return {
      notebooks: {
        ...state.notebooks,
        [path]: {
          ...nb,
          isDirty: true,
          cells: nb.cells.map(c => c.id === cellId ? { ...c, ...update } : c),
        },
      },
    }
  }),
  markNotebookDirty: (path) => set(state => {
    const nb = state.notebooks[path]
    if (!nb) return state
    return { notebooks: { ...state.notebooks, [path]: { ...nb, isDirty: true } } }
  }),

  leftPanelWidth: 260,
  rightPanelWidth: 360,
  isStreaming: false,
  setIsStreaming: (v) => set({ isStreaming: v }),
}))
