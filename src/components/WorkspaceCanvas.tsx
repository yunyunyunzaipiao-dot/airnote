import { useEffect, useRef, type PointerEvent } from 'react'
import type { CalibrationUiState } from '../store/useAirNoteRuntime'
import type { InputMode } from '../types/workspace'

interface WorkspaceCanvasProps {
  inputMode: InputMode
  strokeCount: number
  calibration: CalibrationUiState
  onReady: (canvas: HTMLCanvasElement, cursor: HTMLElement) => void
  onPointerStart: (point: { x: number; y: number }, timestamp: number) => void
  onPointerMove: (point: { x: number; y: number }, timestamp: number) => void
  onPointerEnd: () => void
}

function canvasPoint(event: PointerEvent<HTMLCanvasElement>) {
  const bounds = event.currentTarget.getBoundingClientRect()
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}

export function WorkspaceCanvas({
  inputMode,
  strokeCount,
  calibration,
  onReady,
  onPointerStart,
  onPointerMove,
  onPointerEnd,
}: WorkspaceCanvasProps) {
  const stageRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    const cursor = cursorRef.current
    if (!stage || !canvas || !cursor) return

    const resize = () => onReady(canvas, cursor)
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [onReady])

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (inputMode !== 'mouse' || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    onPointerStart(canvasPoint(event), event.timeStamp)
  }

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (inputMode !== 'mouse' || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    onPointerMove(canvasPoint(event), event.timeStamp)
  }

  const handlePointerEnd = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    onPointerEnd()
  }

  return (
    <section ref={stageRef} className="canvas-stage" aria-labelledby="canvas-title">
      <div className="canvas-stage__index" aria-hidden="true">00 / M1 WORKSPACE</div>
      <canvas
        ref={canvasRef}
        className={`workspace-canvas workspace-canvas--${inputMode}`}
        aria-label={inputMode === 'mouse' ? '鼠标绘图画布' : '空中手势绘图画布'}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      />
      <div ref={cursorRef} className="tracking-cursor" hidden aria-hidden="true" />
      {calibration.phase === 'roi' ? (
        <div className={`calibration-target calibration-target--${calibration.roiStep}`} aria-hidden="true">
          {calibration.roiStep + 1}
        </div>
      ) : null}
      <div className="canvas-stage__notice">
        <p className="eyebrow">P0 STROKE WORKSPACE</p>
        <h2 id="canvas-title">{inputMode === 'mouse' ? '鼠标画笔已启用' : '捏合落笔，松开断笔'}</h2>
        <p>{calibration.phase === 'review'
          ? '当前为校准测试线，不会写入正式 Stroke。'
          : '笔迹已进入正式 Stroke 与撤销历史；完整本地保存将在后续 P0 阶段实现。'}
        </p>
      </div>
      <div className="canvas-stage__coordinates" aria-hidden="true">
        <span>{inputMode.toUpperCase()}</span>
        <span>{strokeCount} STROKES</span>
        <span>INK</span>
      </div>
    </section>
  )
}
