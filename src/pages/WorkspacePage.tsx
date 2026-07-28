import { useEffect, useState } from 'react'
import { CalibrationPanel } from '../components/CalibrationPanel'
import { CameraConsentDialog } from '../components/CameraConsentDialog'
import { CameraPreview } from '../components/CameraPreview'
import { CardPropertyPanel } from '../components/CardPropertyPanel'
import { GestureStatus } from '../components/GestureStatus'
import { LeftToolbar } from '../components/LeftToolbar'
import { hasCompletedOnboarding, OnboardingFlow } from '../components/OnboardingFlow'
import { StatusCenter, useStatusCenter } from '../components/StatusCenter'
import { TopBar } from '../components/TopBar'
import { WorkspaceCanvas } from '../components/WorkspaceCanvas'
import { ZoomControl } from '../components/ZoomControl'
import { exportProjectJpg, exportProjectPng } from '../export/pngExport'
import { exportProjectJson, readProjectFile } from '../export/projectTransfer'
import { useAirNoteRuntime } from '../store/useAirNoteRuntime'

export function WorkspacePage() {
  const runtime = useAirNoteRuntime()
  const pointerEventsSupported = typeof window.PointerEvent !== 'undefined'
  const viewport = runtime.document.workspace.viewport
  const [showCameraConsent, setShowCameraConsent] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() => !hasCompletedOnboarding())
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([])
  const statusCenter = useStatusCenter()

  useEffect(() => {
    if (!runtime.workspaceMessage) return
    statusCenter.push(runtime.workspaceMessage)
    runtime.reportWorkspaceMessage(null)
  }, [runtime.workspaceMessage, runtime.reportWorkspaceMessage, statusCenter.push])

  useEffect(() => {
    if (runtime.uiState.errorMessage) statusCenter.push(runtime.uiState.errorMessage, 'error')
  }, [runtime.uiState.errorMessage, statusCenter.push])

  useEffect(() => {
    const handleToolShortcut = (event: KeyboardEvent) => {
      const target = event.target
      const isEditing = target instanceof HTMLElement
        && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
      const calibrationOpen = runtime.uiState.cameraStatus === 'running'
        && runtime.calibration.phase !== 'ready'
      if (
        event.ctrlKey
        || event.metaKey
        || event.altKey
        || isEditing
        || showOnboarding
        || showCameraConsent
        || calibrationOpen
      ) return

      const key = event.key.toLowerCase()
      const toolByKey = {
        v: 'select',
        p: 'draw',
        e: 'erase',
        h: 'pan',
        r: 'lasso-rect',
        l: 'lasso-free',
      } as const
      const nextTool = toolByKey[key as keyof typeof toolByKey]
      if (nextTool) {
        event.preventDefault()
        runtime.setTool(nextTool)
      } else if (key === 't') {
        event.preventDefault()
        runtime.addTextCard()
      }
    }

    window.addEventListener('keydown', handleToolShortcut)
    return () => window.removeEventListener('keydown', handleToolShortcut)
  }, [
    runtime.addTextCard,
    runtime.calibration.phase,
    runtime.setTool,
    runtime.uiState.cameraStatus,
    showCameraConsent,
    showOnboarding,
  ])

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

  const exportJpg = async () => {
    try {
      await exportProjectJpg(runtime.createProjectSnapshot())
      runtime.reportWorkspaceMessage('JPG 图片已导出。')
    } catch {
      runtime.reportWorkspaceMessage('JPG 导出失败，请稍后重试。')
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

  const setInputMode = (mode: 'gesture' | 'mouse') => {
    if (mode === 'gesture' && runtime.uiState.cameraStatus !== 'running') {
      statusCenter.push('请先启用摄像头并完成校准，再切换到手势模式。', 'warning')
      setShowCameraConsent(true)
      return
    }
    runtime.setInputMode(mode)
  }

  return (
    <main className="app-shell">
      {!pointerEventsSupported ? (
        <p className="blocking-banner" role="alert">当前浏览器不受支持，请使用最新版 Chrome 或 Edge。</p>
      ) : null}
      <TopBar
        workspaceName={runtime.document.workspace.name}
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
        onExportJpg={exportJpg}
        onExportProject={exportProject}
        onImportProject={importProject}
        onOpenOnboarding={() => setShowOnboarding(true)}
      />
      <div className="workspace-layout">
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
            onInputModeChange={setInputMode}
            onGesturePauseEnabledChange={runtime.setGesturePauseEnabled}
            onExperimentalStylesChange={runtime.setExperimentalStylesEnabled}
            onUpdateBrush={runtime.updateBrush}
            onCreateTextCard={runtime.addTextCard}
          />
          <div className="floating-divider" aria-hidden="true" />
          <CameraPreview
            status={runtime.uiState.cameraStatus}
            settings={runtime.uiState.cameraSettings}
            errorMessage={runtime.uiState.errorMessage}
            inputMode={runtime.settings.inputMode}
            canUseGesture={runtime.calibration.phase === 'ready'}
            videoRef={runtime.videoRef}
            onEnable={() => setShowCameraConsent(true)}
            onDisable={runtime.disableCamera}
            onInputModeChange={setInputMode}
            onGestureRequest={runtime.requestGestureMode}
            onUseDefaultCalibration={runtime.skipCalibration}
            onRecalibrate={runtime.beginCalibration}
          />
          <GestureStatus
            diagnostics={runtime.uiState.diagnostics}
            onResume={runtime.resumeGestureInput}
          />
        </div>

        <div className="workspace-zoom-container">
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
            zoom={viewport.zoom}
            viewport={viewport}
            onReady={runtime.attachCanvas}
            onPointerStart={runtime.startMouseStroke}
            onPointerMove={runtime.appendMousePoint}
            onPointerEnd={runtime.endMouseStroke}
            onEraseAtPoint={runtime.eraseStrokeAtPoint}
            onPan={(x, y) => runtime.setViewport({ x, y })}
            onSuggestSelection={runtime.suggestSelectionGroup}
            onGenerateCard={runtime.generateCard}
            onContinueGroup={runtime.continueGroup}
            onCancelGroup={runtime.cancelGroup}
            onMoveCard={runtime.commitCardMove}
            onMoveCards={runtime.commitCardsMove}
            onResizeCard={runtime.commitCardResize}
            onRenameCard={runtime.commitCardRename}
            onUpdateTextCard={runtime.commitTextCardUpdate}
            onDeleteCard={runtime.commitCardDelete}
            onCreateEdge={runtime.commitEdge}
            onUpdateEdge={runtime.commitEdgeType}
            onEdgeTypeChange={runtime.setEdgeType}
            onSelectionChange={setSelectedCardIds}
          />
        </div>

        <div className="canvas-stage__notice"><p className="eyebrow">P0 WORKSPACE</p><h2 id="canvas-title">{runtime.tool === 'draw' ? (runtime.settings.inputMode === 'mouse' ? '鼠标画笔已启用' : '捏合落笔，松开断笔') : runtime.tool === 'erase' ? '整笔橡皮擦：点击或划过自由笔迹' : runtime.tool === 'pan' ? '拖动画布进行平移' : runtime.tool === 'select' ? (selectedCardIds.length > 1 ? `已选择 ${selectedCardIds.length} 张卡片，可整体移动` : '选择卡片或从锚点连线') : runtime.tool === 'lasso-rect' ? '拖动矩形框选笔画与卡片' : '拖动自由套索选择笔画与卡片'}</h2><p>按住 Shift 可增减卡片选择；实验视觉不改写原始 Stroke。</p></div>

        {runtime.uiState.cameraStatus === 'running' && runtime.calibration.phase !== 'ready' && (
          <div className="calibration-overlay" role="dialog" aria-modal="true" aria-label="手势校准">
            <CalibrationPanel
              calibration={runtime.calibration}
              cameraRunning={runtime.uiState.cameraStatus === 'running'}
              streamRef={runtime.streamRef}
              latestHandRef={runtime.latestHandRef}
              calibrationDraftRef={runtime.calibrationDraftRef}
              onBegin={runtime.beginCalibration}
              onCapture={runtime.captureCalibrationSample}
              onConfirm={runtime.confirmCalibration}
              onSkip={runtime.skipCalibration}
            />
          </div>
        )}
        <div className="floating-right" aria-label="属性面板">
          <CardPropertyPanel
            card={selectedCardIds.length === 1 ? runtime.document.cards.find((c) => c.id === selectedCardIds[0]) ?? null : null}
            onRenameCard={runtime.commitCardRename}
            onUpdateTextCard={runtime.commitTextCardUpdate}
            onDeleteCard={runtime.commitCardDelete}
            onClose={() => setSelectedCardIds([])}
          />
        </div>
        <ZoomControl zoom={viewport.zoom} onZoomChange={(zoom) => runtime.setViewport({ zoom })} />
      </div>
      <StatusCenter
        visible={statusCenter.visible}
        history={statusCenter.history}
        historyOpen={statusCenter.historyOpen}
        onHistoryOpenChange={statusCenter.setHistoryOpen}
        onDismiss={statusCenter.dismiss}
        onExportProject={exportProject}
      />
      {showCameraConsent ? (
        <CameraConsentDialog
          onCancel={() => setShowCameraConsent(false)}
          onConfirm={() => {
            setShowCameraConsent(false)
            void runtime.enableCamera()
          }}
        />
      ) : null}
      {showOnboarding ? <OnboardingFlow onClose={() => setShowOnboarding(false)} /> : null}
    </main>
  )
}
