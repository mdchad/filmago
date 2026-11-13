import { describe, expect, it } from 'vitest'
import { evaluateCurve } from './curves.ts'
import { FILM_STOCKS, getStock, stocksForFormat } from './stocks.ts'

describe('film stocks', () => {
  it('ships three 35mm stocks and two instant stocks, all with unique ids', () => {
    expect(stocksForFormat('35mm')).toHaveLength(3)
    expect(stocksForFormat('instant')).toHaveLength(2)
    expect(new Set(FILM_STOCKS.map((s) => s.id)).size).toBe(FILM_STOCKS.length)
  })

  it('offers one monochrome stock per format', () => {
    expect(stocksForFormat('35mm').filter((s) => s.monochrome)).toHaveLength(1)
    expect(stocksForFormat('instant').filter((s) => s.monochrome)).toHaveLength(1)
  })

  it('sizes rolls and packs by format', () => {
    for (const s of stocksForFormat('35mm')) expect([24, 36]).toContain(s.exposures)
    for (const s of stocksForFormat('instant')) expect(s.exposures).toBe(10)
  })

  it.each(FILM_STOCKS)('$name has well-formed parameters', (stock) => {
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

  it.each(FILM_STOCKS.filter((s) => s.monochrome))('$name has identical matrix rows', (mono) => {
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
