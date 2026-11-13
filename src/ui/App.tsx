import { useEffect } from 'react'
import { useGpuRoot } from '../gpu/useGpuRoot.ts'
import { useRollStore } from '../roll/rollStore.ts'
import { CameraScreen } from './CameraScreen.tsx'
import { InstantScreen } from './InstantScreen.tsx'
import { UnsupportedScreen } from './UnsupportedScreen.tsx'

const isInstantPage = () => window.location.pathname.replace(/\/+$/, '') === '/instant'

export function App() {
  const gpu = useGpuRoot()
  const init = useRollStore((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  if (gpu.status === 'unsupported') return <UnsupportedScreen />
  if (gpu.status === 'error') return <UnsupportedScreen detail={gpu.message} />

  const root = gpu.status === 'ready' ? gpu.root : undefined
  const gpuMessage = gpu.status === 'lost' ? 'Reconnecting to the GPU…' : undefined
  // Each camera is its own page; the format switch links between them.
  return isInstantPage() ? (
    <InstantScreen root={root} gpuMessage={gpuMessage} />
  ) : (
    <CameraScreen root={root} gpuMessage={gpuMessage} />
  )
}
