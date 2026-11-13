import { useCallback, useRef, useState, type RefObject } from 'react'
import { captureFrame, type Crop } from '../camera/capture.ts'
import type { FilmStock } from '../film/index.ts'
import type { CapturedFrame, FilmRenderer } from '../gpu/FilmRenderer.ts'
import { useRollStore } from '../roll/rollStore.ts'
import { isRollFinished, type Roll } from '../roll/types.ts'

export const DEVELOP_MS = 2500
/** How long the developed frame stays up before the live view returns. */
const HOLD_MS = 700

/** idle → developing (the image appears) → holding (the finished frame stays up) → idle */
export type ShutterPhase = 'idle' | 'developing' | 'holding'

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

function animate(durationMs: number, onFrame: (progress: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      onFrame(progress)
      if (progress < 1) requestAnimationFrame(step)
      else resolve()
    }
    requestAnimationFrame(step)
  })
}

type ShutterOptions = {
  renderer: FilmRenderer | undefined
  videoRef: RefObject<HTMLVideoElement | null>
  roll: Roll | undefined
  stock: FilmStock | undefined
  crop?: Crop
  developMs?: number
  holdMs?: number
  /** Where the develop plays; defaults to the viewfinder. */
  developCanvasRef?: RefObject<HTMLCanvasElement | null>
}

export function useShutter({
  renderer,
  videoRef,
  roll,
  stock,
  crop = 'full',
  developMs = DEVELOP_MS,
  holdMs = HOLD_MS,
  developCanvasRef,
}: ShutterOptions) {
  const claimShot = useRollStore((s) => s.claimShot)
  const saveFrame = useRollStore((s) => s.saveFrame)
  const [phase, setPhase] = useState<ShutterPhase>('idle')
  const [blinkCount, setBlinkCount] = useState(0)
  const [error, setError] = useState<string>()
  const busy = useRef(false)
  const endHold = useRef<() => void>(undefined)

  /** Ends the hold early, e.g. when the user taps the finished print. */
  const dismiss = useCallback(() => endHold.current?.(), [])

  const ready = Boolean(renderer && roll && stock && !isRollFinished(roll))

  const shoot = useCallback(async () => {
    const video = videoRef.current
    if (busy.current || !renderer || !video || !roll || !stock || isRollFinished(roll)) return
    busy.current = true
    setError(undefined)
    setBlinkCount((n) => n + 1)
    navigator.vibrate?.(25)

    // Grab the frame at the moment of the press; claiming runs alongside so
    // there's no shutter lag. The bitmap is discarded if the claim fails.
    const bitmapPromise = captureFrame(video, crop)
    let frame: CapturedFrame | undefined
    try {
      const { frameNumber } = await claimShot(roll.id).catch(async (err: unknown) => {
        ;(await bitmapPromise.catch(() => undefined))?.close()
        throw err
      })
      const bitmap = await bitmapPromise
      const seed = Math.random() * 1000
      try {
        frame = renderer.capture(bitmap, stock, seed)
      } finally {
        bitmap.close()
      }

      setPhase('developing')
      const captured = frame
      const target = developCanvasRef?.current ?? undefined
      const encoded = renderer.encode(captured)
      await animate(developMs, (p) => renderer.drawDevelop(captured, easeOutCubic(p), target))
      const { image, thumbnail, width, height } = await encoded
      await saveFrame({ rollId: roll.id, frameNumber, seed, stockId: roll.stockId, image, thumbnail, width, height })

      setPhase('holding')
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, holdMs)
        endHold.current = () => {
          clearTimeout(timer)
          resolve()
        }
      })
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (frame) renderer.release(frame)
      endHold.current = undefined
      setPhase('idle')
      busy.current = false
    }
  }, [renderer, videoRef, roll, stock, crop, developMs, holdMs, developCanvasRef, claimShot, saveFrame])

  return { shoot, dismiss, ready, phase, developing: phase !== 'idle', blinkCount, error }
}
