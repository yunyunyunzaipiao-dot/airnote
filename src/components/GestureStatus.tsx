import type { RuntimeDiagnostics } from '../types/m0'

interface GestureStatusProps {
  diagnostics: RuntimeDiagnostics
}

const stateLabels: Record<RuntimeDiagnostics['gestureState'], string> = {
  IDLE: '未检测',
  HOVER: '悬停',
  DRAWING: '落笔',
  TRACKING_LOST: '手丢失',
}

export function GestureStatus({ diagnostics }: GestureStatusProps) {
  return (
    <section className="panel gesture-panel" aria-labelledby="gesture-title">
      <div className="panel-heading">
        <div>
          <p className="panel-number">02</p>
          <h2 id="gesture-title">手势状态</h2>
        </div>
        <span className="panel-state">本地识别</span>
      </div>

      <div className={`gesture-readout gesture-readout--${diagnostics.gestureState.toLowerCase()}`}>
        <div className="gesture-readout__pulse" aria-hidden="true" />
        <div>
          <strong>{diagnostics.gestureState}</strong>
          <span>{stateLabels[diagnostics.gestureState]}</span>
        </div>
      </div>

      <dl className="diagnostics-grid">
        <div><dt>推理 FPS</dt><dd>{diagnostics.fps.toFixed(1)}</dd></div>
        <div><dt>推理耗时</dt><dd>{diagnostics.inferenceMs.toFixed(1)} ms</dd></div>
        <div><dt>捏合比例</dt><dd>{diagnostics.pinchRatio?.toFixed(3) ?? '—'}</dd></div>
        <div><dt>丢失帧</dt><dd>{diagnostics.lostFrames}</dd></div>
      </dl>
    </section>
  )
}
