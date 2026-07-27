import { useEffect, useState } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'

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
    body: '一块安静的画布，捕捉你的灵感。墨迹、文字与连线，都从这里自然展开。',
    visual: <div className="onboarding-ink" aria-hidden="true"><span /><span /></div>,
  },
  {
    eyebrow: '画布操作',
    title: '在同一片画布上自由整理',
    body: '使用画笔记录，切换平移工具浏览内容；右下角可在 25%—300% 之间缩放。',
    visual: <div className="onboarding-canvas-demo" aria-hidden="true"><span className="demo-card demo-card--one" /><span className="demo-card demo-card--two" /><i /></div>,
  },
  {
    eyebrow: '工具栏',
    title: '选择最合适的操作',
    body: '选择、画笔、整笔橡皮擦、平移、矩形框选、自由套索和文字卡片都有鼠标入口。',
    visual: <div className="onboarding-tools" aria-hidden="true">{['V', 'P', 'E', 'H', 'R', 'L', 'T'].map((key) => <span key={key}>{key}</span>)}</div>,
  },
  {
    eyebrow: '两种卡片',
    title: '让墨迹和文字成为想法单元',
    body: '自由笔迹由你确认后生成墨迹卡片；文字卡片可编辑标题、正文、格式和颜色。',
    visual: <div className="onboarding-card-demo" aria-hidden="true"><span><i /><i /><i /></span><span><strong>文字卡片</strong><small>补充一句说明</small></span></div>,
  },
  {
    eyebrow: '连接想法',
    title: '从卡片锚点建立关系',
    body: '在选择工具下，从卡片四周的连接点拖向另一张卡片；移动卡片时连接会实时跟随。',
    visual: <div className="onboarding-edge-demo" aria-hidden="true"><span /><i /><span /></div>,
  },
  {
    eyebrow: '快捷键',
    title: '现在可以开始了',
    body: 'V 选择、P 画笔、E 橡皮擦、H 平移、R 矩形框选、L 套索、Ctrl/Cmd+Z 撤销。',
    visual: <div className="onboarding-shortcuts" aria-hidden="true">{['V', 'P', 'E', 'H', 'R', 'L', '⌘ Z'].map((key) => <kbd key={key}>{key}</kbd>)}</div>,
  },
] as const

interface OnboardingFlowProps {
  onClose: () => void
}

export function OnboardingFlow({ onClose }: OnboardingFlowProps) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const dialogRef = useFocusTrap(true)

  const finish = () => {
    saveOnboardingCompleted()
    onClose()
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish()
      if (event.key === 'ArrowRight' && step < STEPS.length - 1) setStep((value) => value + 1)
      if (event.key === 'ArrowLeft' && step > 0) setStep((value) => value - 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step])

  return (
    <div className="onboarding-layer" role="presentation">
      <button className="onboarding-backdrop" type="button" aria-label="跳过新手引导" onClick={finish} />
      <section ref={dialogRef} className="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <button className="onboarding-close" type="button" aria-label="跳过并关闭新手引导" onClick={finish}>×</button>
        <div className="onboarding-visual">
          <span className="onboarding-count">{step + 1} / {STEPS.length}</span>
          <span className="onboarding-brand" aria-hidden="true">空</span>
          {current.visual}
        </div>
        <div className="onboarding-copy">
          <p className="onboarding-eyebrow">{current.eyebrow}</p>
          <h2 id="onboarding-title">{current.title}</h2>
          <p>{current.body}</p>
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
            {step > 0 ? <button type="button" onClick={() => setStep((value) => value - 1)}>上一步</button> : <button type="button" onClick={finish}>跳过</button>}
            {step < STEPS.length - 1
              ? <button className="onboarding-primary" type="button" onClick={() => setStep((value) => value + 1)}>下一步 →</button>
              : <button className="onboarding-primary" type="button" onClick={finish}>开始使用</button>}
          </div>
        </footer>
      </section>
    </div>
  )
}
