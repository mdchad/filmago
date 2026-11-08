import { describe, expect, it } from 'vitest'
import { evaluateCurve } from './curves.ts'
import { FILM_STOCKS, getStock } from './stocks.ts'

describe('film stocks', () => {
  it('ships three stocks with unique ids', () => {
    expect(FILM_STOCKS).toHaveLength(3)
    expect(new Set(FILM_STOCKS.map((s) => s.id)).size).toBe(FILM_STOCKS.length)
  })

  it('includes one monochrome stock', () => {
    expect(FILM_STOCKS.filter((s) => s.monochrome)).toHaveLength(1)
  })

  it.each(FILM_STOCKS)('$name has well-formed parameters', (stock) => {
    expect([24, 36]).toContain(stock.exposures)
    expect(stock.iso).toBeGreaterThan(0)
    expect(stock.colorMatrix).toHaveLength(9)
    expect(stock.colorMatrix.every(Number.isFinite)).toBe(true)

    for (const points of [stock.curves.r, stock.curves.g, stock.curves.b]) {
      expect(points.length).toBeGreaterThanOrEqual(2)
      expect(points.every((y) => y >= 0 && y <= 1)).toBe(true)
      // Film curves must never invert tones.
      for (let i = 1; i < points.length; i++) expect(points[i]).toBeGreaterThanOrEqual(points[i - 1])
      // Lifted blacks: pure black maps above zero.
      expect(evaluateCurve(points, 0)).toBeGreaterThan(0)
    }

    expect(stock.grain.amount).toBeGreaterThanOrEqual(0)
    expect(stock.grain.size).toBeGreaterThan(0)
    expect(stock.halation.threshold).toBeGreaterThan(0)
    expect(stock.halation.threshold).toBeLessThan(1)
    expect(stock.halation.strength).toBeGreaterThanOrEqual(0)
    expect(stock.halation.tint).toHaveLength(3)
    expect(stock.vignette).toBeGreaterThanOrEqual(0)
    expect(stock.vignette).toBeLessThanOrEqual(1)
  })

  it('gives the monochrome stock identical matrix rows', () => {
    const mono = FILM_STOCKS.find((s) => s.monochrome)!
    const [r, g, b] = [0, 3, 6].map((i) => mono.colorMatrix.slice(i, i + 3))
    expect(g).toEqual(r)
    expect(b).toEqual(r)
  })

  it('gives the tungsten cinema stock the strongest red halation', () => {
    const cinema = getStock('sodium-500t')
    const strongest = Math.max(...FILM_STOCKS.map((s) => s.halation.strength))
    expect(cinema.halation.strength).toBe(strongest)
    const [r, g, b] = cinema.halation.tint
    expect(r).toBeGreaterThan(g)
    expect(r).toBeGreaterThan(b)
  })

  it('throws for an unknown stock id', () => {
    expect(() => getStock('nope')).toThrow(/Unknown film stock/)
  })
})
