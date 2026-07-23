import { useCallback, useEffect, useRef, useState } from 'react'
import {
  calculatePinchThresholds,
  calculateWritingROI,
  createCalibrationDraft,
  finalizeCalibration,
  ROI_TARGETS,
  type CalibrationDraft,
} from '../camera/calibration'
import {
  cameraErrorCode,
  cameraErrorMessage,
  readCameraSettings,
  requestCameraStream,
  stopCameraStream,
} from '../camera/camera'
import { StrokeCanvasRenderer, type StylePerformanceStage } from '../drawing/canvasRenderer'
import type { CardGeometry } from '../layout/cardResize'
import {
  createOpenPalmHold,
  isOpenPalm,
  stepOpenPalmHold,
} from '../gesture/openPalmPause'
import { calculatePinchRatio, createGestureMachine, stepGestureMachine, stopGestureMachine } from '../gesture/pinchStateMachine'
import {
  createWorkspaceHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type WorkspaceHistoryState,
} from '../history/workspaceHistory'
import { createHandTracker, type HandTracker } from '../handTracking/handTracker'
import { startVideoFrameLoop, type VideoFrameLoop } from '../handTracking/videoFrameLoop'
import { loadGesturePauseEnabled, saveGesturePauseEnabled } from '../persistence/gesturePauseStorage'
import { addOrUpdateProjectIndex } from '../persistence/projectIndexStorage'
import { loadSettings, saveSettings } from '../persistence/settingsStorage'
import { loadWorkspace, loadWorkspaceById, saveWorkspace, saveWorkspaceById, type SaveStatus } from '../persistence/workspaceStorage'
import {
  addStrokeToCurrentGroup,
  cancelCurrentGroup,
  continueCurrentGroup,
  createCardFromCurrentGroup,
  createEdge,
  createWorkspaceDocument,
  deleteCard,
  moveCard,
  projectFromDocument,
  renameCard,
  resizeCard,
  suggestGroupFromSelection,
  suggestCurrentGroup,
  touch,
  updateEdgeType,
} from './workspaceDocument'
import type { CameraErrorCode, M0UiState, NormalizedPoint, RuntimeDiagnostics } from '../types/m0'
import {
  DEFAULT_SETTINGS,
  type AirNoteProject,
  type AirNoteSettings,
  type BrushSettings,
  type Edge,
  type EdgeAnchor,
  type InputMode,
  type Stroke,
  type WorkspaceDocument,
  type WorkspaceTool,
} from '../types/workspace'

export type CalibrationPhase = 'idle' | 'required' | 'roi' | 'pinch' | 'review' | 'ready'

export interface CalibrationUiState {
  phase: CalibrationPhase
  roiStep: number
  pinchCycles: number
  awaitingRelease: boolean
  message: string
}

const EMPTY_DIAGNOSTICS: RuntimeDiagnostics = {
  fps: 0,
  inferenceMs: 0,
  pinchRatio: null,
  lostFrames: 0,
  gestureState: 'IDLE',
  openPalmHoldProgress: 0,
}

const INITIAL_UI_STATE: M0UiState = {
  cameraStatus: 'idle',
  cameraSettings: { width: null, height: null, frameRate: null, deviceId: null },
  errorCode: null,
  errorMessage: null,
  diagnostics: EMPTY_DIAGNOSTICS,
}

function readyCalibration(settings: AirNoteSettings): CalibrationUiState {
  return {
    phase: settings.gesture.calibrated ? 'ready' : 'idle',
    roiStep: 0,
    pinchCycles: 0,
    awaitingRelease: false,
    message: settings.gesture.usesDefaultCalibration ? '当前使用默认校准参数。' : '自定义校准已生效。',
  }
}

