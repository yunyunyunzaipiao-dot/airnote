import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceCanvas } from '../components/WorkspaceCanvas'

describe('VIEW-01 unbounded viewport interaction', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture')
    vi.restoreAllMocks()
  })

  it('converts screen input into world coordinates after pan and zoom', () => {
    const onPointerStart = vi.fn()
    render(
      <WorkspaceCanvas
        inputMode="mouse"
        experimentalStylesEnabled
        reducedMotion={false}
        tool="draw"
        edgeType="undirected"
        strokes={[]}
        cards={[]}
        edges={[]}
        currentGroup={null}
        zoom={2}
        viewport={{ x: 120, y: -60, zoom: 2 }}
        calibration={{ phase: 'ready', roiStep: 4, pinchCycles: 3, awaitingRelease: false, message: 'ready' }}
        onReady={vi.fn()}
        onPointerStart={onPointerStart}
        onPointerMove={vi.fn()}
        onPointerEnd={vi.fn()}
        onEraseAtPoint={vi.fn(() => false)}
        onPan={vi.fn()}
        onSuggestSelection={vi.fn(() => true)}
        onGenerateCard={vi.fn()}
        onContinueGroup={vi.fn()}
        onCancelGroup={vi.fn()}
        onMoveCard={vi.fn()}
        onResizeCard={vi.fn()}
        onRenameCard={vi.fn()}
        onUpdateTextCard={vi.fn()}
        onDeleteCard={vi.fn()}
        onCreateEdge={vi.fn(() => true)}
        onUpdateEdge={vi.fn()}
        onEdgeTypeChange={vi.fn()}
      />,
    )

    const canvas = screen.getByLabelText('鼠标绘图画布')
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 10,
      y: 20,
      left: 10,
      top: 20,
      right: 1010,
      bottom: 820,
      width: 1000,
      height: 800,
      toJSON: () => ({}),
    })

    fireEvent.pointerDown(canvas, {
      pointerId: 8,
      button: 0,
      clientX: 210,
      clientY: 160,
      timeStamp: 42,
    })

    expect(onPointerStart).toHaveBeenCalledWith({ x: 40, y: 100 }, expect.any(Number))
  })
})
