import { useFocusTrap } from '../hooks/useFocusTrap'

interface CameraConsentDialogProps {
  onConfirm: () => void
  onCancel: () => void
}

export function CameraConsentDialog({ onConfirm, onCancel }: CameraConsentDialogProps) {
  const dialogRef = useFocusTrap(true)

  return (
    <div className="consent-layer" role="presentation">
      <button className="consent-backdrop" type="button" aria-label="取消启用摄像头" onClick={onCancel} />
      <section ref={dialogRef} className="consent-dialog" role="dialog" aria-modal="true" aria-labelledby="camera-consent-title">
        <div className="consent-icon" aria-hidden="true">◉</div>
        <p className="consent-eyebrow">本地隐私保护</p>
        <h2 id="camera-consent-title">启用摄像头进行手势绘制</h2>
        <p>视频只用于浏览器本地的手部识别。AirNote 默认不录制、不保存、不上传摄像头画面，也不会请求麦克风权限。</p>
        <ul>
          <li>你可以随时关闭摄像头。</li>
          <li>拒绝权限后，鼠标绘图、卡片和连接线仍可使用。</li>
        </ul>
        <div className="consent-actions">
          <button type="button" onClick={onCancel}>继续使用鼠标</button>
          <button className="consent-primary" type="button" onClick={onConfirm}>继续启用摄像头</button>
        </div>
      </section>
    </div>
  )
}
