/**
 * A tone curve as evenly spaced output values: `points[i]` is the output for
 * input `i / (points.length - 1)`. At least two points; values in [0, 1].
 */
export type CurvePoints = number[]

export type FilmStock = {
  id: string
  name: string
  iso: number
  exposures: 24 | 36
  /** Row-major 3x3 matrix applied to RGB before the tone curves. */
  colorMatrix: number[]
  curves: { r: CurvePoints; g: CurvePoints; b: CurvePoints }
  grain: { amount: number; size: number }
  halation: { threshold: number; strength: number; tint: [number, number, number] }
  vignette: number
  monochrome: boolean
}
