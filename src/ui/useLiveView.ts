import { useEffect, useRef, type RefObject } from 'react'
import type { FilmStock } from '../film/index.ts'
import type { Crop } from '../camera/capture.ts'
import { PreviewSource } from '../camera/PreviewSource.ts'
import type { FilmRenderer } from '../gpu/FilmRenderer.ts'

type LiveViewOptions = {
  renderer: FilmRenderer | undefined
  videoRef: RefObject<HTMLVideoElement | null>
  /** False until the camera stream is playing. */
  active: boolean
  stock: FilmStock | undefined
  fullLook: boolean
  paused: boolean
  crop?: Crop
}

/** Draws every new camera frame to the viewfinder until paused. */
export function useLiveView({ renderer, videoRef, active, stock, fullLook, paused, crop = 'full' }: LiveViewOptions) {
  // Read through refs so tuning changes don't restart the frame loop.
  const settings = useRef({ stock, fullLook })
  useEffect(() => {
    settings.current = { stock, fullLook }
  }, [stock, fullLook])

  useEffect(() => {
    const video = videoRef.current
    if (!renderer || !video || !active || paused) return
    let stopped = false
    let handle = 0
    const source = new PreviewSource()
    const useVideoCallback = 'requestVideoFrameCallback' in video

    const schedule = () => {
      handle = useVideoCallback ? video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick)
    }
    const tick = () => {
      if (stopped) return
      const { stock: current, fullLook: full } = settings.current
      if (current && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        try {
          const frame = source.grab(video, crop)
          if (frame) renderer.drawLive(frame, current, { fullLook: full, seed: Math.random() * 1000 })
        } catch (err) {
          // A lost device surfaces here first; recovery is handled by useGpuRoot.
          console.error(err)
        }
      }
      schedule()
    }

    schedule()
    return () => {
      stopped = true
      if (useVideoCallback) video.cancelVideoFrameCallback(handle)
      else cancelAnimationFrame(handle)
    }
  }, [renderer, videoRef, active, paused, crop])
}
