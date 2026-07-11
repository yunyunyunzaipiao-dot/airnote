import { DisabledAction } from './DisabledAction'

export function TopBar() {
  return (
    <header className="top-bar">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">空</span>
        <div>
          <p className="eyebrow">AIRNOTE · PROJECT FOUNDATION</p>
          <h1>空书 <span>/ AirNote</span></h1>
        </div>
      </div>

      <div className="top-bar__status" aria-label="项目状态">
        <span className="status-dot" aria-hidden="true" />
        <span>工程骨架</span>
        <strong>正式功能未启用</strong>
      </div>

      <nav className="top-bar__actions" aria-label="项目操作">
        <DisabledAction label="导入" compact />
        <DisabledAction label="导出" compact />
        <DisabledAction label="启用摄像头" compact />
      </nav>
    </header>
  )
}

