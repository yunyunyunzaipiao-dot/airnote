import { useRef, type ChangeEvent } from 'react'
import type { CameraStatus } from '../types/m0'
import type { InputMode } from '../types/workspace'
import type { SaveStatus } from '../persistence/workspaceStorage'
import { ThemeMenu } from './ThemeMenu'

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
      <div className="top-bar__left">
        <button type="button" className="top-bar__back" aria-label="返回" title="返回">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <ThemeMenu />
        <h1 className="top-bar__title">Product Strategy Brainstorm</h1>
      </div>

      <div className="top-bar__status" aria-label="工作区状态">
        <span className={`status-dot ${cameraActive ? 'status-dot--active' : ''}`} aria-hidden="true" />
        <span>{inputMode === 'gesture' ? '手势模式' : '鼠标模式'}</span>
        <strong>{cameraActive ? '摄像头已启用' : '摄像头未启用'}</strong>
        <span className={`save-state save-state--${saveStatus}`}>{saveStatus === 'saving' ? '保存中…' : saveStatus === 'saved' ? '已保存' : saveStatus === 'error' ? '保存失败' : '等待保存'}</span>
      </div>

      <nav className="top-bar__actions" aria-label="项目操作">
        <div className="top-bar__pill">
          <button type="button" className="history-action" aria-label="撤销" onClick={onUndo} disabled={!canUndo} title="撤销：Ctrl/Cmd+Z">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
          </button>
          <button type="button" className="history-action" aria-label="重做" onClick={onRedo} disabled={!canRedo} title="重做：Ctrl/Cmd+Shift+Z">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3L21 13"/></svg>
          </button>
          <span className="top-bar__divider" aria-hidden="true" />
          <button type="button" className="danger-action" aria-label="清空" onClick={onClear} disabled={!hasContent} title="清空">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
          <span className="top-bar__divider" aria-hidden="true" />
          <button type="button" className="project-action project-action--primary" aria-label="导出图片" onClick={onExportPng} title="导出图片">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          </button>
          <button type="button" className="project-action" aria-label="导出项目" onClick={onExportProject} title="导出项目">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <button type="button" className="project-action" aria-label="导入项目" onClick={() => importInputRef.current?.click()} title="导入项目">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </button>
        </div>
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
