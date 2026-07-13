import { DisabledAction } from './DisabledAction'

export function LeftToolbar() {
  return (
    <aside className="left-toolbar" aria-label="左侧工具栏">
      <div className="vertical-caption" aria-hidden="true">TOOLS / P0</div>
      <div className="tool-stack">
        <DisabledAction label="选择" symbol="01" />
        <button className="tool-action tool-action--active" type="button" aria-pressed="true">
          <span>02</span>
          <strong>画笔</strong>
        </button>
        <DisabledAction label="卡片（暂未实现）" symbol="03" />
        <DisabledAction label="连线（暂未实现）" symbol="04" />
      </div>
      <div className="toolbar-footnote">M1<br />STROKE</div>
    </aside>
  )
}
