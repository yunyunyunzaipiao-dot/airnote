import { DisabledAction } from './DisabledAction'
import type { CameraStatus } from '../types/m0'

interface TopBarProps {
  cameraStatus: CameraStatus
}

export function TopBar({ cameraStatus }: TopBarProps) {
  const cameraActive = cameraStatus === 'running'
  return (
    <header className="top-bar">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">空</span>
        <div>
          <p className="eyebrow">AIRNOTE · M0 TECHNICAL SPIKE</p>
          <h1>空书 <span>/ AirNote</span></h1>
        </div>
      </div>

      <div className="top-bar__status" aria-label="摄像头状态">
        <span className={`status-dot ${cameraActive ? 'status-dot--active' : ''}`} aria-hidden="true" />
        <span>M0 低延迟尖峰</span>
        <strong>{cameraActive ? '摄像头已启用' : '摄像头未启用'}</strong>
      </div>

      <nav className="top-bar__actions" aria-label="项目操作">
        <DisabledAction label="导入" compact />
        <DisabledAction label="导出" compact />
        <DisabledAction label="保存" compact />
      </nav>
    </header>
  )
}
