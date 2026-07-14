import { DEFAULT_SETTINGS, type AirNoteProject, type AirNoteSettings, type WorkspaceDocument } from '../types/workspace'

export const WORKSPACE_STORAGE_KEY = 'airnote.workspace.current'
export const CORRUPT_WORKSPACE_KEY = 'airnote.workspace.corrupt'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function validateProject(value: unknown): value is AirNoteProject {
  if (!value || typeof value !== 'object') return false
  const project = value as Partial<AirNoteProject>
  if (project.schemaVersion !== 1 || !project.workspace || !project.settings) return false
  if (!Array.isArray(project.strokes) || !Array.isArray(project.groups) || !Array.isArray(project.cards) || !Array.isArray(project.edges)) return false

  const ids = new Set<string>()
  const objects = [project.workspace, ...project.strokes, ...project.groups, ...project.cards, ...project.edges]
  for (const object of objects) {
    if (!object || typeof object.id !== 'string' || ids.has(object.id)) return false
    ids.add(object.id)
  }
  const strokeIds = new Set(project.strokes.map((stroke) => stroke.id))
  const cardIds = new Set(project.cards.map((card) => card.id))
  const assigned = new Set<string>()
  for (const stroke of project.strokes) {
    if (!Array.isArray(stroke.points) || stroke.points.some((point) => !finite(point.x) || !finite(point.y) || !finite(point.t))) return false
    if (stroke.cardId && !cardIds.has(stroke.cardId)) return false
  }
  for (const card of project.cards) {
    if (!Array.isArray(card.strokeIds) || card.strokeIds.some((id) => !strokeIds.has(id) || assigned.has(id))) return false
    card.strokeIds.forEach((id) => assigned.add(id))
  }
  for (const edge of project.edges) {
    if (!cardIds.has(edge.sourceCardId) || !cardIds.has(edge.targetCardId) || edge.sourceCardId === edge.targetCardId) return false
    const anchors = ['top', 'right', 'bottom', 'left']
    if (edge.sourceAnchor !== undefined && !anchors.includes(edge.sourceAnchor)) return false
    if (edge.targetAnchor !== undefined && !anchors.includes(edge.targetAnchor)) return false
  }
  return true
}

export function loadWorkspace(storage: StorageLike = localStorage): { document: WorkspaceDocument; settings: AirNoteSettings } | null {
  const raw = storage.getItem(WORKSPACE_STORAGE_KEY)
  if (!raw) return null
  try {
    const project: unknown = JSON.parse(raw)
    if (!validateProject(project)) throw new Error('invalid project')
    const { schemaVersion: _schemaVersion, settings, ...document } = project
    return { document, settings: { ...settings, inputMode: 'mouse' } }
  } catch {
    storage.setItem(CORRUPT_WORKSPACE_KEY, raw)
    throw new Error('上次项目无法恢复，可导入备份JSON。')
  }
}

export function saveWorkspace(project: AirNoteProject, storage: StorageLike = localStorage) {
  if (!validateProject(project)) throw new Error('项目数据校验失败，未写入本地存储。')
  storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(project))
}

export function safeDefaultSettings(): AirNoteSettings {
  return structuredClone(DEFAULT_SETTINGS)
}
