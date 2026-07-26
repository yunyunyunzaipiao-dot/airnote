import type { ReactNode } from 'react'

interface TooltipProps {
  children: ReactNode
  label: string
}

export function Tooltip({ children, label }: TooltipProps) {
  return (
    <span className="tooltip" aria-label={label} title={label}>
      {children}
    </span>
  )
}
