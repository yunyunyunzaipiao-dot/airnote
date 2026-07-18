export interface GroupSuggestionBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface StageSize {
  width: number
  height: number
}

export interface GroupSuggestionActionPosition {
  left: number
  top: number
}

const ACTION_WIDTH = 270
const ACTION_HEIGHT = 40
const STAGE_PADDING = 16
const GROUP_GAP = 8

export function placeGroupSuggestionActions(
  box: GroupSuggestionBounds,
  stage: StageSize,
): GroupSuggestionActionPosition {
  const below = box.y + box.height + GROUP_GAP
  const top = below + ACTION_HEIGHT <= stage.height - STAGE_PADDING
    ? below
    : Math.max(STAGE_PADDING, box.y - ACTION_HEIGHT - GROUP_GAP)

  return {
    left: Math.max(
      STAGE_PADDING,
      Math.min(box.x, Math.max(STAGE_PADDING, stage.width - ACTION_WIDTH - STAGE_PADDING)),
    ),
    top: Math.min(top, Math.max(STAGE_PADDING, stage.height - ACTION_HEIGHT - STAGE_PADDING)),
  }
}
