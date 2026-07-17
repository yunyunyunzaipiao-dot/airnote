export const UI_THEME_GROUPS = [
  {
    id: 'bright',
    label: '明亮色',
    description: '清晰、醒目，适合需要一点活力的工作区。',
    themes: [
      {
        id: 'sky',
        name: '晴空蓝',
        description: '清亮蓝色框架与冰白画布',
        preview: ['#2E6BE6', '#EAF4FF', '#55B8FF'],
      },
      {
        id: 'coral',
        name: '珊瑚橙',
        description: '温暖珊瑚色与奶油白',
        preview: ['#C94F3D', '#FFF0E7', '#FF8A68'],
      },
      {
        id: 'mint',
        name: '薄荷青',
        description: '鲜明青绿色与浅青画布',
        preview: ['#176F68', '#E7F8F3', '#55CDB1'],
      },
    ],
  },
  {
    id: 'soft',
    label: '低饱和色',
    description: '更安静、耐看，长时间使用不容易疲劳。',
    themes: [
      {
        id: 'mist',
        name: '雾霭紫',
        description: '灰紫框架与柔雾白',
        preview: ['#66606E', '#F1EEF3', '#B8AEC3'],
      },
      {
        id: 'sage',
        name: '鼠尾草',
        description: '低饱和绿灰与自然白',
        preview: ['#5F685F', '#EEF1EB', '#AAB7A5'],
      },
      {
        id: 'clay',
        name: '陶土粉',
        description: '柔和土粉与暖灰背景',
        preview: ['#735F5A', '#F4ECE8', '#C6A79D'],
      },
    ],
  },
  {
    id: 'neutral',
    label: '纯色',
    description: '减少颜色干扰，专注内容和线条。',
    themes: [
      {
        id: 'graphite',
        name: '石墨灰',
        description: '当前的中性灰工作区',
        preview: ['#484A45', '#DFE0DA', '#D2D4CF'],
      },
      {
        id: 'night',
        name: '全黑界面',
        description: '深色画布与高对比文字',
        preview: ['#0B0C0D', '#191A1C', '#3B3D40'],
      },
      {
        id: 'white',
        name: '全白界面',
        description: '纯白框架与极简浅灰层次',
        preview: ['#FFFFFF', '#F5F5F5', '#DEDFE1'],
      },
    ],
  },
] as const

export type UiThemeId = (typeof UI_THEME_GROUPS)[number]['themes'][number]['id']

export const DEFAULT_UI_THEME: UiThemeId = 'graphite'
const UI_THEME_KEY = 'airnote.uiTheme'

const UI_THEME_IDS = new Set<UiThemeId>(
  UI_THEME_GROUPS.flatMap((group) => group.themes.map((theme) => theme.id)),
)

export function isUiThemeId(value: unknown): value is UiThemeId {
  return typeof value === 'string' && UI_THEME_IDS.has(value as UiThemeId)
}

export function loadUiTheme(storage: Pick<Storage, 'getItem'> = localStorage): UiThemeId {
  try {
    const stored = storage.getItem(UI_THEME_KEY)
    return isUiThemeId(stored) ? stored : DEFAULT_UI_THEME
  } catch {
    return DEFAULT_UI_THEME
  }
}

export function saveUiTheme(
  theme: UiThemeId,
  storage: Pick<Storage, 'setItem'> = localStorage,
) {
  try {
    storage.setItem(UI_THEME_KEY, theme)
  } catch {
    // 主题是可选界面偏好；存储不可用时仍允许继续使用工作区。
  }
}

export function applyUiTheme(theme: UiThemeId, root: HTMLElement = document.documentElement) {
  root.dataset.uiTheme = theme
}
