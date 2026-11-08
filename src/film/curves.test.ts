import { describe, expect, it } from 'vitest'
import { CURVE_LUT_SIZE, bakeCurveLut, evaluateCurve } from './curves.ts'

describe('evaluateCurve', () => {
  it('passes through every control point', () => {
    const points = [0.05, 0.3, 0.55, 0.8, 0.95]
    points.forEach((y, i) => {
      expect(evaluateCurve(points, i / (points.length - 1))).toBeCloseTo(y, 10)
    })
  })

  it('reproduces the identity for linear points', () => {
    const identity = [0, 0.25, 0.5, 0.75, 1]
    for (let x = 0; x <= 1; x += 0.01) {
      expect(evaluateCurve(identity, x)).toBeCloseTo(x, 10)
    }
  })

  it('clamps inputs outside [0, 1]', () => {
    const points = [0.1, 0.5, 0.9]
    expect(evaluateCurve(points, -1)).toBeCloseTo(0.1)
    expect(evaluateCurve(points, 2)).toBeCloseTo(0.9)
  })

  it('stays monotone and does not overshoot for monotone points', () => {
    // A steep S-curve with a flat toe is the classic overshoot case.
    const points = [0, 0, 0.1, 0.9, 1]
    let previous = -Infinity
    for (let i = 0; i <= 1000; i++) {
      const y = evaluateCurve(points, i / 1000)
      expect(y).toBeGreaterThanOrEqual(previous - 1e-12)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(1)
      previous = y
    }
  })

  it('works with the minimum of two points', () => {
    expect(evaluateCurve([0.2, 0.8], 0.5)).toBeCloseTo(0.5)
  })

  it('rejects curves with fewer than two points', () => {
    expect(() => evaluateCurve([0.5], 0.5)).toThrow()
  })
})

describe('bakeCurveLut', () => {
  it('produces interleaved RGBA entries matching each channel curve', () => {
    const curves = { r: [0, 1], g: [1, 0], b: [0.5, 0.5] }
    const lut = bakeCurveLut(curves)
    expect(lut).toHaveLength(CURVE_LUT_SIZE * 4)
    const last = (CURVE_LUT_SIZE - 1) * 4
    expect([lut[0], lut[1], lut[2], lut[3]]).toEqual([0, 1, 0.5, 1])
    expect([lut[last], lut[last + 1], lut[last + 2], lut[last + 3]]).toEqual([1, 0, 0.5, 1])
  })
})
