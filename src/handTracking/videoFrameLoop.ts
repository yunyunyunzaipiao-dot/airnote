export interface VideoFrameLoop {
  stop(): void
}

export function startVideoFrameLoop(video: HTMLVideoElement, onFrame: (timestamp: number) => void): VideoFrameLoop {
  let stopped = false
  let handle = 0
  let busy = false

  const processFrame = (timestamp: number) => {
    if (stopped) return

    if (!busy && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      busy = true
      try {
        onFrame(timestamp)
      } finally {
        busy = false
      }
    }

    schedule()
  }

  const schedule = () => {
    if (stopped) return
    handle = typeof video.requestVideoFrameCallback === 'function'
      ? video.requestVideoFrameCallback(processFrame)
      : requestAnimationFrame(processFrame)
  }

  schedule()

  return {
    stop() {
      stopped = true
      if (typeof video.cancelVideoFrameCallback === 'function') {
        video.cancelVideoFrameCallback(handle)
      } else {
        cancelAnimationFrame(handle)
      }
    },
  }
}
