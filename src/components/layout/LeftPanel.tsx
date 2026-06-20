import React, { useState, useCallback } from 'react'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen,
  FileCode, FileText, Database, BookOpen, Brain, Cloud,
  MoreHorizontal, Plus, RefreshCw } from 'lucide-react'
import { useIDEStore } from '@/store/ideStore'
import { fetchFileContent, fetchFileTree, FileNode } from '@/lib/api'
import { open } from '@tauri-apps/plugin-dialog'

// ─── File icon resolver ────────────────────────────────────────
function FileIcon({ ext, className = 'w-3.5 h-3.5' }: { ext?: string; className?: string }) {
  const e = ext?.replace('.', '') ?? ''
  if (['py', 'ipynb'].includes(e)) return <FileCode className={`${className} text-yellow-400`} />
  if (['ts', 'tsx', 'js', 'jsx'].includes(e)) return <FileCode className={`${className} text-blue-400`} />
  if (['csv', 'parquet', 'json'].includes(e)) return <Database className={`${className} text-green-400`} />
  if (['md', 'txt'].includes(e)) return <FileText className={`${className} text-slate-400`} />
  if (['yaml', 'yml', 'toml'].includes(e)) return <FileText className={`${className} text-orange-400`} />
  if (e === 'rs') return <FileCode className={`${className} text-orange-500`} />
  if (e === 'sql') return <Database className={`${className} text-cyan-400`} />
  return <File className={`${className} text-slate-500`} />
}

// ─── Single file/folder node ───────────────────────────────────
function FileNodeItem({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth === 0)
  const { openFile, activeTabPath } = useIDEStore()

  const isDir = node.type === 'directory'
  const isSelected = activeTabPath === node.path
  const indent = depth * 12 + 8

  const handleClick = useCallback(async () => {
    if (isDir) {
      setExpanded(e => !e)
      return
    }
    try {
      const content = await fetchFileContent(node.path)
      openFile({ path: node.path, name: node.name, content, language: '', isDirty: false })
    } catch (err) {
      console.error('Failed to open file:', err)
    }
  }, [isDir, node.path, node.name, openFile])

  return (
    <>
      <div
        className={`file-node ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: indent }}
        onClick={handleClick}
      >
        {isDir ? (
          <>
            <span className="text-slate-500 flex-shrink-0">
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </span>
            {expanded
              ? <FolderOpen className="w-3.5 h-3.5 text-accent-light flex-shrink-0" />
              : <Folder className="w-3.5 h-3.5 text-accent flex-shrink-0" />
            }
          </>
        ) : (
          <>
            <span className="w-3 h-3 flex-shrink-0" />
            <FileIcon ext={node.extension} />
          </>
        )}
        <span className="truncate text-xs leading-none">{node.name}</span>
        {node.size != null && !isDir && (
          <span className="ml-auto text-2xs text-text-muted flex-shrink-0">
            {node.size > 1024 ? `${Math.round(node.size / 1024)}K` : `${node.size}B`}
          </span>
        )}
      </div>

      {isDir && expanded && node.children && (
        <div>
          {node.children.map(child => (
            <FileNodeItem key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  )
}

// ─── Section header ────────────────────────────────────────────
function SectionHeader({ label, icon: Icon }: { label: string; icon: React.ComponentType<any> }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 mt-2">
      <Icon className="w-3 h-3 text-text-muted" />
      <span className="text-2xs font-semibold tracking-widest text-text-muted uppercase">{label}</span>
    </div>
  )
}

// ─── Left Panel ────────────────────────────────────────────────
export default function LeftPanel() {
  const { rootPath, setRootPath } = useIDEStore()
  const [tree, setTree] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(false)

  const refreshTree = useCallback(async (path?: string) => {
    const root = path ?? rootPath
    if (!root) return
    setLoading(true)
    try {
      const nodes = await fetchFileTree(root)
      setTree(nodes)
    } catch (err) {
      console.error('Failed to fetch tree:', err)
    } finally {
      setLoading(false)
    }
  }, [rootPath])

  const handleOpenFolder = useCallback(async () => {
    let chosen: string | null = null
    try {
      const selected = await open({ directory: true, multiple: false })
      if (selected && typeof selected === 'string') chosen = selected
    } catch {
      chosen = prompt('Enter project folder path:') ?? null
    }
    if (!chosen) return

    setRootPath(chosen)
    await refreshTree(chosen)

    // Notify backend — initialises .neuron/ and starts file watcher
    try {
      await fetch('http://127.0.0.1:8000/api/projects/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: chosen }),
      })
    } catch {
      // Backend may not be running yet; non-fatal
    }
  }, [setRootPath, refreshTree])

  return (
    <div className="flex flex-col h-full bg-bg-surface border-r border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-accent-light" />
          <span className="text-xs font-semibold text-text-primary tracking-wide">EXPLORER</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => refreshTree()}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenFolder}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            title="Open Folder"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {!rootPath ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
            <Folder className="w-8 h-8 text-accent opacity-40" />
            <p className="text-xs text-text-muted">No project open</p>
            <button
              onClick={handleOpenFolder}
              className="px-3 py-1.5 text-xs rounded-md bg-accent hover:bg-accent/80 text-white transition-colors"
            >
              Open Folder
            </button>
          </div>
        ) : (
          <>
            <SectionHeader label="Project" icon={Folder} />
            {tree.filter(n => n.name !== '.neuron').map(node => (
              <FileNodeItem key={node.path} node={node} depth={0} />
            ))}

            {/* .neuron section */}
            {tree.some(n => n.name === '.neuron') && (
              <>
                <SectionHeader label=".neuron Memory" icon={Brain} />
                {tree.filter(n => n.name === '.neuron').map(node => (
                  <FileNodeItem key={node.path} node={node} depth={0} />
                ))}
              </>
            )}

            {/* Cloud section (placeholder) */}
            <SectionHeader label="Cloud" icon={Cloud} />
            <div className="px-4 py-1.5">
              <div className="flex items-center gap-2 py-1">
                <div className="status-dot idle" />
                <span className="text-xs text-text-muted">No connections</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer: project path */}
      {rootPath && (
        <div className="px-3 py-2 border-t border-border flex-shrink-0">
          <p className="text-2xs text-text-muted truncate" title={rootPath}>
            {rootPath.split(/[/\\]/).pop() ?? rootPath}
          </p>
        </div>
      )}
    </div>
  )
}
