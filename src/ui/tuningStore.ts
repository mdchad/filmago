import { create } from 'zustand'
import { getStock, type FilmStock } from '../film/index.ts'

type TuningState = {
  /** Dev-only edits to a stock's parameters, keyed by stock id. */
  overrides: Record<string, FilmStock>
  /** Render the full film look in the viewfinder instead of the light preview grade. */
  fullLook: boolean
  setStock(stock: FilmStock): void
  reset(stockId: string): void
  setFullLook(fullLook: boolean): void
}

export const useTuningStore = create<TuningState>()((set) => ({
  overrides: {},
  fullLook: false,
  setStock: (stock) => set((s) => ({ overrides: { ...s.overrides, [stock.id]: stock } })),
  reset: (stockId) =>
    set((s) => {
      const { [stockId]: _removed, ...rest } = s.overrides
      return { overrides: rest }
    }),
  setFullLook: (fullLook) => set({ fullLook }),
}))

/** The stock as the renderer should see it: tuned in development, as shipped otherwise. */
export function useEffectiveStock(stockId: string | undefined): FilmStock | undefined {
  const override = useTuningStore((s) => (stockId ? s.overrides[stockId] : undefined))
  if (!stockId) return undefined
  return import.meta.env.DEV && override ? override : getStock(stockId)
}
