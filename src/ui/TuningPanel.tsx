import { useState } from 'react'
import type { FilmStock } from '../film/index.ts'
import { useTuningStore } from './tuningStore.ts'

type SliderProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange(value: number): void
}

function Slider({ label, value, min, max, step = 0.01, onChange }: SliderProps) {
  return (
    <label className="tune-row">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output>{value.toFixed(2)}</output>
    </label>
  )
}

type Channel = 'r' | 'g' | 'b'

/** Dev-only: live-edit the active stock and copy the result back into `src/film/stocks.ts`. */
export function TuningPanel({ stock }: { stock: FilmStock }) {
  const setStock = useTuningStore((s) => s.setStock)
  const reset = useTuningStore((s) => s.reset)
  const fullLook = useTuningStore((s) => s.fullLook)
  const setFullLook = useTuningStore((s) => s.setFullLook)
  const [open, setOpen] = useState(false)
  const [linkCurves, setLinkCurves] = useState(stock.monochrome)
  const [copied, setCopied] = useState(false)

  const update = (patch: Partial<FilmStock>) => setStock({ ...stock, ...patch })

  const setCurvePoint = (channel: Channel, index: number, value: number) => {
    const channels: Channel[] = linkCurves ? ['r', 'g', 'b'] : [channel]
    const curves = { ...stock.curves }
    for (const c of channels) curves[c] = curves[c].map((y, i) => (i === index ? value : y))
    update({ curves })
  }

  const copy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(stock, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (!open) {
    return (
      <button type="button" className="tune-toggle" onClick={() => setOpen(true)}>
        Tune
      </button>
    )
  }

  return (
    <aside className="tune-panel" aria-label="Stock tuning">
      <header>
        <strong>{stock.name}</strong>
        <button type="button" className="text-button" onClick={() => setOpen(false)}>
          Hide
        </button>
      </header>

      <label className="tune-check">
        <input type="checkbox" checked={fullLook} onChange={(e) => setFullLook(e.target.checked)} />
        Full film look in viewfinder
      </label>

      <fieldset>
        <legend>Grain</legend>
        <Slider label="amount" value={stock.grain.amount} min={0} max={0.4} onChange={(amount) => update({ grain: { ...stock.grain, amount } })} />
        <Slider label="size" value={stock.grain.size} min={0.5} max={4} onChange={(size) => update({ grain: { ...stock.grain, size } })} />
      </fieldset>

      <fieldset>
        <legend>Halation</legend>
        <Slider label="threshold" value={stock.halation.threshold} min={0.3} max={0.99} onChange={(threshold) => update({ halation: { ...stock.halation, threshold } })} />
        <Slider label="strength" value={stock.halation.strength} min={0} max={1.5} onChange={(strength) => update({ halation: { ...stock.halation, strength } })} />
        {(['R', 'G', 'B'] as const).map((label, i) => (
          <Slider
            key={label}
            label={`tint ${label}`}
            value={stock.halation.tint[i]}
            min={0}
            max={1}
            onChange={(v) => {
              const tint = [...stock.halation.tint] as [number, number, number]
              tint[i] = v
              update({ halation: { ...stock.halation, tint } })
            }}
          />
        ))}
      </fieldset>

      <fieldset>
        <legend>Vignette</legend>
        <Slider label="amount" value={stock.vignette} min={0} max={1} onChange={(vignette) => update({ vignette })} />
      </fieldset>

      <fieldset>
        <legend>Curves</legend>
        <label className="tune-check">
          <input type="checkbox" checked={linkCurves} onChange={(e) => setLinkCurves(e.target.checked)} />
          Link R/G/B
        </label>
        {(linkCurves ? (['r'] as Channel[]) : (['r', 'g', 'b'] as Channel[])).map((channel) => (
          <div key={channel} className="tune-curve">
            <span className={`tune-channel tune-channel-${channel}`}>{linkCurves ? 'rgb' : channel}</span>
            {stock.curves[channel].map((y, i, all) => (
              <Slider
                key={i}
                label={`in ${(i / (all.length - 1)).toFixed(2)}`}
                value={y}
                min={0}
                max={1}
                onChange={(v) => setCurvePoint(channel, i, v)}
              />
            ))}
          </div>
        ))}
      </fieldset>

      <footer>
        <button type="button" className="pill-button" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy params as JSON'}
        </button>
        <button type="button" className="text-button" onClick={() => reset(stock.id)}>
          Reset
        </button>
      </footer>
    </aside>
  )
}
