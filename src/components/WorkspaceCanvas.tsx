import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { cardInkMetrics } from '../drawing/cardInk'
import { automaticEdgeAnchors, cardAnchorPoint, closestCardAnchor, MIN_CARD_SIZE } from '../store/workspaceDocument'
import type { CalibrationUiState } from '../store/useAirNoteRuntime'
import type { Edge, EdgeAnchor, IdeaCard, InputMode, Stroke, StrokeGroup, WorkspaceTool } from '../types/workspace'

interface WorkspaceCanvasProps {
  inputMode: InputMode
  tool: WorkspaceTool
  edgeType: Edge['type']
  strokes: Stroke[]
  cards: IdeaCard[]
  edges: Edge[]
  currentGroup: StrokeGroup | null
  calibration: CalibrationUiState
  onReady: (canvas: HTMLCanvasElement, cursor: HTMLElement) => void
  onPointerStart: (point: { x: number; y: number }, timestamp: number) => void
  onPointerMove: (point: { x: number; y: number }, timestamp: number) => void
  onPointerEnd: () => void
  onGenerateCard: () => void
  onContinueGroup: () => void
  onCancelGroup: () => void
  onMoveCard: (cardId: string, x: number, y: number, stage: { width: number; height: number }) => void
  onResizeCard: (cardId: string, width: number, height: number, stage: { width: number; height: number }) => void
  onRenameCard: (cardId: string, title: string) => void
  onDeleteCard: (cardId: string) => void
  onCreateEdge: (sourceCardId: string, targetCardId: string, sourceAnchor: EdgeAnchor, targetAnchor: EdgeAnchor) => boolean
  onUpdateEdge: (edgeId: string, type: Edge['type']) => void
  onEdgeTypeChange: (type: Edge['type']) => void
}

function canvasPoint(event: PointerEvent<HTMLCanvasElement>) {
  const bounds = event.currentTarget.getBoundingClientRect()
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}

