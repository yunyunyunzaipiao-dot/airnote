import { useState } from 'react'
import type { IdeaCard, TextCardStyle } from '../types/workspace'

interface CardPropertyPanelProps {
  card: IdeaCard | null
  onRenameCard?: (cardId: string, title: string) => void
  onUpdateTextCard?: (cardId: string, patch: { textStyle?: Partial<TextCardStyle> }) => void
  onDeleteCard?: (cardId: string) => void
  onClose?: () => void
}

const TEXT_COLORS = [
  '#1D1D1F', '#FF453A', '#0A84FF', '#30A46C',
  '#F59E0B', '#8B5CF6', '#EC4899', '#6E6E73',
]

export function CardPropertyPanel({
  card,
  onRenameCard,
  onUpdateTextCard,
  onDeleteCard,
  onClose,
}: CardPropertyPanelProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!card) return null

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    onDeleteCard?.(card.id)
    setConfirmDelete(false)
  }

  const handleClose = () => {
    setConfirmDelete(false)
    onClose?.()
  }

  return (
    <div className="card-property-panel" role="dialog" aria-label="卡片属性">
      <div className="card-property-panel__header">
        <span>{card.kind === 'text' ? '文字卡片' : '墨迹卡片'}</span>
        <button type="button" className="card-property-panel__close" onClick={handleClose} aria-label="关闭">×</button>
      </div>

      {card.kind === 'text' ? (
        <>
          <div className="card-property-panel__section">
            <span className="card-property-panel__label">文字格式</span>
            <div className="card-property-panel__format">
              <button
                type="button"
                className={card.textStyle.bold ? 'is-active' : ''}
                aria-label="加粗"
                aria-pressed={card.textStyle.bold}
                onClick={() => onUpdateTextCard?.(card.id, { textStyle: { bold: !card.textStyle.bold } })}
              >
                B
              </button>
              <button
                type="button"
                className={card.textStyle.italic ? 'is-active' : ''}
                aria-label="斜体"
                aria-pressed={card.textStyle.italic}
                onClick={() => onUpdateTextCard?.(card.id, { textStyle: { italic: !card.textStyle.italic } })}
              >
                I
              </button>
              <button
                type="button"
                className={card.textStyle.underline ? 'is-active' : ''}
                aria-label="下划线"
                aria-pressed={card.textStyle.underline}
                onClick={() => onUpdateTextCard?.(card.id, { textStyle: { underline: !card.textStyle.underline } })}
              >
                U
              </button>
            </div>
          </div>

          <div className="card-property-panel__section">
            <span className="card-property-panel__label">文字颜色</span>
            <div className="card-property-panel__colors">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`card-property-panel__color-dot ${card.textStyle.color === color ? 'is-active' : ''}`}
                  aria-label={`颜色 ${color}`}
                  style={{ backgroundColor: color, borderColor: color === '#FFFFFF' ? '#ddd' : color }}
                  onClick={() => onUpdateTextCard?.(card.id, { textStyle: { color } })}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}

      <div className="card-property-panel__section">
        {confirmDelete ? (
          <div className="card-property-panel__confirm">
            <span>确认删除？</span>
            <div className="card-property-panel__confirm-actions">
              <button type="button" onClick={() => setConfirmDelete(false)}>取消</button>
              <button type="button" className="is-danger" onClick={handleDelete}>确认</button>
            </div>
          </div>
        ) : (
          <button type="button" className="card-property-panel__delete" onClick={handleDelete}>
            删除卡片{card.kind === 'ink' ? '（含笔迹）' : ''}
          </button>
        )}
      </div>
    </div>
  )
}
