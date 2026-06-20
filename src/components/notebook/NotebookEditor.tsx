import { useEffect, useCallback, useState } from 'react'
import Editor from '@monaco-editor/react'
import {
  Play, PlayCircle, Loader2, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Trash2, Plus, Hash
} from 'lucide-react'
import { useIDEStore } from '@/store/ideStore'
import { fetchNotebook, saveNotebook, streamExecuteCell } from '@/lib/api'
import type { NotebookCell as NbCell } from '@/store/ideStore'

// ─── Cell output display ────────────────────────────────────────────
function CellOutput({ cell }: { cell: NbCell }) {
  const hasOutput = cell.outputs.length > 0 || cell.runOutput || cell.runError

  if (!hasOutput) return null

  return (
    <div className="border-t border-border/50 mt-1">
      {cell.runError && (
        <div className="px-3 py-2 bg-error/5 border-l-2 border-error">
          <pre className="text-xs text-error font-mono whitespace-pre-wrap">{cell.runError}</pre>
        </div>
      )}
      {cell.runOutput && (
        <div className="px-3 py-2 bg-bg-base">
          <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap">{cell.runOutput}</pre>
        </div>
      )}
      {!cell.runOutput && !cell.runError && cell.outputs.map((out, i) => (
        <div key={i} className="px-3 py-2 bg-bg-base">
          <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap">{out.text}</pre>
        </div>
      ))}
    </div>
  )
}