export function WorkspaceCanvas(props: WorkspaceCanvasProps) {
  const { inputMode, tool, strokes, cards, edges, currentGroup, calibration } = props
  const stageRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [drag, setDrag] = useState<{ cardId: string; pointerId: number; startX: number; startY: number; x: number; y: number } | null>(null)
  const [resize, setResize] = useState<{ cardId: string; pointerId: number; startX: number; startY: number; width: number; height: number } | null>(null)
  const [edgeDraft, setEdgeDraft] = useState<{ sourceCardId: string; sourceAnchor: EdgeAnchor; x: number; y: number; targetCardId: string | null; targetAnchor: EdgeAnchor | null } | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  useEffect(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    const cursor = cursorRef.current
    if (!stage || !canvas || !cursor) return
    const resize = () => props.onReady(canvas, cursor)
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [props.onReady])

  const cardPreview = (card: IdeaCard): IdeaCard => ({
    ...card,
    position: drag?.cardId === card.id ? { x: drag.x, y: drag.y } : card.position,
    size: resize?.cardId === card.id ? { width: resize.width, height: resize.height } : card.size,
  })

  const finishTitle = (cardId: string, submit: boolean) => {
    if (submit) props.onRenameCard(cardId, draftTitle)
    setEditingCardId(null)
  }

  const beginCardDrag = (event: PointerEvent<HTMLDivElement>, card: IdeaCard) => {
    if (tool === 'draw' || editingCardId === card.id || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({ cardId: card.id, pointerId: event.pointerId, startX: event.clientX - card.position.x, startY: event.clientY - card.position.y, ...card.position })
  }

  const moveCardPreview = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return
    setDrag({ ...drag, x: event.clientX - drag.startX, y: event.clientY - drag.startY })
  }

  const finishCardDrag = (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (!drag || drag.pointerId !== event.pointerId) return
    if (!cancelled && stageRef.current) {
      props.onMoveCard(drag.cardId, drag.x, drag.y, { width: stageRef.current.clientWidth, height: stageRef.current.clientHeight })
    }
    setDrag(null)
  }

  const beginCardResize = (event: PointerEvent<HTMLButtonElement>, card: IdeaCard) => {
    if (tool !== 'select' || event.button !== 0) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setResize({ cardId: card.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, ...card.size })
  }

  const moveCardResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (!resize || resize.pointerId !== event.pointerId) return
    const card = cards.find((item) => item.id === resize.cardId)
    const stage = stageRef.current
    if (!card || !stage) return
    const maxWidth = Math.max(MIN_CARD_SIZE.width, stage.clientWidth)
    const maxHeight = Math.max(MIN_CARD_SIZE.height, stage.clientHeight)
    setResize({
      ...resize,
      width: Math.min(maxWidth, Math.max(MIN_CARD_SIZE.width, card.size.width + event.clientX - resize.startX)),
      height: Math.min(maxHeight, Math.max(MIN_CARD_SIZE.height, card.size.height + event.clientY - resize.startY)),
    })
  }

  const finishCardResize = (event: PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    if (!resize || resize.pointerId !== event.pointerId) return
    if (!cancelled && stageRef.current) {
      props.onResizeCard(resize.cardId, resize.width, resize.height, { width: stageRef.current.clientWidth, height: stageRef.current.clientHeight })
    }
    setResize(null)
  }

  const beginEdge = (event: PointerEvent<HTMLButtonElement>, cardId: string, sourceAnchor: EdgeAnchor) => {
    if (tool === 'draw') return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const source = cards.find((card) => card.id === cardId)
    if (!source) return
    const start = cardAnchorPoint(cardPreview(source), sourceAnchor)
    setEdgeDraft({ sourceCardId: cardId, sourceAnchor, x: start.x, y: start.y, targetCardId: null, targetAnchor: null })
  }

  const moveEdge = (event: PointerEvent<HTMLButtonElement>) => {
    if (!edgeDraft) return
    const bounds = stageRef.current?.getBoundingClientRect()
    const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-card-id]')
    const targetCardId = hit?.dataset.cardId ?? null
    const point = { x: event.clientX - (bounds?.left ?? 0), y: event.clientY - (bounds?.top ?? 0) }
    const targetCard = cards.find((card) => card.id === targetCardId)
    const explicitAnchor = hit?.dataset.anchorSide as EdgeAnchor | undefined
    const targetAnchor = targetCard && targetCardId !== edgeDraft.sourceCardId
      ? explicitAnchor ?? closestCardAnchor(cardPreview(targetCard), point)
      : null
    setEdgeDraft({ ...edgeDraft, ...point, targetCardId: targetAnchor ? targetCardId : null, targetAnchor })
  }

  const finishEdge = () => {
    if (edgeDraft?.targetCardId && edgeDraft.targetAnchor) {
      props.onCreateEdge(edgeDraft.sourceCardId, edgeDraft.targetCardId, edgeDraft.sourceAnchor, edgeDraft.targetAnchor)
    }
    setEdgeDraft(null)
  }

  return (
    <section ref={stageRef} className="canvas-stage" aria-labelledby="canvas-title">
      <div className="canvas-stage__index" aria-hidden="true">00 / M2 WORKSPACE</div>
      <canvas
        ref={canvasRef}
        className={`workspace-canvas workspace-canvas--${inputMode} workspace-canvas--tool-${tool}`}
        aria-label={inputMode === 'mouse' ? '鼠标绘图画布' : '空中手势绘图画布'}
        onPointerDown={(event) => { if (inputMode === 'mouse' && tool === 'draw' && event.button === 0) { event.currentTarget.setPointerCapture(event.pointerId); props.onPointerStart(canvasPoint(event), event.timeStamp) } }}
        onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) props.onPointerMove(canvasPoint(event), event.timeStamp) }}
        onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); props.onPointerEnd() }}
        onPointerCancel={props.onPointerEnd}
      />
      <svg className="edge-layer" aria-label="卡片连接线">
        <defs><marker id="edge-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" /></marker></defs>
        {edges.map((edge) => {
          const source = cards.find((card) => card.id === edge.sourceCardId)
          const target = cards.find((card) => card.id === edge.targetCardId)
          if (!source || !target) return null
          const sourcePreview = cardPreview(source)
          const targetPreview = cardPreview(target)
          const automatic = automaticEdgeAnchors(sourcePreview, targetPreview)
          const start = cardAnchorPoint(sourcePreview, edge.sourceAnchor ?? automatic.source)
          const end = cardAnchorPoint(targetPreview, edge.targetAnchor ?? automatic.target)
          return <line key={edge.id} className={selectedEdgeId === edge.id ? 'edge-selected' : undefined} x1={start.x} y1={start.y} x2={end.x} y2={end.y} markerEnd={edge.type === 'directed' ? 'url(#edge-arrow)' : undefined} onClick={() => setSelectedEdgeId(edge.id)} />
        })}
        {edgeDraft ? (() => {
          const source = cards.find((card) => card.id === edgeDraft.sourceCardId)
          if (!source) return null
          const start = cardAnchorPoint(cardPreview(source), edgeDraft.sourceAnchor)
          return <line className="edge-preview" x1={start.x} y1={start.y} x2={edgeDraft.x} y2={edgeDraft.y} />
        })() : null}
      </svg>
      <div ref={cursorRef} className="tracking-cursor" hidden aria-hidden="true" />
      {cards.map((card) => {
        const preview = cardPreview(card)
        const cardStrokes = strokes.filter((stroke) => card.strokeIds.includes(stroke.id))
        const ink = cardInkMetrics(cardStrokes)
        return (
          <article key={card.id} data-card-id={card.id} className={`idea-card ${edgeDraft?.targetCardId === card.id ? 'idea-card--edge-target' : ''}`} style={{ left: preview.position.x, top: preview.position.y, width: preview.size.width, height: preview.size.height }}>
            <div className="idea-card__title" onPointerDown={(event) => beginCardDrag(event, card)} onPointerMove={moveCardPreview} onPointerUp={(event) => finishCardDrag(event, false)} onPointerCancel={(event) => finishCardDrag(event, true)} onDoubleClick={() => { setEditingCardId(card.id); setDraftTitle(card.title) }}>
              {editingCardId === card.id ? <input autoFocus aria-label="卡片标题" maxLength={100} value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} onBlur={() => finishTitle(card.id, true)} onKeyDown={(event) => { if (event.key === 'Enter') finishTitle(card.id, true); if (event.key === 'Escape') finishTitle(card.id, false) }} /> : <strong>{card.title}</strong>}
              <span>{editingCardId === card.id ? `${draftTitle.length}/100` : '双击改名'}</span>
            </div>
            {ink ? (
              <svg className="idea-card__ink" viewBox={`0 0 ${ink.size.width} ${ink.size.height}`} preserveAspectRatio="xMidYMid meet">
                {cardStrokes.map((stroke) => <polyline key={stroke.id} points={stroke.points.map((point) => `${point.x - ink.origin.x},${point.y - ink.origin.y}`).join(' ')} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />)}
              </svg>
            ) : null}
            <button className="idea-card__delete" type="button" aria-label={`删除卡片 ${card.title}`} onClick={() => props.onDeleteCard(card.id)}>×</button>
            {(['top', 'right', 'bottom', 'left'] as EdgeAnchor[]).map((anchor) => (
              <button
                key={anchor}
                className={`idea-card__anchor idea-card__anchor--${anchor}`}
                type="button"
                hidden={tool === 'draw'}
                data-card-id={card.id}
                data-anchor-side={anchor}
                aria-label={`从 ${card.title} 的${anchor === 'top' ? '上方' : anchor === 'right' ? '右侧' : anchor === 'bottom' ? '下方' : '左侧'}连接点创建连接`}
                onPointerDown={(event) => beginEdge(event, card.id, anchor)}
                onPointerMove={moveEdge}
                onPointerUp={finishEdge}
                onPointerCancel={() => setEdgeDraft(null)}
              >●</button>
            ))}
            <button
              className="idea-card__resize"
              type="button"
              hidden={tool !== 'select'}
              aria-label={`调整卡片 ${card.title} 大小`}
              onPointerDown={(event) => beginCardResize(event, card)}
              onPointerMove={moveCardResize}
              onPointerUp={(event) => finishCardResize(event, false)}
              onPointerCancel={(event) => finishCardResize(event, true)}
            >↘</button>
          </article>
        )
      })}
      {currentGroup?.status === 'suggested' ? <div className="group-suggestion" style={{ left: currentGroup.boundingBox.x - 12, top: currentGroup.boundingBox.y - 12, width: currentGroup.boundingBox.width + 24, height: currentGroup.boundingBox.height + 24 }}><div><button type="button" onClick={props.onGenerateCard}>生成想法卡片</button><button type="button" onClick={props.onContinueGroup}>继续添加</button><button type="button" onClick={props.onCancelGroup}>取消分组</button></div></div> : null}
      {calibration.phase === 'roi' ? <div className={`calibration-target calibration-target--${calibration.roiStep}`} aria-hidden="true">{calibration.roiStep + 1}</div> : null}
      <div className="canvas-stage__notice"><p className="eyebrow">P0 IDEA WORKSPACE</p><h2 id="canvas-title">{tool === 'draw' ? (inputMode === 'mouse' ? '鼠标画笔已启用' : '捏合落笔，松开断笔') : tool === 'select' ? '选择与整理卡片' : '从卡片锚点拖出连接'}</h2><p>笔迹、卡片与连接会在本地自动保存。卡片只引用原始 Stroke，不改写几何数据。</p>{tool === 'edge' ? <label className="edge-type-control">{selectedEdgeId ? '所选连接' : '新连接类型'}<select value={selectedEdgeId ? edges.find((edge) => edge.id === selectedEdgeId)?.type ?? props.edgeType : props.edgeType} onChange={(event) => { const type = event.target.value as Edge['type']; if (selectedEdgeId) props.onUpdateEdge(selectedEdgeId, type); else props.onEdgeTypeChange(type) }}><option value="undirected">无方向</option><option value="directed">有方向</option></select></label> : null}</div>
      <div className="canvas-stage__coordinates" aria-hidden="true"><span>{inputMode.toUpperCase()}</span><span>{strokes.length} STROKES</span><span>{cards.length} CARDS / {edges.length} EDGES</span></div>
    </section>
  )
}
