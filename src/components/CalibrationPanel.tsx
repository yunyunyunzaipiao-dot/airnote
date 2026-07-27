import { useEffect, useRef, useCallback } from 'react'
import { ROI_TARGETS, ROI_TARGET_POSITIONS } from '../camera/calibration'
import type { CalibrationDraft } from '../camera/calibration'
import type { CalibrationUiState, LatestHandData } from '../store/useAirNoteRuntime'
import type { NormalizedPoint } from '../types/m0'

interface CalibrationPanelProps {
  calibration: CalibrationUiState
  cameraRunning: boolean
  streamRef: React.RefObject<MediaStream | null>
  latestHandRef: React.RefObject<LatestHandData | null>
  calibrationDraftRef: React.RefObject<CalibrationDraft>
  onBegin: () => void
  onCapture: () => void
  onConfirm: () => void
  onSkip: () => void
}

/* ── MediaPipe hand skeleton connections ── */

const HAND_CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm lateral
  [5, 9], [9, 13], [13, 17],
]

const INDEX_FINGER_CONNECTIONS: [number, number][] = [
  [0, 5], [5, 6], [6, 7], [7, 8],
]

const THUMB_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
]

/* ── Coordinate mapping ── */

/** Convert a normalised landmark to canvas pixel coordinates.
 *  x is flipped (1 − x) to match the mirrored selfie view. */
function toScreen(lm: NormalizedPoint, w: number, h: number): [number, number] {
  return [w * (1 - lm.x), h * lm.y]
}

/* ── Drawing helpers ── */

function drawConnection(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedPoint[],
  a: number,
  b: number,
  w: number,
  h: number,
  color: string,
  lineWidth: number,
) {
  const [ax, ay] = toScreen(landmarks[a], w, h)
  const [bx, by] = toScreen(landmarks[b], w, h)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(bx, by)
  ctx.stroke()
}

function drawDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fillColor: string,
  strokeColor?: string,
) {
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = fillColor
  ctx.fill()
  if (strokeColor) {
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  lineWidth: number,
) {
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.moveTo(x - size, y)
  ctx.lineTo(x + size, y)
  ctx.moveTo(x, y - size)
  ctx.lineTo(x, y + size)
  ctx.stroke()
}

/* ── Component ── */

export function CalibrationPanel({
  calibration,
  cameraRunning,
  streamRef,
  latestHandRef,
  calibrationDraftRef,
  onBegin,
  onCapture,
  onConfirm,
  onSkip,
}: CalibrationPanelProps) {
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const phaseRef = useRef(calibration.phase)
  const roiStepRef = useRef(calibration.roiStep)

  // Keep refs in sync with React state so the draw loop reads fresh values
  phaseRef.current = calibration.phase
  roiStepRef.current = calibration.roiStep

  /* ── Set up preview video (shares the same MediaStream) ── */

  useEffect(() => {
    const video = previewVideoRef.current
    const stream = streamRef.current
    if (!video || !stream) return
    video.srcObject = stream
    video.play().catch(() => {/* auto-play may be blocked briefly */})
    return () => {
      video.srcObject = null
    }
  }, [streamRef])

  /* ── Canvas animation loop ── */

  const drawFrame = useCallback(() => {
    const canvas = overlayCanvasRef.current
    const video = previewVideoRef.current
    if (!canvas || !video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(drawFrame)
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      rafRef.current = requestAnimationFrame(drawFrame)
      return
    }

    // Match canvas pixel buffer to video display size
    const w = video.clientWidth
    const h = video.clientHeight
    if (w === 0 || h === 0) {
      rafRef.current = requestAnimationFrame(drawFrame)
      return
    }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }

    ctx.clearRect(0, 0, w, h)

    const handData = latestHandRef.current
    const draft = calibrationDraftRef.current
    const phase = phaseRef.current
    const roiStep = roiStepRef.current

    /* ── ROI phase: target crosshairs + recorded points ── */

    if (phase === 'roi') {
      ROI_TARGET_POSITIONS.forEach((target, i) => {
        const [tx, ty] = toScreen(target, w, h)
        const isCurrent = i === roiStep
        const isRecorded = i < roiStep

        if (isRecorded) {
          // Blue filled dot for completed targets
          drawDot(ctx, tx, ty, 7, '#45B7D1', '#2E86AB')
        } else {
          // Crosshair + circle for pending targets
          const color = isCurrent ? '#4ECDC4' : '#888'
          const lw = isCurrent ? 2.5 : 1.2
          const sz = isCurrent ? 14 : 10
          drawCrosshair(ctx, tx, ty, sz, color, lw)
          ctx.beginPath()
          ctx.arc(tx, ty, isCurrent ? 10 : 7, 0, Math.PI * 2)
          ctx.strokeStyle = color
          ctx.lineWidth = lw
          ctx.stroke()

          // Pulsing ring for the current target
          if (isCurrent) {
            const pulse = 1 + 0.15 * Math.sin(Date.now() / 300)  // use Date.now since we redraw each frame
            ctx.beginPath()
            ctx.arc(tx, ty, 10 * pulse, 0, Math.PI * 2)
            ctx.strokeStyle = 'rgba(78, 205, 196, 0.4)'
            ctx.lineWidth = 1.5
            ctx.stroke()
          }

          // Label
          ctx.fillStyle = isCurrent ? '#4ECDC4' : '#888'
          ctx.font = '11px system-ui, sans-serif'
          ctx.textAlign = 'left'
          ctx.fillText(ROI_TARGETS[i], tx + 16, ty - 4)
        }
      })

      // Draw recorded ROI points from draft (blue dots)
      draft.roiPoints.forEach((point) => {
        const [px, py] = toScreen(point, w, h)
        drawDot(ctx, px, py, 6, '#45B7D1', '#2E86AB')
      })
    }

    /* ── Hand skeleton overlay ── */

    if (handData?.landmarks) {
      const lm = handData.landmarks

      // Dim connections for entire skeleton
      HAND_CONNECTIONS.forEach(([a, b]) => {
        drawConnection(ctx, lm, a, b, w, h, 'rgba(255,255,255,0.3)', 1.5)
      })

      // Highlighted connections per phase
      if (phase === 'roi' || phase === 'pinch') {
        INDEX_FINGER_CONNECTIONS.forEach(([a, b]) => {
          drawConnection(ctx, lm, a, b, w, h, '#4ECDC4', 2.8)
        })
      }
      if (phase === 'pinch') {
        THUMB_CONNECTIONS.forEach(([a, b]) => {
          drawConnection(ctx, lm, a, b, w, h, '#FF6B6B', 2.8)
        })
      }

      // Landmark dots
      lm.forEach((point, i) => {
        const [x, y] = toScreen(point, w, h)
        const isIndexTip = i === 8
        const isThumbTip = i === 4
        const highlighted =
          (phase === 'roi' && isIndexTip)
          || (phase === 'pinch' && (isIndexTip || isThumbTip))

        drawDot(ctx, x, y, highlighted ? 4.5 : 2, highlighted ? '#4ECDC4' : 'rgba(255,255,255,0.45)')
      })

      // Glowing fingertip cursor during ROI
      if (phase === 'roi' && lm[8]) {
        const [ix, iy] = toScreen(lm[8], w, h)
        // Outer glow
        drawDot(ctx, ix, iy, 12, 'rgba(78,205,196,0.2)')
        // Core dot
        drawDot(ctx, ix, iy, 5, '#4ECDC4')
      }

      // Thumb–index pinch distance indicator during pinch
      if (phase === 'pinch' && lm[4] && lm[8]) {
        const [tx, ty] = toScreen(lm[4], w, h)
        const [ix, iy] = toScreen(lm[8], w, h)
        // Dashed line between thumb tip and index tip
        ctx.setLineDash([4, 4])
        ctx.strokeStyle = 'rgba(255,107,107,0.6)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(tx, ty)
        ctx.lineTo(ix, iy)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    /* ── Pinch ratio progress bar ── */

    if (phase === 'pinch' && handData?.pinchRatio != null) {
      const barX = w - 32
      const barTop = 16
      const barWidth = 14
      const barHeight = h - 32
      const ratio = handData.pinchRatio

      // Background track
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      roundRect(ctx, barX, barTop, barWidth, barHeight, 4)
      ctx.fill()

      // Fill proportional to pinch ratio (0 → 0.8 range mapped to 0 → 1)
      const fillRatio = Math.min(1, ratio / 0.8)
      const fillH = barHeight * fillRatio

      // Gradient from green (open) to red (pinched)
      const grad = ctx.createLinearGradient(barX, barTop + barHeight, barX, barTop)
      grad.addColorStop(0, '#4ECDC4')
      grad.addColorStop(0.5, '#F7DC6F')
      grad.addColorStop(1, '#FF6B6B')

      ctx.fillStyle = grad
      roundRect(ctx, barX + 1, barTop + barHeight - fillH + 1, barWidth - 2, fillH - 2, 3)
      ctx.fill()

      // Labels
      ctx.fillStyle = '#ccc'
      ctx.font = '10px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('捏合', barX + barWidth / 2, barTop - 4)
      ctx.fillText('松开', barX + barWidth / 2, barTop + barHeight + 14)
    }

    /* ── Review phase: ROI boundary preview ── */

    if (phase === 'review' && draft.roiPoints.length === 4) {
      const pts = draft.roiPoints.map((p) => toScreen(p, w, h))

      // Draw ROI quadrilateral
      ctx.strokeStyle = 'rgba(78, 205, 196, 0.5)'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(pts[0][0], pts[0][1])
      ctx.lineTo(pts[1][0], pts[1][1])
      ctx.lineTo(pts[2][0], pts[2][1])
      ctx.lineTo(pts[3][0], pts[3][1])
      ctx.closePath()
      ctx.stroke()
      ctx.setLineDash([])

      // Fill ROI area with semi-transparent overlay
      ctx.fillStyle = 'rgba(78, 205, 196, 0.08)'
      ctx.fill()

      // Corner dots
      pts.forEach(([px, py]) => drawDot(ctx, px, py, 4, '#4ECDC4'))

      // Label "书写区域"
      const cx = pts.reduce((s, p) => s + p[0], 0) / 4
      const cy = pts.reduce((s, p) => s + p[1], 0) / 4
      ctx.fillStyle = '#4ECDC4'
      ctx.font = '12px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('书写区域', cx, cy)
    }

    /* ── "No hand visible" warning ── */

    if (
      !handData?.landmarks
      && phase !== 'ready'
      && phase !== 'idle'
      && phase !== 'required'
    ) {
      ctx.fillStyle = 'rgba(255,107,107,0.85)'
      ctx.font = '13px system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('⚠ 手不在画面中', 8, 22)
    }

    rafRef.current = requestAnimationFrame(drawFrame)
  }, [latestHandRef, calibrationDraftRef, streamRef])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(drawFrame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [drawFrame])

  /* ── Render ── */

  if (!cameraRunning) return null

  const captureLabel = calibration.phase === 'roi'
    ? `记录${ROI_TARGETS[calibration.roiStep] ?? '目标'}位置`
    : calibration.awaitingRelease ? '记录松开' : '记录捏合'

  const showVisualization =
    calibration.phase === 'roi'
    || calibration.phase === 'pinch'
    || calibration.phase === 'review'

  return (
    <section className="panel calibration-panel" aria-labelledby="calibration-title">
      <div className="panel-heading">
        <div>
          <p className="panel-number">03</p>
          <h2 id="calibration-title">书写校准</h2>
        </div>
        <span className="panel-state">
          {calibration.phase === 'ready' ? '已就绪' : '待完成'}
        </span>
      </div>

      {showVisualization && (
        <div className="calibration-preview">
          <video
            ref={previewVideoRef}
            muted
            playsInline
            className="calibration-preview-video"
          />
          <canvas
            ref={overlayCanvasRef}
            className="calibration-preview-overlay"
          />
        </div>
      )}

      <p className="calibration-message" role="status">{calibration.message}</p>
      {calibration.phase === 'roi' ? <p className="calibration-progress">区域点 {calibration.roiStep}/4</p> : null}
      {calibration.phase === 'pinch' ? <p className="calibration-progress">捏合循环 {calibration.pinchCycles}/3</p> : null}

      <div className="calibration-actions">
        {calibration.phase === 'review' ? (
          <button type="button" onClick={onConfirm}>校准完成</button>
        ) : calibration.phase === 'required' || calibration.phase === 'ready' ? (
          <button type="button" onClick={onBegin}>
            {calibration.phase === 'ready' ? '重新校准' : '开始校准'}
          </button>
        ) : (
          <button type="button" onClick={onCapture}>{captureLabel}</button>
        )}
        {calibration.phase !== 'ready' && calibration.phase !== 'review' ? (
          <button type="button" className="secondary-action" onClick={onSkip}>使用默认设置</button>
        ) : null}
      </div>
    </section>
  )
}

/* ── Utility: rounded rect path ── */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
