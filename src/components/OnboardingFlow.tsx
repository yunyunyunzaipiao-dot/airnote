import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { ToolIcon, type IconName } from './LeftToolbar'

export const ONBOARDING_STORAGE_KEY = 'airnote-onboarding-done'

export function hasCompletedOnboarding(storage: Pick<Storage, 'getItem'> = localStorage) {
  try {
    return storage.getItem(ONBOARDING_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function saveOnboardingCompleted(storage: Pick<Storage, 'setItem'> = localStorage) {
  try {
    storage.setItem(ONBOARDING_STORAGE_KEY, '1')
  } catch {
    // UI-02 是渐进增强；偏好保存失败不能阻塞工作区。
  }
}

const STEPS = [
  {
    eyebrow: 'AIRNOTE',
    title: '欢迎使用空书',
    body: ['一块安静的画布，捕捉你的灵感。', '墨迹、文字、连线 — 随心而至。'],
    visual: (
      <div className="onboarding-welcome" aria-hidden="true">
        <span className="onboarding-brand">AN</span>
        <div className="onboarding-ink"><span /><span /></div>
      </div>
    ),
  },
  {
    eyebrow: '平移 · 缩放',
    title: '自由探索画布',
    body: ['按 H 切换平移工具，拖动画布浏览内容。', '右下角可在 25%—300% 之间缩放。'],
    visual: (
      <div className="onboarding-canvas-demo" aria-hidden="true">
        <span className="demo-card">笔记卡片</span>
        <span className="demo-pan-arrows">↔</span>
        <span className="demo-zoom">100%</span>
      </div>
    ),
  },
  {
    eyebrow: '7 种工具，键盘快捷键驱动',
    title: '工具栏一览',
    body: ['左侧工具栏包含核心工具，每个工具都有单键快捷键。', '按 P 激活画笔，按 V 回到选择模式。'],
    visual: <ToolbarPreview />,
  },
  {
    eyebrow: '墨迹卡片 · 文字卡片',
    title: '两种卡片',
    body: ['用矩形或套索选中笔迹，点击「生成墨迹卡片」封装笔迹。', '按 T 快速新建文字卡片，双击卡片内容即可编辑。'],
    visual: (
      <div className="onboarding-card-demo" aria-hidden="true">
        <span className="demo-ink-card"><strong>墨迹卡片</strong><i /><i /></span>
        <span className="demo-text-card"><strong>文字卡片</strong><i /><i /><i /></span>
      </div>
    ),
  },
  {
    eyebrow: '无方向 · 单向 · 双向',
    title: '连接卡片',
    body: ['在选择模式下，悬停卡片边缘出现锚点。', '从锚点拖向另一张卡片完成连线，可选择箭头方向。'],
    visual: (
      <div className="onboarding-edge-demo" aria-hidden="true">
        <span>卡片 A</span><i /><b>›</b><span>卡片 B</span>
      </div>
    ),
  },
  {
    eyebrow: '空书已就绪',
    title: '开始创作',
    body: ['所有操作支持撤销/重做（⌘Z / ⌘⇧Z）。', '随时点击顶栏的 ? 重新查看引导。'],
    visual: <ShortcutPreview />,
  },
] as const

const TOOL_PREVIEW: Array<{ name: IconName; key: string }> = [
  { name: 'pointer', key: 'V' },
  { name: 'pen', key: 'P' },
  { name: 'eraser', key: 'E' },
  { name: 'pan', key: 'H' },
  { name: 'rect', key: 'R' },
  { name: 'lasso', key: 'L' },
  { name: 'text', key: 'T' },
]

function ToolbarPreview() {
  return (
    <div className="onboarding-tools-preview" aria-hidden="true">
      <div className="onboarding-tools">
        {TOOL_PREVIEW.map((tool, index) => (
          <span key={tool.key} className={index === 0 ? 'is-active' : undefined}><ToolIcon name={tool.name} /></span>
        ))}
      </div>
      <div className="onboarding-tool-note">
        <span><ToolIcon name="pointer" /></span>
        <strong>选择</strong>
        <kbd>V</kbd>
        <small>快捷键</small>
      </div>
    </div>
  )
}

function ShortcutPreview() {
  const shortcuts: Array<[ReactNode, string]> = [
    [<>⌘Z</>, '撤销'],
    [<>⌘⇧Z</>, '重做'],
    [<>Del</>, '删除'],
    [<>Esc</>, '取消'],
    [<>⌘±</>, '缩放'],
    [<>V/P/E</>, '切换工具'],
  ]

  return (
    <div className="onboarding-shortcuts" aria-hidden="true">
      <span className="onboarding-ready-mark">✧</span>
      <div>
        {shortcuts.map(([key, label]) => <span key={label}><kbd>{key}</kbd><small>{label}</small></span>)}
      </div>
    </div>
  )
}

interface OnboardingFlowProps {
  onClose: () => void
}

export function OnboardingFlow({ onClose }: OnboardingFlowProps) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const dialogRef = useFocusTrap(true)

  const finish = useCallback(() => {
    saveOnboardingCompleted()
    onClose()
  }, [onClose])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        finish()
      }
      if (event.key === 'ArrowRight' && step < STEPS.length - 1) {
        event.preventDefault()
        setStep((value) => value + 1)
      }
      if (event.key === 'ArrowLeft' && step > 0) {
        event.preventDefault()
        setStep((value) => value - 1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [finish, step])

  return (
    <div className="onboarding-layer" role="presentation">
      <button className="onboarding-backdrop" type="button" aria-label="跳过新手引导" onClick={finish} />
      <section ref={dialogRef} className="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <button className="onboarding-close" type="button" aria-label="跳过并关闭新手引导" onClick={finish}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className="onboarding-visual">
          <span className="onboarding-count">{step + 1} / {STEPS.length}</span>
          {current.visual}
        </div>
        <div className="onboarding-copy" aria-live="polite">
          <p className="onboarding-eyebrow">{current.eyebrow}</p>
          <h2 id="onboarding-title">{current.title}</h2>
          <p>{current.body.map((line) => <span key={line}>{line}</span>)}</p>
        </div>
        <footer className="onboarding-footer">
          <div className="onboarding-dots" aria-label="新手引导步骤">
            {STEPS.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className={index === step ? 'onboarding-dot onboarding-dot--active' : 'onboarding-dot'}
                aria-label={`前往第 ${index + 1} 步：${item.title}`}
                aria-current={index === step ? 'step' : undefined}
                onClick={() => setStep(index)}
              />
            ))}
          </div>
          <div className="onboarding-actions">
            {step > 0 ? <button type="button" onClick={() => setStep((value) => value - 1)}>上一步</button> : null}
            {step < STEPS.length - 1
              ? <button className="onboarding-primary" type="button" onClick={() => setStep((value) => value + 1)}>下一步 →</button>
              : <button className="onboarding-primary" type="button" onClick={finish}>开始创作</button>}
          </div>
        </footer>
      </section>
    </div>
  )
}
