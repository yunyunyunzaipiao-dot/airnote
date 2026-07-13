import { useEffect, useRef } from 'react'

interface M0CanvasProps {
  onReady: (canvas: HTMLCanvasElement, cursor: HTMLElement) => void
}

export function M0Canvas({ onReady }: M0CanvasProps) {
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

  return (
    <section ref={stageRef} className="canvas-stage" aria-labelledby="canvas-title">
      <div className="canvas-stage__index" aria-hidden="true">00 / M0 CANVAS</div>
      <canvas ref={canvasRef} className="m0-canvas" aria-label="M0 空中绘图诊断画布" />
      <div ref={cursorRef} className="tracking-cursor" hidden aria-hidden="true" />
      <div className="canvas-stage__notice">
        <p className="eyebrow">LOW-LATENCY INK SPIKE</p>
        <h2 id="canvas-title">捏合落笔，松开断笔</h2>
        <p>临时诊断轨迹，不会保存。正式 Stroke、撤销和本地恢复尚未实现。</p>
      </div>
      <div className="canvas-stage__coordinates" aria-hidden="true">
        <span>INK #172B3A</span>
        <span>4 PX</span>
        <span>AXIS EMA</span>
      </div>
    </section>
  )
}
