import { describe, expect, it } from 'vitest'
import { PRINT_MM, printLayout } from './printExport.ts'

describe('printLayout', () => {
  it('keeps instant-print proportions around a square image', () => {
    const layout = printLayout(790)
    expect(layout.width).toBe(880)
    expect(layout.height).toBe(1070)
    expect(layout.width / layout.height).toBeCloseTo(PRINT_MM.width / PRINT_MM.height, 2)
  })

  it('centres the image with a much wider bottom border for the caption', () => {
    const layout = printLayout(1000)
    const left = layout.imageX
    const right = layout.width - layout.imageX - layout.imageSize
    const bottom = layout.height - layout.imageY - layout.imageSize
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1)
    expect(bottom).toBeGreaterThan(layout.imageY * 2.5)
  })

  it('places the caption inside the bottom border', () => {
    const layout = printLayout(1000)
    expect(layout.caption.y).toBeGreaterThan(layout.imageY + layout.imageSize)
    expect(layout.caption.y).toBeLessThan(layout.height)
    expect(layout.caption.maxWidth).toBeLessThan(layout.imageSize)
  })
})
