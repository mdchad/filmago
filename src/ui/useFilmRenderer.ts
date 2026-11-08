import { useEffect, useState, type RefObject } from 'react'
import type { TgpuRoot } from 'typegpu'
import { FilmRenderer } from '../gpu/FilmRenderer.ts'

/** One renderer per GPU root; a new root (after device loss) rebuilds everything. */
export function useFilmRenderer(root: TgpuRoot | undefined, canvasRef: RefObject<HTMLCanvasElement | null>) {
  const [renderer, setRenderer] = useState<FilmRenderer>()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!root || !canvas) return
    const next = new FilmRenderer(root, canvas)
    setRenderer(next)
    return () => {
      setRenderer(undefined)
      next.destroy()
    }
  }, [root, canvasRef])

  return renderer
}
