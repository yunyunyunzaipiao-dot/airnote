import { useState } from 'react'
import type { StylePerformanceStage } from '../drawing/canvasRenderer'
import { addColorToHistory, loadColorHistory, saveColorHistory } from '../persistence/colorHistoryStorage'
import type { BrushSettings, BrushWidth, VisualStyle } from '../types/workspace'
import { ColorPicker } from './ColorPicker'

interface PropertyPanelProps {
  brush: BrushSettings
  experimentalStylesEnabled: boolean
  performanceStage: StylePerformanceStage
  reducedMotion: boolean
  onChange: (brush: BrushSettings) => void
  onExperimentalStylesChange: (enabled: boolean) => void
}

const WIDTHS: BrushWidth[] = [2, 4, 8]
const STYLE_LABELS: Record<VisualStyle, string> = { ink: 'Ink', glow: 'Glow', particle: 'Particle' }

export function PropertyPanel({
  brush,
  experimentalStylesEnabled,
  performanceStage,
  reducedMotion,
  onChange,
  onExperimentalStylesChange,
}: PropertyPanelProps) {
  const [colorHistory, setColorHistory] = useState(() => loadColorHistory(brush.color))
  const rememberColor = (color: string) => {
    setColorHistory((history) => {
      const next = addColorToHistory(history, color)
      saveColorHistory(next)
      return next
    })
  }

  return (
    <section className="panel property-panel" aria-labelledby="property-title">
      <div className="panel-heading">
        <div>
          <p className="panel-number">04</p>
          <h2 id="property-title">画笔属性</h2>
        </div>
        <span className="panel-state">{STYLE_LABELS[brush.style]}</span>
      </div>

      <fieldset>
        <span className="field-label">笔迹颜色</span>
        <ColorPicker
          value={brush.color}
          history={colorHistory}
          onChange={(color) => onChange({ ...brush, color })}
          onCommit={rememberColor}
        />

        <span className="field-label">笔迹粗细</span>
        <div className="width-options" role="group" aria-label="笔迹粗细">
          {WIDTHS.map((width) => (
            <button
              key={width}
              type="button"
              className={brush.width === width ? 'is-active' : ''}
              aria-pressed={brush.width === width}
              onClick={() => onChange({ ...brush, width })}
            >
              {width}px
            </button>
          ))}
        </div>

        <div className="experimental-style-toggle">
          <div><strong>实验视觉</strong><span>失败时自动回退，不影响画笔</span></div>
          <button
            type="button"
            aria-pressed={experimentalStylesEnabled}
            onClick={() => onExperimentalStylesChange(!experimentalStylesEnabled)}
          >{experimentalStylesEnabled ? '关闭' : '启用'}</button>
        </div>

        <label htmlFor="visual-style">视觉风格</label>
        <select
          id="visual-style"
          value={experimentalStylesEnabled ? brush.style : 'ink'}
          disabled={!experimentalStylesEnabled}
          aria-label="视觉风格"
          onChange={(event) => onChange({ ...brush, style: event.target.value as VisualStyle })}
        >
          <option value="ink">Ink</option>
          <option value="glow">Glow</option>
          <option value="particle">Particle</option>
        </select>
        {reducedMotion ? <p className="style-status">系统已启用减少动态效果：已关闭动态衰减，保留静态粒子轮廓。</p> : null}
        {performanceStage !== 'full' ? <p className="style-status" role="status">性能模式已开启：{performanceStage === 'reduced-particles' ? '已减少粒子数量。' : '已关闭拖尾。'}</p> : null}
      </fieldset>
    </section>
  )
}
