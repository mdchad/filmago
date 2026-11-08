import { lazy, Suspense, useRef, useState } from 'react'
import type { TgpuRoot } from 'typegpu'
import { useCameraStream, type Facing } from '../camera/useCameraStream.ts'
import { selectActiveRoll, useRollStore } from '../roll/rollStore.ts'
import { isRollFinished } from '../roll/types.ts'
import { ContactSheet } from './ContactSheet.tsx'
import { FilmWindow } from './FilmWindow.tsx'
import { FrameCounter } from './FrameCounter.tsx'
import { StockPicker } from './StockPicker.tsx'
import { useEffectiveStock, useTuningStore } from './tuningStore.ts'
import { useFilmRenderer } from './useFilmRenderer.ts'
import { useLiveView } from './useLiveView.ts'
import { useShutter } from './useShutter.ts'

const TuningPanel = import.meta.env.DEV
  ? lazy(() => import('./TuningPanel.tsx').then((m) => ({ default: m.TuningPanel })))
  : null

type CameraScreenProps = {
  root: TgpuRoot | undefined
  /** Shown over the viewfinder while the GPU is unavailable, e.g. after a device loss. */
  gpuMessage?: string
}

export function CameraScreen({ root, gpuMessage }: CameraScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [facing, setFacing] = useState<Facing>('environment')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const rollStatus = useRollStore((s) => s.status)
  const roll = useRollStore(selectActiveRoll)
  const loadNewRoll = useRollStore((s) => s.loadNewRoll)
  const stock = useEffectiveStock(roll?.stockId)
  const fullLook = useTuningStore((s) => s.fullLook)

  const camera = useCameraStream(videoRef, facing)
  const renderer = useFilmRenderer(root, canvasRef)
  const shutter = useShutter({ renderer, videoRef, roll, stock })
  useLiveView({
    renderer,
    videoRef,
    active: camera.status === 'live',
    stock,
    fullLook: import.meta.env.DEV && fullLook,
    paused: shutter.developing,
  })

  const finished = roll ? isRollFinished(roll) : false
  const needsFirstRoll = rollStatus === 'ready' && !roll
  const mirrored = facing === 'user' && !shutter.developing

  const statusMessage =
    gpuMessage ??
    (camera.status === 'error' ? camera.message : camera.status === 'starting' ? 'Opening camera…' : undefined)

  return (
    <main className="camera">
      <div className="camera-body">
        <header className="top-plate">
          <div className="wordmark">
            <span className="engraved wordmark-name">Film Roll</span>
            <span className="engraved wordmark-model">RF·35</span>
          </div>
          <div className="eyepiece" aria-hidden="true" />
          <FrameCounter roll={roll} />
        </header>

        <div className="leatherette">
          <div className="screen-bezel">
            <div className="viewfinder">
              <canvas ref={canvasRef} className={mirrored ? 'mirrored' : undefined} />
              {/* Kept in the DOM (not display:none) so iOS keeps decoding frames. */}
              <video ref={videoRef} className="feed" playsInline muted autoPlay />

              <div className="osd osd-top" aria-hidden="true">
                <span>▸ {stock ? stock.name : 'No film'}</span>
                {stock && <span>ISO {stock.iso}</span>}
              </div>
              <div className="osd osd-bottom" aria-hidden="true">
                <span>{roll ? `${roll.shotsLeft} left` : '--'}</span>
                {shutter.developing && <span className="osd-developing">● Developing</span>}
                <span>{facing === 'environment' ? 'Rear' : 'Front'}</span>
              </div>

              {shutter.blinkCount > 0 && (
                <div key={shutter.blinkCount} className="shutter-blink" aria-hidden="true" />
              )}
              {statusMessage && <div className="viewfinder-status">{statusMessage}</div>}
              {finished && !shutter.developing && (
                <div className="roll-end">
                  <p>Roll finished</p>
                  <button type="button" className="pill-button" onClick={() => setPickerOpen(true)}>
                    Load new roll
                  </button>
                </div>
              )}
              {shutter.error && <div className="viewfinder-error">{shutter.error}</div>}
              <div className="screen-glare" aria-hidden="true" />
            </div>
          </div>

          <div className="control-deck">
            <div className="side-buttons">
              <div className="small-control">
                <button
                  type="button"
                  className="round-button"
                  onClick={() => setSheetOpen(true)}
                  disabled={!roll}
                  aria-label="Open contact sheet"
                />
                <span className="printed">disp</span>
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

      {sheetOpen && <ContactSheet initialRollId={roll?.id} onClose={() => setSheetOpen(false)} />}
      {(needsFirstRoll || pickerOpen) && (
        <StockPicker
          onLoad={async (stockId) => {
            await loadNewRoll(stockId)
            setPickerOpen(false)
          }}
          onCancel={needsFirstRoll ? undefined : () => setPickerOpen(false)}
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
