import { useEffect, useState } from 'react'
import type { TgpuRoot } from 'typegpu'
import { requestRoot } from './device.ts'

export type GpuState =
  | { status: 'initializing' }
  | { status: 'unsupported' }
  | { status: 'ready'; root: TgpuRoot }
  /** The device was lost; a new one is requested when the tab is visible. */
  | { status: 'lost' }
  | { status: 'error'; message: string }

/**
 * Provides a TypeGPU root and replaces it after a device loss. Mobile
 * browsers commonly drop the GPU device while a tab is backgrounded, so
 * recovery waits until the page is visible again.
 */
export function useGpuRoot(): GpuState {
  const [state, setState] = useState<GpuState>({ status: 'initializing' })

  useEffect(() => {
    let disposed = false
    let connecting = false
    let current: TgpuRoot | undefined
    let everConnected = false

    async function connect() {
      if (connecting || current || disposed) return
      connecting = true
      try {
        const result = await requestRoot()
        if (disposed) {
          if (result.kind === 'ok') result.root.destroy()
          return
        }
        if (result.kind !== 'ok') {
          // An adapter can be briefly unavailable right after a loss; that is
          // not the same as an unsupported browser.
          setState(everConnected ? { status: 'lost' } : { status: 'unsupported' })
          return
        }

        const root = result.root
        current = root
        everConnected = true
        setState({ status: 'ready', root })

        void root.device.lost.then((info) => {
          if (disposed || current !== root || info.reason === 'destroyed') return
          console.warn('GPU device lost:', info.message)
          current = undefined
          setState({ status: 'lost' })
          if (document.visibilityState === 'visible') void connect()
        })
      } catch (err) {
        if (!disposed) setState({ status: 'error', message: err instanceof Error ? err.message : String(err) })
      } finally {
        connecting = false
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void connect()
    }

    void connect()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      current?.destroy()
    }
  }, [])

  return state
}
