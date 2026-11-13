import { common, d, type TgpuRoot } from 'typegpu'
import { bakeCurveLut, type FilmStock } from '../film/index.ts'
import {
  BlurParams,
  DevelopParams,
  FilmParams,
  blurLayout,
  brightLayout,
  developLayout,
  filmLayout,
  previewLayout,
} from './layouts.ts'
import { blurFragment, brightFragment, developFragment, filmFragment, previewFragment } from './shaders.ts'

/** Gaussian sigma of the halation glow as a fraction of the frame's short edge. */
const HALATION_SPREAD = 0.008
/** Matches the `exp(-x² / 18)` kernel in `blurFragment` (sigma of 3 taps). */
const BLUR_SIGMA_TAPS = 3
const HALATION_DOWNSCALE = 4

const JPEG_QUALITY = 0.9
const THUMBNAIL_EDGE = 480

type Size = { width: number; height: number }

export type EncodedFrame = Size & { image: Blob; thumbnail: Blob }

/** Per-resolution textures and bind groups for the whole film chain. */
class FilmTargets {
  readonly source
  readonly output
  readonly halationA
  readonly halationB
  readonly #blurH
  readonly #blurV
  readonly develop
  readonly brightGroup
  readonly blurHGroup
  readonly blurVGroup
  readonly filmGroup
  readonly developGroup
  readonly previewGroup
  readonly width: number
  readonly height: number

