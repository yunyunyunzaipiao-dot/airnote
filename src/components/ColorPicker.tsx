import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { hexToHsv, hsvToHex, normalizeHexColor, type HsvColor } from '../color/colorMath'

interface ColorPickerProps {
  value: string
  history: string[]
  onChange: (color: string) => void
  onCommit: (color: string) => void
}

function rounded(value: number) {
  return Math.round(value)
}

export function ColorPicker({ value, history, onChange, onCommit }: ColorPickerProps) {
  const hsv = hexToHsv(value) ?? { h: 0, s: 0, v: 0 }
  const [hexDraft, setHexDraft] = useState(value)
  const latestColorRef = useRef(value)

  useEffect(() => {
    setHexDraft(value)
    latestColorRef.current = value
  }, [value])

  const emitColor = (color: string) => {
    latestColorRef.current = color
    onChange(color)
  }
  const commitColor = () => onCommit(latestColorRef.current)
  const update = (next: Partial<HsvColor>) => emitColor(hsvToHex({ ...hsv, ...next }))
  const changeHueByKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault()
      update({ h: hsv.h - step })
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault()
      update({ h: hsv.h + step })
    }
  }
  const updateHueFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (event.type === 'pointermove' && !event.currentTarget.hasPointerCapture(event.pointerId)) return
    if (event.type === 'pointerdown') event.currentTarget.setPointerCapture(event.pointerId)
    const bounds = event.currentTarget.getBoundingClientRect()
    const angle = Math.atan2(event.clientY - bounds.top - bounds.height / 2, event.clientX - bounds.left - bounds.width / 2)
    update({ h: ((angle * 180 / Math.PI + 90) % 360 + 360) % 360 })
  }
  const updateSaturationValue = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    if (event.type === 'pointermove' && !event.currentTarget.hasPointerCapture(event.pointerId)) return
    if (event.type === 'pointerdown') event.currentTarget.setPointerCapture(event.pointerId)
    const bounds = event.currentTarget.getBoundingClientRect()
    update({
      s: Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100)),
      v: Math.min(100, Math.max(0, (1 - (event.clientY - bounds.top) / bounds.height) * 100)),
    })
  }
  const hueAngle = hsv.h * Math.PI / 180 - Math.PI / 2

  return (
    <div className="color-picker" aria-label="画笔颜色选择器">
      <div
        className="color-picker__wheel"
        role="slider"
        tabIndex={0}
        aria-label="色相环"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={rounded(hsv.h)}
        onKeyDown={changeHueByKey}
        onKeyUp={commitColor}
        onPointerDown={updateHueFromPointer}
        onPointerMove={updateHueFromPointer}
        onPointerUp={commitColor}
      >
        <div className="color-picker__wheel-interior" aria-hidden="true" />
        <span
          className="color-picker__hue-marker"
          aria-hidden="true"
          style={{
            left: `${50 + Math.cos(hueAngle) * 44.5}%`,
            top: `${50 + Math.sin(hueAngle) * 44.5}%`,
          }}
        />
        <div
          className="color-picker__sv"
          aria-hidden="true"
          style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
          onPointerDown={updateSaturationValue}
          onPointerMove={updateSaturationValue}
          onPointerUp={commitColor}
        >
          <span
            className="color-picker__sv-marker"
            style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }}
          />
        </div>
      </div>

      <div className="color-picker__hex-row">
        <span className="color-picker__swatch" aria-hidden="true" style={{ backgroundColor: value }} />
        <label htmlFor="brush-color-hex">HEX</label>
        <input
          id="brush-color-hex"
          aria-label="十六进制颜色"
          value={hexDraft}
          maxLength={7}
          spellCheck={false}
          onChange={(event) => {
            const draft = event.target.value
            setHexDraft(draft)
            const normalized = normalizeHexColor(draft)
            if (normalized) emitColor(normalized)
          }}
          onBlur={() => {
            const normalized = normalizeHexColor(hexDraft)
            if (normalized) {
              setHexDraft(normalized)
              emitColor(normalized)
              onCommit(normalized)
            } else {
              setHexDraft(value)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
      </div>

      <div className="color-picker__channels">
        <label><span>H</span><input aria-label="色相 H" type="range" min={0} max={359} value={rounded(hsv.h)} onChange={(event) => update({ h: Number(event.target.value) })} onPointerUp={commitColor} onKeyUp={commitColor} onBlur={commitColor} style={{ background: 'linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }} /><span className="color-picker__value">{String(rounded(hsv.h)).padStart(3, '0')}°</span></label>
        <label><span>S</span><input aria-label="饱和度 S" type="range" min={0} max={100} value={rounded(hsv.s)} onChange={(event) => update({ s: Number(event.target.value) })} onPointerUp={commitColor} onKeyUp={commitColor} onBlur={commitColor} style={{ background: `linear-gradient(90deg, hsl(${hsv.h} 0% ${Math.max(20, hsv.v / 2)}%), hsl(${hsv.h} 100% ${Math.max(20, hsv.v / 2)}%))` }} /><span className="color-picker__value">{String(rounded(hsv.s)).padStart(3, '0')}%</span></label>
        <label><span>V</span><input aria-label="明度 V" type="range" min={0} max={100} value={rounded(hsv.v)} onChange={(event) => update({ v: Number(event.target.value) })} onPointerUp={commitColor} onKeyUp={commitColor} onBlur={commitColor} style={{ background: `linear-gradient(90deg, #000, hsl(${hsv.h} ${hsv.s}% 50%), #fff)` }} /><span className="color-picker__value">{String(rounded(hsv.v)).padStart(3, '0')}%</span></label>
      </div>

      <div className="color-picker__history">
        <span>颜色历史</span>
        <div role="list" aria-label="颜色历史">
          {Array.from({ length: 6 }, (_, index) => {
            const color = history[index]
            return color ? (
              <span key={color} role="listitem">
                <button
                  type="button"
                  className={color === value ? 'is-active' : ''}
                  aria-label={`使用历史颜色 ${color}`}
                  title={color}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    emitColor(color)
                    onCommit(color)
                  }}
                />
              </span>
            ) : <span key={`empty-${index}`} className="is-empty" aria-hidden="true" />
          })}
        </div>
      </div>
    </div>
  )
}
