import { DEFAULT_SETTINGS, type AirNoteProject, type AirNoteSettings, type WorkspaceDocument } from '../types/workspace'

export const WORKSPACE_STORAGE_KEY = 'airnote.workspace.current'
export const CORRUPT_WORKSPACE_KEY = 'airnote.workspace.corrupt'

export function workspaceKeyFor(id: string) {
  return `airnote.workspace.${id}`
}

export function loadWorkspaceById(id: string, storage: StorageLike = localStorage): { document: WorkspaceDocument; settings: AirNoteSettings } | null {
  const raw = storage.getItem(workspaceKeyFor(id))
  if (!raw) return null
  try {
    const validation = validateProjectDetailed(JSON.parse(raw) as unknown)
    if (!validation.ok) throw new Error('invalid project')
    const { schemaVersion: _schemaVersion, settings, ...document } = validation.project
    return { document, settings: { ...settings, inputMode: 'mouse' } }
  } catch {
    throw new Error('项目无法恢复，可导入备份JSON。')
  }
}

export function saveWorkspaceById(id: string, project: AirNoteProject, storage: StorageLike = localStorage) {
  if (!validateProject(project)) throw new Error('项目数据校验失败，未写入本地存储。')
  storage.setItem(workspaceKeyFor(id), JSON.stringify(project))
}

export function deleteWorkspaceById(id: string, storage: StorageLike = localStorage) {
  storage.removeItem(workspaceKeyFor(id))
}

export function listWorkspaceIds(storage: StorageLike = localStorage): string[] {
  const ids: string[] = []
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i)
    if (key?.startsWith('airnote.workspace.') && key !== WORKSPACE_STORAGE_KEY && key !== CORRUPT_WORKSPACE_KEY) {
      ids.push(key.slice('airnote.workspace.'.length))
    }
  }
  return ids
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'length' | 'key'>

export type ProjectValidationFailure =
  | { reason: 'invalid-format'; damagedObjectCount: 0 }
  | { reason: 'version-too-new'; damagedObjectCount: 0 }
  | { reason: 'missing-references'; damagedObjectCount: number }

export type ProjectValidationResult =
  | { ok: true; project: AirNoteProject }
  | { ok: false; error: ProjectValidationFailure }

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, required: string[], optional: string[] = []) {
  const keys = Object.keys(value)
  return required.every((key) => key in value) && keys.every((key) => required.includes(key) || optional.includes(key))
}

function validPoint(value: unknown) {
  return record(value)
    && hasOnlyKeys(value, ['x', 'y', 't'])
    && finite(value.x)
    && finite(value.y)
    && finite(value.t)
}

function validBounds(value: unknown) {
  return record(value)
    && hasOnlyKeys(value, ['x', 'y', 'width', 'height'])
    && finite(value.x)
    && finite(value.y)
    && finite(value.width)
    && finite(value.height)
    && value.width >= 0
    && value.height >= 0
}

function validSettings(value: unknown) {
  if (!record(value) || !hasOnlyKeys(value, ['inputMode', 'brush', 'gesture'], ['experimentalStylesEnabled'])) return false
  if (value.inputMode !== 'mouse' && value.inputMode !== 'gesture') return false
  if (value.experimentalStylesEnabled !== undefined && typeof value.experimentalStylesEnabled !== 'boolean') return false
  if (!record(value.brush) || !hasOnlyKeys(value.brush, ['color', 'width', 'style'])) return false
  if (typeof value.brush.color !== 'string' || ![2, 4, 8].includes(value.brush.width as number) || !['ink', 'glow', 'particle'].includes(value.brush.style as string)) return false
  if (!record(value.gesture) || !hasOnlyKeys(value.gesture, [
    'writingROI',
    'pinchDownThreshold',
    'pinchUpThreshold',
    'handPreference',
    'calibrated',
    'usesDefaultCalibration',
  ], ['drawMode'])) return false
  const gesture = value.gesture
  if (!record(gesture.writingROI) || !hasOnlyKeys(gesture.writingROI, ['left', 'top', 'right', 'bottom'])) return false
  const roi = gesture.writingROI
  if (![roi.left, roi.top, roi.right, roi.bottom].every(finite)) return false
  if ((roi.left as number) >= (roi.right as number) || (roi.top as number) >= (roi.bottom as number)) return false
  if (![gesture.pinchDownThreshold, gesture.pinchUpThreshold].every(finite)) return false
  if ((gesture.pinchDownThreshold as number) >= (gesture.pinchUpThreshold as number)) return false
  return gesture.handPreference === 'any'
    && (gesture.drawMode === undefined || gesture.drawMode === 'mode1' || gesture.drawMode === 'mode2')
    && typeof gesture.calibrated === 'boolean'
    && typeof gesture.usesDefaultCalibration === 'boolean'
}

