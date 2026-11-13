import { createStore, get, getMany, keys, set, update, values, type UseStore } from 'idb-keyval'
import type { RollRepository } from './RollRepository.ts'
import {
  FrameNotFoundError,
  InvalidFrameError,
  MAX_CAPTION_LENGTH,
  MAX_TITLE_LENGTH,
  normalizeText,
  RollFinishedError,
  RollNotFoundError,
  type ClaimedShot,
  type Frame,
  type NewFrame,
  type NewRoll,
  type Roll,
} from './types.ts'

/**
 * Frames are stored with raw bytes rather than Blobs: ArrayBuffers clone
 * reliably into IndexedDB across browsers (older WebKit was flaky with Blobs).
 */
type StoredFrame = Omit<Frame, 'image' | 'thumbnail'> & {
  image: ArrayBuffer
  imageType: string
  thumbnail: ArrayBuffer
  thumbnailType: string
}

const frameKey = (rollId: string, frameNumber: number) =>
  `${rollId}/${String(frameNumber).padStart(3, '0')}`

export class IndexedDbRollRepository implements RollRepository {
  readonly #rolls: UseStore
  readonly #frames: UseStore

  constructor(dbPrefix = 'filmago') {
    this.#rolls = createStore(`${dbPrefix}-rolls`, 'rolls')
    this.#frames = createStore(`${dbPrefix}-frames`, 'frames')
  }

  async createRoll({ stockId, exposures, title }: NewRoll): Promise<Roll> {
    const roll: Roll = {
      id: crypto.randomUUID(),
      stockId,
      exposures,
      shotsLeft: exposures,
      createdAt: Date.now(),
      title: title === undefined ? undefined : normalizeText(title, MAX_TITLE_LENGTH),
    }
    await set(roll.id, roll, this.#rolls)
    return roll
  }

  getRoll(rollId: string): Promise<Roll | undefined> {
    return get<Roll>(rollId, this.#rolls)
  }

  async listRolls(): Promise<Roll[]> {
    const rolls = await values<Roll>(this.#rolls)
    return rolls.sort((a, b) => b.createdAt - a.createdAt)
  }

  async claimShot(rollId: string): Promise<ClaimedShot> {
    let claimed: ClaimedShot | undefined
    // `update` reads and writes inside one readwrite transaction, so two
    // concurrent claims can never both take the last exposure.
    await update<Roll>(
      rollId,
      (roll) => {
        if (!roll) throw new RollNotFoundError(rollId)
        if (roll.shotsLeft <= 0) throw new RollFinishedError(rollId)
        const next = { ...roll, shotsLeft: roll.shotsLeft - 1 }
        claimed = { roll: next, frameNumber: roll.exposures - roll.shotsLeft + 1 }
        return next
      },
      this.#rolls,
    )
    return claimed!
  }

  async saveFrame(input: NewFrame): Promise<Frame> {
    const roll = await this.getRoll(input.rollId)
    if (!roll) throw new RollNotFoundError(input.rollId)
    const claimedCount = roll.exposures - roll.shotsLeft
    if (!Number.isInteger(input.frameNumber) || input.frameNumber < 1 || input.frameNumber > claimedCount) {
      throw new InvalidFrameError(`Frame ${input.frameNumber} was not claimed on roll ${roll.id}`)
    }
    if (input.stockId !== roll.stockId) {
      throw new InvalidFrameError(`Frame stock ${input.stockId} does not match roll stock ${roll.stockId}`)
    }

    const key = frameKey(input.rollId, input.frameNumber)
    const frame: Frame = { ...input, id: key, createdAt: Date.now() }
    const stored: StoredFrame = {
      ...frame,
      image: await input.image.arrayBuffer(),
      imageType: input.image.type,
      thumbnail: await input.thumbnail.arrayBuffer(),
      thumbnailType: input.thumbnail.type,
    }

    await update<StoredFrame>(
      key,
      (existing) => {
        if (existing) throw new InvalidFrameError(`Frame ${input.frameNumber} is already saved`)
        return stored
      },
      this.#frames,
    )
    return frame
  }

  async listFrames(rollId: string): Promise<Frame[]> {
    const prefix = `${rollId}/`
    const frameKeys = (await keys<string>(this.#frames)).filter((k) => k.startsWith(prefix)).sort()
    const stored = await getMany<StoredFrame>(frameKeys, this.#frames)
    return stored.filter((f): f is StoredFrame => f !== undefined).map(({ image, imageType, thumbnail, thumbnailType, ...meta }) => ({
      ...meta,
      image: new Blob([image], { type: imageType }),
      thumbnail: new Blob([thumbnail], { type: thumbnailType }),
    }))
  }

  async renameRoll(rollId: string, title: string): Promise<Roll> {
    const normalized = normalizeText(title, MAX_TITLE_LENGTH)
    let renamed: Roll | undefined
    await update<Roll>(
      rollId,
      (roll) => {
        if (!roll) throw new RollNotFoundError(rollId)
        renamed = { ...roll, title: normalized }
        return renamed
      },
      this.#rolls,
    )
    return renamed!
  }

  async updateCaption(rollId: string, frameNumber: number, caption: string): Promise<void> {
    const normalized = normalizeText(caption, MAX_CAPTION_LENGTH)
    await update<StoredFrame>(
      frameKey(rollId, frameNumber),
      (frame) => {
        if (!frame) throw new FrameNotFoundError(rollId, frameNumber)
        return { ...frame, caption: normalized }
      },
      this.#frames,
    )
  }
}
