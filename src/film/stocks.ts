import type { FilmFormat, FilmStock } from './types.ts'

/** Warm, forgiving portrait color negative: soft contrast, gentle highlight rolloff. */
export const marigold400: FilmStock = {
  id: 'marigold-400',
  name: 'Marigold 400',
  format: '35mm',
  iso: 400,
  exposures: 36,
  colorMatrix: [
    1.08, 0.0, -0.08,
    0.02, 1.0, -0.02,
    -0.04, 0.06, 0.94,
  ],
  curves: {
    r: [0.07, 0.3, 0.55, 0.78, 0.95],
    g: [0.06, 0.28, 0.52, 0.76, 0.94],
    b: [0.08, 0.27, 0.49, 0.72, 0.9],
  },
  grain: { amount: 0.07, size: 1.4 },
  halation: { threshold: 0.82, strength: 0.25, tint: [1, 0.45, 0.2] },
  vignette: 0.25,
  monochrome: false,
}

/** Punchy black & white: deep blacks, bright whites, coarse grain. */
export const ironside400: FilmStock = {
  id: 'ironside-400',
  name: 'Ironside 400',
  format: '35mm',
  iso: 400,
  exposures: 36,
  // Identical rows: a panchromatic response with a slight red-filter bias.
  colorMatrix: [
    0.36, 0.5, 0.14,
    0.36, 0.5, 0.14,
    0.36, 0.5, 0.14,
  ],
  curves: {
    r: [0.02, 0.15, 0.5, 0.87, 1],
    g: [0.02, 0.15, 0.5, 0.87, 1],
    b: [0.02, 0.15, 0.5, 0.87, 1],
  },
  grain: { amount: 0.14, size: 1.8 },
  halation: { threshold: 0.9, strength: 0.08, tint: [1, 1, 1] },
  vignette: 0.35,
  monochrome: true,
}

/** Tungsten-balanced cinema stock: cool in daylight, teal shadows, strong red halation. */
export const sodium500t: FilmStock = {
  id: 'sodium-500t',
  name: 'Sodium 500T',
  format: '35mm',
  iso: 500,
  exposures: 24,
  colorMatrix: [
    0.9, 0.08, 0.02,
    0.0, 1.0, 0.02,
    0.02, 0.06, 1.1,
  ],
  curves: {
    r: [0.05, 0.25, 0.5, 0.77, 0.97],
    g: [0.06, 0.27, 0.52, 0.78, 0.97],
    b: [0.09, 0.31, 0.55, 0.79, 0.96],
  },
  grain: { amount: 0.09, size: 1.5 },
  halation: { threshold: 0.7, strength: 0.6, tint: [1, 0.25, 0.08] },
  vignette: 0.2,
  monochrome: false,
}

/**
 * Instant color: soft contrast, cool cyan shadows, creamy warm highlights,
 * gently muted color. Fine grain and almost no halation.
 */
export const daybreakInstant: FilmStock = {
  id: 'daybreak-instant',
  name: 'Daybreak Instant',
  format: 'instant',
  iso: 640,
  exposures: 10,
  colorMatrix: [
    0.9, 0.1, 0.0,
    0.04, 0.88, 0.08,
    0.02, 0.1, 0.88,
  ],
  curves: {
    r: [0.08, 0.27, 0.55, 0.82, 0.96],
    g: [0.11, 0.3, 0.55, 0.8, 0.94],
    b: [0.15, 0.32, 0.53, 0.75, 0.86],
  },
  grain: { amount: 0.045, size: 1.2 },
  halation: { threshold: 0.92, strength: 0.06, tint: [1, 0.85, 0.7] },
  vignette: 0.4,
  monochrome: false,
}

/** Instant black & white: silvery, low contrast, slightly warm paper tone. */
export const ashenInstant: FilmStock = {
  id: 'ashen-instant',
  name: 'Ashen Instant',
  format: 'instant',
  iso: 640,
  exposures: 10,
  colorMatrix: [
    0.3, 0.58, 0.12,
    0.3, 0.58, 0.12,
    0.3, 0.58, 0.12,
  ],
  curves: {
    r: [0.1, 0.3, 0.56, 0.82, 0.95],
    g: [0.09, 0.29, 0.55, 0.81, 0.94],
    b: [0.08, 0.27, 0.52, 0.78, 0.91],
  },
  grain: { amount: 0.06, size: 1.3 },
  halation: { threshold: 0.95, strength: 0.03, tint: [1, 1, 1] },
  vignette: 0.45,
  monochrome: true,
}

export const FILM_STOCKS: readonly FilmStock[] = [
  marigold400,
  ironside400,
  sodium500t,
  daybreakInstant,
  ashenInstant,
]

export const stocksForFormat = (format: FilmFormat) => FILM_STOCKS.filter((s) => s.format === format)

export function getStock(id: string): FilmStock {
  const stock = FILM_STOCKS.find((s) => s.id === id)
  if (!stock) throw new Error(`Unknown film stock: ${id}`)
  return stock
}
