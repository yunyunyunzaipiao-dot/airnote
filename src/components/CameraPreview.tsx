import { DisabledAction } from './DisabledAction'

export function CameraPreview() {
  return (
    <section className="panel camera-panel" aria-labelledby="camera-title">
      <div className="panel-heading">
        <div>
          <p className="panel-number">01</p>
          <h2 id="camera-title">摄像头预览</h2>
        </div>
        <span className="panel-state">未接入</span>
      </div>
      <div className="camera-placeholder" role="img" aria-label="摄像头预览暂未实现">
        <div className="camera-corners" aria-hidden="true" />
        <span>NO VIDEO INPUT</span>
        <small>不会请求摄像头权限</small>
      </div>
      <DisabledAction label="启用摄像头" compact />
    </section>
  )
}

