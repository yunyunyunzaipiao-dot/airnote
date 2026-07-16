import { useRef, type ChangeEvent } from 'react'
import type { CameraStatus } from '../types/m0'
import type { InputMode } from '../types/workspace'
import type { SaveStatus } from '../persistence/workspaceStorage'

interface TopBarProps {
  cameraStatus: CameraStatus
  inputMode: InputMode
  canUndo: boolean
  canRedo: boolean
  hasContent: boolean
  saveStatus: SaveStatus
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onExportPng: () => void
  onExportProject: () => void
  onImportProject: (file: File) => void
}

export function TopBar({
  cameraStatus,
  inputMode,
  canUndo,
  canRedo,
  hasContent,
  saveStatus,
  onUndo,
  onRedo,
  onClear,
  onExportPng,
  onExportProject,
  onImportProject,
}: TopBarProps) {
  const cameraActive = cameraStatus === 'running'
  const importInputRef = useRef<HTMLInputElement>(null)
  const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onImportProject(file)
  }
  return (
    <header className="top-bar">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">空</span>
        <div>
          <p className="eyebrow">AIRNOTE · M3 PORTABLE WORKSPACE</p>
          <h1>空书 <span>/ AirNote</span></h1>
        </div>
      </div>

      <div className="top-bar__status" aria-label="工作区状态">
        <span className={`status-dot ${cameraActive ? 'status-dot--active' : ''}`} aria-hidden="true" />
        <span>{inputMode === 'gesture' ? '手势模式' : '鼠标模式'}</span>
        <strong>{cameraActive ? '摄像头已启用' : '摄像头未启用'}</strong>
        <span className={`save-state save-state--${saveStatus}`}>{saveStatus === 'saving' ? '保存中…' : saveStatus === 'saved' ? '已保存' : saveStatus === 'error' ? '保存失败' : '等待保存'}</span>
      </div>

      <nav className="top-bar__actions" aria-label="项目操作">
        <button type="button" className="history-action" aria-label="撤销" onClick={onUndo} disabled={!canUndo} title="撤销：Ctrl/Cmd+Z">
          <strong>撤销</strong><span>Ctrl/Cmd+Z</span>
        </button>
        <button type="button" className="history-action" aria-label="重做" onClick={onRedo} disabled={!canRedo} title="重做：Ctrl/Cmd+Shift+Z">
          <strong>重做</strong><span>Ctrl/Cmd+Shift+Z</span>
        </button>
        <button type="button" className="danger-action" onClick={onClear} disabled={!hasContent}>清空</button>
        <button type="button" className="project-action" onClick={onExportPng}>导出图片</button>
        <button type="button" className="project-action" onClick={onExportProject}>导出项目</button>
        <button type="button" className="project-action" onClick={() => importInputRef.current?.click()}>导入项目</button>
        <input
          ref={importInputRef}
          className="visually-hidden"
          type="file"
          accept=".json,application/json"
          aria-label="选择项目JSON"
          onChange={handleImportFile}
        />
      </nav>
    </header>
  )
}
