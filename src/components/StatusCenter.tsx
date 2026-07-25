import { useCallback, useRef, useState } from 'react'

export type StatusLevel = 'info' | 'success' | 'warning' | 'error'

export interface StatusEntry {
  id: string
  message: string
  level: StatusLevel
  createdAt: number
}

function inferLevel(message: string): StatusLevel {
  if (/失败|错误|无法|损坏|不足|拒绝|不可用/.test(message)) return 'error'
  if (/性能|降级|警告|占用|未检测/.test(message)) return 'warning'
  if (/已导出|已保存|已恢复|已导入|完成/.test(message)) return 'success'
  return 'info'
}

export function useStatusCenter() {
  const [visible, setVisible] = useState<StatusEntry[]>([])
  const [history, setHistory] = useState<StatusEntry[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const lastShownRef = useRef(new Map<string, number>())
  const nextIdRef = useRef(0)

  const dismiss = useCallback((id: string) => {
    setVisible((current) => current.filter((entry) => entry.id !== id))
  }, [])

  const push = useCallback((message: string, level: StatusLevel = inferLevel(message)) => {
    const now = Date.now()
    const entry = { id: `status-${++nextIdRef.current}`, message, level, createdAt: now }
    setHistory((current) => [entry, ...current].slice(0, 60))

    const key = `${level}:${message}`
    const lastShown = lastShownRef.current.get(key) ?? 0
    lastShownRef.current.set(key, now)
    if (now - lastShown < 10_000) return

    setVisible((current) => {
      const errors = current.filter((item) => item.level === 'error')
      const others = current.filter((item) => item.level !== 'error')
      return level === 'error'
        ? [...errors, entry, ...others].slice(0, 4)
        : [...errors, ...others, entry].slice(-4)
    })
    if (level !== 'error') {
      window.setTimeout(() => dismiss(entry.id), level === 'warning' ? 6500 : 4200)
    }
  }, [dismiss])

  return {
    visible,
    history,
    historyOpen,
    setHistoryOpen,
    push,
    dismiss,
    blockingCount: visible.filter((entry) => entry.level === 'error').length,
  }
}

interface StatusCenterProps {
  visible: StatusEntry[]
  history: StatusEntry[]
  historyOpen: boolean
  onHistoryOpenChange: (open: boolean) => void
  onDismiss: (id: string) => void
  onExportProject: () => void
}

export function StatusCenter({
  visible,
  history,
  historyOpen,
  onHistoryOpenChange,
  onDismiss,
  onExportProject,
}: StatusCenterProps) {
  return (
    <>
      <div className="status-stack" aria-live="polite" aria-relevant="additions">
        {visible.map((entry) => (
          <section key={entry.id} className={`status-toast status-toast--${entry.level}`} role={entry.level === 'error' ? 'alert' : 'status'}>
            <span className="status-toast__mark" aria-hidden="true">{entry.level === 'error' ? '!' : entry.level === 'warning' ? '△' : '✓'}</span>
            <p>{entry.message}</p>
            {entry.level === 'error' && /保存|存储|数据|项目|损坏/.test(entry.message)
              ? <button type="button" onClick={onExportProject}>导出当前项目</button>
              : null}
            <button className="status-toast__close" type="button" aria-label={`关闭提示：${entry.message}`} onClick={() => onDismiss(entry.id)}>×</button>
          </section>
        ))}
      </div>
      {historyOpen ? (
        <aside className="status-history" role="dialog" aria-modal="false" aria-labelledby="status-history-title">
          <header>
            <div>
              <p>STATUS LOG</p>
              <h2 id="status-history-title">状态记录</h2>
            </div>
            <button type="button" aria-label="关闭状态记录" onClick={() => onHistoryOpenChange(false)}>×</button>
          </header>
          {history.length ? (
            <ol>
              {history.map((entry) => (
                <li key={entry.id} className={`status-history__item status-history__item--${entry.level}`}>
                  <time>{new Date(entry.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
                  <span>{entry.message}</span>
                </li>
              ))}
            </ol>
          ) : <p className="status-history__empty">暂时没有状态记录。</p>}
        </aside>
      ) : null}
    </>
  )
}
