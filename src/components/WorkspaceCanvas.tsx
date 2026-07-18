import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { cardInkMetrics } from '../drawing/cardInk'
import { particleSamplesForStroke } from '../drawing/particleStyle'
import {
  adaptiveResizeHandlePosition,
  resizeCardFromHandle,
  type CardGeometry,
  type CardResizeHandle,
} from '../layout/cardResize'
import { placeGroupSuggestionActions } from '../layout/groupSuggestionPlacement'
import { automaticEdgeAnchors, cardAnchorPoint, closestCardAnchor, MIN_CARD_SIZE } from '../store/workspaceDocument'
import type { CalibrationUiState } from '../store/useAirNoteRuntime'
import type { Edge, EdgeAnchor, IdeaCard, InputMode, Stroke, StrokeGroup, WorkspaceTool } from '../types/workspace'

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
  onReady: (canvas: HTMLCanvasElement, cursor: HTMLElement) => void
  onPointerStart: (point: { x: number; y: number }, timestamp: number) => void
  onPointerMove: (point: { x: number; y: number }, timestamp: number) => void
  onPointerEnd: () => void
  onGenerateCard: () => void
  onContinueGroup: () => void
  onCancelGroup: () => void
  onMoveCard: (cardId: string, x: number, y: number, stage: { width: number; height: number }) => void
  onResizeCard: (cardId: string, geometry: CardGeometry, stage: { width: number; height: number }) => void
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

interface CardDragPreview {
  cardId: string
  pointerId: number
  startX: number
  startY: number
  x: number
  y: number
}

export function WorkspaceCanvas(props: WorkspaceCanvasProps) {
  const { inputMode, tool, strokes, cards, edges, currentGroup, calibration } = props
  const stageRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
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
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })

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
    if (!createdCard || createdCard.title !== '未命名想法') return
    setEditingCardId(createdCard.id)
    setDraftTitle('')
  }, [cards])

  const cardVisuals = useMemo(() => {
    const strokesById = new Map(strokes.map((stroke) => [stroke.id, stroke]))
    return new Map(cards.map((card) => {
      const cardStrokes = card.strokeIds
        .map((strokeId) => strokesById.get(strokeId))
        .filter((stroke): stroke is Stroke => Boolean(stroke))
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
      : drag?.cardId === card.id
        ? { x: drag.x, y: drag.y }
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
    if (tool === 'draw' || editingCardId === card.id || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const next = {
      cardId: card.id,
      pointerId: event.pointerId,
      startX: event.clientX - card.position.x,
      startY: event.clientY - card.position.y,
      ...card.position,
    }
    dragRef.current = next
    setDrag(next)
  }

  const moveCardPreview = (event: PointerEvent<HTMLDivElement>) => {
    const current = dragRef.current
    if (!current || current.pointerId !== event.pointerId) return
    const next = {
      ...current,
      x: event.clientX - current.startX,
      y: event.clientY - current.startY,
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
    if (!cancelled && stageRef.current) {
      props.onMoveCard(current.cardId, current.x, current.y, { width: stageRef.current.clientWidth, height: stageRef.current.clientHeight })
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
          x: event.clientX - resize.startPointer.x,
          y: event.clientY - resize.startPointer.y,
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
        const visual = cardVisuals.get(card.id)
        const cardStrokes = visual?.cardStrokes ?? []
        const ink = visual?.ink ?? null
        return (
          <article key={card.id} data-card-id={card.id} className={`idea-card ${edgeDraft?.targetCardId === card.id ? 'idea-card--edge-target' : ''}`} style={{ left: preview.position.x, top: preview.position.y, width: preview.size.width, height: preview.size.height }}>
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
                  <button
                    className="idea-card__text-entry"
                    type="button"
                    aria-label={`键盘输入卡片文字注释：${card.title}`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => beginTitleEdit(card)}
                  >输入文字</button>
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
            {([
              ['nw', '左上角', '↖'],
              ['ne', '右上角', '↗'],
              ['se', '右下角', '↘'],
              ['sw', '左下角', '↙'],
            ] as const).map(([handle, label, icon]) => (
              <button
                key={handle}
                className={`idea-card__resize idea-card__resize--${handle}`}
                style={adaptiveResizeHandlePosition(preview, handle, stageSize)}
                type="button"
                hidden={tool !== 'select'}
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
      <div className="canvas-stage__notice"><p className="eyebrow">P1 STYLE-01 · P0 SAFE</p><h2 id="canvas-title">{tool === 'draw' ? (inputMode === 'mouse' ? '鼠标画笔已启用' : '捏合落笔，松开断笔') : tool === 'select' ? '选择与整理卡片' : '从卡片锚点拖出连接'}</h2><p>笔迹、卡片与连接会在本地自动保存。实验视觉只改变显示，不改写原始 Stroke。</p>{tool === 'edge' ? <label className="edge-type-control">{selectedEdgeId ? '所选连接' : '新连接类型'}<select value={selectedEdgeId ? edges.find((edge) => edge.id === selectedEdgeId)?.type ?? props.edgeType : props.edgeType} onChange={(event) => { const type = event.target.value as Edge['type']; if (selectedEdgeId) props.onUpdateEdge(selectedEdgeId, type); else props.onEdgeTypeChange(type) }}><option value="undirected">无方向</option><option value="directed">有方向</option></select></label> : null}</div>
      <div className="canvas-stage__coordinates" aria-hidden="true"><span>{inputMode.toUpperCase()}</span><span>{strokes.length} STROKES</span><span>{cards.length} CARDS / {edges.length} EDGES</span></div>
    </section>
  )
}
