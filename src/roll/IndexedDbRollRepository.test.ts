import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { IndexedDbRollRepository } from './IndexedDbRollRepository.ts'
import {
  FrameNotFoundError,
  InvalidFrameError,
  InvalidTextError,
  RollFinishedError,
  RollNotFoundError,
  type NewFrame,
} from './types.ts'

let repo: IndexedDbRollRepository
let dbCounter = 0

beforeEach(() => {
  // A fresh database per test keeps tests independent without teardown.
  repo = new IndexedDbRollRepository(`test-${dbCounter++}`)
})

const jpeg = (label: string) => new Blob([label], { type: 'image/jpeg' })

const frameInput = (rollId: string, frameNumber: number, stockId = 'marigold-400'): NewFrame => ({
  rollId,
  frameNumber,
  stockId,
  seed: frameNumber * 31,
  image: jpeg(`full-${frameNumber}`),
  thumbnail: jpeg(`thumb-${frameNumber}`),
  width: 3000,
  height: 2000,
})

describe('IndexedDbRollRepository', () => {
  it('creates a roll with all exposures available', async () => {
    const roll = await repo.createRoll({ stockId: 'marigold-400', exposures: 24 })
    expect(roll).toMatchObject({ stockId: 'marigold-400', exposures: 24, shotsLeft: 24 })
    expect(await repo.getRoll(roll.id)).toEqual(roll)
  })

  it('returns undefined for an unknown roll', async () => {
    expect(await repo.getRoll('missing')).toBeUndefined()
  })

  it('lists rolls newest first', async () => {
    const first = await repo.createRoll({ stockId: 'marigold-400', exposures: 24 })
    await new Promise((r) => setTimeout(r, 2))
    const second = await repo.createRoll({ stockId: 'ironside-400', exposures: 36 })
    expect((await repo.listRolls()).map((r) => r.id)).toEqual([second.id, first.id])
  })

  it('claims shots in order and decrements shotsLeft', async () => {
    const roll = await repo.createRoll({ stockId: 'marigold-400', exposures: 24 })
    const a = await repo.claimShot(roll.id)
    const b = await repo.claimShot(roll.id)
    expect([a.frameNumber, b.frameNumber]).toEqual([1, 2])
    expect(b.roll.shotsLeft).toBe(22)
    expect((await repo.getRoll(roll.id))?.shotsLeft).toBe(22)
  })

  it('rejects claims once the roll is finished', async () => {
    const roll = await repo.createRoll({ stockId: 'marigold-400', exposures: 24 })
    for (let i = 0; i < 24; i++) await repo.claimShot(roll.id)
    await expect(repo.claimShot(roll.id)).rejects.toBeInstanceOf(RollFinishedError)
    expect((await repo.getRoll(roll.id))?.shotsLeft).toBe(0)
  })

  it('never over-claims under concurrent shutter presses', async () => {
    const roll = await repo.createRoll({ stockId: 'marigold-400', exposures: 24 })
    const results = await Promise.allSettled(Array.from({ length: 30 }, () => repo.claimShot(roll.id)))
    const claimed = results.filter((r) => r.status === 'fulfilled').map((r) => r.value.frameNumber)
    expect(claimed.sort((x, y) => x - y)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1))
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(6)
  })

  it('rejects claims for an unknown roll', async () => {
    await expect(repo.claimShot('missing')).rejects.toBeInstanceOf(RollNotFoundError)
  })

  it('saves frames and lists them in frame order with their images intact', async () => {
    const roll = await repo.createRoll({ stockId: 'marigold-400', exposures: 24 })
    for (let i = 0; i < 3; i++) await repo.claimShot(roll.id)
    await repo.saveFrame(frameInput(roll.id, 2))
    await repo.saveFrame(frameInput(roll.id, 1))
    await repo.saveFrame(frameInput(roll.id, 3))

    const frames = await repo.listFrames(roll.id)
    expect(frames.map((f) => f.frameNumber)).toEqual([1, 2, 3])
    expect(frames[0]).toMatchObject({ rollId: roll.id, seed: 31, stockId: 'marigold-400', width: 3000 })
    expect(frames[0].image.type).toBe('image/jpeg')
    expect(await frames[0].image.text()).toBe('full-1')
    expect(await frames[0].thumbnail.text()).toBe('thumb-1')
  })

  it('keeps frames of different rolls apart', async () => {
    const a = await repo.createRoll({ stockId: 'marigold-400', exposures: 24 })
    const b = await repo.createRoll({ stockId: 'marigold-400', exposures: 24 })
    await repo.claimShot(a.id)
    await repo.claimShot(b.id)
    await repo.saveFrame(frameInput(a.id, 1))
    expect(await repo.listFrames(a.id)).toHaveLength(1)
    expect(await repo.listFrames(b.id)).toHaveLength(0)
  })

  it('rejects frames that were not claimed, are duplicates, or use another stock', async () => {
    const roll = await repo.createRoll({ stockId: 'marigold-400', exposures: 24 })
    await expect(repo.saveFrame(frameInput(roll.id, 1))).rejects.toBeInstanceOf(InvalidFrameError)

    await repo.claimShot(roll.id)
    await repo.saveFrame(frameInput(roll.id, 1))
    await expect(repo.saveFrame(frameInput(roll.id, 1))).rejects.toBeInstanceOf(InvalidFrameError)

    await repo.claimShot(roll.id)
    await expect(repo.saveFrame(frameInput(roll.id, 2, 'ironside-400'))).rejects.toBeInstanceOf(
      InvalidFrameError,
    )
  })

  it('persists across repository instances on the same database', async () => {
    const prefix = `test-persist-${dbCounter++}`
    const first = new IndexedDbRollRepository(prefix)
    const roll = await first.createRoll({ stockId: 'sodium-500t', exposures: 24 })
    await first.claimShot(roll.id)
    await first.saveFrame(frameInput(roll.id, 1, 'sodium-500t'))

    const reopened = new IndexedDbRollRepository(prefix)
    expect((await reopened.getRoll(roll.id))?.shotsLeft).toBe(23)
    expect(await reopened.listFrames(roll.id)).toHaveLength(1)
  })

  it('creates a pack with a trimmed title, and renames or clears it', async () => {
    const pack = await repo.createRoll({ stockId: 'daybreak-instant', exposures: 10, title: '  Kyoto  ' })
    expect(pack.title).toBe('Kyoto')

    const renamed = await repo.renameRoll(pack.id, 'Kyoto, day 2')
    expect(renamed.title).toBe('Kyoto, day 2')
    expect((await repo.getRoll(pack.id))?.title).toBe('Kyoto, day 2')

    await repo.renameRoll(pack.id, '   ')
    expect((await repo.getRoll(pack.id))?.title).toBeUndefined()
  })

  it('rejects overlong titles and renaming an unknown roll', async () => {
    const pack = await repo.createRoll({ stockId: 'daybreak-instant', exposures: 10 })
    await expect(repo.renameRoll(pack.id, 'x'.repeat(41))).rejects.toBeInstanceOf(InvalidTextError)
    await expect(repo.renameRoll('missing', 'x')).rejects.toBeInstanceOf(RollNotFoundError)
  })

  it('writes, rewrites and clears a caption without touching the image', async () => {
    const pack = await repo.createRoll({ stockId: 'daybreak-instant', exposures: 10 })
    await repo.claimShot(pack.id)
    await repo.saveFrame(frameInput(pack.id, 1, 'daybreak-instant'))

    await repo.updateCaption(pack.id, 1, 'first light')
    let [frame] = await repo.listFrames(pack.id)
    expect(frame.caption).toBe('first light')
    expect(await frame.image.text()).toBe('full-1')

    await repo.updateCaption(pack.id, 1, 'golden hour')
    ;[frame] = await repo.listFrames(pack.id)
    expect(frame.caption).toBe('golden hour')

    await repo.updateCaption(pack.id, 1, '')
    ;[frame] = await repo.listFrames(pack.id)
    expect(frame.caption).toBeUndefined()
  })

  it('rejects captions for missing frames and overlong captions', async () => {
    const pack = await repo.createRoll({ stockId: 'daybreak-instant', exposures: 10 })
    await expect(repo.updateCaption(pack.id, 1, 'hi')).rejects.toBeInstanceOf(FrameNotFoundError)

    await repo.claimShot(pack.id)
    await repo.saveFrame(frameInput(pack.id, 1, 'daybreak-instant'))
    await expect(repo.updateCaption(pack.id, 1, 'x'.repeat(61))).rejects.toBeInstanceOf(InvalidTextError)
  })
})
