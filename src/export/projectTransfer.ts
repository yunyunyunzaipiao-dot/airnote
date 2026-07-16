import { validateProjectDetailed, type ProjectValidationFailure } from '../persistence/workspaceStorage'
import type { AirNoteProject } from '../types/workspace'
import { downloadBlob } from './download'

export const INVALID_PROJECT_MESSAGE = '项目文件格式不正确，当前画布未被修改。'
export const NEWER_PROJECT_MESSAGE = '该项目由更高版本AirNote创建，当前版本无法打开。'

export type ProjectImportResult =
  | { ok: true; project: AirNoteProject }
  | { ok: false; error: ProjectValidationFailure; message: string }

export function projectValidationMessage(error: ProjectValidationFailure) {
  if (error.reason === 'version-too-new') return NEWER_PROJECT_MESSAGE
  if (error.reason === 'missing-references') {
    return `项目文件存在引用缺失，发现${error.damagedObjectCount}个损坏对象，当前画布未被修改。`
  }
  return INVALID_PROJECT_MESSAGE
}

export function parseProjectJson(text: string): ProjectImportResult {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    const error = { reason: 'invalid-format', damagedObjectCount: 0 } as const
    return { ok: false, error, message: INVALID_PROJECT_MESSAGE }
  }
  const validation = validateProjectDetailed(value)
  if (!validation.ok) {
    return { ok: false, error: validation.error, message: projectValidationMessage(validation.error) }
  }
  return { ok: true, project: validation.project }
}

export async function readProjectFile(file: File): Promise<ProjectImportResult> {
  const fileTypeAllowed = file.type === '' || file.type === 'application/json'
  if (!file.name.toLowerCase().endsWith('.json') || !fileTypeAllowed) {
    const error = { reason: 'invalid-format', damagedObjectCount: 0 } as const
    return { ok: false, error, message: INVALID_PROJECT_MESSAGE }
  }
  try {
    return parseProjectJson(await file.text())
  } catch {
    const error = { reason: 'invalid-format', damagedObjectCount: 0 } as const
    return { ok: false, error, message: INVALID_PROJECT_MESSAGE }
  }
}

export function serializeProject(project: AirNoteProject) {
  const validation = validateProjectDetailed(project)
  if (!validation.ok) throw new Error(projectValidationMessage(validation.error))
  return JSON.stringify(project, null, 2)
}

export function exportProjectJson(project: AirNoteProject, filename = 'airnote-project.json') {
  const blob = new Blob([serializeProject(project)], { type: 'application/json;charset=utf-8' })
  downloadBlob(blob, filename)
}
