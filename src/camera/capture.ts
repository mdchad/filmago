export const MAX_CAPTURE_EDGE = 3000

/** Scales a frame down (never up) so its long edge fits `maxEdge`. */
export function captureSize(width: number, height: number, maxEdge = MAX_CAPTURE_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/**
 * Grabs the video's current frame, upright. `createImageBitmap` works on
 * every WebGPU browser, unlike `ImageCapture`, which Safari lacks.
 */
export function grabFrame(video: HTMLVideoElement): Promise<ImageBitmap> {
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    return Promise.reject(new Error('The camera has not produced a frame yet'))
  }
  return createImageBitmap(video)
}

/** Instant prints are square; 35mm keeps the camera's full frame. */
export type Crop = 'full' | 'square'

/** The region of a `width`×`height` frame to keep: everything, or the centered square. */
export function cropRect(width: number, height: number, crop: Crop) {
  if (crop === 'full') return { x: 0, y: 0, width, height }
  const side = Math.min(width, height)
  return { x: Math.floor((width - side) / 2), y: Math.floor((height - side) / 2), width: side, height: side }
}

/** Grabs the current frame for a photo, cropped and scaled down to the capture size cap. */
export async function captureFrame(video: HTMLVideoElement, crop: Crop = 'full'): Promise<ImageBitmap> {
  // Size from the upright bitmap, not videoWidth/videoHeight: on iOS those
  // don't reliably match the rotated frame, which would squash the photo.
  const frame = await grabFrame(video)
  const rect = cropRect(frame.width, frame.height, crop)
  const size = captureSize(rect.width, rect.height)
  if (rect.width === frame.width && rect.height === frame.height && size.width === frame.width) return frame
  try {
    return await createImageBitmap(frame, rect.x, rect.y, rect.width, rect.height, {
      resizeWidth: size.width,
      resizeHeight: size.height,
      resizeQuality: 'high',
    })
  } finally {
    frame.close()
  }
}
