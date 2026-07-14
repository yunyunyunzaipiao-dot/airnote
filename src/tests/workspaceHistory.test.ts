import { describe, expect, it } from 'vitest'
import { createWorkspaceHistory, HISTORY_LIMIT, pushHistory, redoHistory, undoHistory } from '../history/workspaceHistory'
import { createWorkspaceDocument } from '../store/workspaceDocument'
import type { Stroke } from '../types/workspace'

function stroke(id: string): Stroke {
  return { id, points: [{ x: 0, y: 0, t: 0 }, { x: 10, y: 10, t: 1 }], color: '#172B3A', width: 4, style: 'ink', createdAt: 0 }
}

describe('workspace history', () => {
  it('undoes and redoes a complete workspace snapshot', () => {
    const before = createWorkspaceDocument(0)
    const after = { ...before, strokes: [stroke('one')] }
    const history = pushHistory(createWorkspaceHistory(), { type: 'ADD_STROKE', before, after })
    const undone = undoHistory(history)!
    expect(undone.document.strokes).toEqual([])
    expect(redoHistory(undone.history)?.document.strokes).toEqual(after.strokes)
  })

  it('clears redo after a new command', () => {
    const before = createWorkspaceDocument(0)
    const after = { ...before, strokes: [stroke('one')] }
    const undone = undoHistory(pushHistory(createWorkspaceHistory(), { type: 'ADD_STROKE', before, after }))!
    const next = pushHistory(undone.history, { type: 'ADD_STROKE', before, after: { ...before, strokes: [stroke('two')] } })
    expect(next.redoStack).toEqual([])
  })

  it('retains the latest fifty commands', () => {
    let history = createWorkspaceHistory()
    const before = createWorkspaceDocument(0)
    for (let index = 0; index < HISTORY_LIMIT + 5; index += 1) {
      history = pushHistory(history, { type: 'ADD_STROKE', before, after: { ...before, strokes: [stroke(String(index))] } })
    }
    expect(history.undoStack).toHaveLength(HISTORY_LIMIT)
    expect(history.undoStack[0].after.strokes[0].id).toBe('5')
  })
})
