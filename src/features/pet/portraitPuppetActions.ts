/**
 * Live2D-like action director for one-image portrait puppets.
 *
 * Live2D plays authored clips (nod / wave / look). A still portrait cannot.
 * This module turns the same public gesture names, performance accents, and
 * a deterministic idle cycle into pose offsets the mesh deformer already
 * understands.
 */

import { clamp } from '../../lib/common.ts'
import { PUBLIC_GESTURE_NAMES } from './models.ts'
import type { PetPerformanceAccent, PetPerformanceCue } from './types.ts'

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return amount * amount * (3 - 2 * amount)
}

export type PortraitPuppetActionOffsets = {
  headYaw: number
  headTilt: number
  headBob: number
  bodyLean: number
  armSway: number
  eyeX: number
  eyeY: number
  eyeDrop: number
  breath: number
  weight: number
}

const EMPTY_ACTION: PortraitPuppetActionOffsets = {
  headYaw: 0,
  headTilt: 0,
  headBob: 0,
  bodyLean: 0,
  armSway: 0,
  eyeX: 0,
  eyeY: 0,
  eyeDrop: 0,
  breath: 0,
  weight: 0,
}

const IDLE_CYCLE_MS = 18_000
const IDLE_ACTION_MS = 2_600
const PUBLIC_GESTURE_SET = new Set<string>(PUBLIC_GESTURE_NAMES)

function scaleAction(
  action: PortraitPuppetActionOffsets,
  amount: number,
): PortraitPuppetActionOffsets {
  if (amount <= 0) return EMPTY_ACTION
  return {
    headYaw: action.headYaw * amount,
    headTilt: action.headTilt * amount,
    headBob: action.headBob * amount,
    bodyLean: action.bodyLean * amount,
    armSway: action.armSway * amount,
    eyeX: action.eyeX * amount,
    eyeY: action.eyeY * amount,
    eyeDrop: action.eyeDrop * amount,
    breath: action.breath * amount,
    weight: clamp(action.weight * amount, 0, 1),
  }
}

function addActions(
  left: PortraitPuppetActionOffsets,
  right: PortraitPuppetActionOffsets,
): PortraitPuppetActionOffsets {
  return {
    headYaw: left.headYaw + right.headYaw,
    headTilt: left.headTilt + right.headTilt,
    headBob: left.headBob + right.headBob,
    bodyLean: left.bodyLean + right.bodyLean,
    armSway: left.armSway + right.armSway,
    eyeX: left.eyeX + right.eyeX,
    eyeY: left.eyeY + right.eyeY,
    eyeDrop: left.eyeDrop + right.eyeDrop,
    breath: left.breath + right.breath,
    weight: clamp(Math.max(left.weight, right.weight), 0, 1),
  }
}

/** Rise-hold-fall envelope so a gesture reads as a beat, not a snap. */
export function resolvePortraitPuppetActionEnvelope(elapsedMs: number, durationMs: number): number {
  const duration = clamp(durationMs, 420, 2_800)
  const progress = clamp(elapsedMs / duration, 0, 1)
  if (progress <= 0 || progress >= 1) return 0
  if (progress < 0.16) return smoothstep(0, 0.16, progress)
  if (progress > 0.78) return 1 - smoothstep(0.78, 1, progress)
  return 1
}

function actionHash(value: number) {
  const hashed = Math.sin(value * 12.9898 + 78.233) * 43_758.5453
  return hashed - Math.floor(hashed)
}

function normalizeGestureName(value: string | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

/** Elapsed time from cue start, matching the Live2D canvas clock. */
export function resolvePortraitPuppetPerformanceElapsedMs(
  cue: PetPerformanceCue | null | undefined,
  startedAtMs: number,
  nowMs: number,
): number | undefined {
  if (!cue) return undefined
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(nowMs)) return undefined
  return Math.max(0, nowMs - startedAtMs)
}

function lobe(elapsedMs: number, hertz: number): number {
  return Math.abs(Math.sin(elapsedMs / 1_000 * hertz))
}

