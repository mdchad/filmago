import type { CurvePoints, FilmStock } from './types.ts'

export const CURVE_LUT_SIZE = 256

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/**
 * Per-segment tangents for a monotone cubic Hermite spline (Fritsch–Carlson),
 * so a monotone set of points never overshoots between them.
 */
function monotoneTangents(ys: CurvePoints, h: number): number[] {
  const n = ys.length
  const slopes = Array.from({ length: n - 1 }, (_, i) => (ys[i + 1] - ys[i]) / h)
  const tangents = new Array<number>(n)
  tangents[0] = slopes[0]
  tangents[n - 1] = slopes[n - 2]
  for (let i = 1; i < n - 1; i++) {
    tangents[i] = slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2
  }
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = 0
      tangents[i + 1] = 0
      continue
    }
    const a = tangents[i] / slopes[i]
    const b = tangents[i + 1] / slopes[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      tangents[i] = t * a * slopes[i]
      tangents[i + 1] = t * b * slopes[i]
    }
  }
  return tangents
}

/** Evaluates evenly spaced curve points at `x` (clamped to [0, 1]). */
export function evaluateCurve(points: CurvePoints, x: number): number {
  if (points.length < 2) throw new Error('A curve needs at least two points')
  const segments = points.length - 1
  const h = 1 / segments
  const t = clamp01(x)
  const i = Math.min(segments - 1, Math.floor(t / h))
  const u = (t - i * h) / h
  const m = monotoneTangents(points, h)

  const u2 = u * u
  const u3 = u2 * u
  const value =
    (2 * u3 - 3 * u2 + 1) * points[i] +
    (u3 - 2 * u2 + u) * h * m[i] +
    (-2 * u3 + 3 * u2) * points[i + 1] +
    (u3 - u2) * h * m[i + 1]
  return clamp01(value)
}

/**
 * Bakes the stock's three curves into an interleaved RGBA float LUT
 * (`size` entries, alpha unused), ready to upload to the GPU.
 */
export function bakeCurveLut(curves: FilmStock['curves'], size = CURVE_LUT_SIZE): Float32Array {
  const lut = new Float32Array(size * 4)
  for (let i = 0; i < size; i++) {
    const x = i / (size - 1)
    lut[i * 4] = evaluateCurve(curves.r, x)
    lut[i * 4 + 1] = evaluateCurve(curves.g, x)
    lut[i * 4 + 2] = evaluateCurve(curves.b, x)
    lut[i * 4 + 3] = 1
  }
  return lut
}
