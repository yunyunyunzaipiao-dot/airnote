interface DisabledActionProps {
  label: string
  symbol?: string
  compact?: boolean
}

export function DisabledAction({ label, symbol, compact = false }: DisabledActionProps) {
  return (
    <button
      className={compact ? 'disabled-action disabled-action--compact' : 'disabled-action'}
      type="button"
      disabled
      aria-label={`${label}，暂未实现`}
      title="暂未实现"
    >
      {symbol ? <span aria-hidden="true">{symbol}</span> : null}
      <span>{label}</span>
    </button>
  )
}

