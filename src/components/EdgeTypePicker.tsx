import type { Edge } from '../types/workspace'

interface EdgeTypePickerProps {
  open: boolean
  onSelect: (type: Edge['type']) => void
  onCancel: () => void
}

export function EdgeTypePicker({ open, onSelect, onCancel }: EdgeTypePickerProps) {
  if (!open) return null

  return (
    <div className="edge-type-picker" role="dialog" aria-label="连接类型">
      <div className="edge-type-picker__header">
        <span>连接类型</span>
        <button type="button" className="edge-type-picker__close" onClick={onCancel} aria-label="取消">×</button>
      </div>
      <div className="edge-type-picker__options">
        <button
          type="button"
          className="edge-type-picker__option"
          onClick={() => onSelect('undirected')}
        >
          <span className="edge-type-picker__icon edge-type-picker__icon--undirected" />
          <span>无方向连接</span>
        </button>
        <button
          type="button"
          className="edge-type-picker__option"
          onClick={() => onSelect('directed')}
        >
          <span className="edge-type-picker__icon edge-type-picker__icon--directed" />
          <span>有方向 →</span>
        </button>
      </div>
    </div>
  )
}
