import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { cardInkMetrics } from '../drawing/cardInk'
import { particleSamplesForStroke } from '../drawing/particleStyle'
import {
  resizeCardFromHandle,
  type CardGeometry,
  type CardResizeHandle,
} from '../layout/cardResize'
import { placeGroupSuggestionActions } from '../layout/groupSuggestionPlacement'
import {
  cardIdsInFreeform,
  cardIdsInRectangle,
  selectionRect,
  strokeIdsInFreeform,
  strokeIdsInRectangle,
  type SelectionPoint,
} from '../selection/strokeSelection'
import { automaticEdgeAnchors, cardAnchorPoint, closestCardAnchor, MIN_CARD_SIZE } from '../store/workspaceDocument'
import type { CalibrationUiState } from '../store/useAirNoteRuntime'
import type { Edge, EdgeAnchor, IdeaCard, InputMode, Stroke, StrokeGroup, TextCardStyle, WorkspaceTool } from '../types/workspace'

interface WorkspaceCanvasProps {
  inputMode: InputMode
  experimentalStylesEnabled: boolean
  reducedMotion: boolean
  tool: WorkspaceTool
  edgeType: Edge['type']
  strokes: Stroke[]
  cards: IdeaCard[]
  edges: Edge[]
  currentGroup: StrokeGroup | null
  calibration: CalibrationUiState
  zoom: number
  viewport: { x: number; y: number; zoom: number }
  onReady: (canvas: HTMLCanvasElement, cursor: HTMLElement) => void
  onPointerStart: (point: { x: number; y: number }, timestamp: number) => void
  onPointerMove: (point: { x: number; y: number }, timestamp: number) => void
  onPointerEnd: () => void
  onEraseAtPoint: (point: { x: number; y: number }) => boolean
  onPan: (x: number, y: number) => void
  onSuggestSelection: (strokeIds: string[]) => boolean
  onGenerateCard: () => void
  onContinueGroup: () => void
  onCancelGroup: () => void
  onMoveCard: (cardId: string, x: number, y: number, stage: { width: number; height: number }) => void
  onMoveCards?: (moves: Array<{ cardId: string; x: number; y: number }>, stage: { width: number; height: number }) => void
  onResizeCard: (cardId: string, geometry: CardGeometry, stage: { width: number; height: number }) => void
  onRenameCard: (cardId: string, title: string) => void
  onUpdateTextCard: (cardId: string, patch: { content?: string; textStyle?: Partial<TextCardStyle> }) => void
  onDeleteCard: (cardId: string) => void
  onCreateEdge: (sourceCardId: string, targetCardId: string, sourceAnchor: EdgeAnchor, targetAnchor: EdgeAnchor) => boolean
  onUpdateEdge: (edgeId: string, type: Edge['type']) => void
  onEdgeTypeChange: (type: Edge['type']) => void
}

function canvasPoint(event: PointerEvent<HTMLCanvasElement>, zoom: number) {
  const bounds = event.currentTarget.getBoundingClientRect()
  return { x: (event.clientX - bounds.left) / zoom, y: (event.clientY - bounds.top) / zoom }
}

interface CardDragPreview {
  cardIds: string[]
  pointerId: number
  startClientX: number
  startClientY: number
  deltaX: number
  deltaY: number
  origins: Record<string, { x: number; y: number }>
}

interface SelectionDraft {
  pointerId: number
  mode: 'rect' | 'free'
  start: SelectionPoint
  current: SelectionPoint
  points: SelectionPoint[]
}

interface PanDraft {
  pointerId: number
  startClient: { x: number; y: number }
  startViewport: { x: number; y: number }
}

