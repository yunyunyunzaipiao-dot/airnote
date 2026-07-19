import { useState } from 'react'
import type { StylePerformanceStage } from '../drawing/canvasRenderer'
import { addColorToHistory, loadColorHistory, saveColorHistory } from '../persistence/colorHistoryStorage'
import type { BrushSettings, BrushWidth } from '../types/workspace'

interface MiniPropertyPanelProps {
  brush: BrushSettings
  experimentalStylesEnabled: boolean
  performanceStage: StylePerformanceStage
  reducedMotion: boolean
  onChange: (brush: BrushSettings) => void
  onExperimentalStylesChange: (enabled: boolean) => void
  onClose: () => void
}

const WIDTHS: BrushWidth[] = [2, 4, 8]

const PRESET_COLORS = [
  '#000000', '#FF3B30', '#FF9500', '#FFCC00',
  '#4CD964', '#5AC8FA', '#007AFF', '#5856D6',
  '#FF2D55', '#8E8E93', '#C7C7CC', '#FFFFFF',
]

export function MiniPropertyPanel({
  brush,
  experimentalStylesEnabled,
  performanceStage,
  reducedMotion,
  onChange,
  onExperimentalStylesChange,
  onClose,
}: MiniPropertyPanelProps) {
  const [colorHistory, setColorHistory] = useState(() => loadColorHistory(brush.color))
  const rememberColor = (color: string) => {
    setColorHistory((history) => {
      const next = addColorToHistory(history, color)
      saveColorHistory(next)
      return next
    })
  }

  const setColor = (color: string) => {
    onChange({ ...brush, color })
    rememberColor(color)
  }

  return (
    <div className="mini-property-panel">
      <div className="mini-property-panel__header">
        <span>画笔属性</span>
        <button type="button" className="mini-property-panel__close" onClick={onClose} aria-label="关闭">×</button>
      </div>

      <div className="mini-property-section">
        <span className="mini-property-label">颜色</span>
        <div className="color-dots">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`color-dot ${brush.color.toUpperCase() === color.toUpperCase() ? 'color-dot--active' : ''}`}
              aria-label={`选择颜色 ${color}`}
              style={{ backgroundColor: color, borderColor: color === '#FFFFFF' ? '#ddd' : color }}
              onClick={() => setColor(color)}
            />
          ))}
        </div>
      </div>

      <div className="mini-property-section">
        <span className="mini-property-label">笔刷样式</span>
        <div className="brush-style-dots">
          {(['ink', 'glow', 'particle'] as const).map((style) => (
            <button
              key={style}
              type="button"
              className={`brush-style-dot ${brush.style === style ? 'brush-style-dot--active' : ''} ${(style === 'glow' || style === 'particle') && !experimentalStylesEnabled ? 'brush-style-dot--disabled' : ''}`}
              aria-label={style === 'ink' ? '墨迹画笔' : style === 'glow' ? '辉光画笔' : '粒子画笔'}
              aria-pressed={brush.style === style}
              disabled={(style === 'glow' || style === 'particle') && !experimentalStylesEnabled}
              onClick={() => onChange({ ...brush, style })}
            >
              {style === 'ink' && '墨'}
              {style === 'glow' && '辉'}
              {style === 'particle' && '粒'}
            </button>
          ))}
        </div>
      </div>

      <div className="mini-property-section">
        <span className="mini-property-label">粗细</span>
        <div className="width-dots">
          {WIDTHS.map((width) => (
            <button
              key={width}
              type="button"
              className={`width-dot ${brush.width === width ? 'width-dot--active' : ''}`}
              aria-label={`笔迹粗细 ${width}px`}
              aria-pressed={brush.width === width}
              onClick={() => onChange({ ...brush, width })}
            >
              <span style={{ width: `${width * 1.5}px`, height: `${width * 1.5}px` }} />
            </button>
          ))}
        </div>
      </div>

      <div className="mini-property-section">
        <div className="experimental-style-toggle-mini">
          <span>实验视觉</span>
          <button
            type="button"
            className={experimentalStylesEnabled ? 'is-active' : ''}
            aria-label={experimentalStylesEnabled ? '关闭实验视觉' : '启用实验视觉'}
            aria-pressed={experimentalStylesEnabled}
            onClick={() => onExperimentalStylesChange(!experimentalStylesEnabled)}
          >
            {experimentalStylesEnabled ? '开' : '关'}
          </button>
        </div>
      </div>
      <div className="mini-property-section">
        <span className="mini-property-label">颜色历史</span>
        <div className="color-dots" role="list" aria-label="颜色历史">
          {colorHistory.slice(0, 6).map((color) => (
            <span key={color} role="listitem">
              <button
                type="button"
                className={`color-dot ${brush.color.toUpperCase() === color.toUpperCase() ? 'color-dot--active' : ''}`}
                aria-label={`使用历史颜色 ${color}`}
                style={{ backgroundColor: color, borderColor: color === '#FFFFFF' ? '#ddd' : color }}
                onClick={() => {
                  onChange({ ...brush, color })
                  rememberColor(color)
                }}
              />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
