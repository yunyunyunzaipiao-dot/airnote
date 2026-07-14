import type { WorkspaceDocument } from '../types/workspace'

export const HISTORY_LIMIT = 50

export type WorkspaceCommandType =
  | 'ADD_STROKE'
  | 'CREATE_CARD'
  | 'MOVE_CARD'
  | 'RESIZE_CARD'
  | 'RENAME_CARD'
  | 'DELETE_CARD'
  | 'CREATE_EDGE'
  | 'UPDATE_EDGE'
  | 'CLEAR_WORKSPACE'

export interface WorkspaceHistoryCommand {
  type: WorkspaceCommandType
  before: WorkspaceDocument
  after: WorkspaceDocument
}

export interface WorkspaceHistoryState {
  undoStack: WorkspaceHistoryCommand[]
  redoStack: WorkspaceHistoryCommand[]
}

export function createWorkspaceHistory(): WorkspaceHistoryState {
  return { undoStack: [], redoStack: [] }
}

export function pushHistory(state: WorkspaceHistoryState, command: WorkspaceHistoryCommand): WorkspaceHistoryState {
  return { undoStack: [...state.undoStack, command].slice(-HISTORY_LIMIT), redoStack: [] }
}

export function undoHistory(state: WorkspaceHistoryState) {
  const command = state.undoStack.at(-1)
  if (!command) return null
  return {
    document: command.before,
    history: { undoStack: state.undoStack.slice(0, -1), redoStack: [...state.redoStack, command] },
  }
}

export function redoHistory(state: WorkspaceHistoryState) {
  const command = state.redoStack.at(-1)
  if (!command) return null
  return {
    document: command.after,
    history: { undoStack: [...state.undoStack, command].slice(-HISTORY_LIMIT), redoStack: state.redoStack.slice(0, -1) },
  }
}
