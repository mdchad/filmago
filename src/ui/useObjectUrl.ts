import { useEffect, useState } from 'react'

/** An object URL for `blob`, revoked when the blob changes or the component unmounts. */
export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) return
    const next = URL.createObjectURL(blob)
    // Syncing an external resource whose lifetime must match the effect's.
    // oxlint-disable-next-line react/set-state-in-effect
    setUrl(next)
    return () => {
      URL.revokeObjectURL(next)
      setUrl(undefined)
    }
  }, [blob])
  return url
}
