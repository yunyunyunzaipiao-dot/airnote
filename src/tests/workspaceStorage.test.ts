import { describe, expect, it } from 'vitest'
import { CORRUPT_WORKSPACE_KEY, loadWorkspace, saveWorkspace, validateProject, WORKSPACE_STORAGE_KEY } from '../persistence/workspaceStorage'
import { createWorkspaceDocument, projectFromDocument } from '../store/workspaceDocument'
import { DEFAULT_SETTINGS } from '../types/workspace'

function memoryStorage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, values }
}

describe('workspace persistence', () => {
  it('round-trips a schemaVersion 1 project and forces safe mouse restore', () => {
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

  it('loads an older schemaVersion 1 project with experimental styles safely disabled', () => {
    const storage = memoryStorage()
    const project = projectFromDocument(createWorkspaceDocument(0), structuredClone(DEFAULT_SETTINGS))
    delete (project.settings as Partial<typeof project.settings>).experimentalStylesEnabled
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(project))
    const restored = loadWorkspace(storage)!
    expect(restored.settings.experimentalStylesEnabled).toBe(false)
    expect(restored.settings.brush.style).toBe('ink')
  })
})
