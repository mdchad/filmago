import { captureSize, cropRect, type Crop } from './capture.ts'

/** Long edge of viewfinder frames: sharp on a phone screen, far below sensor size. */
const PREVIEW_EDGE = 1600

type Size = { width: number; height: number }

/**
 * Produces small, upright copies of the live camera frame for the viewfinder.
 *
 * Drawing the video into a 2D canvas applies the camera's rotation (copying
 * a video straight into WebGPU doesn't in Safari) and downscales in the same
 * step, which keeps the per-frame cost low even when the stream is 12MP.
 */
export class PreviewSource {
  readonly #canvas = new OffscreenCanvas(1, 1)
  readonly #context = this.#canvas.getContext('2d')!
  readonly #cropped = new OffscreenCanvas(1, 1)
  readonly #croppedContext = this.#cropped.getContext('2d')!
  /** The video dimensions the upright size below was measured for. */
  #measuredFor = ''
  #upright: Size | undefined

  /**
   * Returns a canvas holding the current frame, or `undefined` while the
   * stream's upright size is still being measured.
   */
  grab(video: HTMLVideoElement, crop: Crop = 'full'): OffscreenCanvas | undefined {
    const key = `${video.videoWidth}x${video.videoHeight}`
    if (key !== this.#measuredFor) {
      this.#measure(video, key)
      return undefined
    }
    if (!this.#upright) return undefined

    const { width, height } = captureSize(this.#upright.width, this.#upright.height, PREVIEW_EDGE)
    if (this.#canvas.width !== width) this.#canvas.width = width
    if (this.#canvas.height !== height) this.#canvas.height = height
    this.#context.drawImage(video, 0, 0, width, height)
    if (crop === 'full') return this.#canvas

    // Crop from the upright canvas, whose coordinates are known, rather than
    // from the video, whose intrinsic size may be unrotated on iOS.
    const rect = cropRect(width, height, crop)
    if (this.#cropped.width !== rect.width) this.#cropped.width = rect.width
    if (this.#cropped.height !== rect.height) this.#cropped.height = rect.height
    this.#croppedContext.drawImage(this.#canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height)
    return this.#cropped
  }

  /**
   * `videoWidth`/`videoHeight` don't reliably reflect rotation on iOS, so
   * measure one upright bitmap whenever the stream's dimensions change.
   */
  #measure(video: HTMLVideoElement, key: string) {
    this.#measuredFor = key
    this.#upright = undefined
    createImageBitmap(video)
      .then((bitmap) => {
        if (this.#measuredFor === key) this.#upright = { width: bitmap.width, height: bitmap.height }
        bitmap.close()
      })
      .catch(() => {
        // Retry on the next frame.
        if (this.#measuredFor === key) this.#measuredFor = ''
      })
  }
}