// ─── Individual cell ────────────────────────────────────────────────
function CellItem({
  cell,
  index,
  onRun,
  onDelete,
  onAddAfter,
  onSourceChange,
}: {
  cell: NbCell
  index: number
  onRun: (cell: NbCell) => void
  onDelete: (cellId: string) => void
  onAddAfter: (index: number) => void
  onSourceChange: (cellId: string, value: string) => void
}) {
  const [editorHeight, setEditorHeight] = useState(60)

  const lineCount = cell.source.split('\n').length
  const targetHeight = Math.min(Math.max(lineCount * 22 + 16, 60), 400)

  if (cell.cell_type === 'markdown') {
    return (
      <div className="group border border-transparent hover:border-border rounded-lg overflow-hidden transition-all">
        <div className="flex items-start gap-2 px-3 py-2">
          <Hash className="w-3 h-3 text-text-muted mt-1 flex-shrink-0" />
          <pre className="text-xs text-text-secondary font-sans whitespace-pre-wrap flex-1 leading-relaxed">{cell.source}</pre>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border overflow-hidden transition-all ${
      cell.isRunning ? 'border-accent/40' : 'border-border hover:border-accent/20'
    }`}>
      {/* Cell toolbar */}
      <div className="flex items-center justify-between px-2 py-1 bg-bg-elevated border-b border-border/50">
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-text-muted font-mono min-w-8 text-right">
            [{cell.execution_count ?? ' '}]
          </span>
          <span className="text-2xs text-text-muted">In [{index + 1}]</span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onAddAfter(index)}
            className="p-1 rounded hover:bg-bg-high text-text-muted hover:text-text-primary transition-colors"
            title="Add cell below"
          >
            <Plus className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDelete(cell.id)}
            className="p-1 rounded hover:bg-error/10 text-text-muted hover:text-error transition-colors"
            title="Delete cell"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => onRun(cell)}
            disabled={cell.isRunning}
            className="p-1 rounded bg-accent/20 hover:bg-accent/30 text-accent-light disabled:opacity-50 transition-colors"
            title="Run cell"
          >
            {cell.isRunning
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Play className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      </div>

      {/* Code editor */}
      <div className="group" style={{ height: targetHeight }}>
        <Editor
          key={cell.id}
          value={cell.source}
          language="python"
          theme="neuron-dark"
          onChange={v => onSourceChange(cell.id, v ?? '')}
          options={{
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            lineNumbers: 'off',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 0,
            glyphMargin: false,
            folding: false,
            padding: { top: 8, bottom: 8 },
            automaticLayout: true,
            scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            renderLineHighlight: 'none',
          }}
        />
      </div>

      {/* Output */}
      <CellOutput cell={cell} />
    </div>
  )
}

// ─── Main Notebook Editor ───────────────────────────────────────────
export default function NotebookEditor({ filePath }: { filePath: string }) {
  const { notebooks, setNotebook, updateNotebookCell, rootPath, markTabClean } = useIDEStore()
  const nb = notebooks[filePath]
  const [saving, setSaving] = useState(false)
  const [runningAll, setRunningAll] = useState(false)

  // Load notebook on mount
  useEffect(() => {
    if (nb) return
    fetchNotebook(filePath).then(data => {
      setNotebook(filePath, {
        cells: data.cells,
        metadata: data.metadata,
        nbformat: data.nbformat,
        isDirty: false,
      })
    }).catch(err => console.error('Failed to load notebook:', err))
  }, [filePath, nb, setNotebook])

  const runCell = useCallback(async (cell: NbCell) => {
    updateNotebookCell(filePath, cell.id, { isRunning: true, runOutput: '', runError: '' })
    let output = ''
    let error = ''
    try {
      for await (const chunk of streamExecuteCell(cell.source, rootPath)) {
        if (chunk.type === 'output') output += chunk.text
        else if (chunk.type === 'stderr') error += chunk.text
        else if (chunk.type === 'error') error += chunk.text
      }
    } catch (e: any) {
      error = e.message
    }
    updateNotebookCell(filePath, cell.id, {
      isRunning: false,
      runOutput: output,
      runError: error,
      execution_count: (cell.execution_count ?? 0) + 1,
    })
  }, [filePath, rootPath, updateNotebookCell])

  const runAll = useCallback(async () => {
    if (!nb || runningAll) return
    setRunningAll(true)
    for (const cell of nb.cells) {
      if (cell.cell_type === 'code') await runCell(cell)
    }
    setRunningAll(false)
  }, [nb, runningAll, runCell])

  const handleSave = useCallback(async () => {
    if (!nb) return
    setSaving(true)
    try {
      const notebookData = {
        nbformat: nb.nbformat,
        nbformat_minor: 5,
        metadata: nb.metadata,
        cells: nb.cells.map(c => ({
          cell_type: c.cell_type,
          id: c.id,
          metadata: {},
          source: c.source.split('\n').map((l, i, arr) => l + (i < arr.length - 1 ? '\n' : '')),
          outputs: c.outputs,
          execution_count: c.execution_count,
        })),
      }
      await saveNotebook(filePath, notebookData)
      markTabClean(filePath)
    } finally {
      setSaving(false)
    }
  }, [nb, filePath, markTabClean])

  const handleSourceChange = useCallback((cellId: string, value: string) => {
    updateNotebookCell(filePath, cellId, { source: value })
  }, [filePath, updateNotebookCell])

  const handleDelete = useCallback((cellId: string) => {
    if (!nb) return
    setNotebook(filePath, { ...nb, isDirty: true, cells: nb.cells.filter(c => c.id !== cellId) })
  }, [nb, filePath, setNotebook])

  const handleAddAfter = useCallback((index: number) => {
    if (!nb) return
    const newCell: NbCell = {
      id: `cell-${Date.now()}`,
      cell_type: 'code',
      source: '',
      outputs: [],
      execution_count: null,
    }
    const cells = [...nb.cells]
    cells.splice(index + 1, 0, newCell)
    setNotebook(filePath, { ...nb, isDirty: true, cells })
  }, [nb, filePath, setNotebook])

  if (!nb) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-xs">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading notebook…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-base">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-elevated flex-shrink-0">
        <button
          onClick={runAll}
          disabled={runningAll}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent/20 hover:bg-accent/30 text-accent-light text-xs font-medium disabled:opacity-50 transition-colors"
        >
          {runningAll
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Running…</>
            : <><PlayCircle className="w-3 h-3" /> Run All</>
          }
        </button>
        <button
          onClick={() => handleAddAfter(nb.cells.length - 1)}
          className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-bg-high text-text-muted hover:text-text-primary text-xs transition-colors"
        >
          <Plus className="w-3 h-3" /> Add Cell
        </button>
        <div className="flex-1" />
        <span className="text-2xs text-text-muted">{nb.cells.length} cells</span>
        {nb.isDirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-bg-high hover:bg-bg-elevated text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            Save
          </button>
        )}
      </div>

      {/* Cells */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {nb.cells.map((cell, i) => (
          <div key={cell.id} className="group">
            <CellItem
              cell={cell}
              index={i}
              onRun={runCell}
              onDelete={handleDelete}
              onAddAfter={handleAddAfter}
              onSourceChange={handleSourceChange}
            />
          </div>
        ))}

        {nb.cells.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <p className="text-xs text-text-muted">Empty notebook</p>
            <button
              onClick={() => handleAddAfter(-1)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent/20 hover:bg-accent/30 text-accent-light text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add first cell
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
