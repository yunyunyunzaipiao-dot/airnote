import { useState } from 'react'
import type { VisualStyle, WorkspaceTool } from '../types/workspace'

interface LeftToolbarProps {
  tool: WorkspaceTool
  brushStyle: VisualStyle
  experimentalStylesEnabled: boolean
  onChange: (tool: WorkspaceTool) => void
  onBrushStyleChange: (style: VisualStyle) => void
}

type IconName = 'pointer' | 'lasso' | 'rect' | 'free' | 'pen' | 'ink' | 'glow' | 'particle'

function ToolIcon({ name }: { name: IconName }) {
  if (name === 'pointer') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l13 9-6 1.5 3.5 6-2.5 1.5-3.5-6L5 19V3z" /></svg>
  }
  if (name === 'lasso') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11c0-4 3.6-7 8-7s8 2.7 8 6-3.6 6-8 6c-3.4 0-6-1.5-6-3.5S8 9 10.5 9c2 0 3.5 1 3.5 2.2S12.8 13 11.4 13" /><path d="M11.4 13c-1.5 2.5-1.2 5.5 1.6 7" /></svg>
  }
  if (name === 'rect') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="1" strokeDasharray="3 2" /></svg>
  }
  if (name === 'free') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16c-2-4 1-10 6-11 5-1 9 2 8 6-1 5-6 8-10 7-2-.4-3-1-4-2z" strokeDasharray="3 2" /></svg>
  }
  if (name === 'pen') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4.5l5 5L9 20H4v-5L14.5 4.5z" /><path d="M12.5 6.5l5 5" /></svg>
  }
  if (name === 'ink') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17c4-1 5-7 9-9 2-1 4 0 4 2 0 4-6 3-7 7-.5 2 3 2 7 1" /></svg>
  }
  if (name === 'glow') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16c4-1 5-7 9-9 2-1 4 0 4 2 0 4-6 3-7 7-.5 2 3 2 7 1" /><path d="M4 20h16M3 12h2M19 5l1-1" className="icon-soft" /></svg>
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16c4-1 5-7 9-9 2-1 4 0 4 2 0 4-6 3-7 7-.5 2 3 2 7 1" /><circle cx="5" cy="7" r="1" /><circle cx="19" cy="14" r="1" /><circle cx="14" cy="21" r="1" /></svg>
}

export function LeftToolbar({
  tool,
  brushStyle,
  experimentalStylesEnabled,
  onChange,
  onBrushStyleChange,
}: LeftToolbarProps) {
  const [openMenu, setOpenMenu] = useState<'lasso' | 'brush' | null>(null)
  const lassoActive = tool === 'lasso-rect' || tool === 'lasso-free'

  const chooseTool = (nextTool: WorkspaceTool) => {
    onChange(nextTool)
    setOpenMenu(null)
  }

  return (
    <nav className="left-toolbar left-toolbar--iconic" aria-label="画布工具栏">
      <div className="tool-stack tool-stack--iconic">
        <button
          className={`tool-action tool-action--icon ${tool === 'select' ? 'tool-action--active' : ''}`}
          type="button"
          aria-label="选择卡片"
          title="选择卡片：移动、改名、缩放或从锚点连线"
          aria-pressed={tool === 'select'}
          onClick={() => chooseTool('select')}
        >
          <ToolIcon name="pointer" />
        </button>

        <div className="tool-menu">
          <button
            className={`tool-action tool-action--icon ${lassoActive ? 'tool-action--active' : ''}`}
            type="button"
            aria-label="选择笔画区域"
            title="选择笔画：框选或自由套索，完成后显示生成卡片建议"
            aria-expanded={openMenu === 'lasso'}
            aria-pressed={lassoActive}
            onClick={() => setOpenMenu((current) => current === 'lasso' ? null : 'lasso')}
          >
            <ToolIcon name="lasso" />
          </button>
          {openMenu === 'lasso' ? (
            <div className="tool-popover" role="menu" aria-label="笔画选区方式">
              <button type="button" role="menuitem" aria-label="矩形框选笔画" title="矩形框选" onClick={() => chooseTool('lasso-rect')}>
                <ToolIcon name="rect" />
              </button>
              <button type="button" role="menuitem" aria-label="自由套索笔画" title="自由套索" onClick={() => chooseTool('lasso-free')}>
                <ToolIcon name="free" />
              </button>
            </div>
          ) : null}
        </div>

        <div className="tool-menu">
          <button
            className={`tool-action tool-action--icon ${tool === 'draw' ? 'tool-action--active' : ''}`}
            type="button"
            aria-label="画笔"
            title="画笔：选择墨迹、辉光或粒子"
            aria-expanded={openMenu === 'brush'}
            aria-pressed={tool === 'draw'}
            onClick={() => {
              onChange('draw')
              setOpenMenu((current) => current === 'brush' ? null : 'brush')
            }}
          >
            <ToolIcon name="pen" />
          </button>
          {openMenu === 'brush' ? (
            <div className="tool-popover tool-popover--brush" role="menu" aria-label="画笔样式">
              <button
                className={brushStyle === 'ink' ? 'is-active' : ''}
                type="button"
                role="menuitem"
                aria-label="墨迹画笔"
                title="墨迹"
                onClick={() => { onBrushStyleChange('ink'); setOpenMenu(null) }}
              >
                <ToolIcon name="ink" />
              </button>
              <button
                className={brushStyle === 'glow' ? 'is-active' : ''}
                type="button"
                role="menuitem"
                aria-label={experimentalStylesEnabled ? '辉光画笔' : '辉光画笔（请先开启实验功能）'}
                title={experimentalStylesEnabled ? '辉光' : '辉光：请先在右侧开启实验功能'}
                disabled={!experimentalStylesEnabled}
                onClick={() => { onBrushStyleChange('glow'); setOpenMenu(null) }}
              >
                <ToolIcon name="glow" />
              </button>
              <button
                className={brushStyle === 'particle' ? 'is-active' : ''}
                type="button"
                role="menuitem"
                aria-label={experimentalStylesEnabled ? '粒子画笔' : '粒子画笔（请先开启实验功能）'}
                title={experimentalStylesEnabled ? '粒子' : '粒子：请先在右侧开启实验功能'}
                disabled={!experimentalStylesEnabled}
                onClick={() => { onBrushStyleChange('particle'); setOpenMenu(null) }}
              >
                <ToolIcon name="particle" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  )
}
