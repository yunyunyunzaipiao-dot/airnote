import { describe, expect, it } from 'vitest'
import { placeGroupSuggestionActions } from '../layout/groupSuggestionPlacement'

describe('group suggestion action placement', () => {
  it('places the action row below the group when there is enough room', () => {
    expect(placeGroupSuggestionActions(
      { x: 120, y: 100, width: 180, height: 80 },
      { width: 800, height: 600 },
    )).toEqual({ left: 120, top: 188 })
  })

  it('moves the action row above a group near the bottom edge', () => {
    const position = placeGroupSuggestionActions(
      { x: 120, y: 540, width: 180, height: 40 },
      { width: 800, height: 600 },
    )

    expect(position).toEqual({ left: 120, top: 492 })
    expect(position.top + 40).toBeLessThanOrEqual(600 - 16)
  })

  it('keeps the action row within the left and right canvas edges', () => {
    expect(placeGroupSuggestionActions(
      { x: -40, y: 100, width: 80, height: 40 },
      { width: 520, height: 600 },
    ).left).toBe(16)

    expect(placeGroupSuggestionActions(
      { x: 480, y: 100, width: 80, height: 40 },
      { width: 520, height: 600 },
    ).left).toBe(234)
  })
})
