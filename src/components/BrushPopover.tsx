import { useState } from 'react'
import type { StylePerformanceStage } from '../drawing/canvasRenderer'
import { addColorToHistory, loadColorHistory, saveColorHistory } from '../persistence/colorHistoryStorage'
import type { BrushSettings, BrushWidth } from '../types/workspace'
import { ColorPicker } from './ColorPicker'

interface BrushPopoverProps {
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

export function BrushPopover({
  brush,
  experimentalStylesEnabled,
  onChange,
  onExperimentalStylesChange,
  onClose,
}: BrushPopoverProps) {
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
    <div className="brush-popover" role="dialog" aria-label="画笔属性">
      <div className="brush-popover__header">
        <span>画笔</span>
        <button type="button" className="brush-popover__close" onClick={onClose} aria-label="关闭">×</button>
      </div>

      <div className="brush-popover__color">
        <ColorPicker
          value={brush.color}
          history={colorHistory}
          onChange={(color) => onChange({ ...brush, color })}
          onCommit={(color) => {
            onChange({ ...brush, color })
            rememberColor(color)
          }}
        />
      </div>

      <div className="brush-popover__presets">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`brush-popover__preset-dot ${brush.color.toUpperCase() === color.toUpperCase() ? 'is-active' : ''}`}
            aria-label={`选择颜色 ${color}`}
            style={{ backgroundColor: color, borderColor: color === '#FFFFFF' ? '#ddd' : color }}
            onClick={() => setColor(color)}
          />
        ))}
      </div>

      <div className="brush-popover__section">
        <span className="brush-popover__label">样式</span>
        <div className="brush-popover__styles">
          {(['ink', 'glow', 'particle'] as const).map((style) => (
            <button
              key={style}
              type="button"
              className={`brush-popover__style-btn ${brush.style === style ? 'is-active' : ''} ${(style === 'glow' || style === 'particle') && !experimentalStylesEnabled ? 'is-disabled' : ''}`}
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

      <div className="brush-popover__section">
        <span className="brush-popover__label">粗细</span>
        <div className="brush-popover__widths">
          {WIDTHS.map((width) => (
            <button
              key={width}
              type="button"
              className={`brush-popover__width-btn ${brush.width === width ? 'is-active' : ''}`}
              aria-label={`笔迹粗细 ${width}px`}
              aria-pressed={brush.width === width}
              onClick={() => onChange({ ...brush, width })}
            >
              <span style={{ width: `${width * 1.5}px`, height: `${width * 1.5}px` }} />
            </button>
          ))}
        </div>
      </div>

      <div className="brush-popover__section">
        <div className="brush-popover__experimental">
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
    </div>
  )
}
