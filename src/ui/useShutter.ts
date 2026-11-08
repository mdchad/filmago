import { useCallback, useRef, useState, type RefObject } from 'react'
import { captureFrame } from '../camera/capture.ts'
import type { FilmStock } from '../film/index.ts'
import type { CapturedFrame, FilmRenderer } from '../gpu/FilmRenderer.ts'
import { useRollStore } from '../roll/rollStore.ts'
import { isRollFinished, type Roll } from '../roll/types.ts'

export const DEVELOP_MS = 2500
/** How long the developed frame stays up before the live view returns. */
const HOLD_MS = 700

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

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

type ShutterOptions = {
  renderer: FilmRenderer | undefined
  videoRef: RefObject<HTMLVideoElement | null>
  roll: Roll | undefined
  stock: FilmStock | undefined
}

export function useShutter({ renderer, videoRef, roll, stock }: ShutterOptions) {
  const claimShot = useRollStore((s) => s.claimShot)
  const saveFrame = useRollStore((s) => s.saveFrame)
  const [developing, setDeveloping] = useState(false)
  const [blinkCount, setBlinkCount] = useState(0)
  const [error, setError] = useState<string>()
  const busy = useRef(false)

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
    const bitmapPromise = captureFrame(video)
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

      setDeveloping(true)
      const captured = frame
      const encoded = renderer.encode(captured)
      await animate(DEVELOP_MS, (p) => renderer.drawDevelop(captured, easeOutCubic(p)))
      const { image, thumbnail, width, height } = await encoded
      await saveFrame({ rollId: roll.id, frameNumber, seed, stockId: roll.stockId, image, thumbnail, width, height })
      await delay(HOLD_MS)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (frame) renderer.release(frame)
      setDeveloping(false)
      busy.current = false
    }
  }, [renderer, videoRef, roll, stock, claimShot, saveFrame])

  return { shoot, ready, developing, blinkCount, error }
}
