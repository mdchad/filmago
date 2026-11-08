import { useEffect, useState } from 'react'
import { getStock } from '../film/index.ts'
import { useRollStore } from '../roll/rollStore.ts'
import type { Frame, Roll } from '../roll/types.ts'
import { useObjectUrl } from './useObjectUrl.ts'

const pad = (n: number) => String(n).padStart(2, '0')

const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

function Thumbnail({ frame, onOpen }: { frame: Frame; onOpen(): void }) {
  const url = useObjectUrl(frame.thumbnail)
  return (
    <button type="button" className="contact-frame" onClick={onOpen} aria-label={`Open frame ${frame.frameNumber}`}>
      {url && <img src={url} alt="" width={frame.width} height={frame.height} />}
      <span className="edge-number">▸ {pad(frame.frameNumber)}</span>
    </button>
  )
}

function FrameViewer({ frame, onClose }: { frame: Frame; onClose(): void }) {
  const url = useObjectUrl(frame.image)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={`Frame ${frame.frameNumber}`}>
      <header className="viewer-bar">
        <span>
          {getStock(frame.stockId).name} · frame {pad(frame.frameNumber)}
        </span>
        <span className="viewer-actions">
          {url && (
            <a className="text-button" href={url} download={`frame-${pad(frame.frameNumber)}.jpg`}>
              Save
            </a>
          )}
          <button type="button" className="text-button" onClick={onClose}>
            Close
          </button>
        </span>
      </header>
      <div className="viewer-image" onClick={onClose}>
        {url && <img src={url} alt={`Frame ${frame.frameNumber}`} />}
      </div>
    </div>
  )
}

export function ContactSheet({ initialRollId, onClose }: { initialRollId: string | undefined; onClose(): void }) {
  const rolls = useRollStore((s) => s.rolls)
  const framesByRoll = useRollStore((s) => s.framesByRoll)
  const loadFrames = useRollStore((s) => s.loadFrames)
  const [rollId, setRollId] = useState(initialRollId ?? rolls[0]?.id)
  const [openFrame, setOpenFrame] = useState<Frame>()

  const roll: Roll | undefined = rolls.find((r) => r.id === rollId)
  const frames = rollId ? framesByRoll[rollId] : undefined

  useEffect(() => {
    if (rollId && !frames) void loadFrames(rollId)
  }, [rollId, frames, loadFrames])

  return (
    <div className="contact-sheet" role="dialog" aria-modal="true" aria-labelledby="contact-title">
      <header className="sheet-header">
        <h2 id="contact-title">Contact sheet</h2>
        <button type="button" className="text-button" onClick={onClose}>
          Done
        </button>
      </header>

      {rolls.length > 1 && (
        <nav className="roll-tabs" aria-label="Rolls">
          {rolls.map((r) => (
            <button
              type="button"
              key={r.id}
              className="roll-tab"
              aria-pressed={r.id === rollId}
              onClick={() => setRollId(r.id)}
            >
              <span>{getStock(r.stockId).name}</span>
              <small>
                {formatDate(r.createdAt)} · {r.exposures - r.shotsLeft}/{r.exposures}
              </small>
            </button>
          ))}
        </nav>
      )}

      {!roll ? (
        <p className="empty-text">No rolls yet.</p>
      ) : (
        <ol className="contact-grid">
          {Array.from({ length: roll.exposures }, (_, i) => {
            const frame = frames?.find((f) => f.frameNumber === i + 1)
            return (
              <li key={i}>
                {frame ? (
                  <Thumbnail frame={frame} onOpen={() => setOpenFrame(frame)} />
                ) : (
                  <div className="contact-frame unexposed" aria-label={`Frame ${i + 1}, not exposed`}>
                    <span className="edge-number">▸ {pad(i + 1)}</span>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {openFrame && <FrameViewer frame={openFrame} onClose={() => setOpenFrame(undefined)} />}
    </div>
  )
}
