import { useCallback, useEffect, useRef, useState } from 'react'

interface StepDef {
  targetSelector: string
  title: string
  description: string
  placement: 'bottom' | 'right' | 'left' | 'top'
}

const STEPS: StepDef[] = [
  {
    targetSelector: '.canvas-stage',
    title: '欢迎使用空书',
    description: 'AirNote 是一款支持手势绘画的无限画布工具。你可以在画布上自由绘画、整理想法卡片。',
    placement: 'bottom',
  },
  {
    targetSelector: '.floating-sidebar',
    title: '工具箱',
    description: '画笔绘画、套索选区、切换手势模式。点击画笔还可以调整颜色和粗细。',
    placement: 'right',
  },
  {
    targetSelector: '.camera-panel-mini',
    title: '手势与摄像头',
    description: '启用摄像头后，捏合食指和拇指即可在空中绘画，松开手指断笔。',
    placement: 'right',
  },
  {
    targetSelector: '.floating-right .calibration-panel',
    title: '书写校准',
    description: '首次使用手势前需要校准：记录屏幕四角位置和捏合力度，让识别更精准。',
    placement: 'left',
  },
  {
    targetSelector: '.canvas-stage',
    title: '生成想法卡片',
    description: '用套索框选笔画后，点击"生成卡片"即可将笔迹整理为想法卡片，方便后续拖拽和连线。',
    placement: 'bottom',
  },
  {
    targetSelector: '.top-bar__pill',
    title: '操作栏',
    description: '撤销/重做、导出图片与项目、导入项目，都在这里。',
    placement: 'bottom',
  },
  {
    targetSelector: '.canvas-stage',
    title: '开始创作吧',
    description: '一切准备就绪。拿起鼠标或启用手势，开始你的第一笔！',
    placement: 'bottom',
  },
]

interface OnboardingOverlayProps {
  onComplete: () => void
}

export function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [spotlight, setSpotlight] = useState({ top: 0, left: 0, width: 0, height: 0 })
  const [visible, setVisible] = useState(false)
  const rafRef = useRef<number>(0)

  const step = STEPS[stepIndex]

  const computeSpotlight = useCallback(() => {
    const el = document.querySelector(step.targetSelector) as HTMLElement | null
    if (!el) {
      setSpotlight({ top: window.innerHeight / 2 - 60, left: window.innerWidth / 2 - 120, width: 240, height: 120 })
      return
    }
    const rect = el.getBoundingClientRect()
    const padding = 8
    setSpotlight({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    })
  }, [step])

  useEffect(() => {
    setVisible(false)
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      computeSpotlight()
      setVisible(true)
    })
  }, [stepIndex, computeSpotlight])

  useEffect(() => {
    const onResize = () => computeSpotlight()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(rafRef.current)
    }
  }, [computeSpotlight])

  const goNext = () => {
    if (stepIndex >= STEPS.length - 1) {
      onComplete()
    } else {
      setStepIndex((i) => i + 1)
    }
  }

  const goPrev = () => setStepIndex((i) => Math.max(0, i - 1))
  const skip = () => onComplete()

  const cardPos = (() => {
    const s = spotlight
    const cardW = 280
    const cardH = 160
    const gap = 16
    switch (step.placement) {
      case 'bottom':
        return { top: s.top + s.height + gap, left: Math.min(Math.max(s.left + s.width / 2 - cardW / 2, 16), window.innerWidth - cardW - 16) }
      case 'top':
        return { top: Math.max(s.top - cardH - gap, 16), left: Math.min(Math.max(s.left + s.width / 2 - cardW / 2, 16), window.innerWidth - cardW - 16) }
      case 'right':
        return { top: Math.min(Math.max(s.top + s.height / 2 - cardH / 2, 16), window.innerHeight - cardH - 16), left: s.left + s.width + gap }
      case 'left':
        return { top: Math.min(Math.max(s.top + s.height / 2 - cardH / 2, 16), window.innerHeight - cardH - 16), left: Math.max(s.left - cardW - gap, 16) }
      default:
        return { top: s.top + s.height + gap, left: Math.min(Math.max(s.left + s.width / 2 - cardW / 2, 16), window.innerWidth - cardW - 16) }
    }
  })()

  return (
    <div className="onboarding-backdrop" aria-hidden="true">
      <div
        className={`onboarding-spotlight ${visible ? 'is-visible' : ''}`}
        style={{
          top: spotlight.top,
          left: spotlight.left,
          width: spotlight.width,
          height: spotlight.height,
        }}
      />

      <button type="button" className="onboarding-skip" onClick={skip}>跳过</button>

      <div
        className={`onboarding-card ${visible ? 'is-visible' : ''}`}
        style={{ top: cardPos.top, left: cardPos.left }}
        role="dialog"
        aria-modal="false"
        aria-labelledby={`onboarding-title-${stepIndex}`}
      >
        <div className="onboarding-progress">
          {STEPS.map((_, i) => (
            <span key={i} className={i === stepIndex ? 'is-active' : ''} />
          ))}
        </div>
        <h3 id={`onboarding-title-${stepIndex}`}>{step.title}</h3>
        <p>{step.description}</p>
        <div className="onboarding-actions">
          {stepIndex > 0 ? (
            <button type="button" className="secondary" onClick={goPrev}>上一步</button>
          ) : (
            <span />
          )}
          <button type="button" className="primary" onClick={goNext}>
            {stepIndex >= STEPS.length - 1 ? '开始创作' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  )
}
