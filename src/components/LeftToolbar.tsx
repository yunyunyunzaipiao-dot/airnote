import { useState } from 'react'
import type { BrushSettings, InputMode, WorkspaceTool } from '../types/workspace'
import type { StylePerformanceStage } from '../drawing/canvasRenderer'
import { BrushPopover } from './BrushPopover'

interface LeftToolbarProps {
  tool: WorkspaceTool
  inputMode: InputMode
  brush: BrushSettings
  gesturePauseEnabled: boolean
  experimentalStylesEnabled: boolean
  performanceStage: StylePerformanceStage
  reducedMotion: boolean
  onChange: (tool: WorkspaceTool) => void
  onInputModeChange: (mode: InputMode) => void
  onGesturePauseEnabledChange: (enabled: boolean) => void
  onExperimentalStylesChange: (enabled: boolean) => void
  onUpdateBrush: (brush: BrushSettings) => void
  onCreateTextCard: () => void
}

type IconName = 'pointer' | 'lasso' | 'rect' | 'free' | 'pen' | 'eraser' | 'pan' | 'text' | 'hand' | 'palm' | 'star'

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
  if (name === 'hand') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v0" /><path d="M14 10V4a2 2 0 00-2-2v0a2 2 0 00-2 2v2" /><path d="M10 10.5V6a2 2 0 00-2-2v0a2 2 0 00-2 2v8.5" /><path d="M18.5 15.5c.5-1.5.5-2.5-.5-3.5s-2.5-1-4-.5" /><path d="M6 12c-1.5.5-2.5 1.5-2.5 3s1 2.5 2 3.5 3 2 5 2 4-.5 5.5-1.5 2-2.5 2.5-4" /></svg>
  }
  if (name === 'palm') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 11v8" /><path d="M8 10.5V15" /><path d="M16 10.5V15" /><path d="M20 12.5V16" /><path d="M4 12.5V16" /><circle cx="12" cy="5" r="2" /><circle cx="8" cy="7" r="1.5" /><circle cx="16" cy="7" r="1.5" /><circle cx="4" cy="10" r="1.5" /><circle cx="20" cy="10" r="1.5" /></svg>
  }
  if (name === 'eraser') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17l9-12 8 6-7 9H7z" /><path d="M11 20h10" /></svg>
  }
  if (name === 'pan') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11V6a2 2 0 014 0v4-6a2 2 0 014 0v6-4a2 2 0 014 0v8c0 5-3 8-8 8-4 0-6-2-8-6l-1-3a2 2 0 013-2l2 2V8a2 2 0 014 0" /></svg>
  }
  if (name === 'text') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14M12 5v14M8 19h8" /></svg>
  }
  if (name === 'star') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /></svg>
}

