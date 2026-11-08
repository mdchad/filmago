/** Presentation-only copy for the stock picker. Rendering parameters live in `src/film`. */
export const STOCK_STYLE: Record<string, { tagline: string; color: string }> = {
  'marigold-400': { tagline: 'Warm portrait color. Soft contrast, kind to skin.', color: '#e8a23a' },
  'ironside-400': { tagline: 'High-contrast black & white. Deep blacks, coarse grain.', color: '#d9d4c7' },
  'sodium-500t': { tagline: 'Tungsten cinema stock. Cool daylight, red halation.', color: '#d2452f' },
}

export const stockStyle = (id: string) => STOCK_STYLE[id] ?? { tagline: '', color: '#999' }
