import type { BrushSettings, BrushWidth } from '../types/workspace'

interface PropertyPanelProps {
  brush: BrushSettings
  onChange: (brush: BrushSettings) => void
}

const WIDTHS: BrushWidth[] = [2, 4, 8]

export function PropertyPanel({ brush, onChange }: PropertyPanelProps) {
  return (
    <section className="panel property-panel" aria-labelledby="property-title">
      <div className="panel-heading">
        <div>
          <p className="panel-number">04</p>
          <h2 id="property-title">画笔属性</h2>
        </div>
        <span className="panel-state">Ink</span>
      </div>

      <fieldset>
        <label htmlFor="brush-color">笔迹颜色</label>
        <div className="color-row">
          <input
            id="brush-color"
            type="color"
            value={brush.color}
            onChange={(event) => onChange({ ...brush, color: event.target.value.toUpperCase() })}
          />
          <span>{brush.color}</span>
        </div>

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

        <label htmlFor="visual-style">视觉风格</label>
        <select id="visual-style" value="ink" disabled aria-label="视觉风格暂仅支持 Ink">
          <option value="ink">Ink</option>
        </select>
      </fieldset>
    </section>
  )
}
