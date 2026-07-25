import type { CanvasPoint } from './m0'

export type InputMode = 'gesture' | 'mouse'
export type BrushWidth = 2 | 4 | 8
export type VisualStyle = 'ink' | 'glow' | 'particle'
export type WorkspaceTool = 'draw' | 'erase' | 'pan' | 'select' | 'lasso-rect' | 'lasso-free'

export interface StrokePoint extends CanvasPoint {
  t: number
}

export interface Stroke {
  id: string
  points: StrokePoint[]
  color: string
  width: BrushWidth
  style: VisualStyle
  createdAt: number
  cardId?: string
}

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface StrokeGroup {
  id: string
  strokeIds: string[]
  boundingBox: BoundingBox
  status: 'collecting' | 'suggested' | 'committed'
}

export interface BaseCard {
  id: string
  title: string
  position: { x: number; y: number }
  size: { width: number; height: number }
}

export interface InkCard extends BaseCard {
  kind: 'ink'
  strokeIds: string[]
}

export interface TextCardStyle {
  bold: boolean
  italic: boolean
  underline: boolean
  color: string
}

export interface TextCard extends BaseCard {
  kind: 'text'
  content: string
  textStyle: TextCardStyle
}

export type IdeaCard = InkCard | TextCard

export type EdgeAnchor = 'top' | 'right' | 'bottom' | 'left'

export interface Edge {
  id: string
  sourceCardId: string
  targetCardId: string
  type: 'undirected' | 'directed'
  label?: string
  sourceAnchor?: EdgeAnchor
  targetAnchor?: EdgeAnchor
}

export interface WorkspaceMetadata {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  viewport: { x: number; y: number; zoom: number }
}

export interface BrushSettings {
  color: string
  width: BrushWidth
  style: VisualStyle
}

export interface WritingROI {
  left: number
  top: number
  right: number
  bottom: number
}

export interface GestureSettings {
  writingROI: WritingROI
  pinchDownThreshold: number
  pinchUpThreshold: number
  handPreference: 'any'
  calibrated: boolean
  usesDefaultCalibration: boolean
}

export interface AirNoteSettings {
  inputMode: InputMode
  brush: BrushSettings
  gesture: GestureSettings
  experimentalStylesEnabled: boolean
}

export interface WorkspaceDocument {
  workspace: WorkspaceMetadata
  strokes: Stroke[]
  groups: StrokeGroup[]
  cards: IdeaCard[]
  edges: Edge[]
}

export interface AirNoteProject extends WorkspaceDocument {
  schemaVersion: 2
  settings: AirNoteSettings
}

export const DEFAULT_BRUSH: BrushSettings = {
  color: '#172B3A',
  width: 4,
  style: 'ink',
}

export const DEFAULT_WRITING_ROI: WritingROI = {
  left: 0,
  top: 0,
  right: 1,
  bottom: 1,
}

export const DEFAULT_SETTINGS: AirNoteSettings = {
  inputMode: 'mouse',
  brush: DEFAULT_BRUSH,
  experimentalStylesEnabled: false,
  gesture: {
    writingROI: DEFAULT_WRITING_ROI,
    pinchDownThreshold: 0.35,
    pinchUpThreshold: 0.42,
    handPreference: 'any',
    calibrated: false,
    usesDefaultCalibration: true,
  },
}
