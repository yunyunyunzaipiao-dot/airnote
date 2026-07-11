import { CameraPreview } from './components/CameraPreview'
import { GestureStatus } from './components/GestureStatus'
import { LeftToolbar } from './components/LeftToolbar'
import { MainCanvasPlaceholder } from './components/MainCanvasPlaceholder'
import { PropertyPanel } from './components/PropertyPanel'
import { TopBar } from './components/TopBar'

export function App() {
  return (
    <main className="app-shell">
      <TopBar />
      <div className="workspace-layout">
        <LeftToolbar />
        <MainCanvasPlaceholder />
        <aside className="context-rail" aria-label="状态与属性面板">
          <CameraPreview />
          <GestureStatus />
          <PropertyPanel />
        </aside>
      </div>
    </main>
  )
}

