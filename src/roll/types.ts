export type Roll = {
  id: string
  stockId: string
  exposures: 24 | 36
  shotsLeft: number
  createdAt: number
}

export type Frame = {
  id: string
  rollId: string
  /** 1-based position on the roll. */
  frameNumber: number
  seed: number
  stockId: string
  image: Blob
  thumbnail: Blob
  width: number
  height: number
  createdAt: number
}

export type NewRoll = Pick<Roll, 'stockId' | 'exposures'>
export type NewFrame = Omit<Frame, 'id' | 'createdAt'>

export type ClaimedShot = {
  roll: Roll
  frameNumber: number
}

export const isRollFinished = (roll: Roll) => roll.shotsLeft === 0

/** The frame number the next shot will use, or the last one if the roll is finished. */
export const currentFrameNumber = (roll: Roll) =>
  Math.min(roll.exposures, roll.exposures - roll.shotsLeft + 1)

export class RollNotFoundError extends Error {
  constructor(rollId: string) {
    super(`Roll not found: ${rollId}`)
    this.name = 'RollNotFoundError'
  }
}

export class RollFinishedError extends Error {
  constructor(rollId: string) {
    super(`Roll ${rollId} has no exposures left`)
    this.name = 'RollFinishedError'
  }
}

export class InvalidFrameError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidFrameError'
  }
}
