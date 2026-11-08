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

/** Grabs the current frame for a photo, scaled down to the capture size cap. */
export async function captureFrame(video: HTMLVideoElement): Promise<ImageBitmap> {
  // Size from the upright bitmap, not videoWidth/videoHeight: on iOS those
  // don't reliably match the rotated frame, which would squash the photo.
  const frame = await grabFrame(video)
  const size = captureSize(frame.width, frame.height)
  if (size.width === frame.width && size.height === frame.height) return frame
  try {
    return await createImageBitmap(frame, {
      resizeWidth: size.width,
      resizeHeight: size.height,
      resizeQuality: 'high',
    })
  } finally {
    frame.close()
  }
}
