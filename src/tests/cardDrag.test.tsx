import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
    cleanup()
    Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture')
    vi.restoreAllMocks()
  })

  it('drags from the whole card surface and commits before the next animation frame', () => {
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
          kind: 'ink',
          strokeIds: [],
          title: '拖动测试',
          position: { x: 100, y: 100 },
          size: { width: 240, height: 180 },
        }]}
        edges={[]}
        currentGroup={null}
        zoom={1}
        viewport={{ x: 0, y: 0, zoom: 1 }}
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
        onEraseAtPoint={vi.fn(() => false)}
        onPan={vi.fn()}
        onSuggestSelection={vi.fn(() => true)}
        onGenerateCard={vi.fn()}
        onContinueGroup={vi.fn()}
        onCancelGroup={vi.fn()}
        onMoveCard={onMoveCard}
        onResizeCard={vi.fn()}
        onRenameCard={vi.fn()}
        onUpdateTextCard={vi.fn()}
        onDeleteCard={vi.fn()}
        onCreateEdge={vi.fn(() => true)}
        onUpdateEdge={vi.fn()}
        onEdgeTypeChange={vi.fn()}
      />,
    )

    const cardSurface = screen.getByText('拖动测试').closest('.idea-card')!
    fireEvent.pointerDown(cardSurface, { pointerId: 9, button: 0, clientX: 120, clientY: 120 })
    fireEvent.pointerMove(cardSurface, { pointerId: 9, clientX: 300, clientY: 260 })
    fireEvent.pointerUp(cardSurface, { pointerId: 9, clientX: 300, clientY: 260 })

    expect(onMoveCard).toHaveBeenCalledWith(
      'card-1',
      280,
      240,
      expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }),
    )
  })

  it('keeps text editing interactive instead of starting a card drag', () => {
    const onMoveCard = vi.fn()
    render(
      <WorkspaceCanvas
        inputMode="mouse"
        experimentalStylesEnabled
        reducedMotion={false}
        tool="select"
        edgeType="undirected"
        strokes={[]}
        cards={[{
          id: 'card-text',
          kind: 'text',
          title: '文字卡片',
          content: '可编辑正文',
          textStyle: { bold: false, italic: false, underline: false, color: '#172B3A' },
          position: { x: 100, y: 100 },
          size: { width: 240, height: 180 },
        }]}
        edges={[]}
        currentGroup={null}
        zoom={1}
        viewport={{ x: 0, y: 0, zoom: 1 }}
        calibration={{ phase: 'ready', roiStep: 4, pinchCycles: 3, awaitingRelease: false, message: 'ready' }}
        onReady={vi.fn()}
        onPointerStart={vi.fn()}
        onPointerMove={vi.fn()}
        onPointerEnd={vi.fn()}
        onEraseAtPoint={vi.fn(() => false)}
        onPan={vi.fn()}
        onSuggestSelection={vi.fn(() => true)}
        onGenerateCard={vi.fn()}
        onContinueGroup={vi.fn()}
        onCancelGroup={vi.fn()}
        onMoveCard={onMoveCard}
        onResizeCard={vi.fn()}
        onRenameCard={vi.fn()}
        onUpdateTextCard={vi.fn()}
        onDeleteCard={vi.fn()}
        onCreateEdge={vi.fn(() => true)}
        onUpdateEdge={vi.fn()}
        onEdgeTypeChange={vi.fn()}
      />,
    )

    const textarea = screen.getByRole('textbox', { name: '编辑文字卡片 文字卡片' })
    fireEvent.pointerDown(textarea, { pointerId: 4, button: 0, clientX: 140, clientY: 160 })
    fireEvent.pointerMove(textarea, { pointerId: 4, clientX: 260, clientY: 240 })
    fireEvent.pointerUp(textarea, { pointerId: 4, clientX: 260, clientY: 240 })

    expect(onMoveCard).not.toHaveBeenCalled()
  })

  it('uses Shift selection to move multiple cards in one batch command', () => {
    const onMoveCard = vi.fn()
    const onMoveCards = vi.fn()
    render(
      <WorkspaceCanvas
        inputMode="mouse"
        experimentalStylesEnabled
        reducedMotion={false}
        tool="select"
        edgeType="undirected"
        strokes={[]}
        cards={[
          { id: 'card-1', kind: 'ink', strokeIds: [], title: '第一张', position: { x: 100, y: 100 }, size: { width: 240, height: 180 } },
          { id: 'card-2', kind: 'ink', strokeIds: [], title: '第二张', position: { x: 400, y: 200 }, size: { width: 240, height: 180 } },
        ]}
        edges={[]}
        currentGroup={null}
        zoom={1}
        viewport={{ x: 0, y: 0, zoom: 1 }}
        calibration={{ phase: 'ready', roiStep: 4, pinchCycles: 3, awaitingRelease: false, message: 'ready' }}
        onReady={vi.fn()}
        onPointerStart={vi.fn()}
        onPointerMove={vi.fn()}
        onPointerEnd={vi.fn()}
        onEraseAtPoint={vi.fn(() => false)}
        onPan={vi.fn()}
        onSuggestSelection={vi.fn(() => true)}
        onGenerateCard={vi.fn()}
        onContinueGroup={vi.fn()}
        onCancelGroup={vi.fn()}
        onMoveCard={onMoveCard}
        onMoveCards={onMoveCards}
        onResizeCard={vi.fn()}
        onRenameCard={vi.fn()}
        onUpdateTextCard={vi.fn()}
        onDeleteCard={vi.fn()}
        onCreateEdge={vi.fn(() => true)}
        onUpdateEdge={vi.fn()}
        onEdgeTypeChange={vi.fn()}
      />,
    )

    const first = screen.getByText('第一张').closest('.idea-card__title')!
    const second = screen.getByText('第二张').closest('.idea-card__title')!
    fireEvent.pointerDown(first, { pointerId: 1, button: 0, clientX: 120, clientY: 120 })
    fireEvent.pointerUp(first, { pointerId: 1, clientX: 120, clientY: 120 })
    fireEvent.pointerDown(second, { pointerId: 2, button: 0, shiftKey: true, clientX: 420, clientY: 220 })
    fireEvent.pointerUp(second, { pointerId: 2, clientX: 420, clientY: 220 })
    expect(document.querySelectorAll('.idea-card--selected')).toHaveLength(2)

    fireEvent.pointerDown(first, { pointerId: 3, button: 0, clientX: 120, clientY: 120 })
    fireEvent.pointerMove(first, { pointerId: 3, clientX: 170, clientY: 160 })
    fireEvent.pointerUp(first, { pointerId: 3, clientX: 170, clientY: 160 })

    expect(onMoveCards).toHaveBeenCalledWith([
      { cardId: 'card-1', x: 150, y: 140 },
      { cardId: 'card-2', x: 450, y: 240 },
    ], expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }))
    expect(onMoveCard).not.toHaveBeenCalled()
  })
})