export function validateProjectDetailed(value: unknown): ProjectValidationResult {
  if (!record(value)) return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
  if (finite(value.schemaVersion) && value.schemaVersion > 1) {
    return { ok: false, error: { reason: 'version-too-new', damagedObjectCount: 0 } }
  }
  if (value.schemaVersion !== 1 || !hasOnlyKeys(value, ['schemaVersion', 'workspace', 'strokes', 'groups', 'cards', 'edges', 'settings'])) {
    return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
  }
  if (!record(value.workspace) || !hasOnlyKeys(value.workspace, ['id', 'name', 'createdAt', 'updatedAt', 'viewport'])) {
    return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
  }
  const workspace = value.workspace
  if (typeof workspace.id !== 'string' || typeof workspace.name !== 'string' || !finite(workspace.createdAt) || !finite(workspace.updatedAt)) {
    return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
  }
  if (!record(workspace.viewport) || !hasOnlyKeys(workspace.viewport, ['x', 'y', 'zoom'])) {
    return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
  }
  if (!finite(workspace.viewport.x) || !finite(workspace.viewport.y) || !finite(workspace.viewport.zoom) || workspace.viewport.zoom <= 0) {
    return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
  }
  if (!validSettings(value.settings)) return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
  if (!Array.isArray(value.strokes) || !Array.isArray(value.groups) || !Array.isArray(value.cards) || !Array.isArray(value.edges)) {
    return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
  }

  const project = structuredClone(value) as unknown as AirNoteProject
  delete (project.settings.gesture as unknown as Record<string, unknown>).drawMode
  project.settings.experimentalStylesEnabled = value.settings && record(value.settings)
    ? value.settings.experimentalStylesEnabled === true
    : false
  if (!project.settings.experimentalStylesEnabled) project.settings.brush.style = 'ink'

  for (const stroke of project.strokes) {
    if (!record(stroke) || !hasOnlyKeys(stroke, ['id', 'points', 'color', 'width', 'style', 'createdAt'], ['cardId'])) {
      return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
    }
    if (typeof stroke.id !== 'string' || !Array.isArray(stroke.points) || !stroke.points.every(validPoint)) {
      return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
    }
    if (typeof stroke.color !== 'string' || ![2, 4, 8].includes(stroke.width) || !['ink', 'glow', 'particle'].includes(stroke.style) || !finite(stroke.createdAt)) {
      return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
    }
    if (stroke.cardId !== undefined && typeof stroke.cardId !== 'string') {
      return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
    }
  }

  for (const group of project.groups) {
    if (!record(group) || !hasOnlyKeys(group, ['id', 'strokeIds', 'boundingBox', 'status'])) {
      return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
    }
    if (typeof group.id !== 'string' || !Array.isArray(group.strokeIds) || !group.strokeIds.every((id) => typeof id === 'string')) {
      return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
    }
    if (!validBounds(group.boundingBox) || !['collecting', 'suggested', 'committed'].includes(group.status)) {
      return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
    }
  }

  for (const card of project.cards) {
    if (!record(card) || !hasOnlyKeys(card, ['id', 'strokeIds', 'title', 'position', 'size'])) {
      return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
    }
    if (typeof card.id !== 'string' || !Array.isArray(card.strokeIds) || !card.strokeIds.every((id) => typeof id === 'string')) {
      return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
    }
    if (typeof card.title !== 'string' || card.title.length > 100 || !record(card.position) || !record(card.size)) {
      return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
    }
    if (!hasOnlyKeys(card.position, ['x', 'y']) || !finite(card.position.x) || !finite(card.position.y)) {
      return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
    }
    if (!hasOnlyKeys(card.size, ['width', 'height']) || !finite(card.size.width) || !finite(card.size.height) || card.size.width <= 0 || card.size.height <= 0) {
      return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
    }
  }

  const anchors = ['top', 'right', 'bottom', 'left']
  for (const edge of project.edges) {
    if (!record(edge) || !hasOnlyKeys(edge, ['id', 'sourceCardId', 'targetCardId', 'type'], ['label', 'sourceAnchor', 'targetAnchor'])) {
      return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
    }
    if (typeof edge.id !== 'string' || typeof edge.sourceCardId !== 'string' || typeof edge.targetCardId !== 'string') {
      return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
    }
    if (!['undirected', 'directed'].includes(edge.type) || (edge.label !== undefined && typeof edge.label !== 'string')) {
      return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
    }
    if (edge.sourceAnchor !== undefined && !anchors.includes(edge.sourceAnchor)) {
      return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
    }
    if (edge.targetAnchor !== undefined && !anchors.includes(edge.targetAnchor)) {
      return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
    }
    if (edge.sourceCardId === edge.targetCardId) {
      return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
    }
  }

  const ids = new Set<string>()
  const objects = [project.workspace, ...project.strokes, ...project.groups, ...project.cards, ...project.edges]
  for (const object of objects) {
    if (!object.id || ids.has(object.id)) return { ok: false, error: { reason: 'invalid-format', damagedObjectCount: 0 } }
    ids.add(object.id)
  }
  const strokeIds = new Set(project.strokes.map((stroke) => stroke.id))
  const cardIds = new Set(project.cards.map((card) => card.id))
  const assigned = new Set<string>()
  const damagedObjects = new Set<string>()
  for (const stroke of project.strokes) {
    if (stroke.cardId && !cardIds.has(stroke.cardId)) damagedObjects.add(stroke.id)
  }
  for (const card of project.cards) {
    for (const strokeId of card.strokeIds) {
      if (!strokeIds.has(strokeId) || assigned.has(strokeId)) damagedObjects.add(card.id)
      assigned.add(strokeId)
      const stroke = project.strokes.find((item) => item.id === strokeId)
      if (stroke && stroke.cardId !== card.id) {
        damagedObjects.add(card.id)
        damagedObjects.add(stroke.id)
      }
    }
  }
  for (const stroke of project.strokes) {
    if (stroke.cardId && !project.cards.find((card) => card.id === stroke.cardId)?.strokeIds.includes(stroke.id)) {
      damagedObjects.add(stroke.id)
    }
  }
  for (const group of project.groups) {
    if (group.strokeIds.some((id) => !strokeIds.has(id))) damagedObjects.add(group.id)
  }
  for (const edge of project.edges) {
    if (!cardIds.has(edge.sourceCardId) || !cardIds.has(edge.targetCardId)) damagedObjects.add(edge.id)
  }
  if (damagedObjects.size > 0) {
    return { ok: false, error: { reason: 'missing-references', damagedObjectCount: damagedObjects.size } }
  }
  return { ok: true, project }
}

export function validateProject(value: unknown): value is AirNoteProject {
  return validateProjectDetailed(value).ok
}

export function loadWorkspace(storage: StorageLike = localStorage): { document: WorkspaceDocument; settings: AirNoteSettings } | null {
  const raw = storage.getItem(WORKSPACE_STORAGE_KEY)
  if (!raw) return null
  try {
    const validation = validateProjectDetailed(JSON.parse(raw) as unknown)
    if (!validation.ok) throw new Error('invalid project')
    const { schemaVersion: _schemaVersion, settings, ...document } = validation.project
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