function cycle(elapsedMs: number, hertz: number): number {
  return Math.sin(elapsedMs / 1_000 * hertz)
}

/** Public Live2D gesture names mapped onto portrait pose channels. */
export function planPortraitPuppetGesture(
  gestureName: string,
  elapsedMs: number,
  envelope: number,
): PortraitPuppetActionOffsets {
  const name = normalizeGestureName(gestureName)
  if (!PUBLIC_GESTURE_SET.has(name) || envelope <= 0) return EMPTY_ACTION

  switch (name) {
    case 'wave': {
      const swing = cycle(elapsedMs, 11.4)
      return {
        ...EMPTY_ACTION,
        armSway: swing * 1.15 * envelope,
        headTilt: (1.6 + swing * 0.7) * envelope,
        bodyLean: (0.55 + swing * 0.22) * envelope,
        weight: envelope,
      }
    }
    case 'nod': {
      const dip = lobe(elapsedMs, 8.8)
      return {
        ...EMPTY_ACTION,
        headBob: -dip * 0.014 * envelope,
        headTilt: dip * 4.4 * envelope,
        weight: envelope,
      }
    }
    case 'shake': {
      const turn = cycle(elapsedMs, 9.6)
      return {
        ...EMPTY_ACTION,
        headYaw: turn * 0.52 * envelope,
        eyeX: turn * 0.28 * envelope,
        weight: envelope,
      }
    }
    case 'tilt':
      return {
        ...EMPTY_ACTION,
        headTilt: 5.4 * envelope,
        headYaw: 0.14 * envelope,
        eyeY: 0.12 * envelope,
        weight: envelope,
      }
    case 'point':
      return {
        ...EMPTY_ACTION,
        armSway: 0.92 * envelope,
        bodyLean: 1.6 * envelope,
        headYaw: 0.22 * envelope,
        eyeX: 0.18 * envelope,
        weight: envelope,
      }
    default:
      return EMPTY_ACTION
  }
}

/** Same accent vocabulary as Live2D, expressed as portrait offsets. */
export function planPortraitPuppetAccent(
  accentStyle: PetPerformanceAccent | undefined,
  elapsedMs: number,
  envelope: number,
): PortraitPuppetActionOffsets {
  if (!accentStyle || envelope <= 0) return EMPTY_ACTION
  const pulse = lobe(elapsedMs, 10.4) * envelope

  switch (accentStyle) {
    case 'peek':
      return {
        ...EMPTY_ACTION,
        headTilt: 3.1 * envelope,
        bodyLean: 1.8 * envelope,
        eyeY: -0.16 * envelope,
        weight: envelope,
      }
    case 'search': {
      const scan = cycle(elapsedMs, 7.4) * envelope
      return {
        ...EMPTY_ACTION,
        headYaw: scan * 0.42,
        eyeX: scan * 0.7,
        eyeY: 0.14 * envelope,
        headTilt: scan * 1.4,
        weight: envelope,
      }
    }
    case 'organize':
    case 'confirm':
      return {
        ...EMPTY_ACTION,
        headBob: -lobe(elapsedMs, 9.4) * 0.01 * envelope,
        headTilt: lobe(elapsedMs, 9.4) * 3.6 * envelope,
        bodyLean: pulse * 0.8,
        weight: envelope,
      }
    case 'write':
      return {
        ...EMPTY_ACTION,
        headTilt: -2.4 * envelope,
        eyeY: 0.22 * envelope,
        eyeX: -0.18 * envelope,
        armSway: lobe(elapsedMs, 12.2) * 0.35 * envelope,
        weight: envelope,
      }
    case 'deliver':
      return {
        ...EMPTY_ACTION,
        bodyLean: 1.4 * envelope,
        headTilt: 1.8 * envelope,
        armSway: 0.42 * envelope,
        weight: envelope,
      }
    case 'sparkle':
      return {
        ...EMPTY_ACTION,
        headTilt: 2.2 * envelope + pulse * 1.1,
        headBob: -0.004 * envelope,
        eyeY: -0.1 * envelope,
        weight: envelope,
      }
    case 'listen':
      return {
        ...EMPTY_ACTION,
        headTilt: -3.2 * envelope,
        bodyLean: cycle(elapsedMs, 6.5) * 0.7 * envelope,
        weight: envelope,
      }
    case 'shy':
      return {
        ...EMPTY_ACTION,
        headTilt: 4.6 * envelope,
        headYaw: -0.16 * envelope,
        eyeY: 0.14 * envelope,
        eyeDrop: 0.08 * envelope,
        weight: envelope,
      }
    default:
      return EMPTY_ACTION
  }
}

