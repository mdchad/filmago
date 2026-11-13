import type { Exposures } from '../film/index.ts'

export const MAX_TITLE_LENGTH = 40
export const MAX_CAPTION_LENGTH = 60

export type Roll = {
  id: string
  stockId: string
  exposures: Exposures
  shotsLeft: number
  createdAt: number
  /** Optional name, e.g. "Kyoto, day 2". */
  title?: string
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
  /** Handwritten note on an instant print's border. */
  caption?: string
}

export type NewRoll = Pick<Roll, 'stockId' | 'exposures' | 'title'>
export type NewFrame = Omit<Frame, 'id' | 'createdAt' | 'caption'>

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

export class FrameNotFoundError extends Error {
  constructor(rollId: string, frameNumber: number) {
    super(`Frame ${frameNumber} not found on roll ${rollId}`)
    this.name = 'FrameNotFoundError'
  }
}

export class InvalidTextError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidTextError'
  }
}

/** Trims and validates a user-entered title or caption; empty means "none". */
export function normalizeText(text: string, maxLength: number): string | undefined {
  const trimmed = text.trim()
  if (trimmed.length > maxLength) throw new InvalidTextError(`Keep it under ${maxLength} characters`)
  return trimmed || undefined
}

export class InvalidFrameError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidFrameError'
  }
}
