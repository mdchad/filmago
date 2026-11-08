import type { CSSProperties } from 'react'
import type { FilmStock } from '../film/index.ts'
import { stockStyle } from './stockStyle.ts'

type FilmWindowProps = {
  stock: FilmStock | undefined
  /** When set, the window works as a button, e.g. to load a new roll. */
  onActivate?: () => void
}

/** The memo window on the camera back that shows which film is loaded. */
export function FilmWindow({ stock, onActivate }: FilmWindowProps) {
  const content = stock ? (
    <span className="film-card" style={{ '--canister': stockStyle(stock.id).color } as CSSProperties}>
      <span className="film-card-name">{stock.name}</span>
      <span className="film-card-meta">
        {stock.exposures} EXP{stock.monochrome ? ' · B&W' : ''}
      </span>
    </span>
  ) : (
    <span className="film-card film-card-empty">No film</span>
  )

  return (
    <div className="film-window-wrap">
      {onActivate ? (
        <button
          type="button"
          className="film-window"
          onClick={onActivate}
          aria-label={stock ? 'Roll finished. Load a new roll' : 'Load a roll'}
        >
          {content}
        </button>
      ) : (
        <div className="film-window" aria-label={stock ? `Loaded: ${stock.name}` : 'No film loaded'}>
          {content}
        </div>
      )}
      <span className="printed">{onActivate ? 'load film' : 'film'}</span>
    </div>
  )
}
