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
  requesting: '请求权限',
  'loading-model': '加载模型',
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
    <section className="panel camera-panel" aria-labelledby="camera-title">
      <div className="panel-heading">
        <div>
          <p className="panel-number">01</p>
          <h2 id="camera-title">摄像头预览</h2>
        </div>
        <span className={`panel-state panel-state--${status}`}>{statusLabels[status]}</span>
      </div>

      <div className="camera-preview">
        <video ref={videoRef} muted playsInline aria-label="镜像摄像头预览" />
        {!isRunning ? (
          <div className="camera-preview__empty">
            <strong>LOCAL VIDEO ONLY</strong>
            <span>不会录制、保存或上传画面</span>
          </div>
        ) : null}
        <div className="camera-corners" aria-hidden="true" />
      </div>

      <p className="privacy-note">视频只用于浏览器本地手部识别。只有点击启用后才会请求权限。</p>
      {settings.width && settings.height ? (
        <p className="camera-metadata">
          实际输入 {settings.width}×{settings.height}
          {settings.frameRate ? ` · ${settings.frameRate.toFixed(0)} FPS` : ''}
        </p>
      ) : null}
      {errorMessage ? <p className="inline-error" role="alert">{errorMessage}</p> : null}

      <div className="input-mode-switch" role="group" aria-label="输入模式">
        <button
          type="button"
          aria-pressed={inputMode === 'mouse'}
          className={inputMode === 'mouse' ? 'is-active' : ''}
          onClick={() => onInputModeChange('mouse')}
        >
          鼠标模式
        </button>
        <button
          type="button"
          aria-pressed={inputMode === 'gesture'}
          className={inputMode === 'gesture' ? 'is-active' : ''}
          onClick={canUseGesture ? () => onInputModeChange('gesture') : onGestureRequest}
          disabled={!isRunning}
          title={!canUseGesture ? '点击开始或继续手势校准' : '切换到手势模式'}
        >
          {canUseGesture ? '手势模式' : '设置手势模式'}
        </button>
      </div>

      {isRunning && !canUseGesture ? (
        <div className="gesture-setup-callout" role="status">
          <p>手势画笔需要先完成校准。也可以明确使用默认参数立即启用。</p>
          <button type="button" onClick={onUseDefaultCalibration}>直接使用默认参数</button>
        </div>
      ) : null}

      {isRunning ? (
        <button className="camera-action camera-action--stop" type="button" onClick={onDisable}>
          关闭摄像头
        </button>
      ) : (
        <button className="camera-action" type="button" onClick={onEnable} disabled={isBusy}>
          {isBusy ? statusLabels[status] : '启用摄像头'}
        </button>
      )}
    </section>
  )
}