export function LeftToolbar({
  tool,
  inputMode,
  brush,
  gesturePauseEnabled,
  experimentalStylesEnabled,
  performanceStage,
  reducedMotion,
  onChange,
  onInputModeChange,
  onGesturePauseEnabledChange,
  onExperimentalStylesChange,
  onUpdateBrush,
  onCreateTextCard,
}: LeftToolbarProps) {
  const [openMenu, setOpenMenu] = useState<'lasso' | null>(null)
  const [brushPopoverOpen, setBrushPopoverOpen] = useState(false)
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
          title="选择卡片"
          aria-pressed={tool === 'select'}
          onClick={() => chooseTool('select')}
        >
          <ToolIcon name="pointer" />
        </button>

        <button
          className={`tool-action tool-action--icon ${inputMode === 'gesture' ? 'tool-action--active' : ''}`}
          type="button"
          aria-label="切换手势模式"
          title="切换手势模式"
          aria-pressed={inputMode === 'gesture'}
          onClick={() => onInputModeChange(inputMode === 'mouse' ? 'gesture' : 'mouse')}
        >
          <ToolIcon name="hand" />
        </button>

        <div className="tool-menu">
          <button
            className={`tool-action tool-action--icon ${tool === 'draw' ? 'tool-action--active' : ''}`}
            type="button"
            aria-label="画笔"
            title="画笔"
            aria-pressed={tool === 'draw'}
            aria-expanded={brushPopoverOpen}
            onClick={() => {
              onChange('draw')
              setBrushPopoverOpen(v => !v)
            }}
          >
            <ToolIcon name="pen" />
          </button>
          {brushPopoverOpen ? (
            <div className="tool-popover tool-popover--brush" role="dialog" aria-label="画笔属性">
              <BrushPopover
                brush={brush}
                experimentalStylesEnabled={experimentalStylesEnabled}
                performanceStage={performanceStage}
                reducedMotion={reducedMotion}
                onChange={onUpdateBrush}
                onExperimentalStylesChange={onExperimentalStylesChange}
                onClose={() => setBrushPopoverOpen(false)}
              />
            </div>
          ) : null}
        </div>

        <button
          className={`tool-action tool-action--icon ${gesturePauseEnabled ? 'tool-action--active' : ''}`}
          type="button"
          aria-label={gesturePauseEnabled ? '关闭张掌暂停' : '启用张掌暂停'}
          title={gesturePauseEnabled ? '张掌暂停已启用' : '张掌暂停已关闭'}
          aria-pressed={gesturePauseEnabled}
          onClick={() => onGesturePauseEnabledChange(!gesturePauseEnabled)}
        >
          <ToolIcon name="palm" />
        </button>

        <div className="tool-menu">
          <button
            className={`tool-action tool-action--icon ${lassoActive ? 'tool-action--active' : ''}`}
            type="button"
            aria-label="选择笔画区域"
            title="选择笔画"
            aria-expanded={openMenu === 'lasso'}
            aria-pressed={lassoActive}
            onClick={() => setOpenMenu((current: 'lasso' | null) => current === 'lasso' ? null : 'lasso')}
          >
            <ToolIcon name="lasso" />
          </button>
          {openMenu === 'lasso' ? (
            <div className="tool-popover tool-popover--vertical" role="menu" aria-label="笔画选区方式">
              <button type="button" role="menuitem" aria-label="矩形框选笔画" title="矩形框选" onClick={() => chooseTool('lasso-rect')}>
                <ToolIcon name="rect" />
              </button>
              <button type="button" role="menuitem" aria-label="自由套索笔画" title="自由套索" onClick={() => chooseTool('lasso-free')}>
                <ToolIcon name="free" />
              </button>
            </div>
          ) : null}
        </div>

        <button
          className={`tool-action tool-action--icon ${tool === 'erase' ? 'tool-action--active' : ''}`}
          type="button"
          aria-label="整笔橡皮擦"
          title="整笔橡皮擦"
          aria-pressed={tool === 'erase'}
          onClick={() => chooseTool('erase')}
        >
          <ToolIcon name="eraser" />
        </button>

        <button
          className={`tool-action tool-action--icon ${tool === 'pan' ? 'tool-action--active' : ''}`}
          type="button"
          aria-label="平移画布"
          title="平移画布"
          aria-pressed={tool === 'pan'}
          onClick={() => chooseTool('pan')}
        >
          <ToolIcon name="pan" />
        </button>

        <button
          className="tool-action tool-action--icon"
          type="button"
          aria-label="新建文字卡片"
          title="新建文字卡片"
          onClick={onCreateTextCard}
        >
          <ToolIcon name="text" />
        </button>

        <button
          className={`tool-action tool-action--icon ${experimentalStylesEnabled ? 'tool-action--active' : ''}`}
          type="button"
          aria-label={experimentalStylesEnabled ? '工具栏关闭实验视觉' : '工具栏启用实验视觉'}
          title={experimentalStylesEnabled ? '实验视觉已启用' : '实验视觉已关闭'}
          aria-pressed={experimentalStylesEnabled}
          onClick={() => onExperimentalStylesChange(!experimentalStylesEnabled)}
        >
          <ToolIcon name="star" />
        </button>
      </div>
    </nav>
  )
}