export function useAirNoteRuntime(projectId?: string) {
  const restoredRef = useRef<ReturnType<typeof loadWorkspace> | undefined>(undefined)
  const restoreErrorRef = useRef<string | null>(null)
  if (restoredRef.current === undefined) {
    try {
      restoredRef.current = projectId ? loadWorkspaceById(projectId) : loadWorkspace()
    } catch (error) {
      restoredRef.current = null
      restoreErrorRef.current = error instanceof Error ? error.message : '上次项目无法恢复。'
    }
  }
  const initialSettingsRef = useRef<AirNoteSettings | null>(null)
  if (!initialSettingsRef.current) {
    initialSettingsRef.current = restoredRef.current?.settings ?? { ...loadSettings(), inputMode: 'mouse' }
  }

  const [uiState, setUiState] = useState<M0UiState>(INITIAL_UI_STATE)
  const [settings, setSettings] = useState<AirNoteSettings>(initialSettingsRef.current)
  const [documentState, setDocumentState] = useState<WorkspaceDocument>(() => restoredRef.current?.document ?? createWorkspaceDocument())
  const [history, setHistory] = useState<WorkspaceHistoryState>(() => createWorkspaceHistory())
  const [calibration, setCalibration] = useState<CalibrationUiState>(() => readyCalibration(initialSettingsRef.current!))
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(restoreErrorRef.current)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [tool, setToolState] = useState<WorkspaceTool>('draw')
  const [edgeType, setEdgeType] = useState<Edge['type']>('undirected')
  const [stylePerformanceStage, setStylePerformanceStage] = useState<StylePerformanceStage>('full')
  const [reducedMotion, setReducedMotion] = useState(false)
  const [gesturePauseEnabled, setGesturePauseEnabledState] = useState(loadGesturePauseEnabled)
  const [onboardingCompleted, setOnboardingCompleted] = useState(() => {
    try {
      return sessionStorage.getItem('airnote.onboarding.completed') === 'true'
    } catch {
      return false
    }
  })

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const trackerRef = useRef<HandTracker | null>(null)
  const loopRef = useRef<VideoFrameLoop | null>(null)
  const rendererRef = useRef(new StrokeCanvasRenderer())
  const machineRef = useRef(createGestureMachine())
  const openPalmHoldRef = useRef(createOpenPalmHold())
  const gesturePauseEnabledRef = useRef(gesturePauseEnabled)
  const settingsRef = useRef(settings)
  const documentRef = useRef(documentState)
  const historyRef = useRef(history)
  const calibrationRef = useRef(calibration)
  const calibrationDraftRef = useRef<CalibrationDraft>(createCalibrationDraft())
  const latestHandRef = useRef<{ point: NormalizedPoint; pinchRatio: number } | null>(null)
  const diagnosticsRef = useRef(EMPTY_DIAGNOSTICS)
  const mountedRef = useRef(true)
  const frameCountRef = useRef(0)
  const fpsWindowStartedAtRef = useRef(0)
  const lastHudUpdateAtRef = useRef(0)
  const groupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hydratedRef = useRef(false)

  const publishCalibration = useCallback((next: CalibrationUiState) => {
    calibrationRef.current = next
    setCalibration(next)
  }, [])

  const publishSettings = useCallback((next: AirNoteSettings) => {
    settingsRef.current = next
    rendererRef.current.setBrush(next.brush)
    rendererRef.current.setEffectsEnabled(next.experimentalStylesEnabled)
    rendererRef.current.setWritingROI(next.gesture.writingROI)
    setSettings(next)
    try {
      saveSettings(next)
    } catch {
      setUiState((current) => ({
        ...current,
        errorMessage: '设置保存失败，请检查浏览器存储权限。',
      }))
    }
  }, [])

  const applyDocument = useCallback((next: WorkspaceDocument) => {
    documentRef.current = next
    rendererRef.current.setCompletedStrokes(next.strokes.filter((stroke) => !stroke.cardId))
    setDocumentState(next)
  }, [])

  const publishHistory = useCallback((next: WorkspaceHistoryState) => {
    historyRef.current = next
    setHistory(next)
  }, [])

  const commitStroke = useCallback((stroke: Stroke | null) => {
    if (!stroke) return
    const before = documentRef.current
    const after = addStrokeToCurrentGroup(before, stroke)
    applyDocument(after)
    publishHistory(pushHistory(historyRef.current, { type: 'ADD_STROKE', before, after }))
    if (groupTimerRef.current) clearTimeout(groupTimerRef.current)
    groupTimerRef.current = setTimeout(() => applyDocument(suggestCurrentGroup(documentRef.current)), 1200)
  }, [applyDocument, publishHistory])

  const finishRendererStroke = useCallback(() => {
    commitStroke(rendererRef.current.finishStroke())
  }, [commitStroke])

  const publishDiagnostics = useCallback((inferenceMs: number) => {
    const now = performance.now()
    frameCountRef.current += 1
    if (fpsWindowStartedAtRef.current === 0) fpsWindowStartedAtRef.current = now

    const elapsed = now - fpsWindowStartedAtRef.current
    let fps = diagnosticsRef.current.fps
    if (elapsed >= 1000) {
      fps = (frameCountRef.current * 1000) / elapsed
      frameCountRef.current = 0
      fpsWindowStartedAtRef.current = now
    }

    diagnosticsRef.current = {
      fps,
      inferenceMs,
      pinchRatio: machineRef.current.pinchRatio,
      lostFrames: machineRef.current.lostFrames,
      gestureState: machineRef.current.state,
      openPalmHoldProgress: openPalmHoldRef.current.progress,
    }

    if (now - lastHudUpdateAtRef.current >= 125) {
      lastHudUpdateAtRef.current = now
      const diagnostics = diagnosticsRef.current
      setUiState((current) => ({ ...current, diagnostics }))
    }
  }, [])

  const endGestureTrajectory = useCallback(() => {
    const result = stopGestureMachine(machineRef.current)
    machineRef.current = result.machine
    openPalmHoldRef.current = createOpenPalmHold()
    result.commands.forEach((command) => {
      const stroke = rendererRef.current.handleGesture(command)
      if (
        calibrationRef.current.phase === 'ready'
        || calibrationRef.current.phase === 'review'
      ) commitStroke(stroke)
    })
  }, [commitStroke])

  const stopLoop = useCallback(() => {
    loopRef.current?.stop()
    loopRef.current = null
    endGestureTrajectory()
  }, [endGestureTrajectory])

  const startLoop = useCallback(() => {
    const video = videoRef.current
    const tracker = trackerRef.current
    if (!video || !tracker || loopRef.current) return

    loopRef.current = startVideoFrameLoop(video, (timestamp) => {
      try {
        const frame = tracker.detect(video, timestamp)
        const landmarks = frame.landmarks
        const pinchRatio = landmarks ? calculatePinchRatio(landmarks) : null
        const indexTip = landmarks?.[8]
        latestHandRef.current = indexTip && pinchRatio !== null
          ? { point: indexTip, pinchRatio }
          : null

        const calibrationPhase = calibrationRef.current.phase
        if (
          settingsRef.current.inputMode === 'gesture'
          && (calibrationPhase === 'ready' || calibrationPhase === 'review')
        ) {
          if (machineRef.current.state === 'PAUSED') {
            const holdResult = stepOpenPalmHold(
              openPalmHoldRef.current,
              frame.timestamp,
              isOpenPalm(landmarks),
              gesturePauseEnabledRef.current && calibrationPhase === 'ready',
            )
            openPalmHoldRef.current = holdResult.hold
            if (holdResult.completed) {
              machineRef.current = {
                ...createGestureMachine(),
                state: landmarks ? 'HOVER' : 'IDLE',
                lastFrameAt: frame.timestamp,
                pinchRatio,
              }
              setWorkspaceMessage('手势输入已恢复，从悬停状态重新开始。')
            }
          } else {
            const result = stepGestureMachine(
              machineRef.current,
              frame,
              settingsRef.current.gesture.pinchDownThreshold,
              settingsRef.current.gesture.pinchUpThreshold,
            )
            machineRef.current = result.machine
            result.commands.forEach((command) => {
              const stroke = rendererRef.current.handleGesture(command)
              if (calibrationPhase === 'ready' || calibrationPhase === 'review') {
                commitStroke(stroke)
              }
            })

            const holdResult = stepOpenPalmHold(
              openPalmHoldRef.current,
              frame.timestamp,
              isOpenPalm(landmarks),
              gesturePauseEnabledRef.current
                && calibrationPhase === 'ready'
                && machineRef.current.state === 'HOVER',
            )
            openPalmHoldRef.current = holdResult.hold
            if (holdResult.completed) {
              machineRef.current = {
                ...machineRef.current,
                state: 'PAUSED',
                downFrames: 0,
                upFrames: 0,
              }
              setWorkspaceMessage('手势输入已暂停。再次张掌保持 0.8 秒，或点击“恢复手势”。')
            }
          }
        } else {
          openPalmHoldRef.current = createOpenPalmHold()
          machineRef.current = {
            ...createGestureMachine(),
            state: landmarks ? 'HOVER' : 'IDLE',
            lastFrameAt: frame.timestamp,
            pinchRatio,
          }
        }
        publishDiagnostics(frame.inferenceMs)
      } catch (error) {
        console.error('Hand tracking inference failed.', error)
        stopLoop()
        trackerRef.current?.close()
        trackerRef.current = null
        const nextSettings = { ...settingsRef.current, inputMode: 'mouse' as const }
        publishSettings(nextSettings)
        if (mountedRef.current) {
          const errorCode: CameraErrorCode = 'tracking-runtime-failed'
          setUiState((current) => ({
            ...current,
            cameraStatus: 'running',
            errorCode,
            errorMessage: cameraErrorMessage(errorCode),
            diagnostics: EMPTY_DIAGNOSTICS,
          }))
        }
      }
    })
  }, [commitStroke, publishDiagnostics, publishSettings, stopLoop])

  const stopRuntime = useCallback((publishStoppedState = true) => {
    stopLoop()
    trackerRef.current?.close()
    trackerRef.current = null
    stopCameraStream(streamRef.current)
    streamRef.current = null
    latestHandRef.current = null
    openPalmHoldRef.current = createOpenPalmHold()
    if (videoRef.current) videoRef.current.srcObject = null

    if (publishStoppedState && mountedRef.current) {
      publishSettings({ ...settingsRef.current, inputMode: 'mouse' })
      setUiState((current) => ({
        ...current,
        cameraStatus: 'stopped',
        errorCode: null,
        errorMessage: null,
        diagnostics: EMPTY_DIAGNOSTICS,
      }))
    }
  }, [publishSettings, stopLoop])

  const disableCamera = useCallback(() => stopRuntime(true), [stopRuntime])

  const enableCamera = useCallback(async () => {
    stopRuntime(false)
    publishSettings({ ...settingsRef.current, inputMode: 'mouse' })
    setUiState((current) => ({
      ...current,
      cameraStatus: 'requesting',
      errorCode: null,
      errorMessage: null,
    }))

    let stream: MediaStream
    try {
      stream = await requestCameraStream()
    } catch (error) {
      const errorCode = cameraErrorCode(error)
      setUiState((current) => ({
        ...current,
        cameraStatus: 'error',
        errorCode,
        errorMessage: cameraErrorMessage(errorCode),
      }))
      return
    }

    if (!mountedRef.current) {
      stopCameraStream(stream)
      return
    }

    streamRef.current = stream
    const video = videoRef.current
    if (!video) {
      stopRuntime(false)
      return
    }

    video.srcObject = stream
    try {
      await video.play()
    } catch {
      stopRuntime(false)
      const errorCode: CameraErrorCode = 'not-readable'
      setUiState((current) => ({
        ...current,
        cameraStatus: 'error',
        errorCode,
        errorMessage: cameraErrorMessage(errorCode),
      }))
      return
    }

    setUiState((current) => ({
      ...current,
      cameraStatus: 'loading-model',
      cameraSettings: readCameraSettings(stream),
    }))

    try {
      trackerRef.current = await createHandTracker()
    } catch {
      stopRuntime(false)
      const errorCode: CameraErrorCode = 'model-load-failed'
      setUiState((current) => ({
        ...current,
        cameraStatus: 'error',
        errorCode,
        errorMessage: cameraErrorMessage(errorCode),
      }))
      return
    }

    if (!mountedRef.current) {
      stopRuntime(false)
      return
    }

    machineRef.current = createGestureMachine()
    openPalmHoldRef.current = createOpenPalmHold()
    frameCountRef.current = 0
    fpsWindowStartedAtRef.current = 0
    const hasCalibration = settingsRef.current.gesture.calibrated
    if (hasCalibration) {
      publishSettings({ ...settingsRef.current, inputMode: 'gesture' })
      publishCalibration(readyCalibration(settingsRef.current))
    } else {
      publishCalibration({
        phase: 'required',
        roiStep: 0,
        pinchCycles: 0,
        awaitingRelease: false,
        message: '请完成校准，或明确选择使用默认参数。',
      })
    }
    setUiState((current) => ({ ...current, cameraStatus: 'running' }))
    if (!document.hidden) startLoop()
  }, [publishCalibration, publishSettings, startLoop, stopRuntime])

  const setInputMode = useCallback((inputMode: InputMode) => {
    endGestureTrajectory()
    finishRendererStroke()
    if (inputMode === 'gesture' && uiState.cameraStatus !== 'running') return
    publishSettings({ ...settingsRef.current, inputMode })
  }, [endGestureTrajectory, finishRendererStroke, publishSettings, uiState.cameraStatus])

  const resumeGestureInput = useCallback(() => {
    if (machineRef.current.state !== 'PAUSED') return
    openPalmHoldRef.current = createOpenPalmHold()
    machineRef.current = {
      ...createGestureMachine(),
      state: latestHandRef.current ? 'HOVER' : 'IDLE',
      pinchRatio: latestHandRef.current?.pinchRatio ?? null,
    }
    setUiState((current) => ({
      ...current,
      diagnostics: {
        ...current.diagnostics,
        gestureState: machineRef.current.state,
        pinchRatio: machineRef.current.pinchRatio,
        openPalmHoldProgress: 0,
      },
    }))
    setWorkspaceMessage('手势输入已恢复，从悬停状态重新开始。')
  }, [])

  const setGesturePauseEnabled = useCallback((enabled: boolean) => {
    gesturePauseEnabledRef.current = enabled
    setGesturePauseEnabledState(enabled)
    openPalmHoldRef.current = createOpenPalmHold()
    try {
      saveGesturePauseEnabled(enabled)
    } catch {
      setWorkspaceMessage('张掌暂停开关未能保存，但本次仍可使用。')
    }
    if (!enabled && machineRef.current.state === 'PAUSED') {
      machineRef.current = {
        ...createGestureMachine(),
        state: latestHandRef.current ? 'HOVER' : 'IDLE',
        pinchRatio: latestHandRef.current?.pinchRatio ?? null,
      }
    }
    setUiState((current) => ({
      ...current,
      diagnostics: {
        ...current.diagnostics,
        gestureState: machineRef.current.state,
        pinchRatio: machineRef.current.pinchRatio,
        openPalmHoldProgress: 0,
      },
    }))
    setWorkspaceMessage(enabled
      ? '张掌暂停已启用：张开手掌保持 0.8 秒可暂停或恢复。'
      : '张掌暂停已关闭，鼠标与基础手势不受影响。')
  }, [])

  const attachCanvas = useCallback((canvas: HTMLCanvasElement, cursor: HTMLElement) => {
    finishRendererStroke()
    rendererRef.current.attach(canvas)
    rendererRef.current.attachCursor(cursor)
    rendererRef.current.setBrush(settingsRef.current.brush)
    rendererRef.current.setEffectsEnabled(settingsRef.current.experimentalStylesEnabled)
    rendererRef.current.setWritingROI(settingsRef.current.gesture.writingROI)
    rendererRef.current.setCompletedStrokes(documentRef.current.strokes.filter((stroke) => !stroke.cardId))
  }, [finishRendererStroke])

  const startMouseStroke = useCallback((point: { x: number; y: number }, timestamp: number) => {
    if (settingsRef.current.inputMode !== 'mouse' || tool !== 'draw') return
    rendererRef.current.startMouseStroke(point, timestamp)
  }, [tool])

  const appendMousePoint = useCallback((point: { x: number; y: number }, timestamp: number) => {
    if (settingsRef.current.inputMode !== 'mouse' || tool !== 'draw') return
    rendererRef.current.appendMousePoint(point, timestamp)
  }, [tool])

  const endMouseStroke = useCallback(() => {
    if (settingsRef.current.inputMode !== 'mouse') return
    finishRendererStroke()
  }, [finishRendererStroke])

  const updateBrush = useCallback((brush: BrushSettings) => {
    publishSettings({
      ...settingsRef.current,
      brush: settingsRef.current.experimentalStylesEnabled ? brush : { ...brush, style: 'ink' },
    })
  }, [publishSettings])

  const setExperimentalStylesEnabled = useCallback((enabled: boolean) => {
    publishSettings({
      ...settingsRef.current,
      experimentalStylesEnabled: enabled,
      brush: enabled ? settingsRef.current.brush : { ...settingsRef.current.brush, style: 'ink' },
    })
    if (!enabled) setStylePerformanceStage('full')
  }, [publishSettings])

  const undo = useCallback(() => {
    endGestureTrajectory()
    finishRendererStroke()
    const result = undoHistory(historyRef.current)
    if (!result) return
    applyDocument(result.document)
    publishHistory(result.history)
    setWorkspaceMessage(null)
  }, [applyDocument, endGestureTrajectory, finishRendererStroke, publishHistory])

  const redo = useCallback(() => {
    endGestureTrajectory()
    finishRendererStroke()
    const result = redoHistory(historyRef.current)
    if (!result) return
    applyDocument(result.document)
    publishHistory(result.history)
    setWorkspaceMessage(null)
  }, [applyDocument, endGestureTrajectory, finishRendererStroke, publishHistory])

  const clearWorkspace = useCallback(() => {
    endGestureTrajectory()
    finishRendererStroke()
    const before = documentRef.current
    if (before.strokes.length === 0 && before.cards.length === 0 && before.edges.length === 0) return
    const after = touch({ ...before, strokes: [], groups: [], cards: [], edges: [] })
    applyDocument(after)
    publishHistory(pushHistory(historyRef.current, { type: 'CLEAR_WORKSPACE', before, after }))
    setWorkspaceMessage('画布已清空，可撤销。')
  }, [applyDocument, endGestureTrajectory, finishRendererStroke, publishHistory])

  const beginCalibration = useCallback(() => {
    endGestureTrajectory()
    publishSettings({ ...settingsRef.current, inputMode: 'mouse' })
    calibrationDraftRef.current = createCalibrationDraft()
    publishCalibration({
      phase: 'roi',
      roiStep: 0,
      pinchCycles: 0,
      awaitingRelease: false,
      message: `把食指移到${ROI_TARGETS[0]}目标后记录。`,
    })
  }, [endGestureTrajectory, publishCalibration, publishSettings])

  const captureCalibrationSample = useCallback(() => {
    const latest = latestHandRef.current
    const current = calibrationRef.current
    if (!latest) {
      publishCalibration({ ...current, message: '请把手移回摄像头画面并保持可见。' })
      return
    }

    const draft = calibrationDraftRef.current
    if (current.phase === 'roi') {
      draft.roiPoints.push(latest.point)
      if (draft.roiPoints.length < 4) {
        const roiStep = draft.roiPoints.length
        publishCalibration({ ...current, roiStep, message: `把食指移到${ROI_TARGETS[roiStep]}目标后记录。` })
        return
      }

      if (!calculateWritingROI(draft.roiPoints)) {
        calibrationDraftRef.current = createCalibrationDraft()
        publishCalibration({ ...current, roiStep: 0, message: '书写区域过小，请扩大手部移动范围后重新记录四点。' })
        return
      }

      publishCalibration({
        phase: 'pinch',
        roiStep: 4,
        pinchCycles: 0,
        awaitingRelease: false,
        message: '自然捏合拇指与食指，然后记录捏合。',
      })
      return
    }

    if (current.phase !== 'pinch') return
    if (!current.awaitingRelease) {
      draft.pendingPinch = latest.pinchRatio
      publishCalibration({ ...current, awaitingRelease: true, message: '现在松开手指，然后记录松开。' })
      return
    }

    if (draft.pendingPinch === null || latest.pinchRatio <= draft.pendingPinch) {
      publishCalibration({ ...current, message: '松开距离需要大于捏合距离，请重新记录松开。' })
      return
    }

    draft.pinchCycles.push({ pinch: draft.pendingPinch, release: latest.pinchRatio })
    draft.pendingPinch = null
    const cycleCount = draft.pinchCycles.length
    if (cycleCount < 3) {
      publishCalibration({
        ...current,
        pinchCycles: cycleCount,
        awaitingRelease: false,
        message: `已完成 ${cycleCount}/3 次，请再次自然捏合。`,
      })
      return
    }

    const thresholdsStable = calculatePinchThresholds(draft.pinchCycles) !== null
    const gesture = finalizeCalibration(draft)
    const nextSettings: AirNoteSettings = { ...settingsRef.current, inputMode: 'gesture', gesture }
    publishSettings(nextSettings)
    publishCalibration({
      phase: 'review',
      roiStep: 4,
      pinchCycles: 3,
      awaitingRelease: false,
      message: thresholdsStable
        ? '请捏合绘制一条测试线，确认效果后点击“校准完成”。'
        : '校准波动较大，已使用默认灵敏度。请绘制测试线后确认。',
    })
  }, [publishCalibration, publishSettings])

  const confirmCalibration = useCallback(() => {
    rendererRef.current.finishStroke()
    rendererRef.current.setCompletedStrokes(documentRef.current.strokes.filter((stroke) => !stroke.cardId))
    machineRef.current = createGestureMachine()
    publishCalibration({
      phase: 'ready',
      roiStep: 4,
      pinchCycles: 3,
      awaitingRelease: false,
      message: settingsRef.current.gesture.usesDefaultCalibration
        ? '校准完成，已使用默认捏合灵敏度。'
        : '校准完成，手势绘图已启用。',
    })
  }, [publishCalibration])

  const skipCalibration = useCallback(() => {
    const gesture = {
      ...DEFAULT_SETTINGS.gesture,
      calibrated: true,
      usesDefaultCalibration: true,
    }
    publishSettings({ ...settingsRef.current, inputMode: 'gesture', gesture })
    publishCalibration({
      phase: 'ready',
      roiStep: 0,
      pinchCycles: 0,
      awaitingRelease: false,
      message: '已明确使用默认书写区域和捏合灵敏度。',
    })
  }, [publishCalibration, publishSettings])

  const requestGestureMode = useCallback(() => {
    if (uiState.cameraStatus !== 'running') return
    const phase = calibrationRef.current.phase
    if (phase === 'ready') {
      setInputMode('gesture')
      return
    }
    if (phase === 'idle' || phase === 'required') {
      beginCalibration()
      return
    }
    setWorkspaceMessage('请先完成当前校准，或选择直接使用默认参数。')
  }, [beginCalibration, setInputMode, uiState.cameraStatus])

  const setTool = useCallback((nextTool: WorkspaceTool) => {
    finishRendererStroke()
    setToolState(nextTool)
  }, [finishRendererStroke])

  const continueGroup = useCallback(() => applyDocument(continueCurrentGroup(documentRef.current)), [applyDocument])

  const cancelGroup = useCallback(() => {
    if (groupTimerRef.current) clearTimeout(groupTimerRef.current)
    applyDocument(cancelCurrentGroup(documentRef.current))
  }, [applyDocument])

  const suggestSelectionGroup = useCallback((strokeIds: string[]) => {
    const before = documentRef.current
    const after = suggestGroupFromSelection(before, strokeIds)
    if (after === before) {
      setWorkspaceMessage('选区内没有可生成卡片的笔画。')
      return false
    }
    if (groupTimerRef.current) clearTimeout(groupTimerRef.current)
    applyDocument(after)
    setWorkspaceMessage('已选中笔画。确认后才会生成想法卡片。')
    return true
  }, [applyDocument])

  const generateCard = useCallback(() => {
    const before = documentRef.current
    const after = createCardFromCurrentGroup(before)
    if (!after) {
      setWorkspaceMessage('无法生成卡片，请撤销最近笔画后重试。')
      return
    }
    applyDocument(after)
    publishHistory(pushHistory(historyRef.current, { type: 'CREATE_CARD', before, after }))
    setToolState('select')
  }, [applyDocument, publishHistory])

  const commitCardMove = useCallback((cardId: string, x: number, y: number, stage: { width: number; height: number }) => {
    const before = documentRef.current
    const after = moveCard(before, cardId, x, y, stage)
    const oldCard = before.cards.find((card) => card.id === cardId)
    const newCard = after.cards.find((card) => card.id === cardId)
    if (!oldCard || !newCard || (oldCard.position.x === newCard.position.x && oldCard.position.y === newCard.position.y)) return
    applyDocument(after)
    publishHistory(pushHistory(historyRef.current, { type: 'MOVE_CARD', before, after }))
  }, [applyDocument, publishHistory])

  const commitCardResize = useCallback((cardId: string, geometry: CardGeometry, stage: { width: number; height: number }) => {
    const before = documentRef.current
    const after = resizeCard(before, cardId, geometry, stage)
    const oldCard = before.cards.find((card) => card.id === cardId)
    const newCard = after.cards.find((card) => card.id === cardId)
    if (
      !oldCard
      || !newCard
      || (
        oldCard.position.x === newCard.position.x
        && oldCard.position.y === newCard.position.y
        && oldCard.size.width === newCard.size.width
        && oldCard.size.height === newCard.size.height
      )
    ) return
    applyDocument(after)
    publishHistory(pushHistory(historyRef.current, { type: 'RESIZE_CARD', before, after }))
  }, [applyDocument, publishHistory])

  const commitCardRename = useCallback((cardId: string, title: string) => {
    const before = documentRef.current
    const after = renameCard(before, cardId, title)
    applyDocument(after)
    publishHistory(pushHistory(historyRef.current, { type: 'RENAME_CARD', before, after }))
  }, [applyDocument, publishHistory])

  const commitCardDelete = useCallback((cardId: string) => {
    const before = documentRef.current
    const edgeCount = before.edges.filter((edge) => edge.sourceCardId === cardId || edge.targetCardId === cardId).length
    if (edgeCount > 0 && !window.confirm(`删除卡片将同时删除${edgeCount}条连接线。`)) return
    const after = deleteCard(before, cardId)
    applyDocument(after)
    publishHistory(pushHistory(historyRef.current, { type: 'DELETE_CARD', before, after }))
  }, [applyDocument, publishHistory])

  const commitEdge = useCallback((sourceCardId: string, targetCardId: string, sourceAnchor: EdgeAnchor, targetAnchor: EdgeAnchor) => {
    const before = documentRef.current
    const after = createEdge(before, sourceCardId, targetCardId, edgeType, sourceAnchor, targetAnchor)
    if (!after) return false
    applyDocument(after)
    publishHistory(pushHistory(historyRef.current, { type: 'CREATE_EDGE', before, after }))
    return true
  }, [applyDocument, edgeType, publishHistory])

  const commitEdgeType = useCallback((edgeId: string, type: Edge['type']) => {
    const before = documentRef.current
    const after = updateEdgeType(before, edgeId, type)
    if (after === before) return
    applyDocument(after)
    publishHistory(pushHistory(historyRef.current, { type: 'UPDATE_EDGE', before, after }))
  }, [applyDocument, publishHistory])

  const createProjectSnapshot = useCallback(() => {
    endGestureTrajectory()
    finishRendererStroke()
    return projectFromDocument(documentRef.current, settingsRef.current)
  }, [endGestureTrajectory, finishRendererStroke])

  const replaceProject = useCallback((project: AirNoteProject) => {
    endGestureTrajectory()
    finishRendererStroke()
    if (groupTimerRef.current) {
      clearTimeout(groupTimerRef.current)
      groupTimerRef.current = null
    }
    const { schemaVersion: _schemaVersion, settings: importedSettings, ...document } = project
    const safeSettings = { ...importedSettings, inputMode: 'mouse' as const }
    machineRef.current = createGestureMachine()
    applyDocument(document)
    publishSettings(safeSettings)
    publishCalibration(readyCalibration(safeSettings))
    publishHistory(createWorkspaceHistory())
    setToolState('draw')
    setEdgeType('undirected')
    setSaveStatus('saving')
    try {
      if (projectId) {
        saveWorkspaceById(projectId, projectFromDocument(document, safeSettings))
      } else {
        saveWorkspace(projectFromDocument(document, safeSettings))
      }
      setSaveStatus('saved')
      setWorkspaceMessage('项目已导入并保存到本地。')
    } catch (error) {
      setSaveStatus('error')
      const isQuota = error instanceof DOMException && error.name === 'QuotaExceededError'
      setWorkspaceMessage(isQuota
        ? '项目已导入，但本地存储空间不足，请立即导出项目备份。'
        : '项目已导入，但本地保存失败，请立即导出项目备份。')
    }
  }, [applyDocument, endGestureTrajectory, finishRendererStroke, publishCalibration, publishHistory, publishSettings])

  const reportWorkspaceMessage = useCallback((message: string | null) => {
    setWorkspaceMessage(message)
  }, [])

  const completeOnboarding = useCallback(() => {
    setOnboardingCompleted(true)
    try {
      sessionStorage.setItem('airnote.onboarding.completed', 'true')
    } catch {
      // onboarding completion is optional
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const publish = () => {
      const reduced = media?.matches === true
      setReducedMotion(reduced)
      rendererRef.current.setReducedMotion(reduced)
    }
    publish()
    media?.addEventListener?.('change', publish)
    return () => media?.removeEventListener?.('change', publish)
  }, [])

  useEffect(() => {
    rendererRef.current.setPerformanceListener((stage) => {
      setStylePerformanceStage(stage)
      if (stage !== 'full') setWorkspaceMessage('已开启性能模式，实验视觉已自动降级。')
    })
    return () => rendererRef.current.setPerformanceListener(null)
  }, [])

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true
      rendererRef.current.setCompletedStrokes(documentState.strokes.filter((stroke) => !stroke.cardId))
      return
    }
    setSaveStatus('saving')
    const timer = setTimeout(() => {
      try {
        const project = projectFromDocument(documentRef.current, settingsRef.current)
        if (projectId) {
          saveWorkspaceById(projectId, project)
          addOrUpdateProjectIndex({
            id: projectId,
            name: project.workspace.name,
            updatedAt: Date.now(),
            strokeCount: project.strokes.length,
            cardCount: project.cards.length,
          })
        } else {
          saveWorkspace(project)
        }
        setSaveStatus('saved')
      } catch (error) {
        setSaveStatus('error')
        const isQuota = error instanceof DOMException && error.name === 'QuotaExceededError'
        setWorkspaceMessage(isQuota
          ? '本地存储空间不足，请导出项目后清理画布。'
          : error instanceof Error ? error.message : '本地保存失败。')
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [documentState, settings])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) stopLoop()
      else if (trackerRef.current && streamRef.current) startLoop()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [startLoop, stopLoop])

  useEffect(() => {
    const handleBlur = () => {
      endGestureTrajectory()
      finishRendererStroke()
    }
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [endGestureTrajectory, finishRendererStroke])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key.toLowerCase() !== 'z') return
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [redo, undo])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (groupTimerRef.current) clearTimeout(groupTimerRef.current)
      stopRuntime(false)
    }
  }, [stopRuntime])

  return {
    uiState,
    settings,
    document: documentState,
    strokes: documentState.strokes,
    currentGroup: documentState.groups.find((group) => group.status !== 'committed') ?? null,
    tool,
    edgeType,
    stylePerformanceStage,
    reducedMotion,
    gesturePauseEnabled,
    saveStatus,
    calibration,
    workspaceMessage,
    canUndo: history.undoStack.length > 0,
    canRedo: history.redoStack.length > 0,
    videoRef,
    enableCamera,
    disableCamera,
    setInputMode,
    requestGestureMode,
    attachCanvas,
    startMouseStroke,
    appendMousePoint,
    endMouseStroke,
    updateBrush,
    setExperimentalStylesEnabled,
    setGesturePauseEnabled,
    resumeGestureInput,
    undo,
    redo,
    clearWorkspace,
    beginCalibration,
    captureCalibrationSample,
    confirmCalibration,
    skipCalibration,
    setTool,
    setEdgeType,
    continueGroup,
    cancelGroup,
    suggestSelectionGroup,
    generateCard,
    commitCardMove,
    commitCardResize,
    commitCardRename,
    commitCardDelete,
    commitEdge,
    commitEdgeType,
    createProjectSnapshot,
    replaceProject,
    reportWorkspaceMessage,
    onboardingCompleted,
    completeOnboarding,
  }
}
