import { useEffect, useState } from 'react'
import type { IdeaCard, TextCardStyle } from '../types/workspace'

interface CardPropertyPanelProps {
  card: IdeaCard | null
  onUpdateTextCard?: (cardId: string, patch: { textStyle?: Partial<TextCardStyle> }) => void
  onRenameCard?: (cardId: string, title: string) => void
  onRestoreInkCard?: (cardId: string) => void
  onDeleteCard?: (cardId: string) => void
  onClose?: () => void
}

const TEXT_COLORS = [
  { color: '#172B3A', label: '深色' },
  { color: '#0A84FF', label: '蓝色' },
  { color: '#30A46C', label: '绿色' },
  { color: '#FF9500', label: '橙色' },
  { color: '#FF453A', label: '红色' },
  { color: '#8B5CF6', label: '紫色' },
  { color: '#EC4899', label: '粉色' },
]

export function CardPropertyPanel({
  card,
  onUpdateTextCard,
  onRenameCard,
  onRestoreInkCard,
  onDeleteCard,
  onClose,
}: CardPropertyPanelProps) {
  const [draftTitle, setDraftTitle] = useState(card?.title ?? '')

  useEffect(() => {
    setDraftTitle(card?.title ?? '')
  }, [card?.id, card?.title])

  if (!card) return null

  return (
    <aside
      className={`card-property-panel card-property-panel--${card.kind}`}
      aria-label={`${card.kind === 'text' ? '文字' : '墨迹'}卡片属性`}
    >
      <div className="card-property-panel__header">
        <span>{card.kind === 'text' ? '文字卡片' : '墨迹卡片'}</span>
        <button type="button" className="card-property-panel__close" onClick={onClose} aria-label="关闭卡片属性">×</button>
      </div>

      {card.kind === 'text' ? (
        <>
          <div className="card-property-panel__section">
            <span className="card-property-panel__label">文字格式</span>
            <div className="card-property-panel__format">
              <button
                type="button"
                className={card.textStyle.bold ? 'is-active' : ''}
                aria-label="B"
                title="加粗"
                aria-pressed={card.textStyle.bold}
                onClick={() => onUpdateTextCard?.(card.id, { textStyle: { bold: !card.textStyle.bold } })}
              >
                B
              </button>
              <button
                type="button"
                className={card.textStyle.italic ? 'is-active' : ''}
                aria-label="I"
                title="斜体"
                aria-pressed={card.textStyle.italic}
                onClick={() => onUpdateTextCard?.(card.id, { textStyle: { italic: !card.textStyle.italic } })}
              >
                I
              </button>
              <button
                type="button"
                className={card.textStyle.underline ? 'is-active' : ''}
                aria-label="U"
                title="下划线"
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
              {TEXT_COLORS.map(({ color, label }) => (
                <button
                  key={color}
                  type="button"
                  className={`card-property-panel__color-dot ${card.textStyle.color === color ? 'is-active' : ''}`}
                  aria-label={`文字颜色：${label}`}
                  aria-pressed={card.textStyle.color === color}
                  style={{ backgroundColor: color }}
                  onClick={() => onUpdateTextCard?.(card.id, { textStyle: { color } })}
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="card-property-panel__section card-property-panel__annotation">
            <label className="card-property-panel__label" htmlFor={`ink-card-title-${card.id}`}>标注</label>
            <input
              id={`ink-card-title-${card.id}`}
              maxLength={100}
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={() => {
                if (draftTitle !== card.title) onRenameCard?.(card.id, draftTitle)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.currentTarget.blur()
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setDraftTitle(card.title)
                }
              }}
            />
          </div>
          <div className="card-property-panel__section card-property-panel__restore-section">
            <button
              type="button"
              className="card-property-panel__restore"
              onClick={() => onRestoreInkCard?.(card.id)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 4v6h6M5.4 9.2A8 8 0 1 1 4 13" />
              </svg>
              恢复为自由笔迹
            </button>
          </div>
        </>
      )}

      <div className="card-property-panel__section card-property-panel__delete-section">
        <button type="button" className="card-property-panel__delete" onClick={() => onDeleteCard?.(card.id)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6" />
          </svg>
          删除卡片{card.kind === 'ink' ? '（含笔迹）' : ''}
        </button>
      </div>
    </aside>
  )
}
