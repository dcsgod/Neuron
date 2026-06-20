import { useEffect } from 'react'
import { GitBranch, Wifi, WifiOff, AlertCircle, CheckCircle2, Zap } from 'lucide-react'
import { useIDEStore } from '@/store/ideStore'

export default function StatusBar() {
  const { health, activeTabPath, openTabs, selectedModel, rootPath } = useIDEStore()

  const activeTab = openTabs.find(t => t.path === activeTabPath)
  const backendOnline = health !== null

  return (
    <div className="flex items-center justify-between px-3 bg-accent/90 text-white select-none flex-shrink-0"
      style={{ height: 24, fontSize: 11 }}>
      {/* Left: project + branch */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 opacity-90">
          <GitBranch className="w-3 h-3" />
          <span>{rootPath ? rootPath.split(/[/\\]/).pop() : 'No project'}</span>
        </div>
        {backendOnline ? (
          <div className="flex items-center gap-1 opacity-80">
            <CheckCircle2 className="w-3 h-3" />
            <span>Backend online</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 opacity-80">
            <WifiOff className="w-3 h-3" />
            <span>Backend offline</span>
          </div>
        )}
      </div>

      {/* Center: active file */}
      <div className="flex items-center gap-2 opacity-80">
        {activeTab && (
          <>
            <span className="truncate max-w-64">{activeTab.path}</span>
            {activeTab.isDirty && <span className="opacity-70">●</span>}
          </>
        )}
      </div>

      {/* Right: model + health */}
      <div className="flex items-center gap-3">
        {selectedModel && (
          <div className="flex items-center gap-1.5 opacity-80">
            <Zap className="w-3 h-3" />
            <span>{selectedModel}</span>
          </div>
        )}
        {health && health.issues.length > 0 && (
          <div className="flex items-center gap-1 text-yellow-200">
            <AlertCircle className="w-3 h-3" />
            <span>{health.issues.length} issue{health.issues.length > 1 ? 's' : ''}</span>
          </div>
        )}
        {health?.cudaAvailable && (
          <div className="flex items-center gap-1 opacity-80">
            <span>GPU ✓</span>
          </div>
        )}
      </div>
    </div>
  )
}
