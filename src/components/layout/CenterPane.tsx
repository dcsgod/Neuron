import { useCallback, useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { X, Circle, FileCode, FileText, Database, BookOpen } from 'lucide-react'
import { useIDEStore } from '@/store/ideStore'
import { saveFileContent } from '@/lib/api'
import NotebookEditor from '@/components/notebook/NotebookEditor'

// ─── Tab icon ──────────────────────────────────────────────────
function TabIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'ipynb') return <BookOpen className="w-3 h-3 text-orange-400 flex-shrink-0" />
  if (['py', 'ts', 'tsx', 'js', 'jsx', 'rs'].includes(ext))
    return <FileCode className="w-3 h-3 text-accent-light flex-shrink-0" />
  if (['csv', 'parquet', 'json'].includes(ext))
    return <Database className="w-3 h-3 text-green-400 flex-shrink-0" />
  return <FileText className="w-3 h-3 text-slate-400 flex-shrink-0" />
}

// ─── Tab Bar ───────────────────────────────────────────────────
function TabBar() {
  const { openTabs, activeTabPath, setActiveTab, closeTab, notebooks } = useIDEStore()

  if (openTabs.length === 0) return null

  return (
    <div
      className="flex items-end overflow-x-auto bg-bg-elevated border-b border-border flex-shrink-0"
      style={{ scrollbarWidth: 'none' }}
    >
      {openTabs.map(tab => {
        const isNb = tab.name.endsWith('.ipynb')
        const nbDirty = isNb ? (notebooks[tab.path]?.isDirty ?? false) : false
        const dirty = tab.isDirty || nbDirty

        return (
          <div
            key={tab.path}
            className={`tab-item group ${activeTabPath === tab.path ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.path)}
          >
            <TabIcon name={tab.name} />
            <span className="max-w-32 truncate">{tab.name}</span>
            {dirty && (
              <Circle className="w-2 h-2 text-accent fill-accent flex-shrink-0" />
            )}
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.path) }}
              className="opacity-0 group-hover:opacity-100 hover:text-error transition-all ml-1 flex-shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ─── Center Pane ───────────────────────────────────────────────
export default function CenterPane() {
  const { openTabs, activeTabPath, updateTabContent, markTabClean } = useIDEStore()
  const activeTab = openTabs.find(t => t.path === activeTabPath)
  const editorRef = useRef<any>(null)

  const isNotebook = activeTab?.name.endsWith('.ipynb') ?? false

  // Ctrl+S to save (for non-notebook files)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (!activeTab || isNotebook) return
        if (!activeTab.isDirty) return
        try {
          await saveFileContent(activeTab.path, activeTab.content)
          markTabClean(activeTab.path)
        } catch (err) {
          console.error('Save failed:', err)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, isNotebook, markTabClean])

  const handleEditorMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor

    monaco.editor.defineTheme('neuron-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '4a5568', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'a78bfa' },
        { token: 'string', foreground: '6ee7b7' },
        { token: 'number', foreground: 'fcd34d' },
        { token: 'type', foreground: '93c5fd' },
        { token: 'function', foreground: 'c4b5fd' },
        { token: 'variable', foreground: 'e2e8f0' },
        { token: 'class', foreground: '67e8f9' },
        { token: 'decorator', foreground: 'f9a8d4' },
      ],
      colors: {
        'editor.background': '#0a0a0f',
        'editor.foreground': '#e2e8f0',
        'editor.lineHighlightBackground': '#12121a',
        'editor.selectionBackground': '#7c3aed40',
        'editor.inactiveSelectionBackground': '#7c3aed20',
        'editorCursor.foreground': '#a78bfa',
        'editorLineNumber.foreground': '#2a2a3d',
        'editorLineNumber.activeForeground': '#64748b',
        'editorGutter.background': '#0a0a0f',
        'editorWidget.background': '#12121a',
        'editorWidget.border': '#2a2a3d',
        'editorSuggestWidget.background': '#12121a',
        'editorSuggestWidget.border': '#2a2a3d',
        'editorSuggestWidget.selectedBackground': '#1e1e2e',
        'scrollbarSlider.background': '#2a2a3d80',
        'scrollbarSlider.hoverBackground': '#3a3a5580',
        'minimap.background': '#0a0a0f',
      },
    })
    monaco.editor.setTheme('neuron-dark')
  }, [])

  return (
    <div className="flex flex-col h-full bg-bg-base overflow-hidden">
      <TabBar />

      {activeTab ? (
        isNotebook ? (
          <NotebookEditor filePath={activeTab.path} />
        ) : (
          <div className="flex-1 overflow-hidden">
            <Editor
              key={activeTab.path}
              value={activeTab.content}
              language={activeTab.language}
              onMount={handleEditorMount}
              onChange={(value) => {
                if (value !== undefined) updateTabContent(activeTab.path, value)
              }}
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontLigatures: true,
                lineHeight: 22,
                padding: { top: 16, bottom: 16 },
                minimap: { enabled: true, scale: 1 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                renderLineHighlight: 'line',
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true },
                wordWrap: 'off',
                tabSize: 2,
                insertSpaces: true,
                formatOnPaste: true,
                automaticLayout: true,
                scrollbar: {
                  verticalScrollbarSize: 5,
                  horizontalScrollbarSize: 5,
                },
              }}
            />
          </div>
        )
      ) : (
        // Welcome screen
        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-8">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center glow-accent">
              <span className="text-3xl">⚡</span>
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">Neuron IDE</h2>
            <p className="text-sm text-text-muted max-w-xs">
              Open a project folder and select a file to start editing.
              Your AI agent is ready to help.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-text-muted">
            <kbd className="px-2 py-1 bg-bg-elevated rounded border border-border">Ctrl+S</kbd>
            <span className="flex items-center">Save file</span>
            <kbd className="px-2 py-1 bg-bg-elevated rounded border border-border">Ctrl+P</kbd>
            <span className="flex items-center">Command palette</span>
          </div>
        </div>
      )}
    </div>
  )
}
