import { useState } from 'react'
import {
  FolderOpen, Brain, FlaskConical, Trophy,
  Cloud, ChevronLeft, ChevronRight, BookOpen, Stethoscope
} from 'lucide-react'
import LeftPanel from './LeftPanel'
import MemoryPanel from '@/components/memory/MemoryPanel'
import ExperimentsPanel from '@/components/experiments/ExperimentsPanel'
import ModelArena from '@/components/arena/ModelArena'
import CloudConsole from '@/components/cloud/CloudConsole'
import ResearchPanel from '@/components/research/ResearchPanel'
import EnvironmentPanel from '@/components/doctor/EnvironmentPanel'

type Tab = 'files' | 'memory' | 'experiments' | 'arena' | 'cloud' | 'research' | 'doctor'

const TABS: { id: Tab; label: string; icon: React.ComponentType<any>; color: string }[] = [
  { id: 'files',       label: 'Files',        icon: FolderOpen,   color: 'text-accent-light' },
  { id: 'memory',      label: 'Memory',       icon: Brain,        color: 'text-purple-400' },
  { id: 'experiments', label: 'Experiments',  icon: FlaskConical, color: 'text-purple-400' },
  { id: 'arena',       label: 'Arena',        icon: Trophy,       color: 'text-yellow-400' },
  { id: 'cloud',       label: 'Cloud',        icon: Cloud,        color: 'text-blue-400' },
  { id: 'research',    label: 'Research',     icon: BookOpen,     color: 'text-pink-400' },
  { id: 'doctor',      label: 'Doctor',       icon: Stethoscope,  color: 'text-green-400' },
]

export default function SidebarContainer() {
  const [activeTab, setActiveTab] = useState<Tab>('files')
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div
      className={`flex h-full bg-bg-surface border-r border-border overflow-hidden transition-all duration-200 ${collapsed ? 'w-10' : 'w-64'}`}
      style={{ minWidth: collapsed ? 40 : 260, maxWidth: collapsed ? 40 : 260 }}
    >
      {/* Icon rail */}
      <div className="flex flex-col items-center py-2 gap-1 w-10 flex-shrink-0 border-r border-border bg-bg-elevated">
        {TABS.map(({ id, icon: Icon, label, color }) => (
          <button
            key={id}
            title={label}
            onClick={() => { setActiveTab(id); setCollapsed(false) }}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${
              activeTab === id && !collapsed
                ? 'bg-accent/20 shadow-glow-sm'
                : 'hover:bg-bg-high'
            }`}
          >
            <Icon className={`w-4 h-4 ${activeTab === id && !collapsed ? color : 'text-text-muted'}`} />
          </button>
        ))}

        {/* Collapse toggle at bottom */}
        <div className="mt-auto">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-bg-high transition-colors"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed
              ? <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
              : <ChevronLeft className="w-3.5 h-3.5 text-text-muted" />
            }
          </button>
        </div>
      </div>

      {/* Panel content */}
      {!collapsed && (
        <div className="flex-1 overflow-hidden">
          {activeTab === 'files'       && <LeftPanel />}
          {activeTab === 'memory'      && <MemoryPanel />}
          {activeTab === 'experiments' && <ExperimentsPanel />}
          {activeTab === 'arena'       && <ModelArena />}
          {activeTab === 'cloud'       && <CloudConsole />}
          {activeTab === 'research'    && <ResearchPanel />}
          {activeTab === 'doctor'      && <EnvironmentPanel />}
        </div>
      )}
    </div>
  )
}