type IdleActionKind = 'lookLeft' | 'lookRight' | 'nod' | 'tilt' | 'weightShift' | 'stretch'

const IDLE_ACTIONS: IdleActionKind[] = [
  'lookLeft',
  'lookRight',
  'nod',
  'tilt',
  'weightShift',
  'stretch',
]

function planIdleKind(
  kind: IdleActionKind,
  envelope: number,
  elapsedMs: number,
): PortraitPuppetActionOffsets {
  switch (kind) {
    case 'lookLeft':
      return {
        ...EMPTY_ACTION,
        headYaw: -0.58 * envelope,
        eyeX: -0.62 * envelope,
        headTilt: -1.4 * envelope,
        weight: envelope,
      }
    case 'lookRight':
      return {
        ...EMPTY_ACTION,
        headYaw: 0.58 * envelope,
        eyeX: 0.62 * envelope,
        headTilt: 1.4 * envelope,
        weight: envelope,
      }
    case 'nod':
      return scaleAction(planPortraitPuppetGesture('nod', elapsedMs, 1), envelope)
    case 'tilt':
      return scaleAction(planPortraitPuppetGesture('tilt', elapsedMs, 1), envelope)
    case 'weightShift':
      return {
        ...EMPTY_ACTION,
        bodyLean: 1.8 * envelope,
        armSway: 0.28 * envelope,
        weight: envelope,
      }
    case 'stretch':
      return {
        ...EMPTY_ACTION,
        headBob: -0.008 * envelope,
        breath: 0.55 * envelope,
        armSway: 0.22 * envelope,
        weight: envelope,
      }
    default:
      return EMPTY_ACTION
  }
}

/**
 * Quiet, hashed idle beats so a still portrait does not loop the same
 * four-second sine forever. Disabled while a performance cue is active.
 */
export function planPortraitPuppetIdleAction(nowMs: number): PortraitPuppetActionOffsets {
  const block = Math.floor(nowMs / IDLE_CYCLE_MS)
  const start = actionHash(block * 3 + 1) * (IDLE_CYCLE_MS - IDLE_ACTION_MS)
  const local = nowMs - block * IDLE_CYCLE_MS - start
  const envelope = resolvePortraitPuppetActionEnvelope(local, IDLE_ACTION_MS)
  if (envelope <= 0) return EMPTY_ACTION
  const kind = IDLE_ACTIONS[Math.floor(actionHash(block * 11 + 5) * IDLE_ACTIONS.length)]
    ?? 'lookLeft'
  return planIdleKind(kind, envelope, local)
}

export function planPortraitPuppetAction(input: {
  nowMs: number
  performanceCue?: PetPerformanceCue | null
  performanceElapsedMs?: number
  allowIdleAction?: boolean
}): PortraitPuppetActionOffsets {
  const cue = input.performanceCue
  if (cue) {
    const elapsed = Number.isFinite(input.performanceElapsedMs)
      ? Number(input.performanceElapsedMs)
      : cue.durationMs * 0.35
    const envelope = resolvePortraitPuppetActionEnvelope(elapsed, cue.durationMs || 1_200)
    return addActions(
      planPortraitPuppetGesture(cue.gestureName ?? '', elapsed, envelope),
      planPortraitPuppetAccent(cue.accentStyle, elapsed, envelope),
    )
  }

  if (input.allowIdleAction) {
    return planPortraitPuppetIdleAction(input.nowMs)
  }

  return EMPTY_ACTION
}
