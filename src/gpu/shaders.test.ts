import { common, tgpu } from 'typegpu'
import { describe, expect, it } from 'vitest'
import { blurFragment, brightFragment, developFragment, filmFragment, previewFragment } from './shaders.ts'

describe('film shaders', () => {
  it.each([
    ['bright', brightFragment],
    ['blur', blurFragment],
    ['film', filmFragment],
    ['develop', developFragment],
    ['preview', previewFragment],
  ])('%s pass resolves to WGSL', (_, fragment) => {
    const wgsl = tgpu.resolve([common.fullScreenTriangle, fragment])
    expect(wgsl).toContain('@fragment')
    expect(wgsl).toContain('@vertex')
  })
})
