export function GestureStatus() {
  return (
    <section className="panel gesture-panel" aria-labelledby="gesture-title">
      <div className="panel-heading">
        <div>
          <p className="panel-number">02</p>
          <h2 id="gesture-title">手势状态</h2>
        </div>
        <span className="panel-state">未启用</span>
      </div>
      <div className="gesture-readout">
        <div className="gesture-readout__pulse" aria-hidden="true" />
        <div>
          <strong>WAITING</strong>
          <span>手部追踪与捏合状态暂未实现</span>
        </div>
      </div>
    </section>
  )
}

