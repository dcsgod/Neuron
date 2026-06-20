import { useEffect, useRef } from 'react'
import SidebarContainer from './components/layout/SidebarContainer'
import CenterPane from './components/layout/CenterPane'
import RightPanel from './components/layout/RightPanel'
import StatusBar from './components/shared/StatusBar'
import { useIDEStore } from './store/ideStore'
import { fetchHealth, fetchModels } from './lib/api'

export default function App() {
  const { setHealth, setAvailableModels, setSelectedModel } = useIDEStore()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    async function init() {
      try {
        const [health, models] = await Promise.all([fetchHealth(), fetchModels()])
        if (health) setHealth(health)
        if (models.length > 0) {
          setAvailableModels(models)
          setSelectedModel(models[0])
        }
      } catch (err) {
        console.warn('Backend not available yet:', err)
      }
    }

    init()

    const interval = setInterval(async () => {
      try {
        const health = await fetchHealth()
        if (health) setHealth(health)
      } catch {}
    }, 30_000)

    return () => clearInterval(interval)
  }, [setHealth, setAvailableModels, setSelectedModel])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg-base">
      <div className="flex flex-1 overflow-hidden">
        {/* Left: icon-rail sidebar with all panels */}
        <SidebarContainer />
        {/* Center: Monaco editor workspace */}
        <div className="flex-1 overflow-hidden">
          <CenterPane />
        </div>
        {/* Right: Agent Cockpit */}
        <RightPanel />
      </div>
      <StatusBar />
    </div>
  )
}
