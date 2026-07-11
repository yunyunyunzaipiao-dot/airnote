export function PropertyPanel() {
  return (
    <section className="panel property-panel" aria-labelledby="property-title">
      <div className="panel-heading">
        <div>
          <p className="panel-number">03</p>
          <h2 id="property-title">属性面板</h2>
        </div>
        <span className="panel-state">暂未实现</span>
      </div>

      <fieldset disabled>
        <label htmlFor="brush-color">笔迹颜色</label>
        <div className="color-row">
          <input id="brush-color" type="color" value="#173f5f" readOnly />
          <span>#173F5F</span>
        </div>

        <label htmlFor="brush-width">笔迹粗细</label>
        <input id="brush-width" type="range" min="2" max="8" value="4" readOnly />

        <label htmlFor="visual-style">视觉风格</label>
        <select id="visual-style" defaultValue="ink">
          <option value="ink">Ink（暂未实现）</option>
        </select>
      </fieldset>
    </section>
  )
}

