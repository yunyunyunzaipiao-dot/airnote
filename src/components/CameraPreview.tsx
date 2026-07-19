import type { RefObject } from 'react'
import type { CameraSettings, CameraStatus } from '../types/m0'
import type { InputMode } from '../types/workspace'

interface CameraPreviewProps {
  status: CameraStatus
  settings: CameraSettings
  errorMessage: string | null
  inputMode: InputMode
  canUseGesture: boolean
  videoRef: RefObject<HTMLVideoElement | null>
  onEnable: () => void
  onDisable: () => void
  onInputModeChange: (mode: InputMode) => void
  onGestureRequest: () => void
  onUseDefaultCalibration: () => void
}

const statusLabels: Record<CameraStatus, string> = {
  idle: '未启用',
  requesting: '请求中',
  'loading-model': '加载中',
  running: '已启用',
  stopped: '已关闭',
  error: '启动失败',
}

export function CameraPreview({
  status,
  settings,
  errorMessage,
  inputMode,
  canUseGesture,
  videoRef,
  onEnable,
  onDisable,
  onInputModeChange,
  onGestureRequest,
  onUseDefaultCalibration,
}: CameraPreviewProps) {
  const isBusy = status === 'requesting' || status === 'loading-model'
  const isRunning = status === 'running'

  return (
    <section className="camera-panel-mini" aria-label="摄像头与输入模式">
      <div className="camera-preview-mini">
        <video ref={videoRef} muted playsInline aria-label="镜像摄像头预览" />
        {!isRunning ? (
          <div className="camera-preview-mini__empty">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
        ) : null}
      </div>

      <div className="camera-actions-mini">
        <button
          type="button"
          className={`camera-mode-btn ${inputMode === 'mouse' ? 'camera-mode-btn--active' : ''}`}
          aria-label="鼠标模式"
          aria-pressed={inputMode === 'mouse'}
          title="鼠标模式"
          onClick={() => onInputModeChange('mouse')}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="3" width="12" height="18" rx="6" />
            <line x1="12" y1="7" x2="12" y2="11" />
          </svg>
        </button>
        <button
          type="button"
          className={`camera-mode-btn ${inputMode === 'gesture' ? 'camera-mode-btn--active' : ''}`}
          aria-label="摄像头手势模式"
          aria-pressed={inputMode === 'gesture'}
          title={canUseGesture ? '手势模式' : '请先校准手势'}
          onClick={canUseGesture ? () => onInputModeChange('gesture') : onGestureRequest}
          disabled={!isRunning}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v0" />
            <path d="M14 10V4a2 2 0 00-2-2v0a2 2 0 00-2 2v2" />
            <path d="M10 10.5V6a2 2 0 00-2-2v0a2 2 0 00-2 2v8.5" />
            <path d="M18.5 15.5c.5-1.5.5-2.5-.5-3.5s-2.5-1-4-.5" />
            <path d="M6 12c-1.5.5-2.5 1.5-2.5 3s1 2.5 2 3.5 3 2 5 2 4-.5 5.5-1.5 2-2.5 2.5-4" />
          </svg>
        </button>
      </div>

      {!isRunning ? (
        <button className="camera-toggle-btn" type="button" onClick={onEnable} disabled={isBusy} title="启用摄像头">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>
      ) : (
        <button className="camera-toggle-btn camera-toggle-btn--stop" type="button" onClick={onDisable} title="关闭摄像头">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
          </svg>
        </button>
      )}

      <span className="camera-status-label">{statusLabels[status]}</span>

      {isRunning && !canUseGesture ? (
        <button type="button" className="camera-default-btn" onClick={onUseDefaultCalibration}>
          直接使用默认参数
        </button>
      ) : null}

      {errorMessage ? <p className="camera-error-mini" role="alert">{errorMessage}</p> : null}
    </section>
  )
}
