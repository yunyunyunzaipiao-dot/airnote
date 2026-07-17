import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import {
  applyUiTheme,
  loadUiTheme,
  saveUiTheme,
  UI_THEME_GROUPS,
  type UiThemeId,
} from '../theme/uiThemes'

const THEME_PANEL_ID = 'airnote-theme-panel'

export function ThemeMenu() {
  const [theme, setTheme] = useState<UiThemeId>(() => loadUiTheme())
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    applyUiTheme(theme)
  }, [theme])

  useEffect(() => {
    if (!open) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const selectTheme = (nextTheme: UiThemeId) => {
    setTheme(nextTheme)
    saveUiTheme(nextTheme)
  }

  return (
    <div className="theme-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="brand-mark"
        aria-label="打开界面主题"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={THEME_PANEL_ID}
        title="切换界面主题"
        onClick={() => setOpen((current) => !current)}
      >
        空
      </button>

      {open ? (
        <section
          id={THEME_PANEL_ID}
          className="theme-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="theme-panel-title"
        >
          <header className="theme-panel__header">
            <div>
              <p className="theme-panel__eyebrow">界面外观</p>
              <h2 id="theme-panel-title">选择主题</h2>
              <p>只改变界面颜色，不会改变笔迹、卡片或导出内容。</p>
            </div>
            <button
              type="button"
              className="theme-panel__close"
              aria-label="关闭主题面板"
              onClick={() => {
                setOpen(false)
                triggerRef.current?.focus()
              }}
            >
              ×
            </button>
          </header>

          <div className="theme-panel__groups">
            {UI_THEME_GROUPS.map((group) => (
              <section className="theme-group" key={group.id} aria-labelledby={`theme-group-${group.id}`}>
                <div className="theme-group__heading">
                  <h3 id={`theme-group-${group.id}`}>{group.label}</h3>
                  <p>{group.description}</p>
                </div>
                <div className="theme-grid">
                  {group.themes.map((option) => {
                    const selected = option.id === theme
                    const previewStyle = {
                      '--theme-preview-frame': option.preview[0],
                      '--theme-preview-surface': option.preview[1],
                      '--theme-preview-accent': option.preview[2],
                    } as CSSProperties
                    return (
                      <button
                        type="button"
                        className={`theme-option ${selected ? 'theme-option--selected' : ''}`}
                        key={option.id}
                        aria-pressed={selected}
                        onClick={() => selectTheme(option.id)}
                      >
                        <span className="theme-option__preview" style={previewStyle} aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </span>
                        <span className="theme-option__copy">
                          <strong>{option.name}</strong>
                          <small>{option.description}</small>
                        </span>
                        <span className="theme-option__mark" aria-hidden="true">
                          {selected ? '✓' : '○'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
