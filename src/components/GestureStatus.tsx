import type { CSSProperties } from 'react'
import type { RuntimeDiagnostics } from '../types/m0'

interface GestureStatusProps {
  diagnostics: RuntimeDiagnostics
  pauseEnabled: boolean
  gestureModeActive: boolean
  onPauseEnabledChange: (enabled: boolean) => void
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
  pauseEnabled,
  gestureModeActive,
  onPauseEnabledChange,
  onResume,
}: GestureStatusProps) {
  const holdPercent = Math.round(diagnostics.openPalmHoldProgress * 100)

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

      <div className="gesture-pause-control">
        <div className="gesture-pause-control__heading">
          <div>
            <strong>张掌暂停</strong>
            <span>实验功能 · 保持 0.8 秒</span>
          </div>
          <button
            type="button"
            className="gesture-pause-control__toggle"
            aria-label={pauseEnabled ? '关闭张掌暂停' : '启用张掌暂停'}
            aria-pressed={pauseEnabled}
            onClick={() => onPauseEnabledChange(!pauseEnabled)}
          >
            {pauseEnabled ? '关闭' : '启用'}
          </button>
        </div>

        <div className="gesture-pause-control__status">
          <div
            className="gesture-hold-ring"
            role="progressbar"
            aria-label="张掌保持进度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={holdPercent}
            style={{ '--gesture-hold-progress': `${holdPercent * 3.6}deg` } as CSSProperties}
          >
            <span>{holdPercent}%</span>
          </div>
          <p>
            {!pauseEnabled
              ? '默认关闭，不影响基础手势。'
              : diagnostics.gestureState === 'PAUSED'
                ? '输入已暂停；再次张掌保持，或手动恢复。'
                : gestureModeActive
                  ? '张开手掌并稳定保持，即可暂停。'
                  : '切换到手势模式后生效。'}
          </p>
        </div>

        {diagnostics.gestureState === 'PAUSED' ? (
          <button type="button" className="gesture-pause-control__resume" onClick={onResume}>
            恢复手势
          </button>
        ) : null}
      </div>
    </section>
  )
}
