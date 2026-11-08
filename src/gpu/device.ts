import { tgpu, type TgpuRoot } from 'typegpu'

export type RootRequest = { kind: 'ok'; root: TgpuRoot } | { kind: 'no-webgpu' } | { kind: 'no-adapter' }

/**
 * WebGPU support is only real once an adapter comes back: some browsers
 * expose `navigator.gpu` but return `null` here (blocklisted GPU, disabled flag).
 */
export async function requestRoot(): Promise<RootRequest> {
  if (!('gpu' in navigator) || !navigator.gpu) return { kind: 'no-webgpu' }
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
  if (!adapter) return { kind: 'no-adapter' }
  const device = await adapter.requestDevice()
  return { kind: 'ok', root: tgpu.initFromDevice({ device }) }
}
