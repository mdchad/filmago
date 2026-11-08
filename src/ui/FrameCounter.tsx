import type { CSSProperties } from 'react'
import { currentFrameNumber, type Roll } from '../roll/types.ts'

/**
 * A mechanical frame counter: a numbered strip behind a small window on the
 * top plate that rolls to the next frame after each exposure. 'S' is the
 * empty-camera start position.
 */
export function FrameCounter({ roll }: { roll: Roll | undefined }) {
  const exposures = roll?.exposures ?? 36
  const index = roll ? currentFrameNumber(roll) : 0
  const label = roll
    ? `Frame ${currentFrameNumber(roll)} of ${roll.exposures}, ${roll.shotsLeft} left`
    : 'No film loaded'

  return (
    <div className="frame-counter" role="img" aria-label={label} aria-live="polite">
      <div className="counter-window">
        <div className="counter-strip" style={{ '--index': index } as CSSProperties}>
          {['S', ...Array.from({ length: exposures }, (_, i) => String(i + 1))].map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </div>
      <span className="engraved counter-caption">frame</span>
    </div>
  )
}
