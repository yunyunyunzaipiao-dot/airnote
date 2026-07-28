import { useLayoutEffect, useRef, useState, type ChangeEvent } from 'react'
import type { CameraStatus } from '../types/m0'
import type { InputMode } from '../types/workspace'
import type { SaveStatus } from '../persistence/workspaceStorage'
import { applyUiTheme, loadUiTheme, saveUiTheme, type UiThemeId } from '../theme/uiThemes'
import { ThemeMenu } from './ThemeMenu'

interface TopBarProps {
  workspaceName: string
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
  onExportJpg: () => void
  onExportProject: () => void
  onImportProject: (file: File) => void
  onOpenOnboarding: () => void
}

export function TopBar({
  workspaceName,
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
  onExportJpg,
  onExportProject,
  onImportProject,
  onOpenOnboarding,
}: TopBarProps) {
  const cameraActive = cameraStatus === 'running'
  const importInputRef = useRef<HTMLInputElement>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [theme, setTheme] = useState<UiThemeId>(() => loadUiTheme())
  const lastLightThemeRef = useRef<UiThemeId>(theme === 'night' ? 'aether' : theme)

  useLayoutEffect(() => applyUiTheme(theme), [theme])

  const chooseTheme = (nextTheme: UiThemeId) => {
    if (nextTheme !== 'night') lastLightThemeRef.current = nextTheme
    setTheme(nextTheme)
    saveUiTheme(nextTheme)
  }

  const toggleDayNight = () => {
    chooseTheme(theme === 'night' ? lastLightThemeRef.current : 'night')
  }

  const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onImportProject(file)
  }

  const runExport = (action: () => void) => {
    setExportOpen(false)
    action()
  }

  return (
    <header className="top-bar">
      <div className="top-bar__left">
        <ThemeMenu theme={theme} onThemeChange={chooseTheme} />
        <div className="top-bar__workspace">
          <h1 className="top-bar__title">{workspaceName}</h1>
          <span className={`save-state save-state--${saveStatus}`}>
            {saveStatus === 'saving' ? '保存中…' : saveStatus === 'saved' ? '已保存' : saveStatus === 'error' ? '保存失败' : '等待保存'}
          </span>
        </div>
      </div>

      <div className="top-bar__status" aria-label="工作区状态">
        <span className={`status-dot ${cameraActive ? 'status-dot--active' : ''}`} aria-hidden="true" />
        <span>{inputMode === 'gesture' ? '手势' : '鼠标'}</span>
        <strong>{cameraActive ? '摄像头已启用' : '本地工作区'}</strong>
      </div>

      <nav className="top-bar__actions" aria-label="项目操作">
        <div className="top-bar__pill">
          <button type="button" className="history-action" aria-label="撤销" onClick={onUndo} disabled={!canUndo} title="撤销：Ctrl/Cmd+Z">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-15-6.7L3 13" /></svg>
          </button>
          <button type="button" className="history-action" aria-label="重做" onClick={onRedo} disabled={!canRedo} title="重做：Ctrl/Cmd+Shift+Z">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 15-6.7L21 13" /></svg>
          </button>
          <span className="top-bar__divider" aria-hidden="true" />
          <button type="button" className="danger-action" aria-label="清空" onClick={onClear} disabled={!hasContent} title="清空画布">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M19 6v14H5V6M8 6V4h8v2M10 11v6M14 11v6" /></svg>
          </button>
        </div>

        <div className="top-bar__mode-switch" aria-label="输入模式">
          <span className={inputMode === 'mouse' ? 'top-bar__mode top-bar__mode--active' : 'top-bar__mode'}>鼠标</span>
          <span className={inputMode === 'gesture' ? 'top-bar__mode top-bar__mode--active' : 'top-bar__mode'}>手势</span>
        </div>

        <button type="button" className="top-bar__icon-action" aria-label={theme === 'night' ? '切换日间模式' : '切换夜间模式'} title={theme === 'night' ? '切换日间模式' : '切换夜间模式'} onClick={toggleDayNight}>
          {theme === 'night' ? '☀' : '☾'}
        </button>

        <button type="button" className="top-bar__icon-action top-bar__help-action" aria-label="打开新手引导" title="新手入门" onClick={onOpenOnboarding}>
          ?
        </button>

        <div className="export-menu">
          <button type="button" className="export-menu__trigger" aria-haspopup="menu" aria-expanded={exportOpen} onClick={() => setExportOpen((open) => !open)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4 19h16" /></svg>
            导出
            <span aria-hidden="true">⌄</span>
          </button>
          {exportOpen ? (
            <div className="export-menu__panel" role="menu">
              <button type="button" role="menuitem" onClick={() => runExport(onExportPng)}>导出 PNG</button>
              <button type="button" role="menuitem" onClick={() => runExport(onExportJpg)}>导出 JPG</button>
              <button type="button" role="menuitem" onClick={() => runExport(onExportProject)}>导出 JSON</button>
              <button type="button" role="menuitem" onClick={() => { setExportOpen(false); importInputRef.current?.click() }}>导入 JSON</button>
            </div>
          ) : null}
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
