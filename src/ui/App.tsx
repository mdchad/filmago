import { useEffect } from 'react'
import { useGpuRoot } from '../gpu/useGpuRoot.ts'
import { useRollStore } from '../roll/rollStore.ts'
import { CameraScreen } from './CameraScreen.tsx'
import { UnsupportedScreen } from './UnsupportedScreen.tsx'

export function App() {
  const gpu = useGpuRoot()
  const init = useRollStore((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  if (gpu.status === 'unsupported') return <UnsupportedScreen />
  if (gpu.status === 'error') return <UnsupportedScreen detail={gpu.message} />

  return (
    <CameraScreen
      root={gpu.status === 'ready' ? gpu.root : undefined}
      gpuMessage={gpu.status === 'lost' ? 'Reconnecting to the GPU…' : undefined}
    />
  )
}
