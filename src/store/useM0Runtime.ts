import { useCallback, useEffect, useRef, useState } from 'react'
import {
  cameraErrorCode,
  cameraErrorMessage,
  readCameraSettings,
  requestCameraStream,
  stopCameraStream,
} from '../camera/camera'
import { DiagnosticCanvasRenderer } from '../drawing/canvasRenderer'
import {
  createGestureMachine,
  stepGestureMachine,
  stopGestureMachine,
} from '../gesture/pinchStateMachine'
import { createHandTracker, type HandTracker } from '../handTracking/handTracker'
import { startVideoFrameLoop, type VideoFrameLoop } from '../handTracking/videoFrameLoop'
import type { CameraErrorCode, M0UiState, RuntimeDiagnostics } from '../types/m0'

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

export function useM0Runtime() {
  const [uiState, setUiState] = useState<M0UiState>(INITIAL_UI_STATE)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const trackerRef = useRef<HandTracker | null>(null)
  const loopRef = useRef<VideoFrameLoop | null>(null)
  const rendererRef = useRef(new DiagnosticCanvasRenderer())
  const machineRef = useRef(createGestureMachine())
  const diagnosticsRef = useRef(EMPTY_DIAGNOSTICS)
  const mountedRef = useRef(true)
  const frameCountRef = useRef(0)
  const fpsWindowStartedAtRef = useRef(0)
  const lastHudUpdateAtRef = useRef(0)

  const publishDiagnostics = useCallback((inferenceMs: number) => {
    const now = performance.now()
    frameCountRef.current += 1

    if (fpsWindowStartedAtRef.current === 0) {
      fpsWindowStartedAtRef.current = now
    }

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

  const endActiveTrajectory = useCallback(() => {
    const result = stopGestureMachine(machineRef.current)
    machineRef.current = result.machine
    result.commands.forEach((command) => rendererRef.current.handle(command))
  }, [])

  const stopLoop = useCallback(() => {
    loopRef.current?.stop()
    loopRef.current = null
    endActiveTrajectory()
  }, [endActiveTrajectory])

  const startLoop = useCallback(() => {
    const video = videoRef.current
    const tracker = trackerRef.current
    if (!video || !tracker || loopRef.current) return

    loopRef.current = startVideoFrameLoop(video, (timestamp) => {
      try {
        const frame = tracker.detect(video, timestamp)
        const result = stepGestureMachine(machineRef.current, frame)
        machineRef.current = result.machine
        result.commands.forEach((command) => rendererRef.current.handle(command))
        publishDiagnostics(frame.inferenceMs)
      } catch (error) {
        console.error('Hand tracking inference failed.', error)
        stopLoop()
        trackerRef.current?.close()
        trackerRef.current = null
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
  }, [publishDiagnostics, stopLoop])

  const stopRuntime = useCallback((publishStoppedState = true) => {
    stopLoop()
    trackerRef.current?.close()
    trackerRef.current = null
    stopCameraStream(streamRef.current)
    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    if (publishStoppedState && mountedRef.current) {
      setUiState((current) => ({
        ...current,
        cameraStatus: 'stopped',
        errorCode: null,
        errorMessage: null,
        diagnostics: EMPTY_DIAGNOSTICS,
      }))
    }
  }, [stopLoop])

  const enableCamera = useCallback(async () => {
    stopRuntime(false)
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
    setUiState((current) => ({ ...current, cameraStatus: 'running' }))
    if (!document.hidden) startLoop()
  }, [startLoop, stopRuntime])

  const attachCanvas = useCallback((canvas: HTMLCanvasElement, cursor: HTMLElement) => {
    endActiveTrajectory()
    rendererRef.current.attach(canvas)
    rendererRef.current.attachCursor(cursor)
  }, [endActiveTrajectory])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopLoop()
      } else if (trackerRef.current && streamRef.current) {
        startLoop()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [startLoop, stopLoop])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopRuntime(false)
    }
  }, [stopRuntime])

  return {
    uiState,
    videoRef,
    enableCamera,
    disableCamera: stopRuntime,
    attachCanvas,
  }
}
