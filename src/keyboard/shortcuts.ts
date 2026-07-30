export type ShortcutPlatform = 'mac' | 'windows'

export function getShortcutPlatform(platform = typeof navigator === 'undefined' ? '' : navigator.platform): ShortcutPlatform {
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? 'mac' : 'windows'
}

export function getShortcutLabels(platform = getShortcutPlatform()) {
  const modifier = platform === 'mac' ? '⌘' : 'Ctrl'
  return {
    modifier,
    undo: platform === 'mac' ? '⌘Z' : 'Ctrl+Z',
    redo: platform === 'mac' ? '⌘⇧Z' : 'Ctrl+Shift+Z',
    zoom: platform === 'mac' ? '⌘±' : 'Ctrl+±',
  }
}

export function hasPrimaryModifier(event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey'>, platform = getShortcutPlatform()) {
  return platform === 'mac' ? event.metaKey : event.ctrlKey
}

export function isEditableShortcutTarget(target: EventTarget | null) {
  return target instanceof Element
    && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

export function hasBlockingShortcutDialog(root: Pick<Document, 'querySelector'> = document) {
  return Boolean(root.querySelector('[role="dialog"]:not(.card-property-panel)'))
}
