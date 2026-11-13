import { create } from 'zustand'
import { getStock, type FilmFormat } from '../film/index.ts'
import { IndexedDbRollRepository } from './IndexedDbRollRepository.ts'
import type { RollRepository } from './RollRepository.ts'
import type { ClaimedShot, Frame, NewFrame, Roll } from './types.ts'

type RollState = {
  status: 'loading' | 'ready' | 'error'
  error?: string
  /** Newest first. Per format, the newest roll is the one loaded in that camera. */
  rolls: Roll[]
  framesByRoll: Record<string, Frame[]>

  init(): Promise<void>
  loadNewRoll(stockId: string, title?: string): Promise<Roll>
  claimShot(rollId: string): Promise<ClaimedShot>
  saveFrame(frame: NewFrame): Promise<Frame>
  loadFrames(rollId: string): Promise<void>
  renameRoll(rollId: string, title: string): Promise<void>
  updateCaption(rollId: string, frameNumber: number, caption: string): Promise<void>
}

export function createRollStore(repo: RollRepository) {
  return create<RollState>()((set, get) => {
    const replaceRoll = (roll: Roll) =>
      set((s) => ({ rolls: s.rolls.map((r) => (r.id === roll.id ? roll : r)) }))

    return {
      status: 'loading',
      rolls: [],
      framesByRoll: {},

      async init() {
        try {
          const rolls = await repo.listRolls()
          set({ rolls, status: 'ready' })
          // Preload the roll in each camera so the newest frames show immediately.
          const loaded = new Set<string>()
          for (const roll of rolls) {
            const format = rollFormat(roll)
            if (loaded.has(format)) continue
            loaded.add(format)
            await get().loadFrames(roll.id)
          }
        } catch (err) {
          set({ status: 'error', error: err instanceof Error ? err.message : String(err) })
        }
      },

      async loadNewRoll(stockId, title) {
        const roll = await repo.createRoll({ stockId, exposures: getStock(stockId).exposures, title })
        set((s) => ({ rolls: [roll, ...s.rolls], framesByRoll: { ...s.framesByRoll, [roll.id]: [] } }))
        return roll
      },

      async claimShot(rollId) {
        const claimed = await repo.claimShot(rollId)
        replaceRoll(claimed.roll)
        return claimed
      },

      async saveFrame(input) {
        const frame = await repo.saveFrame(input)
        set((s) => ({
          framesByRoll: {
            ...s.framesByRoll,
            [frame.rollId]: [...(s.framesByRoll[frame.rollId] ?? []), frame].sort(
              (a, b) => a.frameNumber - b.frameNumber,
            ),
          },
        }))
        return frame
      },

      async loadFrames(rollId) {
        const frames = await repo.listFrames(rollId)
        set((s) => ({ framesByRoll: { ...s.framesByRoll, [rollId]: frames } }))
      },

      async renameRoll(rollId, title) {
        replaceRoll(await repo.renameRoll(rollId, title))
      },

      async updateCaption(rollId, frameNumber, caption) {
        await repo.updateCaption(rollId, frameNumber, caption)
        const normalized = caption.trim() || undefined
        set((s) => ({
          framesByRoll: {
            ...s.framesByRoll,
            [rollId]: (s.framesByRoll[rollId] ?? []).map((f) =>
              f.frameNumber === frameNumber ? { ...f, caption: normalized } : f,
            ),
          },
        }))
      },
    }
  })
}

export const useRollStore = createRollStore(new IndexedDbRollRepository())

export const rollFormat = (roll: Roll): FilmFormat => getStock(roll.stockId).format

/** The roll loaded in the camera for `format`: the newest roll of that format. */
export const selectActiveRoll =
  (format: FilmFormat) =>
  (s: RollState): Roll | undefined =>
    s.rolls.find((r) => rollFormat(r) === format)

export const selectRollsOfFormat = (format: FilmFormat) => (s: RollState) =>
  s.rolls.filter((r) => rollFormat(r) === format)
