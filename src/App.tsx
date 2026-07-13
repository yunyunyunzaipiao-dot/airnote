import { CameraPreview } from './components/CameraPreview'
import { GestureStatus } from './components/GestureStatus'
import { LeftToolbar } from './components/LeftToolbar'
import { M0Canvas } from './components/M0Canvas'
import { PropertyPanel } from './components/PropertyPanel'
import { TopBar } from './components/TopBar'
import { useM0Runtime } from './store/useM0Runtime'

export function App() {
  const {
    uiState,
    videoRef,
    enableCamera,
    disableCamera,
    attachCanvas,
  } = useM0Runtime()

  return (
    <main className="app-shell">
      <TopBar cameraStatus={uiState.cameraStatus} />
      <div className="workspace-layout">
        <LeftToolbar />
        <M0Canvas onReady={attachCanvas} />
        <aside className="context-rail" aria-label="摄像头与属性面板">
          <CameraPreview
            status={uiState.cameraStatus}
            settings={uiState.cameraSettings}
            errorMessage={uiState.errorMessage}
            videoRef={videoRef}
            onEnable={enableCamera}
            onDisable={disableCamera}
          />
          <GestureStatus diagnostics={uiState.diagnostics} />
          <PropertyPanel />
        </aside>
      </div>
    </main>
  )
}
