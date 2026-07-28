interface ZoomControlProps {
  zoom: number
  onZoomChange: (zoom: number) => void
}

const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
const STEP = 0.25

export function ZoomControl({ zoom, onZoomChange }: ZoomControlProps) {
  const decrease = () => onZoomChange(Math.max(MIN_ZOOM, Math.round((zoom - STEP) * 100) / 100))
  const increase = () => onZoomChange(Math.min(MAX_ZOOM, Math.round((zoom + STEP) * 100) / 100))
  const reset = () => onZoomChange(1)

  return (
    <div className="zoom-control" aria-label="缩放控制">
      <button type="button" className="zoom-control__btn" aria-label="缩小" title="缩小" onClick={decrease}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <button type="button" className="zoom-control__value" aria-label="重置缩放" title="重置为 100%" onClick={reset}>
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" className="zoom-control__btn" aria-label="放大" title="放大" onClick={increase}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>
  )
}
