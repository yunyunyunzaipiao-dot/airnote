export type CameraStatus =
  | 'idle'
  | 'requesting'
  | 'loading-model'
  | 'running'
  | 'stopped'
  | 'error'

export type CameraErrorCode =
  | 'not-allowed'
  | 'not-found'
  | 'not-readable'
  | 'insecure-context'
  | 'unsupported'
  | 'model-load-failed'
  | 'tracking-runtime-failed'
  | 'unknown'

export type GestureState = 'IDLE' | 'HOVER' | 'DRAWING' | 'PAUSED' | 'TRACKING_LOST'

export interface NormalizedPoint {
  x: number
  y: number
  z?: number
}

export interface CanvasPoint {
  x: number
  y: number
}

export interface HandFrame {
  landmarks: NormalizedPoint[] | null
  timestamp: number
  inferenceMs: number
}

export type GestureCommand =
  | { type: 'START_STROKE'; point: NormalizedPoint; timestamp: number }
  | { type: 'APPEND_POINT'; point: NormalizedPoint; timestamp: number }
  | { type: 'END_STROKE'; reason: 'pinch-up' | 'tracking-lost' | 'frame-gap' | 'stopped' }

export interface GestureMachineState {
  state: GestureState
  downFrames: number
  upFrames: number
  lostFrames: number
  lastFrameAt: number | null
  lastIndexTip: NormalizedPoint | null
  pinchRatio: number | null
}

export interface GestureMachineResult {
  machine: GestureMachineState
  commands: GestureCommand[]
}

export interface CameraSettings {
  width: number | null
  height: number | null
  frameRate: number | null
  deviceId: string | null
}

export interface RuntimeDiagnostics {
  fps: number
  inferenceMs: number
  pinchRatio: number | null
  lostFrames: number
  gestureState: GestureState
  openPalmHoldProgress: number
}

export interface M0UiState {
  cameraStatus: CameraStatus
  cameraSettings: CameraSettings
  errorCode: CameraErrorCode | null
  errorMessage: string | null
  diagnostics: RuntimeDiagnostics
}
