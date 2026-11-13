import type { ClaimedShot, Frame, NewFrame, NewRoll, Roll } from './types.ts'

/**
 * Storage boundary for rolls and frames. The UI depends only on this
 * interface so the IndexedDB implementation can later be swapped for a
 * server-backed one with the same semantics.
 */
export interface RollRepository {
  createRoll(input: NewRoll): Promise<Roll>
  /** Resolves to `undefined` when no roll has this id. */
  getRoll(rollId: string): Promise<Roll | undefined>
  /** All rolls, newest first. */
  listRolls(): Promise<Roll[]>
  /**
   * Atomically uses one exposure. Rejects with `RollFinishedError` when the
   * roll has no shots left, and `RollNotFoundError` for an unknown roll.
   */
  claimShot(rollId: string): Promise<ClaimedShot>
  /** Stores a developed frame. The frame number must have been claimed and not saved yet. */
  saveFrame(frame: NewFrame): Promise<Frame>
  /** The roll's frames ordered by frame number. */
  listFrames(rollId: string): Promise<Frame[]>
  /** Sets or clears (empty string) a roll's title. Resolves to the updated roll. */
  renameRoll(rollId: string, title: string): Promise<Roll>
  /**
   * Sets or clears (empty string) a saved frame's caption. Unlike shots,
   * captions can be rewritten any time.
   */
  updateCaption(rollId: string, frameNumber: number, caption: string): Promise<void>
}
