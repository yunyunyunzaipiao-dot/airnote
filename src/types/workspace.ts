import type { CanvasPoint } from './m0'

export type InputMode = 'gesture' | 'mouse'
export type BrushWidth = 2 | 4 | 8

export interface StrokePoint extends CanvasPoint {
  t: number
}

export interface Stroke {
  id: string
  points: StrokePoint[]
  color: string
  width: BrushWidth
  style: 'ink'
  createdAt: number
  cardId?: string
}

export interface BrushSettings {
  color: string
  width: BrushWidth
  style: 'ink'
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
  gesture: {
    writingROI: DEFAULT_WRITING_ROI,
    pinchDownThreshold: 0.35,
    pinchUpThreshold: 0.42,
    handPreference: 'any',
    calibrated: false,
    usesDefaultCalibration: true,
  },
}
