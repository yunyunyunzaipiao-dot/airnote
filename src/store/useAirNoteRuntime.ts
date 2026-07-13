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
import { StrokeCanvasRenderer } from '../drawing/canvasRenderer'
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
import { loadSettings, saveSettings } from '../persistence/settingsStorage'
import type { CameraErrorCode, M0UiState, NormalizedPoint, RuntimeDiagnostics } from '../types/m0'
import {
  DEFAULT_SETTINGS,
  type AirNoteSettings,
  type BrushSettings,
  type InputMode,
  type Stroke,
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

export function useAirNoteRuntime() {
  const initialSettingsRef = useRef<AirNoteSettings | null>(null)
  if (!initialSettingsRef.current) {
    initialSettingsRef.current = { ...loadSettings(), inputMode: 'mouse' }
  }

  const [uiState, setUiState] = useState<M0UiState>(INITIAL_UI_STATE)
  const [settings, setSettings] = useState<AirNoteSettings>(initialSettingsRef.current)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [history, setHistory] = useState<WorkspaceHistoryState>(() => createWorkspaceHistory())
  const [calibration, setCalibration] = useState<CalibrationUiState>(() => readyCalibration(initialSettingsRef.current!))
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const trackerRef = useRef<HandTracker | null>(null)
  const loopRef = useRef<VideoFrameLoop | null>(null)
  const rendererRef = useRef(new StrokeCanvasRenderer())
  const machineRef = useRef(createGestureMachine())
  const settingsRef = useRef(settings)
  const strokesRef = useRef(strokes)
  const historyRef = useRef(history)
  const calibrationRef = useRef(calibration)
  const calibrationDraftRef = useRef<CalibrationDraft>(createCalibrationDraft())
  const latestHandRef = useRef<{ point: NormalizedPoint; pinchRatio: number } | null>(null)
  const diagnosticsRef = useRef(EMPTY_DIAGNOSTICS)
  const mountedRef = useRef(true)
  const frameCountRef = useRef(0)
  const fpsWindowStartedAtRef = useRef(0)
  const lastHudUpdateAtRef = useRef(0)

  const publishCalibration = useCallback((next: CalibrationUiState) => {
    calibrationRef.current = next
    setCalibration(next)
  }, [])

  const publishSettings = useCallback((next: AirNoteSettings) => {
    settingsRef.current = next
    rendererRef.current.setBrush(next.brush)
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

  const applyStrokes = useCallback((next: Stroke[]) => {
    strokesRef.current = next
    rendererRef.current.setCompletedStrokes(next)
    setStrokes(next)
  }, [])

  const publishHistory = useCallback((next: WorkspaceHistoryState) => {
    historyRef.current = next
    setHistory(next)
  }, [])

  const commitStroke = useCallback((stroke: Stroke | null) => {
    if (!stroke) return
    const before = strokesRef.current
    const after = [...before, stroke]
    applyStrokes(after)
    publishHistory(pushHistory(historyRef.current, { type: 'ADD_STROKE', before, after }))
  }, [applyStrokes, publishHistory])

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
    result.commands.forEach((command) => {
      const stroke = rendererRef.current.handleGesture(command)
      if (calibrationRef.current.phase === 'ready') commitStroke(stroke)
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
          const result = stepGestureMachine(
            machineRef.current,
            frame,
            settingsRef.current.gesture.pinchDownThreshold,
            settingsRef.current.gesture.pinchUpThreshold,
          )
          machineRef.current = result.machine
          result.commands.forEach((command) => {
            const stroke = rendererRef.current.handleGesture(command)
            if (calibrationPhase === 'ready') commitStroke(stroke)
          })
        } else {
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

  const attachCanvas = useCallback((canvas: HTMLCanvasElement, cursor: HTMLElement) => {
    finishRendererStroke()
    rendererRef.current.attach(canvas)
    rendererRef.current.attachCursor(cursor)
    rendererRef.current.setBrush(settingsRef.current.brush)
    rendererRef.current.setWritingROI(settingsRef.current.gesture.writingROI)
    rendererRef.current.setCompletedStrokes(strokesRef.current)
  }, [finishRendererStroke])

  const startMouseStroke = useCallback((point: { x: number; y: number }, timestamp: number) => {
    if (settingsRef.current.inputMode !== 'mouse') return
    rendererRef.current.startMouseStroke(point, timestamp)
  }, [])

  const appendMousePoint = useCallback((point: { x: number; y: number }, timestamp: number) => {
    if (settingsRef.current.inputMode !== 'mouse') return
    rendererRef.current.appendMousePoint(point, timestamp)
  }, [])

  const endMouseStroke = useCallback(() => {
    if (settingsRef.current.inputMode !== 'mouse') return
    finishRendererStroke()
  }, [finishRendererStroke])

  const updateBrush = useCallback((brush: BrushSettings) => {
    publishSettings({ ...settingsRef.current, brush })
  }, [publishSettings])

  const undo = useCallback(() => {
    endGestureTrajectory()
    finishRendererStroke()
    const result = undoHistory(historyRef.current)
    if (!result) return
    applyStrokes(result.strokes)
    publishHistory(result.history)
    setWorkspaceMessage(null)
  }, [applyStrokes, endGestureTrajectory, finishRendererStroke, publishHistory])

  const redo = useCallback(() => {
    endGestureTrajectory()
    finishRendererStroke()
    const result = redoHistory(historyRef.current)
    if (!result) return
    applyStrokes(result.strokes)
    publishHistory(result.history)
    setWorkspaceMessage(null)
  }, [applyStrokes, endGestureTrajectory, finishRendererStroke, publishHistory])

  const clearWorkspace = useCallback(() => {
    endGestureTrajectory()
    finishRendererStroke()
    const before = strokesRef.current
    if (before.length === 0) return
    const after: Stroke[] = []
    applyStrokes(after)
    publishHistory(pushHistory(historyRef.current, { type: 'CLEAR_WORKSPACE', before, after }))
    setWorkspaceMessage('画布已清空，可撤销。')
  }, [applyStrokes, endGestureTrajectory, finishRendererStroke, publishHistory])

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
    rendererRef.current.setCompletedStrokes(strokesRef.current)
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
      stopRuntime(false)
    }
  }, [stopRuntime])

  return {
    uiState,
    settings,
    strokes,
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
    undo,
    redo,
    clearWorkspace,
    beginCalibration,
    captureCalibrationSample,
    confirmCalibration,
    skipCalibration,
  }
}
