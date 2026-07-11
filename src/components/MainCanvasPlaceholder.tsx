export function MainCanvasPlaceholder() {
  return (
    <section className="canvas-stage" aria-labelledby="canvas-title">
      <div className="canvas-stage__index" aria-hidden="true">00 / CANVAS</div>
      <div className="canvas-stage__content">
        <div className="orbit-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="eyebrow">AIR INPUT WORKSPACE</p>
        <h2 id="canvas-title">想法落下之前，<br />先留一片空白。</h2>
        <p className="canvas-stage__description">
          主画布占位区域。绘图、笔画分组、卡片与连接功能均暂未实现。
        </p>
        <span className="not-implemented-badge">NOT IMPLEMENTED / 暂未实现</span>
      </div>
      <div className="canvas-stage__coordinates" aria-hidden="true">
        <span>X 000</span>
        <span>Y 000</span>
        <span>ZOOM 100%</span>
      </div>
    </section>
  )
}

