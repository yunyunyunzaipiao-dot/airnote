import { ROI_TARGETS } from '../camera/calibration'
import type { CalibrationUiState } from '../store/useAirNoteRuntime'

interface CalibrationPanelProps {
  calibration: CalibrationUiState
  cameraRunning: boolean
  onBegin: () => void
  onCapture: () => void
  onConfirm: () => void
  onSkip: () => void
}

export function CalibrationPanel({
  calibration,
  cameraRunning,
  onBegin,
  onCapture,
  onConfirm,
  onSkip,
}: CalibrationPanelProps) {
  if (!cameraRunning) return null

  const captureLabel = calibration.phase === 'roi'
    ? `记录${ROI_TARGETS[calibration.roiStep] ?? '目标'}位置`
    : calibration.awaitingRelease ? '记录松开' : '记录捏合'

  return (
    <section className="panel calibration-panel" aria-labelledby="calibration-title">
      <div className="panel-heading">
        <div>
          <p className="panel-number">03</p>
          <h2 id="calibration-title">书写校准</h2>
        </div>
        <span className="panel-state">
          {calibration.phase === 'ready' ? '已就绪' : '待完成'}
        </span>
      </div>

      <p className="calibration-message" role="status">{calibration.message}</p>
      {calibration.phase === 'roi' ? <p className="calibration-progress">区域点 {calibration.roiStep}/4</p> : null}
      {calibration.phase === 'pinch' ? <p className="calibration-progress">捏合循环 {calibration.pinchCycles}/3</p> : null}

      <div className="calibration-actions">
        {calibration.phase === 'review' ? (
          <button type="button" onClick={onConfirm}>校准完成</button>
        ) : calibration.phase === 'required' || calibration.phase === 'ready' ? (
          <button type="button" onClick={onBegin}>
            {calibration.phase === 'ready' ? '重新校准' : '开始校准'}
          </button>
        ) : (
          <button type="button" onClick={onCapture}>{captureLabel}</button>
        )}
        {calibration.phase !== 'ready' && calibration.phase !== 'review' ? (
          <button type="button" className="secondary-action" onClick={onSkip}>使用默认设置</button>
        ) : null}
      </div>
    </section>
  )
}
