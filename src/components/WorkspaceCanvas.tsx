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
import { EdgeTypePicker } from './EdgeTypePicker'

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
  onSelectionChange?: (selectedCardIds: string[]) => void
  cancelInteractionSignal?: number
}

function canvasPoint(
  event: PointerEvent<HTMLCanvasElement>,
  viewport: { x: number; y: number; zoom: number },
) {
  const bounds = event.currentTarget.getBoundingClientRect()
  return {
    x: (event.clientX - bounds.left - viewport.x) / viewport.zoom,
    y: (event.clientY - bounds.top - viewport.y) / viewport.zoom,
  }
}

function blocksCardDrag(target: EventTarget | null) {
  return target instanceof Element
    && Boolean(target.closest('input, textarea, button, select, a, [contenteditable="true"]'))
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
  const { inputMode, tool, strokes, cards, edges, currentGroup, calibration, zoom, viewport } = props
  const stageRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const knownCardIdsRef = useRef(new Set(cards.map((card) => card.id)))
  const [drag, setDrag] = useState<CardDragPreview | null>(null)
  const dragRef = useRef<CardDragPreview | null>(null)
  const dragFrameRef = useRef<number | null>(null)
  const cancelInteractionSignalRef = useRef(props.cancelInteractionSignal)
  const [resize, setResize] = useState<{
    cardId: string
    pointerId: number
    handle: CardResizeHandle
    startPointer: { x: number; y: number }
    startGeometry: CardGeometry
    geometry: CardGeometry
  } | null>(null)
  const [edgeDraft, setEdgeDraft] = useState<{ sourceCardId: string; sourceAnchor: EdgeAnchor; x: number; y: number; targetCardId: string | null; targetAnchor: EdgeAnchor | null } | null>(null)
  const [pendingEdgeDraft, setPendingEdgeDraft] = useState<{ sourceCardId: string; targetCardId: string; sourceAnchor: EdgeAnchor; targetAnchor: EdgeAnchor } | null>(null)
  const [showEdgeTypePicker, setShowEdgeTypePicker] = useState(false)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(() => new Set())
  const [selection, setSelection] = useState<SelectionDraft | null>(null)
  const [pan, setPan] = useState<PanDraft | null>(null)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    props.onSelectionChange?.([...selectedCardIds])
  }, [selectedCardIds, props.onSelectionChange])

  useEffect(() => {
    if (props.cancelInteractionSignal === cancelInteractionSignalRef.current) return
    cancelInteractionSignalRef.current = props.cancelInteractionSignal
    if (dragFrameRef.current !== null) {
      if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(dragFrameRef.current)
      else window.clearTimeout(dragFrameRef.current)
      dragFrameRef.current = null
    }
    dragRef.current = null
    setDrag(null)
    setResize(null)
    setEdgeDraft(null)
    setPendingEdgeDraft(null)
    setShowEdgeTypePicker(false)
    setSelectedEdgeId(null)
    setSelectedCardIds(new Set())
    setSelection(null)
    setPan(null)
  }, [props.cancelInteractionSignal])

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

  const beginCardDrag = (event: PointerEvent<HTMLElement>, card: IdeaCard) => {
    if (
      tool !== 'select'
      || editingCardId === card.id
      || event.button !== 0
      || blocksCardDrag(event.target)
    ) return
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

  const moveCardPreview = (event: PointerEvent<HTMLElement>) => {
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

  const finishCardDrag = (event: PointerEvent<HTMLElement>, cancelled: boolean) => {
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
    const worldStage = {
      width: stage.clientWidth / zoom,
      height: stage.clientHeight / zoom,
    }
    setResize({
      ...resize,
      geometry: resizeCardFromHandle(
        resize.startGeometry,
        resize.handle,
        {
          x: (event.clientX - resize.startPointer.x) / zoom,
          y: (event.clientY - resize.startPointer.y) / zoom,
        },
        worldStage,
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
        {
          width: stageRef.current.clientWidth / zoom,
          height: stageRef.current.clientHeight / zoom,
        },
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
      x: (event.clientX - (bounds?.left ?? 0) - viewport.x) / zoom,
      y: (event.clientY - (bounds?.top ?? 0) - viewport.y) / zoom,
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
      setPendingEdgeDraft({
        sourceCardId: edgeDraft.sourceCardId,
        targetCardId: edgeDraft.targetCardId,
        sourceAnchor: edgeDraft.sourceAnchor,
        targetAnchor: edgeDraft.targetAnchor,
      })
      setShowEdgeTypePicker(true)
    }
    setEdgeDraft(null)
  }

  const confirmEdgeType = (type: Edge['type']) => {
    if (!pendingEdgeDraft) return
    props.onEdgeTypeChange(type)
    props.onCreateEdge(
      pendingEdgeDraft.sourceCardId,
      pendingEdgeDraft.targetCardId,
      pendingEdgeDraft.sourceAnchor,
      pendingEdgeDraft.targetAnchor,
    )
    setPendingEdgeDraft(null)
    setShowEdgeTypePicker(false)
  }

  const cancelEdgeType = () => {
    setPendingEdgeDraft(null)
    setShowEdgeTypePicker(false)
  }

  const beginCanvasAction = (event: PointerEvent<HTMLCanvasElement>) => {
    if (inputMode !== 'mouse' || event.button !== 0) return
    if (tool === 'draw') {
      event.currentTarget.setPointerCapture(event.pointerId)
      props.onPointerStart(canvasPoint(event, viewport), event.timeStamp)
      return
    }
    if (tool === 'erase') {
      event.currentTarget.setPointerCapture(event.pointerId)
      props.onEraseAtPoint(canvasPoint(event, viewport))
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
    const point = canvasPoint(event, viewport)
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
      props.onPointerMove(canvasPoint(event, viewport), event.timeStamp)
      return
    }
    if (tool === 'erase') {
      props.onEraseAtPoint(canvasPoint(event, viewport))
      return
    }
    if (tool === 'pan' && pan?.pointerId === event.pointerId) {
      props.onPan(
        pan.startViewport.x + event.clientX - pan.startClient.x,
        pan.startViewport.y + event.clientY - pan.startClient.y,
      )
      return
    }
    const point = canvasPoint(event, viewport)
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
      const end = canvasPoint(event, viewport)
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
    ? (() => {
        const visibleWorld = {
          x: -viewport.x / zoom,
          y: -viewport.y / zoom,
          width: stageSize.width / zoom,
          height: stageSize.height / zoom,
        }
        const relativePosition = placeGroupSuggestionActions(
          {
            ...currentGroup.boundingBox,
            x: currentGroup.boundingBox.x - visibleWorld.x,
            y: currentGroup.boundingBox.y - visibleWorld.y,
          },
          { width: visibleWorld.width, height: visibleWorld.height },
        )
        return {
          left: relativePosition.left + visibleWorld.x,
          top: relativePosition.top + visibleWorld.y,
        }
      })()
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
      <div ref={cursorRef} className="tracking-cursor" hidden aria-hidden="true" />
      <div
        className="workspace-world"
        style={{
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`,
        }}
      >
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
        {cards.map((card) => {
        const preview = cardPreview(card)
        const visual = cardVisuals.get(card.id)
        const cardStrokes = visual?.cardStrokes ?? []
        const ink = card.kind === 'ink' ? visual?.ink ?? null : null
        const isCompact = preview.size.width < 200 || preview.size.height < 160
        const isMini = preview.size.width < 140 || preview.size.height < 110
        return (
          <article
            key={card.id}
            data-card-id={card.id}
            className={`idea-card ${tool === 'select' ? 'idea-card--draggable' : ''} ${selectedCardIds.has(card.id) ? 'idea-card--selected' : ''} ${edgeDraft?.targetCardId === card.id ? 'idea-card--edge-target' : ''} ${isCompact ? 'idea-card--compact' : ''} ${isMini ? 'idea-card--mini' : ''}`}
            style={{ left: preview.position.x, top: preview.position.y, width: preview.size.width, height: preview.size.height }}
            onPointerDown={(event) => beginCardDrag(event, card)}
            onPointerMove={moveCardPreview}
            onPointerUp={(event) => finishCardDrag(event, false)}
            onPointerCancel={(event) => finishCardDrag(event, true)}
          >
            <div className="idea-card__title" onDoubleClick={() => beginTitleEdit(card)}>
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
                <textarea
                  key={card.content}
                  aria-label={`编辑文字卡片 ${card.title}`}
                  maxLength={5000}
                  defaultValue={card.content}
                  placeholder="输入正文…"
                  onPointerDown={(event) => event.stopPropagation()}
                  onBlur={(event) => {
                    props.onUpdateTextCard(card.id, { content: event.target.value })
                  }}
                />
              </div>
            ) : null}
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
      </div>
      {calibration.phase === 'roi' ? <div className={`calibration-target calibration-target--${calibration.roiStep}`} aria-hidden="true">{calibration.roiStep + 1}</div> : null}
      <EdgeTypePicker open={showEdgeTypePicker} onSelect={confirmEdgeType} onCancel={cancelEdgeType} />

    </section>
  )
}
