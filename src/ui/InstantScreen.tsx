import { lazy, Suspense, useRef, useState } from 'react'
import type { TgpuRoot } from 'typegpu'
import { useCameraStream, type Facing } from '../camera/useCameraStream.ts'
import { selectActiveRoll, useRollStore } from '../roll/rollStore.ts'
import { isRollFinished } from '../roll/types.ts'
import { FilmWindow } from './FilmWindow.tsx'
import { FormatSwitch } from './FormatSwitch.tsx'
import { FrameCounter } from './FrameCounter.tsx'
import { PrintsBoard } from './PrintsBoard.tsx'
import { StockPicker } from './StockPicker.tsx'
import { useEffectiveStock, useTuningStore } from './tuningStore.ts'
import { useFilmRenderer } from './useFilmRenderer.ts'
import { useLiveView } from './useLiveView.ts'
import { useShutter } from './useShutter.ts'

const TuningPanel = import.meta.env.DEV
  ? lazy(() => import('./TuningPanel.tsx').then((m) => ({ default: m.TuningPanel })))
  : null

/** Instant film takes its time; the print develops in your hand. */
const INSTANT_DEVELOP_MS = 4000
/** The finished print hangs out of the slot until tapped, or this long. */
const INSTANT_HOLD_MS = 2500

type InstantScreenProps = {
  root: TgpuRoot | undefined
  gpuMessage?: string
}

export function InstantScreen({ root, gpuMessage }: InstantScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const printCanvasRef = useRef<HTMLCanvasElement>(null)
  const [facing, setFacing] = useState<Facing>('environment')
  const [boardOpen, setBoardOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const rollStatus = useRollStore((s) => s.status)
  const pack = useRollStore(selectActiveRoll('instant'))
  const loadNewRoll = useRollStore((s) => s.loadNewRoll)
  const stock = useEffectiveStock(pack?.stockId)
  const fullLook = useTuningStore((s) => s.fullLook)

  const camera = useCameraStream(videoRef, facing)
  const renderer = useFilmRenderer(root, canvasRef)
  const shutter = useShutter({
    renderer,
    videoRef,
    roll: pack,
    stock,
    crop: 'square',
    developMs: INSTANT_DEVELOP_MS,
    holdMs: INSTANT_HOLD_MS,
    developCanvasRef: printCanvasRef,
  })
  // The viewfinder stays live while the print develops outside it.
  useLiveView({
    renderer,
    videoRef,
    active: camera.status === 'live',
    stock,
    fullLook: import.meta.env.DEV && fullLook,
    paused: false,
    crop: 'square',
  })

  const finished = pack ? isRollFinished(pack) : false
  const needsFirstPack = rollStatus === 'ready' && !pack
  const statusMessage =
    gpuMessage ??
    (camera.status === 'error' ? camera.message : camera.status === 'starting' ? 'Opening camera…' : undefined)

  return (
    <main className="camera">
      <div className="camera-body instant-body">
        <header className="top-plate">
          <div className="wordmark">
            <span className="engraved wordmark-name">Filmago</span>
            <span className="engraved wordmark-model">Instant·10</span>
          </div>
          <FormatSwitch current="instant" />
          <FrameCounter roll={pack} />
        </header>

        <div className="leatherette instant-panel">
          <div className="screen-bezel square-bezel">
            <div className="viewfinder">
              <canvas ref={canvasRef} className={facing === 'user' ? 'mirrored' : undefined} />
              {/* Kept in the DOM (not display:none) so iOS keeps decoding frames. */}
              <video ref={videoRef} className="feed" playsInline muted autoPlay />

              <div className="osd osd-top" aria-hidden="true">
                <span>▸ {stock ? stock.name : 'No film'}</span>
              </div>
              <div className="osd osd-bottom" aria-hidden="true">
                <span>{pack ? `${pack.shotsLeft} left` : '--'}</span>
                <span>{facing === 'environment' ? 'Rear' : 'Front'}</span>
              </div>

              {shutter.blinkCount > 0 && (
                <div key={shutter.blinkCount} className="shutter-blink" aria-hidden="true" />
              )}
              {statusMessage && <div className="viewfinder-status">{statusMessage}</div>}
              {finished && !shutter.developing && (
                <div className="roll-end">
                  <p>Pack finished</p>
                  <button type="button" className="pill-button" onClick={() => setPickerOpen(true)}>
                    Load new pack
                  </button>
                </div>
              )}
              {shutter.error && <div className="viewfinder-error">{shutter.error}</div>}
              <div className="screen-glare" aria-hidden="true" />
            </div>
          </div>

          <div className="print-slot-area">
            <div className="print-slot" aria-hidden="true" />
            <div className="print-exit">
              <button
                type="button"
                className="print ejected-print"
                data-phase={shutter.phase}
                onClick={shutter.dismiss}
                tabIndex={shutter.phase === 'holding' ? 0 : -1}
                aria-hidden={shutter.phase === 'idle'}
                aria-label="Put the print on the pile"
              >
                <span className="print-image">
                  <canvas ref={printCanvasRef} />
                </span>
                <span className="print-caption" />
              </button>
            </div>
          </div>

          <div className="control-deck">
            <div className="side-buttons">
              <div className="small-control">
                <button
                  type="button"
                  className="round-button"
                  onClick={() => setBoardOpen(true)}
                  aria-label="Open prints"
                />
                <span className="printed">prints</span>
              </div>
              <div className="small-control">
                <button
                  type="button"
                  className="round-button"
                  onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
                  disabled={shutter.developing}
                  aria-label={facing === 'environment' ? 'Switch to front camera' : 'Switch to rear camera'}
                />
                <span className="printed">flip</span>
              </div>
            </div>

            <div className="command-ring">
              <div className="shutter-collar">
                <button
                  type="button"
                  className="shutter"
                  onClick={() => void shutter.shoot()}
                  disabled={!shutter.ready || shutter.developing || camera.status !== 'live' || Boolean(gpuMessage)}
                  aria-label="Take photo"
                />
              </div>
            </div>

            <FilmWindow stock={stock} onActivate={finished ? () => setPickerOpen(true) : undefined} />
          </div>
        </div>
      </div>

      {boardOpen && <PrintsBoard onClose={() => setBoardOpen(false)} />}
      {(needsFirstPack || pickerOpen) && (
        <StockPicker
          format="instant"
          onLoad={async (stockId) => {
            await loadNewRoll(stockId)
            setPickerOpen(false)
          }}
          onCancel={needsFirstPack ? undefined : () => setPickerOpen(false)}
        />
      )}
      {TuningPanel && stock && (
        <Suspense>
          <TuningPanel stock={stock} />
        </Suspense>
      )}
    </main>
  )
}
