/**
 * Instant-print geometry in millimetres: a square image on a white card with
 * a wide bottom border for writing on.
 */
export const PRINT_MM = { width: 88, height: 107, image: 79, side: 4.5, top: 6 } as const

export const MARKER_FONT = '"Permanent Marker", "Marker Felt", cursive'
const INK = '#1f2230'
const PAPER = '#f6f3ec'

/** Pixel layout of a print whose square image is `imageSize` px wide. */
export function printLayout(imageSize: number) {
  const scale = imageSize / PRINT_MM.image
  const width = Math.round(PRINT_MM.width * scale)
  const height = Math.round(PRINT_MM.height * scale)
  const imageX = Math.round((width - imageSize) / 2)
  const imageY = Math.round(PRINT_MM.top * scale)
  const borderTop = imageY + imageSize
  return {
    width,
    height,
    imageX,
    imageY,
    imageSize,
    caption: {
      x: width / 2,
      y: borderTop + (height - borderTop) / 2,
      maxWidth: imageSize * 0.92,
      fontSize: Math.round(imageSize * 0.075),
    },
  }
}

/** Renders the whole print (card, photo and handwritten caption) as a JPEG. */
export async function renderPrint(image: Blob, caption: string | undefined): Promise<Blob> {
  const bitmap = await createImageBitmap(image)
  const size = Math.min(bitmap.width, bitmap.height)
  const layout = printLayout(size)
  const canvas = new OffscreenCanvas(layout.width, layout.height)
  const ctx = canvas.getContext('2d')!

  const paper = ctx.createLinearGradient(0, 0, layout.width, layout.height)
  paper.addColorStop(0, '#faf8f2')
  paper.addColorStop(1, PAPER)
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, layout.width, layout.height)
  ctx.drawImage(bitmap, 0, 0, size, size, layout.imageX, layout.imageY, size, size)
  bitmap.close()
  ctx.strokeStyle = 'rgb(0 0 0 / 0.12)'
  ctx.lineWidth = Math.max(1, size / 800)
  ctx.strokeRect(layout.imageX, layout.imageY, size, size)

  if (caption) {
    const { x, y, maxWidth, fontSize } = layout.caption
    const font = `${fontSize}px ${MARKER_FONT}`
    await document.fonts.load(font, caption)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate((-1.2 * Math.PI) / 180)
    ctx.font = font
    ctx.fillStyle = INK
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(caption, 0, 0, maxWidth)
    ctx.restore()
  }

  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 })
}

/** Offers a file to the user: the share sheet where supported (iOS "Save Image"), else a download. */
export async function shareOrDownload(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
