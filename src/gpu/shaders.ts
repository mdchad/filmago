import { d, std, tgpu } from 'typegpu'
import { applyColorTransform, luminance } from './colorTransform.ts'
import { blurLayout, brightLayout, developLayout, filmLayout, previewLayout } from './layouts.ts'

/** Grain cells are sized relative to this short edge, so preview and capture match. */
const GRAIN_REFERENCE_EDGE = 1200

// "Hash without sine" (Dave Hoskins): stable on mobile GPUs at pixel-scale inputs.
const hash12 = (p: d.v2f): number => {
  'use gpu'
  let p3 = std.fract(d.vec3f(p.x, p.y, p.x).mul(0.1031))
  p3 = p3.add(std.dot(p3, p3.yzx.add(33.33)))
  return std.fract((p3.x + p3.y) * p3.z)
}

const valueNoise = (p: d.v2f): number => {
  'use gpu'
  const cell = std.floor(p)
  const f = std.fract(p)
  const u = f.mul(f).mul(d.vec2f(3).sub(f.mul(2)))
  const a = hash12(cell)
  const b = hash12(cell.add(d.vec2f(1, 0)))
  const c = hash12(cell.add(d.vec2f(0, 1)))
  const e = hash12(cell.add(d.vec2f(1, 1)))
  return std.mix(std.mix(a, b, u.x), std.mix(c, e, u.x), u.y)
}

/** Two octaves: clumps plus fine structure. Roughly centred on 0.5. */
const grainNoise = (p: d.v2f): number => {
  'use gpu'
  return valueNoise(p) * 0.65 + valueNoise(p.mul(2.3).add(d.vec2f(57.1, 13.7))) * 0.35
}

const sampleSrc = (uv: d.v2f): d.v3f => {
  'use gpu'
  return std.textureSample(brightLayout.$.src, brightLayout.$.samp, uv).rgb
}

/**
 * Halation step 1: extract highlights from the source frame into a
 * quarter-resolution target. Four bilinear taps average a 4x4 source block.
 */
export const brightFragment = tgpu.fragmentFn({
  in: { uv: d.vec2f },
  out: d.vec4f,
})(({ uv }) => {
  const texel = d.vec2f(1).div(d.vec2f(std.textureDimensions(brightLayout.$.src)))
  const sum = sampleSrc(uv.add(texel.mul(d.vec2f(-1, -1))))
    .add(sampleSrc(uv.add(texel.mul(d.vec2f(1, -1)))))
    .add(sampleSrc(uv.add(texel.mul(d.vec2f(-1, 1)))))
    .add(sampleSrc(uv.add(texel.mul(d.vec2f(1, 1)))))
  const color = sum.mul(0.25)
  const threshold = brightLayout.$.params.halationThreshold
  const mask = std.smoothstep(threshold, threshold + 0.15, luminance(color))
  return d.vec4f(color.mul(mask), 1)
})

/** Halation step 2: one direction of a separable 13-tap gaussian. */
export const blurFragment = tgpu.fragmentFn({
  in: { uv: d.vec2f },
  out: d.vec4f,
})(({ uv }) => {
  const step = blurLayout.$.blur.step
  let acc = d.vec3f()
  let total = d.f32(0)
  for (let i = -6; i <= 6; i++) {
    const offset = d.f32(i)
    const weight = std.exp((offset * offset) / -18)
    const tap = std.textureSample(blurLayout.$.src, blurLayout.$.samp, uv.add(step.mul(offset))).rgb
    acc = acc.add(tap.mul(weight))
    total = total + weight
  }
  return d.vec4f(acc.div(total), 1)
})

/** The full film look: color, halation, grain, vignette. */
export const filmFragment = tgpu.fragmentFn({
  in: { uv: d.vec2f },
  out: d.vec4f,
})(({ uv }) => {
  const params = filmLayout.$.params
  const source = std.textureSample(filmLayout.$.src, filmLayout.$.samp, uv).rgb

  // 1. Color response.
  let color = applyColorTransform(source)

  // 2. Halation: the blurred highlights bleed back in, tinted by the film base.
  const glow = luminance(std.textureSample(filmLayout.$.halation, filmLayout.$.samp, uv).rgb)
  color = color.add(params.halationTint.mul(glow * params.halationStrength))
  color = std.mix(color, d.vec3f(luminance(color)), params.monochrome)

  // 3. Grain: strongest in the midtones, seeded per frame.
  const cellSize = (std.min(params.resolution.x, params.resolution.y) / GRAIN_REFERENCE_EDGE) * params.grainSize
  const seedOffset = d.vec2f(params.seed * 1.37, params.seed * 0.73)
  const p = uv.mul(params.resolution).div(cellSize).add(seedOffset)
  const lum = std.saturate(luminance(color))
  const response = 0.15 + 3.4 * lum * (1 - lum)
  const mono = d.vec3f(grainNoise(p))
  const chroma = d.vec3f(
    grainNoise(p.add(d.vec2f(101.3, 7.9))),
    grainNoise(p.add(d.vec2f(17.1, 211.7))),
    grainNoise(p.add(d.vec2f(311.9, 89.3))),
  )
  const noise = std.mix(mono, chroma, 0.35 * (1 - params.monochrome)).sub(0.5)
  color = color.add(noise.mul(params.grainAmount * response * 2))

  // 4. Vignette, measured to the frame corners.
  const q = uv.sub(0.5).mul(2)
  const falloff = std.smoothstep(0.4, 2, std.dot(q, q))
  color = color.mul(1 - params.vignette * falloff)

  return d.vec4f(std.saturate(color), 1)
})

/**
 * Develop animation over a finished frame. `progress` 0 is a flat milky
 * grey-green; shadows emerge first, then midtones, then saturation, with a
 * passing warm cast. At `progress >= 1` the finished frame is returned untouched.
 */
export const developFragment = tgpu.fragmentFn({
  in: { uv: d.vec2f },
  out: d.vec4f,
})(({ uv }) => {
  const final = std.textureSample(developLayout.$.src, developLayout.$.samp, uv)
  const t = std.saturate(developLayout.$.develop.progress)
  const lum = luminance(final.rgb)

  // Each pixel appears once the developer reaches its density: dark first, bright last.
  const emerge = std.smoothstep(0, 1, std.saturate((t - 0.55 * lum) / 0.45))
  const saturation = std.smoothstep(0.4, 1, t)
  const toned = std.mix(d.vec3f(lum), final.rgb, saturation)
  let color = std.mix(d.vec3f(0.66, 0.69, 0.62), toned, emerge)

  const warmth = 0.08 * std.smoothstep(0, 0.2, t) * (1 - std.smoothstep(0.3, 1, t))
  color = color.mul(d.vec3f(1 + warmth, 1 + warmth * 0.3, 1 - warmth * 0.6))

  return std.select(d.vec4f(std.saturate(color), 1), final, t >= 1)
})

/** Light viewfinder grade: a hint of contrast and warmth, not the film look. */
export const previewFragment = tgpu.fragmentFn({
  in: { uv: d.vec2f },
  out: d.vec4f,
})(({ uv }) => {
  const c = std.textureSample(previewLayout.$.src, previewLayout.$.samp, uv).rgb
  const contrasted = std.mix(c, std.smoothstep(d.vec3f(0), d.vec3f(1), c), 0.3)
  return d.vec4f(std.saturate(contrasted.mul(d.vec3f(1.02, 1, 0.97))), 1)
})
