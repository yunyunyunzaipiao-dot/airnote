export type CardResizeHandle = 'nw' | 'ne' | 'se' | 'sw'

export interface CardGeometry {
  position: { x: number; y: number }
  size: { width: number; height: number }
}

interface Size {
  width: number
  height: number
}

const HANDLE_STAGE_INSET = 14

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function resizeCardFromHandle(
  start: CardGeometry,
  handle: CardResizeHandle,
  delta: { x: number; y: number },
  stage: Size,
  minimum: Size,
): CardGeometry {
  const maxWidth = Math.max(minimum.width, stage.width)
  const maxHeight = Math.max(minimum.height, stage.height)
  const right = start.position.x + start.size.width
  const bottom = start.position.y + start.size.height
  const usesWest = handle === 'nw' || handle === 'sw'
  const usesNorth = handle === 'nw' || handle === 'ne'
  const width = clamp(
    start.size.width + (usesWest ? -delta.x : delta.x),
    minimum.width,
    maxWidth,
  )
  const height = clamp(
    start.size.height + (usesNorth ? -delta.y : delta.y),
    minimum.height,
    maxHeight,
  )
  const requestedX = usesWest ? right - width : start.position.x
  const requestedY = usesNorth ? bottom - height : start.position.y

  return {
    position: {
      x: requestedX,
      y: requestedY,
    },
    size: { width, height },
  }
}

export function adaptiveResizeHandlePosition(
  card: CardGeometry,
  handle: CardResizeHandle,
  stage: Size,
) {
  const usesWest = handle === 'nw' || handle === 'sw'
  const usesNorth = handle === 'nw' || handle === 'ne'
  if (stage.width <= 0 || stage.height <= 0) {
    return {
      left: usesWest ? 0 : card.size.width,
      top: usesNorth ? 0 : card.size.height,
    }
  }
  const left = clamp(HANDLE_STAGE_INSET - card.position.x, 0, card.size.width)
  const right = clamp(stage.width - HANDLE_STAGE_INSET - card.position.x, 0, card.size.width)
  const top = clamp(HANDLE_STAGE_INSET - card.position.y, 0, card.size.height)
  const bottom = clamp(stage.height - HANDLE_STAGE_INSET - card.position.y, 0, card.size.height)

  return {
    left: usesWest ? left : right,
    top: usesNorth ? top : bottom,
  }
}
