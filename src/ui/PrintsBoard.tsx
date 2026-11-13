import { useEffect, useState, type CSSProperties } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { getStock } from '../film/index.ts'
import { selectRollsOfFormat, useRollStore } from '../roll/rollStore.ts'
import { MAX_CAPTION_LENGTH, MAX_TITLE_LENGTH, type Frame, type Roll } from '../roll/types.ts'
import { renderPrint, shareOrDownload } from './printExport.ts'
import { useObjectUrl } from './useObjectUrl.ts'

const formatDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/** A stable, slightly messy placement for a print, derived from its seed. */
function scatter(frame: Frame): CSSProperties {
  const r = (n: number) => ((Math.sin(frame.seed * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1
  return {
    '--tilt': `${(r(1) - 0.5) * 12}deg`,
    '--shift-x': `${(r(2) - 0.5) * 10}px`,
    '--shift-y': `${(r(3) - 0.5) * 14}px`,
  } as CSSProperties
}

function Print({ frame, large = false }: { frame: Frame; large?: boolean }) {
  const url = useObjectUrl(large ? frame.image : frame.thumbnail)
  return (
    <figure className={large ? 'print print-large' : 'print'}>
      <div className="print-image">{url && <img src={url} alt="" />}</div>
      <figcaption className="print-caption">{frame.caption}</figcaption>
    </figure>
  )
}

/** Inline-editable handwriting: shows as marker text, edits in place, saves on blur. */
function MarkerField({
  value,
  placeholder,
  maxLength,
  label,
  className,
  onSave,
}: {
  value: string | undefined
  placeholder: string
  maxLength: number
  label: string
  className: string
  onSave(next: string): Promise<void>
}) {
  const [draft, setDraft] = useState(value ?? '')
  const [error, setError] = useState<string>()

  const save = async () => {
    if (draft.trim() === (value ?? '')) return
    try {
      setError(undefined)
      await onSave(draft)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <>
      <input
        className={className}
        aria-label={label}
        value={draft}
        placeholder={placeholder}
        maxLength={maxLength}
        enterKeyHint="done"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      {error && <p className="error-text">{error}</p>}
    </>
  )
}

function PrintViewer({ frame, onClose }: { frame: Frame; onClose(): void }) {
  const updateCaption = useRollStore((s) => s.updateCaption)
  const [saving, setSaving] = useState(false)
  const imageUrl = useObjectUrl(frame.image)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const savePrint = async () => {
    setSaving(true)
    try {
      const blob = await renderPrint(frame.image, frame.caption)
      await shareOrDownload(blob, `print-${String(frame.frameNumber).padStart(2, '0')}.jpg`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="print-viewer" role="dialog" aria-modal="true" aria-label={`Print ${frame.frameNumber}`}>
      <div className="print-viewer-backdrop" onClick={onClose} />
      <figure className="print print-large">
        <div className="print-image">{imageUrl && <img src={imageUrl} alt={`Print ${frame.frameNumber}`} />}</div>
        <MarkerField
          // Re-mount when switching prints so the draft starts from that caption.
          key={frame.id}
          className="print-caption print-caption-input"
          label="Caption"
          placeholder="Write something…"
          maxLength={MAX_CAPTION_LENGTH}
          value={frame.caption}
          onSave={(caption) => updateCaption(frame.rollId, frame.frameNumber, caption)}
        />
      </figure>
      <div className="print-viewer-actions">
        <button type="button" className="pill-button" onClick={() => void savePrint()} disabled={saving}>
          {saving ? 'Preparing…' : 'Save print'}
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => void shareOrDownload(frame.image, `photo-${String(frame.frameNumber).padStart(2, '0')}.jpg`)}
        >
          Save photo
        </button>
        <button type="button" className="text-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

function PackStack({ pack, onOpen }: { pack: Roll; onOpen(frame: Frame): void }) {
  const frames = useRollStore((s) => s.framesByRoll[pack.id])
  const loadFrames = useRollStore((s) => s.loadFrames)
  const renameRoll = useRollStore((s) => s.renameRoll)

  useEffect(() => {
    if (!frames) void loadFrames(pack.id)
  }, [frames, loadFrames, pack.id])

  return (
    <section className="pack-stack">
      <header className="pack-stack-header">
        <MarkerField
          className="pack-title"
          label="Pack name"
          placeholder="Name this pack"
          maxLength={MAX_TITLE_LENGTH}
          value={pack.title}
          onSave={(title) => renameRoll(pack.id, title)}
        />
        <small>
          {getStock(pack.stockId).name} · {formatDate(pack.createdAt)} · {pack.exposures - pack.shotsLeft}/
          {pack.exposures}
        </small>
      </header>
      {frames && frames.length > 0 ? (
        <ol className="pack-prints">
          {frames.map((frame) => (
            <li key={frame.id} style={scatter(frame)}>
              <button type="button" className="print-button" onClick={() => onOpen(frame)} aria-label={`Open print ${frame.frameNumber}`}>
                <Print frame={frame} />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty-text">No prints yet.</p>
      )}
    </section>
  )
}

export function PrintsBoard({ onClose }: { onClose(): void }) {
  const packs = useRollStore(useShallow(selectRollsOfFormat('instant')))
  const [open, setOpen] = useState<Frame>()
  // Read the latest copy from the store so caption edits show immediately.
  const openFrame = useRollStore((s) =>
    open ? s.framesByRoll[open.rollId]?.find((f) => f.frameNumber === open.frameNumber) : undefined,
  )

  return (
    <div className="prints-board" role="dialog" aria-modal="true" aria-labelledby="prints-title">
      <header className="sheet-header">
        <h2 id="prints-title">Prints</h2>
        <button type="button" className="text-button" onClick={onClose}>
          Done
        </button>
      </header>
      {packs.length === 0 ? (
        <p className="empty-text">Load a pack and take a picture. Your prints land here.</p>
      ) : (
        packs.map((pack) => <PackStack key={pack.id} pack={pack} onOpen={setOpen} />)
      )}
      {openFrame && <PrintViewer frame={openFrame} onClose={() => setOpen(undefined)} />}
    </div>
  )
}
