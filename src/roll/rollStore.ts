import { create } from 'zustand'
import { getStock } from '../film/index.ts'
import { IndexedDbRollRepository } from './IndexedDbRollRepository.ts'
import type { RollRepository } from './RollRepository.ts'
import type { ClaimedShot, Frame, NewFrame, Roll } from './types.ts'

type RollState = {
  status: 'loading' | 'ready' | 'error'
  error?: string
  /** Newest first. The newest roll is the one loaded in the camera. */
  rolls: Roll[]
  framesByRoll: Record<string, Frame[]>

  init(): Promise<void>
  loadNewRoll(stockId: string): Promise<Roll>
  claimShot(rollId: string): Promise<ClaimedShot>
  saveFrame(frame: NewFrame): Promise<Frame>
  loadFrames(rollId: string): Promise<void>
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
          if (rolls[0]) await get().loadFrames(rolls[0].id)
        } catch (err) {
          set({ status: 'error', error: err instanceof Error ? err.message : String(err) })
        }
      },

      async loadNewRoll(stockId) {
        const roll = await repo.createRoll({ stockId, exposures: getStock(stockId).exposures })
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
    }
  })
}

export const useRollStore = createRollStore(new IndexedDbRollRepository())

export const selectActiveRoll = (s: RollState): Roll | undefined => s.rolls[0]
