import { describe, expect, it } from 'vitest'
import { CORRUPT_WORKSPACE_KEY, loadWorkspace, saveWorkspace, validateProject, WORKSPACE_STORAGE_KEY } from '../persistence/workspaceStorage'
import { createWorkspaceDocument, projectFromDocument } from '../store/workspaceDocument'
import { DEFAULT_SETTINGS } from '../types/workspace'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
    get length() { return values.size },
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    values,
  }
}

describe('workspace persistence', () => {
  it('round-trips a schemaVersion 2 project and forces safe mouse restore', () => {
    const storage = memoryStorage()
    const project = projectFromDocument(createWorkspaceDocument(0), { ...DEFAULT_SETTINGS, inputMode: 'gesture' })
    saveWorkspace(project, storage)
    const restored = loadWorkspace(storage)!
    expect(restored.document.workspace.id).toBe(project.workspace.id)
    expect(restored.settings.inputMode).toBe('mouse')
    expect(validateProject(project)).toBe(true)
  })

  it('preserves corrupt JSON before reporting restore failure', () => {
    const storage = memoryStorage()
    storage.setItem(WORKSPACE_STORAGE_KEY, '{broken')
    expect(() => loadWorkspace(storage)).toThrow('上次项目无法恢复')
    expect(storage.values.get(CORRUPT_WORKSPACE_KEY)).toBe('{broken')
  })

  it('loads an older project with experimental styles safely disabled', () => {
    const storage = memoryStorage()
    const project = projectFromDocument(createWorkspaceDocument(0), structuredClone(DEFAULT_SETTINGS))
    ;(project as unknown as Record<string, unknown>).schemaVersion = 1
    delete (project.settings as Partial<typeof project.settings>).experimentalStylesEnabled
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(project))
    const restored = loadWorkspace(storage)!
    expect(restored.settings.experimentalStylesEnabled).toBe(false)
    expect(restored.settings.brush.style).toBe('ink')
  })

  it('loads and strips drawMode from a temporary project', () => {
    const storage = memoryStorage()
    const project = projectFromDocument(createWorkspaceDocument(0), structuredClone(DEFAULT_SETTINGS))
    const temporaryProject = structuredClone(project) as unknown as Record<string, unknown>
    const temporarySettings = temporaryProject.settings as Record<string, unknown>
    const temporaryGesture = temporarySettings.gesture as Record<string, unknown>
    temporaryGesture.drawMode = 'mode2'
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(temporaryProject))
    const restored = loadWorkspace(storage)!
    expect(restored.settings.gesture).not.toHaveProperty('drawMode')
  })

  it('migrates a schemaVersion 1 ink card before replacing the workspace', () => {
    const storage = memoryStorage()
    const project = projectFromDocument(createWorkspaceDocument(0), structuredClone(DEFAULT_SETTINGS))
    project.strokes = [{ id: 's1', points: [{ x: 0, y: 0, t: 0 }], color: '#172B3A', width: 4, style: 'ink', createdAt: 0, cardId: 'c1' }]
    project.cards = [{ id: 'c1', kind: 'ink', strokeIds: ['s1'], title: '旧卡片', position: { x: 0, y: 0 }, size: { width: 120, height: 96 } }]
    const legacy = structuredClone(project) as unknown as Record<string, unknown>
    legacy.schemaVersion = 1
    delete ((legacy.cards as Array<Record<string, unknown>>)[0]).kind
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(legacy))
    const restored = loadWorkspace(storage)!
    expect(restored.document.cards[0]).toMatchObject({ kind: 'ink', strokeIds: ['s1'] })
  })
})
