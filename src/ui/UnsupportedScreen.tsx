export function UnsupportedScreen({ detail }: { detail?: string }) {
  return (
    <main className="notice-screen">
      <div className="notice-card">
        <div className="notice-icon" aria-hidden="true" />
        <h1>This camera needs a newer browser (iOS 26+ / recent Chrome)</h1>
        <p>Film Roll develops every frame on your GPU with WebGPU, which this browser doesn’t provide.</p>
        {detail && <p className="notice-detail">{detail}</p>}
      </div>
    </main>
  )
}