export function WorkspaceCanvas(props: WorkspaceCanvasProps) {
  const { inputMode, tool, strokes, cards, edges, currentGroup, calibration, zoom } = props
  const stageRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [textLengths, setTextLengths] = useState<Record<string, number>>({})
  const knownCardIdsRef = useRef(new Set(cards.map((card) => card.id)))
  const [drag, setDrag] = useState<CardDragPreview | null>(null)
  const dragRef = useRef<CardDragPreview | null>(null)
  const dragFrameRef = useRef<number | null>(null)
  const [resize, setResize] = useState<{
    cardId: string
    pointerId: number
    handle: CardResizeHandle
    startPointer: { x: number; y: number }
    startGeometry: CardGeometry
    geometry: CardGeometry
  } | null>(null)
  const [edgeDraft, setEdgeDraft] = useState<{ sourceCardId: string; sourceAnchor: EdgeAnchor; x: number; y: number; targetCardId: string | null; targetAnchor: EdgeAnchor | null } | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(() => new Set())
  const [selection, setSelection] = useState<SelectionDraft | null>(null)
  const [pan, setPan] = useState<PanDraft | null>(null)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (tool !== 'lasso-rect' && tool !== 'lasso-free') {
      setSelection(null)
    }
  }, [tool])

  useEffect(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    const cursor = cursorRef.current
    if (!stage || !canvas || !cursor) return
    const resize = () => {
      props.onReady(canvas, cursor)
      setStageSize((current) => {
        const next = { width: stage.clientWidth, height: stage.clientHeight }
        return current.width === next.width && current.height === next.height ? current : next
      })
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [props.onReady])

  useEffect(() => () => {
    if (dragFrameRef.current === null) return
    if (typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(dragFrameRef.current)
    } else {
      window.clearTimeout(dragFrameRef.current)
    }
  }, [])

  useEffect(() => {
    const knownCardIds = knownCardIdsRef.current
    const createdCard = cards.find((card) => !knownCardIds.has(card.id))
    knownCardIdsRef.current = new Set(cards.map((card) => card.id))
    setSelectedCardIds((current) => {
      const available = new Set(cards.map((card) => card.id))
      if (createdCard) return new Set([createdCard.id])
      const next = new Set([...current].filter((id) => available.has(id)))
      return next.size === current.size ? current : next
    })
    if (!createdCard || !['未命名想法', '未命名文字'].includes(createdCard.title)) return
    setEditingCardId(createdCard.id)
    setDraftTitle('')
  }, [cards])

  const cardVisuals = useMemo(() => {
    const strokesById = new Map(strokes.map((stroke) => [stroke.id, stroke]))
    return new Map(cards.map((card) => {
      const cardStrokes = card.kind === 'ink' ? card.strokeIds
        .map((strokeId) => strokesById.get(strokeId))
        .filter((stroke): stroke is Stroke => Boolean(stroke)) : []
      const particleSamples = new Map(
        cardStrokes
          .filter((stroke) => props.experimentalStylesEnabled && stroke.style === 'particle')
          .map((stroke) => [stroke.id, particleSamplesForStroke(stroke)]),
      )
      return [card.id, {
        cardStrokes,
        ink: cardInkMetrics(cardStrokes),
        particleSamples,
      }]
    }))
  }, [cards, props.experimentalStylesEnabled, strokes])

  const cardPreview = (card: IdeaCard): IdeaCard => ({
    ...card,
    position: resize?.cardId === card.id
      ? resize.geometry.position
      : drag?.origins[card.id]
        ? {
            x: drag.origins[card.id].x + drag.deltaX,
            y: drag.origins[card.id].y + drag.deltaY,
          }
        : card.position,
    size: resize?.cardId === card.id ? resize.geometry.size : card.size,
  })

  const finishTitle = (cardId: string, submit: boolean) => {
    if (submit) props.onRenameCard(cardId, draftTitle)
    setEditingCardId(null)
  }

  const beginTitleEdit = (card: IdeaCard) => {
    setEditingCardId(card.id)
    setDraftTitle(card.title === '未命名想法' ? '' : card.title)
  }

  const beginCardDrag = (event: PointerEvent<HTMLDivElement>, card: IdeaCard) => {
    if (tool !== 'select' || editingCardId === card.id || event.button !== 0) return
    const nextSelected = new Set(selectedCardIds)
    if (event.shiftKey) {
      if (nextSelected.has(card.id)) nextSelected.delete(card.id)
      else nextSelected.add(card.id)
    } else if (!nextSelected.has(card.id)) {
      nextSelected.clear()
      nextSelected.add(card.id)
    }
    setSelectedCardIds(nextSelected)
    setSelectedEdgeId(null)
    if (!nextSelected.has(card.id)) return

    const targets = cards.filter((item) => nextSelected.has(item.id))
    const origins = Object.fromEntries(targets.map((item) => [item.id, { ...item.position }]))
    event.currentTarget.setPointerCapture(event.pointerId)
    const next = {
      cardIds: targets.map((item) => item.id),
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      deltaX: 0,
      deltaY: 0,
      origins,
    }
    dragRef.current = next
    setDrag(next)
  }

  const moveCardPreview = (event: PointerEvent<HTMLDivElement>) => {
    const current = dragRef.current
    if (!current || current.pointerId !== event.pointerId) return
    const next = {
      ...current,
      deltaX: (event.clientX - current.startClientX) / zoom,
      deltaY: (event.clientY - current.startClientY) / zoom,
    }
    dragRef.current = next
    if (dragFrameRef.current !== null) return
    const requestFrame = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16)
    dragFrameRef.current = requestFrame(() => {
      dragFrameRef.current = null
      setDrag(dragRef.current)
    })
  }

  const finishCardDrag = (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const current = dragRef.current
    if (!current || current.pointerId !== event.pointerId) return
    if (dragFrameRef.current !== null) {
      if (typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(dragFrameRef.current)
      } else {
        window.clearTimeout(dragFrameRef.current)
      }
      dragFrameRef.current = null
    }
    const hasMoved = Math.abs(current.deltaX) > 0.5 || Math.abs(current.deltaY) > 0.5
    if (!cancelled && hasMoved && stageRef.current) {
      const moves = current.cardIds.map((cardId) => ({
        cardId,
        x: current.origins[cardId].x + current.deltaX,
        y: current.origins[cardId].y + current.deltaY,
      }))
      const stage = { width: stageRef.current.clientWidth, height: stageRef.current.clientHeight }
      if (moves.length > 1 && props.onMoveCards) props.onMoveCards(moves, stage)
      else if (moves[0]) props.onMoveCard(moves[0].cardId, moves[0].x, moves[0].y, stage)
    }
    dragRef.current = null
    setDrag(null)
  }

  const beginCardResize = (
    event: PointerEvent<HTMLButtonElement>,
    card: IdeaCard,
    handle: CardResizeHandle,
  ) => {
    if (tool !== 'select' || event.button !== 0) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const startGeometry = { position: card.position, size: card.size }
    setResize({
      cardId: card.id,
      pointerId: event.pointerId,
      handle,
      startPointer: { x: event.clientX, y: event.clientY },
      startGeometry,
      geometry: startGeometry,
    })
  }

  const moveCardResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (!resize || resize.pointerId !== event.pointerId) return
    const stage = stageRef.current
    if (!stage) return
    setResize({
      ...resize,
      geometry: resizeCardFromHandle(
        resize.startGeometry,
        resize.handle,
        {
          x: (event.clientX - resize.startPointer.x) / zoom,
          y: (event.clientY - resize.startPointer.y) / zoom,
        },
        { width: stage.clientWidth, height: stage.clientHeight },
        MIN_CARD_SIZE,
      ),
    })
  }

  const finishCardResize = (event: PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    if (!resize || resize.pointerId !== event.pointerId) return
    if (!cancelled && stageRef.current) {
      props.onResizeCard(
        resize.cardId,
        resize.geometry,
        { width: stageRef.current.clientWidth, height: stageRef.current.clientHeight },
      )
    }
    setResize(null)
  }

  const beginEdge = (event: PointerEvent<HTMLButtonElement>, cardId: string, sourceAnchor: EdgeAnchor) => {
    if (tool !== 'select') return
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
    const point = {
      x: (event.clientX - (bounds?.left ?? 0)) / zoom,
      y: (event.clientY - (bounds?.top ?? 0)) / zoom,
    }
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

  const beginCanvasAction = (event: PointerEvent<HTMLCanvasElement>) => {
    if (inputMode !== 'mouse' || event.button !== 0) return
    if (tool === 'draw') {
      event.currentTarget.setPointerCapture(event.pointerId)
      props.onPointerStart(canvasPoint(event, zoom), event.timeStamp)
      return
    }
    if (tool === 'erase') {
      event.currentTarget.setPointerCapture(event.pointerId)
      props.onEraseAtPoint(canvasPoint(event, zoom))
      return
    }
    if (tool === 'pan') {
      event.currentTarget.setPointerCapture(event.pointerId)
      const viewport = props.viewport
      setPan({
        pointerId: event.pointerId,
        startClient: { x: event.clientX, y: event.clientY },
        startViewport: { x: viewport.x, y: viewport.y },
      })
      return
    }
    if (tool === 'select') {
      setSelectedCardIds(new Set())
      setSelectedEdgeId(null)
      return
    }
    if (tool !== 'lasso-rect' && tool !== 'lasso-free') return
    const point = canvasPoint(event, zoom)
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedCardIds(new Set())
    setSelectedEdgeId(null)
    setSelection({
      pointerId: event.pointerId,
      mode: tool === 'lasso-rect' ? 'rect' : 'free',
      start: point,
      current: point,
      points: [point],
    })
  }

  const moveCanvasAction = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    if (tool === 'draw') {
      props.onPointerMove(canvasPoint(event, zoom), event.timeStamp)
      return
    }
    if (tool === 'erase') {
      props.onEraseAtPoint(canvasPoint(event, zoom))
      return
    }
    if (tool === 'pan' && pan?.pointerId === event.pointerId) {
      props.onPan(
        pan.startViewport.x + event.clientX - pan.startClient.x,
        pan.startViewport.y + event.clientY - pan.startClient.y,
      )
      return
    }
    const point = canvasPoint(event, zoom)
    setSelection((current) => {
      if (!current || current.pointerId !== event.pointerId) return current
      return {
        ...current,
        current: point,
        points: current.mode === 'free' ? [...current.points, point] : current.points,
      }
    })
  }

  const finishCanvasAction = (event: PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (tool === 'draw') {
      props.onPointerEnd()
      return
    }
    if (tool === 'erase') return
    if (tool === 'pan') {
      setPan(null)
      return
    }
    if (!selection || selection.pointerId !== event.pointerId) return
    if (!cancelled) {
      const end = canvasPoint(event, zoom)
      const polygon = [...selection.points, end]
      const rect = selectionRect(selection.start, end)
      const strokeIds = selection.mode === 'rect'
        ? strokeIdsInRectangle(strokes, rect)
        : strokeIdsInFreeform(strokes, polygon)
      const cardIds = selection.mode === 'rect'
        ? cardIdsInRectangle(cards, rect)
        : cardIdsInFreeform(cards, polygon)
      setSelectedCardIds(new Set(cardIds))
      props.onSuggestSelection(strokeIds)
    }
    setSelection(null)
  }

  const groupActionPosition = currentGroup?.status === 'suggested'
    ? placeGroupSuggestionActions(currentGroup.boundingBox, stageSize)
    : null

  return (
    <section ref={stageRef} className={`canvas-stage canvas-stage--${inputMode}`} aria-labelledby="canvas-title">
      <div className="canvas-stage__index" aria-hidden="true">00 / P1 STYLE LAB</div>
      {inputMode === 'gesture' ? <div className="canvas-stage__edge-cue" aria-hidden="true">手势边缘提示</div> : null}
      <canvas
        ref={canvasRef}
        className={`workspace-canvas workspace-canvas--${inputMode} workspace-canvas--tool-${tool}`}
        aria-label={inputMode === 'mouse' ? '鼠标绘图画布' : '空中手势绘图画布'}
        onPointerDown={beginCanvasAction}
        onPointerMove={moveCanvasAction}
        onPointerUp={(event) => finishCanvasAction(event, false)}
        onPointerCancel={(event) => finishCanvasAction(event, true)}
      />
      {selection ? (
        <svg className="selection-layer" aria-hidden="true">
          {selection.mode === 'rect' ? (() => {
            const rect = selectionRect(selection.start, selection.current)
            return <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} />
          })() : (
            <polyline points={selection.points.map((point) => `${point.x},${point.y}`).join(' ')} />
          )}
        </svg>
      ) : null}
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
        const visual = cardVisuals.get(card.id)
        const cardStrokes = visual?.cardStrokes ?? []
        const ink = card.kind === 'ink' ? visual?.ink ?? null : null
        const isCompact = preview.size.width < 200 || preview.size.height < 160
        const isMini = preview.size.width < 140 || preview.size.height < 110
        return (
          <article key={card.id} data-card-id={card.id} className={`idea-card ${selectedCardIds.has(card.id) ? 'idea-card--selected' : ''} ${edgeDraft?.targetCardId === card.id ? 'idea-card--edge-target' : ''} ${isCompact ? 'idea-card--compact' : ''} ${isMini ? 'idea-card--mini' : ''}`} style={{ left: preview.position.x, top: preview.position.y, width: preview.size.width, height: preview.size.height }}>
            <div className="idea-card__title" onPointerDown={(event) => beginCardDrag(event, card)} onPointerMove={moveCardPreview} onPointerUp={(event) => finishCardDrag(event, false)} onPointerCancel={(event) => finishCardDrag(event, true)} onDoubleClick={() => beginTitleEdit(card)}>
              {editingCardId === card.id ? (
                <>
                  <input
                    autoFocus
                    aria-label="卡片文字注释"
                    maxLength={100}
                    placeholder="用键盘输入文字"
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onBlur={() => finishTitle(card.id, true)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') finishTitle(card.id, true)
                      if (event.key === 'Escape') finishTitle(card.id, false)
                    }}
                  />
                  <span>{draftTitle.length}/100</span>
                </>
              ) : (
                <>
                  <strong>{card.title}</strong>
                  {!isCompact && (
                    <button
                      className="idea-card__text-entry"
                      type="button"
                      aria-label={`键盘输入卡片文字注释：${card.title}`}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => beginTitleEdit(card)}
                    >输入文字</button>
                  )}
                </>
              )}
            </div>
            {ink ? (
              <svg className="idea-card__ink" viewBox={`0 0 ${ink.size.width} ${ink.size.height}`} preserveAspectRatio="xMidYMid meet">
                {cardStrokes.map((stroke) => {
                  const style = props.experimentalStylesEnabled ? stroke.style : 'ink'
                  const particleSamples = style === 'particle'
                    ? visual?.particleSamples.get(stroke.id) ?? []
                    : []
                  return (
                    <g key={stroke.id} className={`card-stroke card-stroke--${style}`} style={{ color: stroke.color }}>
                      {style !== 'particle' ? <polyline points={stroke.points.map((point) => `${point.x - ink.origin.x},${point.y - ink.origin.y}`).join(' ')} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" /> : null}
                      {style === 'particle'
                        ? particleSamples.map((particle, index) => <circle key={`${stroke.id}-particle-${index}`} cx={particle.x - ink.origin.x} cy={particle.y - ink.origin.y} r={particle.radius} fill={stroke.color} opacity={particle.opacity} style={{ filter: `blur(${props.reducedMotion ? 0.7 : Math.min(1.8, particle.blur * 0.55)}px)` }} />)
                        : null}
                    </g>
                  )
                })}
              </svg>
            ) : null}
            {card.kind === 'text' ? (
              <div
                className="idea-card__text"
                style={{
                  color: card.textStyle.color,
                  fontWeight: card.textStyle.bold ? 700 : 400,
                  fontStyle: card.textStyle.italic ? 'italic' : 'normal',
                  textDecoration: card.textStyle.underline ? 'underline' : 'none',
                }}
              >
                {!isCompact && (
                  <div className="idea-card__formatting" aria-label="文字格式">
                    <button type="button" aria-pressed={card.textStyle.bold} onClick={() => props.onUpdateTextCard(card.id, { textStyle: { bold: !card.textStyle.bold } })}>B</button>
                    <button type="button" aria-pressed={card.textStyle.italic} onClick={() => props.onUpdateTextCard(card.id, { textStyle: { italic: !card.textStyle.italic } })}>I</button>
                    <button type="button" aria-pressed={card.textStyle.underline} onClick={() => props.onUpdateTextCard(card.id, { textStyle: { underline: !card.textStyle.underline } })}>U</button>
                    <input
                      type="color"
                      aria-label="文字颜色"
                      value={card.textStyle.color}
                      onChange={(event) => props.onUpdateTextCard(card.id, { textStyle: { color: event.target.value } })}
                    />
                  </div>
                )}
                <textarea
                  key={card.content}
                  aria-label={`编辑文字卡片 ${card.title}`}
                  maxLength={5000}
                  defaultValue={card.content}
                  placeholder="输入正文…"
                  onPointerDown={(event) => event.stopPropagation()}
                  onInput={(event) => {
                    const value = event.currentTarget.value
                    setTextLengths((current) => ({ ...current, [card.id]: value.length }))
                  }}
                  onBlur={(event) => {
                    props.onUpdateTextCard(card.id, { content: event.target.value })
                    setTextLengths((current) => {
                      const next = { ...current }
                      delete next[card.id]
                      return next
                    })
                  }}
                />
                {!isCompact && <span className="idea-card__body-count">{textLengths[card.id] ?? card.content.length}/5000</span>}
              </div>
            ) : null}
            {!isCompact && (
              <button
                className="idea-card__delete"
                type="button"
                aria-label={`删除卡片 ${card.title}`}
                title="删除卡片及其内容"
                onClick={() => props.onDeleteCard(card.id)}
              >×</button>
            )}
            {(['top', 'right', 'bottom', 'left'] as EdgeAnchor[]).map((anchor) => (
              <button
                key={anchor}
                className={`idea-card__anchor idea-card__anchor--${anchor}`}
                type="button"
                style={{ pointerEvents: tool === 'select' ? 'auto' : 'none' }}
                data-card-id={card.id}
                data-anchor-side={anchor}
                aria-label={`从 ${card.title} 的${anchor === 'top' ? '上方' : anchor === 'right' ? '右侧' : anchor === 'bottom' ? '下方' : '左侧'}连接点创建连接`}
                onPointerDown={(event) => beginEdge(event, card.id, anchor)}
                onPointerMove={moveEdge}
                onPointerUp={finishEdge}
                onPointerCancel={() => setEdgeDraft(null)}
              >●</button>
            ))}
            {([
              ['nw', '左上角', '↖'],
              ['ne', '右上角', '↗'],
              ['se', '右下角', '↘'],
              ['sw', '左下角', '↙'],
            ] as const).map(([handle, label, icon]) => (
              <button
                key={handle}
                className={`idea-card__resize idea-card__resize--${handle}`}
                type="button"
                style={{ pointerEvents: tool === 'select' ? 'auto' : 'none' }}
                aria-label={`从${label}调整卡片 ${card.title} 大小`}
                onPointerDown={(event) => beginCardResize(event, card, handle)}
                onPointerMove={moveCardResize}
                onPointerUp={(event) => finishCardResize(event, false)}
                onPointerCancel={(event) => finishCardResize(event, true)}
              >{icon}</button>
            ))}
          </article>
        )
      })}
      {currentGroup?.status === 'suggested' ? (
        <>
          <div
            className="group-suggestion"
            style={{
              left: currentGroup.boundingBox.x - 12,
              top: currentGroup.boundingBox.y - 12,
              width: currentGroup.boundingBox.width + 24,
              height: currentGroup.boundingBox.height + 24,
            }}
          />
          <div className="group-suggestion-actions" style={groupActionPosition ?? undefined}>
            <button type="button" onClick={props.onGenerateCard}>生成想法卡片</button>
            <button type="button" onClick={props.onContinueGroup}>继续添加</button>
            <button type="button" onClick={props.onCancelGroup}>取消分组</button>
          </div>
        </>
      ) : null}
      {calibration.phase === 'roi' ? <div className={`calibration-target calibration-target--${calibration.roiStep}`} aria-hidden="true">{calibration.roiStep + 1}</div> : null}
      <div className="canvas-stage__notice"><p className="eyebrow">P0 WORKSPACE</p><h2 id="canvas-title">{tool === 'draw' ? (inputMode === 'mouse' ? '鼠标画笔已启用' : '捏合落笔，松开断笔') : tool === 'erase' ? '整笔橡皮擦：点击或划过自由笔迹' : tool === 'pan' ? '拖动画布进行平移' : tool === 'select' ? (selectedCardIds.size > 1 ? `已选择 ${selectedCardIds.size} 张卡片，可整体移动` : '选择卡片或从锚点连线') : tool === 'lasso-rect' ? '拖动矩形框选笔画与卡片' : '拖动自由套索选择笔画与卡片'}</h2><p>按住 Shift 可增减卡片选择；实验视觉不改写原始 Stroke。</p>{tool === 'select' ? <label className="edge-type-control">{selectedEdgeId ? '所选连接' : '新连接类型'}<select value={selectedEdgeId ? edges.find((edge) => edge.id === selectedEdgeId)?.type ?? props.edgeType : props.edgeType} onChange={(event) => { const type = event.target.value as Edge['type']; if (selectedEdgeId) props.onUpdateEdge(selectedEdgeId, type); else props.onEdgeTypeChange(type) }}><option value="undirected">无方向</option><option value="directed">有方向</option></select></label> : null}</div>
      <div className="canvas-stage__coordinates" aria-hidden="true"><span>{inputMode.toUpperCase()}</span><span>{strokes.length} STROKES</span><span>{cards.length} CARDS / {edges.length} EDGES</span></div>
    </section>
  )
}
