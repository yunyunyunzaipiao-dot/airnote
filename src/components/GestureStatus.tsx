import type { RuntimeDiagnostics } from '../types/m0'

interface GestureStatusProps {
  diagnostics: RuntimeDiagnostics
  onResume: () => void
}

const stateLabels: Record<RuntimeDiagnostics['gestureState'], string> = {
  IDLE: '未检测',
  HOVER: '悬停',
  DRAWING: '落笔',
  PAUSED: '已暂停',
  TRACKING_LOST: '手丢失',
}

export function GestureStatus({
  diagnostics,
  onResume,
}: GestureStatusProps) {
  return (
    <section className="gesture-panel-mini" aria-label="手势状态">
      <div className={`gesture-readout-mini gesture-readout-mini--${diagnostics.gestureState.toLowerCase()}`}>
        <div className="gesture-readout-mini__pulse" aria-hidden="true" />
        <span className="gesture-readout-mini__text">{stateLabels[diagnostics.gestureState]}</span>
      </div>

      {diagnostics.gestureState === 'PAUSED' ? (
        <button
          type="button"
          className="gesture-icon-btn gesture-icon-btn--resume"
          aria-label="恢复手势"
          title="恢复手势"
          onClick={onResume}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
      ) : null}
    </section>
  )
}
