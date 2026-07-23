interface GalleryCardProps {
  id: string
  name: string
  updatedAt: number
  strokeCount: number
  cardCount: number
  thumbnail?: string
  onOpen: () => void
  onDelete: () => void
}

export function GalleryCard({
  name,
  updatedAt,
  strokeCount,
  cardCount,
  thumbnail,
  onOpen,
  onDelete,
}: GalleryCardProps) {
  const dateStr = new Date(updatedAt).toLocaleDateString('zh-CN')

  return (
    <article className="gallery-card" onClick={onOpen}>
      <div className="gallery-card__preview">
        {thumbnail ? (
          <img src={thumbnail} alt={name} loading="lazy" />
        ) : (
          <div className="gallery-card__placeholder"><span>空画布</span></div>
        )}
      </div>
      <div className="gallery-card__info">
        <h3>{name}</h3>
        <p>{dateStr} · {strokeCount} 笔 · {cardCount} 卡</p>
      </div>
      <button
        type="button"
        className="gallery-card__delete"
        aria-label="删除作品"
        title="删除"
        onClick={(event) => { event.stopPropagation(); onDelete() }}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
      </button>
    </article>
  )
}
