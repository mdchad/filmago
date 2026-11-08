import { describe, expect, it } from 'vitest'
import { captureSize } from './capture.ts'

describe('captureSize', () => {
  it('caps the long edge at 3000px and keeps the aspect ratio', () => {
    expect(captureSize(4032, 3024)).toEqual({ width: 3000, height: 2250 })
    expect(captureSize(2160, 3840)).toEqual({ width: 1688, height: 3000 })
  })

  it('never upscales', () => {
    expect(captureSize(1920, 1080)).toEqual({ width: 1920, height: 1080 })
  })
})
