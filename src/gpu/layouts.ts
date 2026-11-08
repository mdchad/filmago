import { d, tgpu } from 'typegpu'
import { CURVE_LUT_SIZE } from '../film/index.ts'

/** GPU mirror of a `FilmStock`, plus the per-frame seed and output size. */
export const FilmParams = d.struct({
  /** Built so that `rgb.mul(colorMatrix)` applies the stock's row-major matrix. */
  colorMatrix: d.mat3x3f,
  halationTint: d.vec3f,
  halationThreshold: d.f32,
  halationStrength: d.f32,
  grainAmount: d.f32,
  grainSize: d.f32,
  vignette: d.f32,
  /** 0 or 1, used as a mix factor so the shader stays branch-free. */
  monochrome: d.f32,
  seed: d.f32,
  resolution: d.vec2f,
  /** Baked per-channel tone curves (rgb), see `bakeCurveLut`. */
  curve: d.arrayOf(d.vec4f, CURVE_LUT_SIZE),
})

export const BlurParams = d.struct({
  /** UV offset between neighbouring taps, along the blur direction. */
  step: d.vec2f,
})

export const DevelopParams = d.struct({
  progress: d.f32,
})

// All shader resources go through bind groups so the shader code below is
// independent of any particular device: after a device loss only the
// pipelines and resources are rebuilt.

export const brightLayout = tgpu.bindGroupLayout({
  src: { texture: d.texture2d(d.f32) },
  samp: { sampler: 'filtering' },
  params: { uniform: FilmParams },
})

export const blurLayout = tgpu.bindGroupLayout({
  src: { texture: d.texture2d(d.f32) },
  samp: { sampler: 'filtering' },
  blur: { uniform: BlurParams },
})

export const filmLayout = tgpu.bindGroupLayout({
  src: { texture: d.texture2d(d.f32) },
  halation: { texture: d.texture2d(d.f32) },
  samp: { sampler: 'filtering' },
  params: { uniform: FilmParams },
})

export const developLayout = tgpu.bindGroupLayout({
  src: { texture: d.texture2d(d.f32) },
  samp: { sampler: 'filtering' },
  develop: { uniform: DevelopParams },
})

export const previewLayout = tgpu.bindGroupLayout({
  src: { texture: d.texture2d(d.f32) },
  samp: { sampler: 'filtering' },
})
