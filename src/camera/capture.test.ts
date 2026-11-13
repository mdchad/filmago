import { describe, expect, it } from 'vitest'
import { captureSize, cropRect } from './capture.ts'

describe('captureSize', () => {
  it('caps the long edge at 3000px and keeps the aspect ratio', () => {
    expect(captureSize(4032, 3024)).toEqual({ width: 3000, height: 2250 })
    expect(captureSize(2160, 3840)).toEqual({ width: 1688, height: 3000 })
  })

  it('never upscales', () => {
    expect(captureSize(1920, 1080)).toEqual({ width: 1920, height: 1080 })
  })
})

describe('cropRect', () => {
  it('keeps the whole frame for 35mm', () => {
    expect(cropRect(1920, 1440, 'full')).toEqual({ x: 0, y: 0, width: 1920, height: 1440 })
  })

  it('takes the centered square for instant prints, in either orientation', () => {
    expect(cropRect(1920, 1440, 'square')).toEqual({ x: 240, y: 0, width: 1440, height: 1440 })
    expect(cropRect(1440, 1920, 'square')).toEqual({ x: 0, y: 240, width: 1440, height: 1440 })
    expect(cropRect(1000, 1000, 'square')).toEqual({ x: 0, y: 0, width: 1000, height: 1000 })
  })
})
