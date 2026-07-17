import '@testing-library/jest-dom/vitest'

class ResizeObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: ResizeObserverMock,
})

Object.defineProperty(window, 'PointerEvent', {
  configurable: true,
  value: MouseEvent,
})

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: () => ({
    setTransform() {},
    clearRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    arc() {},
    stroke() {},
    fill() {},
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    shadowColor: 'transparent',
    shadowBlur: 0,
  }),
})

const capturedPointers = new WeakMap<Element, Set<number>>()

Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', {
  configurable: true,
  value(pointerId: number) {
    const pointers = capturedPointers.get(this) ?? new Set<number>()
    pointers.add(pointerId)
    capturedPointers.set(this, pointers)
  },
})

Object.defineProperty(HTMLCanvasElement.prototype, 'hasPointerCapture', {
  configurable: true,
  value(pointerId: number) {
    return capturedPointers.get(this)?.has(pointerId) ?? false
  },
})

Object.defineProperty(HTMLCanvasElement.prototype, 'releasePointerCapture', {
  configurable: true,
  value(pointerId: number) {
    capturedPointers.get(this)?.delete(pointerId)
  },
})
