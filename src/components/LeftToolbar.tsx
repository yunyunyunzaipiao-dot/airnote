import { DisabledAction } from './DisabledAction'

const tools = [
  { label: '选择', symbol: '01' },
  { label: '画笔', symbol: '02' },
  { label: '卡片', symbol: '03' },
  { label: '连线', symbol: '04' },
]

export function LeftToolbar() {
  return (
    <aside className="left-toolbar" aria-label="左侧工具栏">
      <div className="vertical-caption" aria-hidden="true">TOOLS / 暂未实现</div>
      <div className="tool-stack">
        {tools.map((tool) => (
          <DisabledAction key={tool.label} label={tool.label} symbol={tool.symbol} />
        ))}
      </div>
      <div className="toolbar-footnote">MVP<br />FOUNDATION</div>
    </aside>
  )
}

