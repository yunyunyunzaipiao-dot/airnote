import { describe, expect, it } from 'vitest'
import {
  createWorkspaceHistory,
  HISTORY_LIMIT,
  pushHistory,
  redoHistory,
  undoHistory,
} from '../history/workspaceHistory'
import type { Stroke } from '../types/workspace'

function stroke(id: string): Stroke {
  return {
    id,
    points: [{ x: 0, y: 0, t: 0 }, { x: 10, y: 10, t: 1 }],
    color: '#172B3A',
    width: 4,
    style: 'ink',
    createdAt: 0,
  }
}

describe('workspace history', () => {
  it('undoes and redoes a completed Stroke', () => {
    const added = [stroke('one')]
    const history = pushHistory(createWorkspaceHistory(), {
      type: 'ADD_STROKE',
      before: [],
      after: added,
    })
    const undone = undoHistory(history)!
    expect(undone.strokes).toEqual([])
    expect(redoHistory(undone.history)?.strokes).toEqual(added)
  })

  it('clears redo after a new command', () => {
    const first = [stroke('one')]
    const history = pushHistory(createWorkspaceHistory(), { type: 'ADD_STROKE', before: [], after: first })
    const undone = undoHistory(history)!
    const next = pushHistory(undone.history, { type: 'ADD_STROKE', before: [], after: [stroke('two')] })
    expect(next.redoStack).toEqual([])
  })

  it('retains at least the latest fifty commands', () => {
    let history = createWorkspaceHistory()
    for (let index = 0; index < HISTORY_LIMIT + 5; index += 1) {
      history = pushHistory(history, { type: 'ADD_STROKE', before: [], after: [stroke(String(index))] })
    }
    expect(history.undoStack).toHaveLength(HISTORY_LIMIT)
    expect(history.undoStack[0].after[0].id).toBe('5')
  })
})
