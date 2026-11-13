import { useState, type CSSProperties } from 'react'
import { stocksForFormat, type FilmFormat } from '../film/index.ts'
import { stockStyle } from './stockStyle.ts'

type StockPickerProps = {
  format: FilmFormat
  onLoad(stockId: string): Promise<unknown>
  onCancel?: () => void
}

export function StockPicker({ format, onLoad, onCancel }: StockPickerProps) {
  const instant = format === 'instant'
  const [loading, setLoading] = useState<string>()
  const [error, setError] = useState<string>()

  const load = async (stockId: string) => {
    setLoading(stockId)
    setError(undefined)
    try {
      await onLoad(stockId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setLoading(undefined)
    }
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="stock-picker-title">
      <div className="sheet">
        <header className="sheet-header">
          <h2 id="stock-picker-title">{instant ? 'Load a pack' : 'Load a roll'}</h2>
          {onCancel && (
            <button type="button" className="text-button" onClick={onCancel}>
              Cancel
            </button>
          )}
        </header>
        <p className="sheet-hint">
          {instant ? 'Ten prints. The pack stays loaded until the last one.' : 'The stock stays loaded until the last frame.'}
        </p>
        <ul className="stock-list">
          {stocksForFormat(format).map((stock) => {
            const style = stockStyle(stock.id)
            return (
              <li key={stock.id}>
                <button
                  type="button"
                  className="stock-card"
                  disabled={loading !== undefined}
                  onClick={() => void load(stock.id)}
                >
                  <span className={instant ? 'pack' : 'canister'} style={{ '--canister': style.color } as CSSProperties}>
                    <span>{stock.iso}</span>
                  </span>
                  <span className="stock-text">
                    <span className="stock-name">{stock.name}</span>
                    <span className="stock-tagline">{style.tagline}</span>
                    <span className="stock-meta">
                      ISO {stock.iso} · {stock.exposures} exp{stock.monochrome ? ' · B&W' : ''}
                    </span>
                  </span>
                  {loading === stock.id && <span className="stock-loading">Loading…</span>}
                </button>
              </li>
            )
          })}
        </ul>
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  )
}
