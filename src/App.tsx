import { CalibrationPanel } from './components/CalibrationPanel'
import { CameraPreview } from './components/CameraPreview'
import { GestureStatus } from './components/GestureStatus'
import { LeftToolbar } from './components/LeftToolbar'
import { PropertyPanel } from './components/PropertyPanel'
import { TopBar } from './components/TopBar'
import { WorkspaceCanvas } from './components/WorkspaceCanvas'
import { useAirNoteRuntime } from './store/useAirNoteRuntime'

export function App() {
  const runtime = useAirNoteRuntime()
  const pointerEventsSupported = typeof window.PointerEvent !== 'undefined'

  const confirmClear = () => {
    const confirmed = window.confirm('将清空当前画布中的笔迹、卡片和连接线。此操作可撤销一次。')
    if (confirmed) runtime.clearWorkspace()
  }

  return (
    <main className="app-shell">
      {!pointerEventsSupported ? (
        <p className="blocking-banner" role="alert">当前浏览器不受支持，请使用最新版 Chrome 或 Edge。</p>
      ) : null}
      {runtime.workspaceMessage ? (
        <p className="workspace-toast" role="status">{runtime.workspaceMessage}</p>
      ) : null}
      <TopBar
        cameraStatus={runtime.uiState.cameraStatus}
        inputMode={runtime.settings.inputMode}
        canUndo={runtime.canUndo}
        canRedo={runtime.canRedo}
        hasContent={runtime.strokes.length > 0 || runtime.document.cards.length > 0}
        saveStatus={runtime.saveStatus}
        onUndo={runtime.undo}
        onRedo={runtime.redo}
        onClear={confirmClear}
      />
      <div className="workspace-layout">
        <LeftToolbar tool={runtime.tool} onChange={runtime.setTool} />
        <WorkspaceCanvas
          inputMode={runtime.settings.inputMode}
          tool={runtime.tool}
          edgeType={runtime.edgeType}
          strokes={runtime.strokes}
          cards={runtime.document.cards}
          edges={runtime.document.edges}
          currentGroup={runtime.currentGroup}
          calibration={runtime.calibration}
          onReady={runtime.attachCanvas}
          onPointerStart={runtime.startMouseStroke}
          onPointerMove={runtime.appendMousePoint}
          onPointerEnd={runtime.endMouseStroke}
          onGenerateCard={runtime.generateCard}
          onContinueGroup={runtime.continueGroup}
          onCancelGroup={runtime.cancelGroup}
          onMoveCard={runtime.commitCardMove}
          onResizeCard={runtime.commitCardResize}
          onRenameCard={runtime.commitCardRename}
          onDeleteCard={runtime.commitCardDelete}
          onCreateEdge={runtime.commitEdge}
          onUpdateEdge={runtime.commitEdgeType}
          onEdgeTypeChange={runtime.setEdgeType}
        />
        <aside className="context-rail" aria-label="摄像头、手势与属性面板">
          <CameraPreview
            status={runtime.uiState.cameraStatus}
            settings={runtime.uiState.cameraSettings}
            errorMessage={runtime.uiState.errorMessage}
            inputMode={runtime.settings.inputMode}
            canUseGesture={runtime.calibration.phase === 'ready'}
            videoRef={runtime.videoRef}
            onEnable={runtime.enableCamera}
            onDisable={runtime.disableCamera}
            onInputModeChange={runtime.setInputMode}
            onGestureRequest={runtime.requestGestureMode}
            onUseDefaultCalibration={runtime.skipCalibration}
          />
          <GestureStatus diagnostics={runtime.uiState.diagnostics} />
          <CalibrationPanel
            calibration={runtime.calibration}
            cameraRunning={runtime.uiState.cameraStatus === 'running'}
            onBegin={runtime.beginCalibration}
            onCapture={runtime.captureCalibrationSample}
            onConfirm={runtime.confirmCalibration}
            onSkip={runtime.skipCalibration}
          />
          <PropertyPanel brush={runtime.settings.brush} onChange={runtime.updateBrush} />
        </aside>
      </div>
    </main>
  )
}
