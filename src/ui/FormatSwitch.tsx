import type { FilmFormat } from '../film/index.ts'

/** A two-position slide switch on the top plate that moves between the cameras. */
export function FormatSwitch({ current }: { current: FilmFormat }) {
  return (
    <nav className="format-switch" aria-label="Camera" data-current={current}>
      <span className="format-switch-knob" aria-hidden="true" />
      <a href="/" aria-current={current === '35mm' ? 'page' : undefined}>
        35mm
      </a>
      <a href="/instant" aria-current={current === 'instant' ? 'page' : undefined}>
        Instant
      </a>
    </nav>
  )
}
