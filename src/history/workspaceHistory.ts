import type { Stroke } from '../types/workspace'

export const HISTORY_LIMIT = 50

export interface StrokeHistoryCommand {
  type: 'ADD_STROKE' | 'CLEAR_WORKSPACE'
  before: Stroke[]
  after: Stroke[]
}

export interface WorkspaceHistoryState {
  undoStack: StrokeHistoryCommand[]
  redoStack: StrokeHistoryCommand[]
}

export function createWorkspaceHistory(): WorkspaceHistoryState {
  return { undoStack: [], redoStack: [] }
}

export function pushHistory(
  state: WorkspaceHistoryState,
  command: StrokeHistoryCommand,
): WorkspaceHistoryState {
  return {
    undoStack: [...state.undoStack, command].slice(-HISTORY_LIMIT),
    redoStack: [],
  }
}

export function undoHistory(state: WorkspaceHistoryState) {
  const command = state.undoStack.at(-1)
  if (!command) return null
  return {
    strokes: command.before,
    history: {
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, command],
    },
  }
}

export function redoHistory(state: WorkspaceHistoryState) {
  const command = state.redoStack.at(-1)
  if (!command) return null
  return {
    strokes: command.after,
    history: {
      undoStack: [...state.undoStack, command].slice(-HISTORY_LIMIT),
      redoStack: state.redoStack.slice(0, -1),
    },
  }
}
