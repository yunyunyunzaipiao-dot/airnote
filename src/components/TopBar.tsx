import { DisabledAction } from './DisabledAction'
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
}: TopBarProps) {
  const cameraActive = cameraStatus === 'running'
  return (
    <header className="top-bar">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">空</span>
        <div>
          <p className="eyebrow">AIRNOTE · M2 IDEA WORKSPACE</p>
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
        <DisabledAction label="导出（暂未实现）" compact />
      </nav>
    </header>
  )
}
