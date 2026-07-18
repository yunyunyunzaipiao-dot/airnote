import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceCanvas } from '../components/WorkspaceCanvas'

describe('CARD-02 card drag preview', () => {
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

  it('commits the latest pointer position even before the next animation frame', () => {
    const onMoveCard = vi.fn()
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(17)
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

    render(
      <WorkspaceCanvas
        inputMode="mouse"
        experimentalStylesEnabled
        reducedMotion={false}
        tool="select"
        edgeType="undirected"
        strokes={[]}
        cards={[{
          id: 'card-1',
          strokeIds: [],
          title: '拖动测试',
          position: { x: 100, y: 100 },
          size: { width: 240, height: 180 },
        }]}
        edges={[]}
        currentGroup={null}
        calibration={{
          phase: 'ready',
          roiStep: 4,
          pinchCycles: 3,
          awaitingRelease: false,
          message: 'ready',
        }}
        onReady={vi.fn()}
        onPointerStart={vi.fn()}
        onPointerMove={vi.fn()}
        onPointerEnd={vi.fn()}
        onSuggestSelection={vi.fn(() => true)}
        onGenerateCard={vi.fn()}
        onContinueGroup={vi.fn()}
        onCancelGroup={vi.fn()}
        onMoveCard={onMoveCard}
        onResizeCard={vi.fn()}
        onRenameCard={vi.fn()}
        onDeleteCard={vi.fn()}
        onCreateEdge={vi.fn(() => true)}
        onUpdateEdge={vi.fn()}
        onEdgeTypeChange={vi.fn()}
      />,
    )

    const titleBar = screen.getByText('拖动测试').closest('.idea-card__title')!
    fireEvent.pointerDown(titleBar, { pointerId: 9, button: 0, clientX: 120, clientY: 120 })
    fireEvent.pointerMove(titleBar, { pointerId: 9, clientX: 300, clientY: 260 })
    fireEvent.pointerUp(titleBar, { pointerId: 9, clientX: 300, clientY: 260 })

    expect(onMoveCard).toHaveBeenCalledWith(
      'card-1',
      280,
      240,
      expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }),
    )
  })
})
