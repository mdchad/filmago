import { useEffect, useState, type RefObject } from 'react'

export type Facing = 'environment' | 'user'

export type CameraState =
  | { status: 'starting' }
  | { status: 'live'; width: number; height: number }
  | { status: 'error'; message: string }

const constraintsFor = (facing: Facing): MediaStreamConstraints => ({
  audio: false,
  video: {
    facingMode: { ideal: facing },
    // Ask high; the browser returns the closest mode the camera supports.
    width: { ideal: 4032 },
    height: { ideal: 3024 },
  },
})

function describeError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError') return 'Camera access was denied. Allow it in your browser settings.'
    if (err.name === 'NotFoundError') return 'No camera was found on this device.'
    if (err.name === 'NotReadableError') return 'The camera is in use by another app.'
  }
  return err instanceof Error ? err.message : String(err)
}

/**
 * Streams the requested camera into `videoRef`. Changing `facing` stops
 * the old tracks before asking for a fresh stream.
 */
export function useCameraStream(videoRef: RefObject<HTMLVideoElement | null>, facing: Facing): CameraState {
  // Tagged with the facing it belongs to, so a toggle reads as 'starting' until the new stream is up.
  const [result, setResult] = useState<{ facing: Facing; state: CameraState }>()

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let stream: MediaStream | undefined
    let cancelled = false

    const request = navigator.mediaDevices?.getUserMedia
      ? navigator.mediaDevices.getUserMedia(constraintsFor(facing))
      : Promise.reject(new Error('Camera access needs HTTPS and a browser with getUserMedia.'))

    request
      .then(async (s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        video.srcObject = s
        await video.play().catch(() => {
          // autoPlay will retry; a rejected play() here is usually an interrupted load.
        })
        if (!cancelled) {
          setResult({ facing, state: { status: 'live', width: video.videoWidth, height: video.videoHeight } })
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setResult({ facing, state: { status: 'error', message: describeError(err) } })
      })

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
      if (video.srcObject === stream) video.srcObject = null
    }
  }, [videoRef, facing])

  return result?.facing === facing ? result.state : { status: 'starting' }
}
