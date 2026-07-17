import type { WorkspaceTool } from '../types/workspace'

interface LeftToolbarProps {
  tool: WorkspaceTool
  onChange: (tool: WorkspaceTool) => void
  onCardAction: () => void
}

export function LeftToolbar({ tool, onChange, onCardAction }: LeftToolbarProps) {
  return (
    <nav className="left-toolbar" aria-label="画布工具栏">
      <div className="vertical-caption" aria-hidden="true">TOOLS / P0</div>
      <div className="tool-stack">
        <button className={`tool-action ${tool === 'select' ? 'tool-action--active' : ''}`} type="button" aria-pressed={tool === 'select'} onClick={() => onChange('select')}><span>01</span><strong>选择</strong></button>
        <button className={`tool-action ${tool === 'draw' ? 'tool-action--active' : ''}`} type="button" aria-pressed={tool === 'draw'} onClick={() => onChange('draw')}>
          <span>02</span>
          <strong>画笔</strong>
        </button>
        <button className="tool-action" type="button" aria-label="03 卡片" onClick={onCardAction} title="确认生成当前笔画组，或进入卡片整理"><span>03</span><strong>卡片</strong></button>
        <button className={`tool-action ${tool === 'edge' ? 'tool-action--active' : ''}`} type="button" aria-pressed={tool === 'edge'} onClick={() => onChange('edge')}><span>04</span><strong>连线</strong></button>
      </div>
      <div className="toolbar-footnote">M2<br />IDEAS</div>
    </nav>
  )
}
