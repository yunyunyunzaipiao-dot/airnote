import { useEffect, useState } from 'react'
import { CalibrationPanel } from './components/CalibrationPanel'
import { CameraPreview } from './components/CameraPreview'
import { GestureStatus } from './components/GestureStatus'
import { LeftToolbar } from './components/LeftToolbar'
import { OnboardingOverlay } from './components/OnboardingOverlay'
import { TopBar } from './components/TopBar'
import { WorkspaceCanvas } from './components/WorkspaceCanvas'
import { ZoomControl } from './components/ZoomControl'
import { exportProjectPng } from './export/pngExport'
import { exportProjectJson, readProjectFile } from './export/projectTransfer'
import { useAirNoteRuntime } from './store/useAirNoteRuntime'

export function App() {
  const runtime = useAirNoteRuntime()
  const pointerEventsSupported = typeof window.PointerEvent !== 'undefined'
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    if (!runtime.workspaceMessage) return
    const timer = setTimeout(() => {
      runtime.reportWorkspaceMessage(null)
    }, 3000)
    return () => clearTimeout(timer)
  }, [runtime.workspaceMessage])

  const confirmClear = () => {
    const confirmed = window.confirm('将清空当前画布中的笔迹、卡片和连接线。此操作可撤销一次。')
    if (confirmed) runtime.clearWorkspace()
  }

  const exportPng = async () => {
    try {
      await exportProjectPng(runtime.createProjectSnapshot())
      runtime.reportWorkspaceMessage('画布图片已导出。')
    } catch {
      runtime.reportWorkspaceMessage('图片导出失败，请稍后重试。')
    }
  }

  const exportProject = () => {
    try {
      exportProjectJson(runtime.createProjectSnapshot())
      runtime.reportWorkspaceMessage('项目JSON已导出。')
    } catch (error) {
      runtime.reportWorkspaceMessage(error instanceof Error ? error.message : '项目导出失败，请稍后重试。')
    }
  }

  const importProject = async (file: File) => {
    const result = await readProjectFile(file)
    if (!result.ok) {
      runtime.reportWorkspaceMessage(result.message)
      return
    }
    if (!window.confirm('导入项目将替换当前画布。是否继续？')) return
    runtime.replaceProject(result.project)
  }

  return (
    <main className="app-shell">
      {!pointerEventsSupported ? (
        <p className="blocking-banner" role="alert">当前浏览器不受支持，请使用最新版 Chrome 或 Edge。</p>
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
        onExportPng={exportPng}
        onExportProject={exportProject}
        onImportProject={importProject}
      />
      <div className="workspace-layout">
        {/* 左侧浮动工具栏 */}
        <div className="floating-sidebar" aria-label="工具与摄像头面板">
          <LeftToolbar
            tool={runtime.tool}
            inputMode={runtime.settings.inputMode}
            brush={runtime.settings.brush}
            gesturePauseEnabled={runtime.gesturePauseEnabled}
            experimentalStylesEnabled={runtime.settings.experimentalStylesEnabled}
            performanceStage={runtime.stylePerformanceStage}
            reducedMotion={runtime.reducedMotion}
            onChange={runtime.setTool}
            onInputModeChange={runtime.setInputMode}
            onGesturePauseEnabledChange={runtime.setGesturePauseEnabled}
            onExperimentalStylesChange={runtime.setExperimentalStylesEnabled}
            onUpdateBrush={runtime.updateBrush}
            onInsertImage={() => runtime.reportWorkspaceMessage('插入图片功能即将推出。')}
          />
          <div className="floating-divider" aria-hidden="true" />
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
          <GestureStatus
            diagnostics={runtime.uiState.diagnostics}
            onResume={runtime.resumeGestureInput}
          />
        </div>

        {/* 全屏画布 */}
        <div
          className="workspace-zoom-container"
          style={{
            position: 'absolute',
            inset: 0,
            width: `${100 / zoom}%`,
            height: `${100 / zoom}%`,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
          }}
        >
          <WorkspaceCanvas
            inputMode={runtime.settings.inputMode}
            experimentalStylesEnabled={runtime.settings.experimentalStylesEnabled}
            reducedMotion={runtime.reducedMotion}
            tool={runtime.tool}
            edgeType={runtime.edgeType}
            strokes={runtime.strokes}
            cards={runtime.document.cards}
            edges={runtime.document.edges}
            currentGroup={runtime.currentGroup}
            calibration={runtime.calibration}
            zoom={zoom}
            onReady={runtime.attachCanvas}
            onPointerStart={runtime.startMouseStroke}
            onPointerMove={runtime.appendMousePoint}
            onPointerEnd={runtime.endMouseStroke}
            onSuggestSelection={runtime.suggestSelectionGroup}
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
        </div>

        {/* 右侧浮动面板 */}
        <div className="floating-right" aria-label="校准与属性面板">
          <CalibrationPanel
            calibration={runtime.calibration}
            cameraRunning={runtime.uiState.cameraStatus === 'running'}
            onBegin={runtime.beginCalibration}
            onCapture={runtime.captureCalibrationSample}
            onConfirm={runtime.confirmCalibration}
            onSkip={runtime.skipCalibration}
          />
        </div>
        {runtime.workspaceMessage ? (
          <p className="workspace-toast workspace-toast--visible" role="status">{runtime.workspaceMessage}</p>
        ) : null}
        {!runtime.onboardingCompleted ? (
          <OnboardingOverlay onComplete={runtime.completeOnboarding} />
        ) : null}
        <ZoomControl zoom={zoom} onZoomChange={setZoom} />
      </div>
    </main>
  )
}
