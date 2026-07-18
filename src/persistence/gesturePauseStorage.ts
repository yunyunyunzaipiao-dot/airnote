const STORAGE_KEY = 'airnote.gesturePauseEnabled'

export function loadGesturePauseEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function saveGesturePauseEnabled(enabled: boolean) {
  window.localStorage.setItem(STORAGE_KEY, String(enabled))
}