  constructor(
    root: TgpuRoot,
    width: number,
    height: number,
    params: ReturnType<typeof createParamsBuffer>,
    sampler: ReturnType<TgpuRoot['createSampler']>,
  ) {
    this.width = width
    this.height = height
    const color = () =>
      root.createTexture({ size: [width, height], format: 'rgba8unorm' }).$usage('sampled', 'render')
    const hw = Math.max(1, Math.round(width / HALATION_DOWNSCALE))
    const hh = Math.max(1, Math.round(height / HALATION_DOWNSCALE))
    const glow = () =>
      root.createTexture({ size: [hw, hh], format: 'rgba16float' }).$usage('sampled', 'render')

    this.source = color()
    this.output = color()
    this.halationA = glow()
    this.halationB = glow()

    const sigmaTexels = (HALATION_SPREAD * Math.min(width, height)) / HALATION_DOWNSCALE
    const stepTexels = sigmaTexels / BLUR_SIGMA_TAPS
    this.#blurH = root.createBuffer(BlurParams, { step: d.vec2f(stepTexels / hw, 0) }).$usage('uniform')
    this.#blurV = root.createBuffer(BlurParams, { step: d.vec2f(0, stepTexels / hh) }).$usage('uniform')
    this.develop = root.createBuffer(DevelopParams, { progress: 1 }).$usage('uniform')

    this.brightGroup = root.createBindGroup(brightLayout, { src: this.source, samp: sampler, params })
    this.blurHGroup = root.createBindGroup(blurLayout, { src: this.halationA, samp: sampler, blur: this.#blurH })
    this.blurVGroup = root.createBindGroup(blurLayout, { src: this.halationB, samp: sampler, blur: this.#blurV })
    this.filmGroup = root.createBindGroup(filmLayout, {
      src: this.source,
      halation: this.halationA,
      samp: sampler,
      params,
    })
    this.developGroup = root.createBindGroup(developLayout, {
      src: this.output,
      samp: sampler,
      develop: this.develop,
    })
    this.previewGroup = root.createBindGroup(previewLayout, { src: this.source, samp: sampler })
  }

  matches(width: number, height: number) {
    return this.width === width && this.height === height
  }

  destroy() {
    for (const t of [this.source, this.output, this.halationA, this.halationB]) t.destroy()
    for (const b of [this.#blurH, this.#blurV, this.develop]) b.destroy()
  }
}

/** Passing the row-major matrix as columns makes WGSL's `rgb * M` equal `M_rowMajor · rgb`. */
function rowMajorMat3(m: number[]): d.m3x3f {
  const [a, b, c, e, f, g, h, i, j] = m
  return d.mat3x3f(a, b, c, e, f, g, h, i, j)
}

const createParamsBuffer = (root: TgpuRoot) => root.createBuffer(FilmParams).$usage('uniform')

/** A developed frame held on the GPU until it is encoded and released. */
export class CapturedFrame {
  readonly targets: FilmTargets

  constructor(targets: FilmTargets) {
    this.targets = targets
  }

  get width() {
    return this.targets.width
  }

  get height() {
    return this.targets.height
  }
}

/**
 * Owns every GPU resource for one device: pipelines, the canvas context and
 * render targets. After a device loss, throw this away and build a new one
 * from the new root.
 */
export class FilmRenderer {
  readonly #root: TgpuRoot
  readonly #canvas: HTMLCanvasElement
  /** Canvas contexts by canvas: the viewfinder, plus e.g. an instant print. */
  readonly #contexts = new Map<HTMLCanvasElement, GPUCanvasContext>()
  readonly #params
  readonly #sampler
  readonly #pipelines
  readonly #lutCache = new WeakMap<FilmStock['curves'], d.v4f[]>()
  #live: FilmTargets | undefined
  #captures = new Set<CapturedFrame>()

  constructor(root: TgpuRoot, canvas: HTMLCanvasElement) {
    this.#root = root
    this.#canvas = canvas
    this.#params = createParamsBuffer(root)
    this.#sampler = root.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    })

    const vertex = common.fullScreenTriangle
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat()
    this.#pipelines = {
      bright: root.createRenderPipeline({ vertex, fragment: brightFragment, targets: { format: 'rgba16float' } }),
      blur: root.createRenderPipeline({ vertex, fragment: blurFragment, targets: { format: 'rgba16float' } }),
      film: root.createRenderPipeline({ vertex, fragment: filmFragment, targets: { format: 'rgba8unorm' } }),
      develop: root.createRenderPipeline({ vertex, fragment: developFragment, targets: { format: canvasFormat } }),
      preview: root.createRenderPipeline({ vertex, fragment: previewFragment, targets: { format: canvasFormat } }),
    }
  }

  /**
   * Draws a live camera frame to the canvas: a light preview grade, or
   * (for tuning) the full film look.
   *
   * Takes an upright frame (see `PreviewSource`) rather than the `<video>`
   * itself: Safari's WebGPU ignores the camera's rotation when copying
   * straight from a video, which shows the viewfinder sideways.
   */
  drawLive(frame: ImageBitmap | OffscreenCanvas, stock: FilmStock, options: { fullLook: boolean; seed: number }) {
    const { width, height } = frame
    if (!this.#live?.matches(width, height)) {
      this.#live?.destroy()
      this.#live = new FilmTargets(this.#root, width, height, this.#params, this.#sampler)
    }
    const live = this.#live
    live.source.write(frame)
    this.#fitCanvas(this.#canvas, width, height)

    if (options.fullLook) {
      this.#renderFilm(live, stock, options.seed)
      live.develop.write({ progress: 1 })
      this.#pipelines.develop.with(live.developGroup).withColorAttachment(this.#canvasAttachment(this.#canvas)).draw(3)
    } else {
      this.#pipelines.preview.with(live.previewGroup).withColorAttachment(this.#canvasAttachment(this.#canvas)).draw(3)
    }
  }

  /** Renders the finished film image for a captured bitmap into an offscreen target. */
  capture(bitmap: ImageBitmap, stock: FilmStock, seed: number): CapturedFrame {
    const targets = new FilmTargets(this.#root, bitmap.width, bitmap.height, this.#params, this.#sampler)
    targets.source.write(bitmap)
    this.#renderFilm(targets, stock, seed)
    const frame = new CapturedFrame(targets)
    this.#captures.add(frame)
    return frame
  }

  /**
   * Shows a captured frame at the given develop progress (0→1), on the
   * viewfinder or on another canvas such as an instant print.
   */
  drawDevelop(frame: CapturedFrame, progress: number, canvas: HTMLCanvasElement = this.#canvas) {
    this.#fitCanvas(canvas, frame.width, frame.height)
    frame.targets.develop.write({ progress })
    this.#pipelines.develop.with(frame.targets.developGroup).withColorAttachment(this.#canvasAttachment(canvas)).draw(3)
  }

  /** Reads the finished image back and encodes the full-size JPEG and a thumbnail. */
  async encode(frame: CapturedFrame): Promise<EncodedFrame> {
    const { width, height } = frame
    const device = this.#root.device
    const bytesPerRow = Math.ceil((width * 4) / 256) * 256
    const readback = device.createBuffer({
      size: bytesPerRow * height,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    })
    const encoder = device.createCommandEncoder()
    encoder.copyTextureToBuffer(
      { texture: this.#root.unwrap(frame.targets.output) },
      { buffer: readback, bytesPerRow },
      [width, height],
    )
    device.queue.submit([encoder.finish()])

    const pixels = new Uint8ClampedArray(width * height * 4)
    try {
      await readback.mapAsync(GPUMapMode.READ)
      const mapped = new Uint8Array(readback.getMappedRange())
      for (let y = 0; y < height; y++) {
        pixels.set(mapped.subarray(y * bytesPerRow, y * bytesPerRow + width * 4), y * width * 4)
      }
    } finally {
      readback.destroy()
    }

    const full = new OffscreenCanvas(width, height)
    full.getContext('2d')!.putImageData(new ImageData(pixels, width, height), 0, 0)
    const scale = Math.min(1, THUMBNAIL_EDGE / Math.max(width, height))
    const thumb = new OffscreenCanvas(Math.round(width * scale), Math.round(height * scale))
    const thumbContext = thumb.getContext('2d')!
    thumbContext.imageSmoothingQuality = 'high'
    thumbContext.drawImage(full, 0, 0, thumb.width, thumb.height)

    const [image, thumbnail] = await Promise.all([
      full.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY }),
      thumb.convertToBlob({ type: 'image/jpeg', quality: 0.8 }),
    ])
    return { image, thumbnail, width, height }
  }

  release(frame: CapturedFrame) {
    if (this.#captures.delete(frame)) frame.targets.destroy()
  }

  destroy() {
    this.#live?.destroy()
    this.#live = undefined
    for (const frame of this.#captures) frame.targets.destroy()
    this.#captures.clear()
    this.#params.destroy()
    for (const context of this.#contexts.values()) context.unconfigure()
    this.#contexts.clear()
  }

  #renderFilm(targets: FilmTargets, stock: FilmStock, seed: number) {
    this.#writeParams(stock, seed, targets.width, targets.height)
    const { bright, blur, film } = this.#pipelines
    bright.with(targets.brightGroup).withColorAttachment({ view: targets.halationA }).draw(3)
    blur.with(targets.blurHGroup).withColorAttachment({ view: targets.halationB }).draw(3)
    blur.with(targets.blurVGroup).withColorAttachment({ view: targets.halationA }).draw(3)
    film.with(targets.filmGroup).withColorAttachment({ view: targets.output }).draw(3)
  }

  #canvasAttachment(canvas: HTMLCanvasElement) {
    let context = this.#contexts.get(canvas)
    if (!context) {
      context = this.#root.configureContext({ canvas, alphaMode: 'opaque' })
      this.#contexts.set(canvas, context)
    }
    return { view: context, clearValue: [0, 0, 0, 1] } as const
  }

  #writeParams(stock: FilmStock, seed: number, width: number, height: number) {
    this.#params.write({
      colorMatrix: rowMajorMat3(stock.colorMatrix),
      halationTint: d.vec3f(...stock.halation.tint),
      halationThreshold: stock.halation.threshold,
      halationStrength: stock.halation.strength,
      grainAmount: stock.grain.amount,
      grainSize: stock.grain.size,
      vignette: stock.vignette,
      monochrome: stock.monochrome ? 1 : 0,
      seed,
      resolution: d.vec2f(width, height),
      curve: this.#curveLut(stock.curves),
    })
  }

  #curveLut(curves: FilmStock['curves']): d.v4f[] {
    let lut = this.#lutCache.get(curves)
    if (!lut) {
      const flat = bakeCurveLut(curves)
      lut = Array.from({ length: flat.length / 4 }, (_, i) =>
        d.vec4f(flat[i * 4], flat[i * 4 + 1], flat[i * 4 + 2], flat[i * 4 + 3]),
      )
      this.#lutCache.set(curves, lut)
    }
    return lut
  }

  /** Sizes the canvas backing store to the frame's aspect, no larger than needed on screen. */
  #fitCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
    const dpr = window.devicePixelRatio || 1
    const displayEdge = Math.max(canvas.clientWidth, canvas.clientHeight) * dpr
    const scale = Math.min(1, displayEdge / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
  }
}
