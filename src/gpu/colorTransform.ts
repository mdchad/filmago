import { d, std } from 'typegpu'
import { CURVE_LUT_SIZE } from '../film/index.ts'
import { filmLayout } from './layouts.ts'

export const luminance = (c: d.v3f): number => {
  'use gpu'
  return std.dot(c, d.vec3f(0.2126, 0.7152, 0.0722))
}

/** Linearly interpolated lookup into the baked curve LUT, all three channels at once. */
const curveAt = (x: number): d.v3f => {
  'use gpu'
  const pos = std.saturate(x) * (CURVE_LUT_SIZE - 1)
  const i0 = d.u32(std.floor(pos))
  const i1 = std.min(i0 + 1, CURVE_LUT_SIZE - 1)
  const curve = filmLayout.$.params.curve
  return std.mix(curve[i0].xyz, curve[i1].xyz, std.fract(pos))
}

/**
 * Stage 1 of the film look: the stock's color response.
 *
 * This is the only place that knows how a stock maps scene color to film
 * color (3x3 matrix, then per-channel curves). A 3D LUT (.cube) can replace
 * it by swapping this function for a `textureSampleLevel` into a 3D texture
 * bound on `filmLayout`; nothing else in the pipeline needs to change.
 */
export const applyColorTransform = (rgb: d.v3f): d.v3f => {
  'use gpu'
  const matrixed = std.saturate(rgb.mul(filmLayout.$.params.colorMatrix))
  const graded = std.mix(matrixed, d.vec3f(luminance(matrixed)), filmLayout.$.params.monochrome)
  return d.vec3f(curveAt(graded.x).x, curveAt(graded.y).y, curveAt(graded.z).z)
}
