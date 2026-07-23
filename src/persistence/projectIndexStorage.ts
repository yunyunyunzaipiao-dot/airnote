export interface ProjectIndexItem {
  id: string
  name: string
  updatedAt: number
  strokeCount: number
  cardCount: number
  thumbnail?: string
}

const INDEX_KEY = 'airnote.project.index'

export function loadProjectIndex(): ProjectIndexItem[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is ProjectIndexItem =>
      typeof item?.id === 'string'
      && typeof item?.name === 'string'
      && typeof item?.updatedAt === 'number',
    )
  } catch {
    return []
  }
}

export function saveProjectIndex(index: ProjectIndexItem[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index))
  } catch {
    // index is optional
  }
}

export function addOrUpdateProjectIndex(item: ProjectIndexItem) {
  const index = loadProjectIndex()
  const existing = index.find((i) => i.id === item.id)
  if (existing) {
    Object.assign(existing, item)
  } else {
    index.push(item)
  }
  saveProjectIndex(index)
}

export function removeProjectIndex(id: string) {
  const index = loadProjectIndex().filter((i) => i.id !== id)
  saveProjectIndex(index)
}
