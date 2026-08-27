/**
 * Live2D-shaped motion direction for Portrait Puppet v4.
 *
 * v4 parameters live in roughly [-1, 1]. The Live2D frame path uses Cubism
 * units (degrees, addParameterValue). This module keeps the same smoothing,
 * expression overlays, and eyelid rules, scaled into the v4 range.
 */

import { clamp } from '../../lib/common.ts'
import {
  BLINK_DOUBLE_CHANCE,
  blinkHash,
  createBlinkLane,
  RIGHT_BLINK_LAG_MS,
  stepBlinkLane,
  type BlinkLane,
} from './blink.ts'
import { createSaccadeState, stepIdleSaccade, type SaccadeState } from './idleSaccades.ts'
import { planPortraitPuppetAction } from './portraitPuppetActions.ts'
import { resolveSpeechVisemes } from './speechVisemes.ts'
import type { PetExpressionSlot } from './types.ts'
import type { PortraitPuppetV4MotionInput } from './portraitPuppetV4Runtime.ts'
import {
  resolvePortraitPuppetExpression,
  type PortraitPuppetInput,
} from './portraitPuppet.ts'

const GAZE_SMOOTH_IDLE = 0.16
const GAZE_SMOOTH_THINKING = 0.08
const SPEECH_ATTACK = 0.34
const SPEECH_RELEASE = 0.2
const ACTION_HEAD_TILT_SCALE = 1 / 7
const ACTION_BODY_LEAN_SCALE = 1 / 3.5
const ACTION_HEAD_BOB_SCALE = 40

export type PortraitPuppetV4MotionState = {
  gazeX: number
  gazeY: number
  speech: number
  blinkLeft: BlinkLane
  blinkRight: BlinkLane
  saccade: SaccadeState
}

export function createPortraitPuppetV4MotionState(): PortraitPuppetV4MotionState {
  return {
    gazeX: 0,
    gazeY: 0,
    speech: 0,
    blinkLeft: createBlinkLane(),
    blinkRight: createBlinkLane(),
    saccade: createSaccadeState(),
  }
}

function smoothToward(current: number, target: number, rate: number) {
  return current + (target - current) * clamp(rate, 0, 1)
}

function expressionMouthForm(expression: PetExpressionSlot) {
  switch (expression) {
    case 'happy': return 0.75
    case 'embarrassed': return 0.35
    case 'surprised': return -0.45
    case 'confused': return -0.2
    case 'sleepy': return 0.1
    case 'speaking': return 0.12
    default: return 0
  }
}

function lidScale(expression: PetExpressionSlot) {
  if (expression === 'sleepy') return 0.72
  if (expression === 'thinking') return 0.9
  if (expression === 'surprised') return 1.08
  return 1
}

function scheduleHashedBlink(nowMs: number, salt: number) {
  return nowMs + 2_400 + blinkHash(nowMs + salt) * 3_600
}

function expressionEyeSmile(expression: PetExpressionSlot, mouthOpen: number) {
  switch (expression) {
    case 'happy':
    case 'touchHead':
      return 0.55
    case 'touchFace':
      return 0.62
    case 'embarrassed':
      return 0.38
    case 'speaking':
      return 0.12 + mouthOpen * 0.1
    case 'listening':
    case 'touchBody':
      return 0.1
    default:
      return 0
  }
}

/**
 * Advance smoothed gaze/speech and return the v4 parameter targets for one frame.
 */
export function planPortraitPuppetV4Motion(
  input: PortraitPuppetInput,
  state: PortraitPuppetV4MotionState,
): PortraitPuppetV4MotionInput {
  const nowMs = Number.isFinite(input.nowMs) ? Number(input.nowMs) : 0
  const seconds = nowMs / 1000
  const expression = resolvePortraitPuppetExpression(input)
  const reduced = Boolean(input.prefersReducedMotion)
  const gazeRate = expression === 'thinking' ? GAZE_SMOOTH_THINKING : GAZE_SMOOTH_IDLE
  const gazeTargetX = clamp(input.gazeX ?? 0, -1, 1)
  const gazeTargetY = clamp(input.gazeY ?? 0, -1, 1)
  state.gazeX = reduced ? gazeTargetX : smoothToward(state.gazeX, gazeTargetX, gazeRate)
  state.gazeY = reduced ? gazeTargetY : smoothToward(state.gazeY, gazeTargetY, gazeRate)

  const speechTarget = input.isSpeaking ? clamp(input.speechLevel ?? 0, 0, 1) : 0
  const speechRate = speechTarget > state.speech ? SPEECH_ATTACK : SPEECH_RELEASE
  state.speech = reduced ? speechTarget : smoothToward(state.speech, speechTarget, speechRate)
  const visemes = resolveSpeechVisemes(state.speech, nowMs, reduced)
  const mouthOpen = visemes.open
  const mouthRound = visemes.round
  const mouthNarrow = visemes.narrow

  const saccade = stepIdleSaccade(
    state.saccade,
    nowMs,
    !reduced && expression === 'idle' && !input.isSpeaking && !input.performanceCue,
  )
  let gazeX = clamp(state.gazeX + saccade.x, -1, 1)
  let gazeY = clamp(state.gazeY + saccade.y, -1, 1)
  let headTilt = reduced ? 0 : Math.sin(seconds * 0.95) * 0.07
  let bodyYaw = reduced ? gazeX * 0.12 : Math.sin(seconds * 0.82) * 0.06 + gazeX * 0.22
  let breath = 0.08 + (reduced ? 0 : (Math.sin(seconds * 2.1) + 1) * 0.07)
  let mouthForm = expressionMouthForm(expression)
  let mouthDown = 0
  let browForm = 0
  let browLeftY = 0
  let browRightY = 0
  let browLeftAngle = 0
  let browRightAngle = 0
  let cheek = 0
  let eyeSmile = expressionEyeSmile(expression, mouthOpen)
  let eyeForm = 0
  let armSway = reduced ? 0 : Math.sin(seconds * 1.7) * 0.045 + (breath - 0.08) * 0.08
  let actionHeadYaw = 0
  let actionHeadPitch = 0
  let actionEyeDrop = 0

  switch (expression) {
    case 'listening':
      headTilt += reduced ? 0 : Math.sin(seconds * 3.4) * 0.05
      bodyYaw += gazeX * 0.12
      mouthForm += 0.08
      cheek += 0.04
      breath += 0.04
      break
    case 'thinking':
      gazeX *= 0.35
      gazeY = clamp(gazeY + 0.18, -1, 1)
      headTilt += reduced ? -0.12 : Math.sin(seconds * 1.8) * 0.14 - 0.12
      bodyYaw += reduced ? 0 : Math.sin(seconds * 0.9) * 0.08
      browForm -= 0.18
      browLeftY += 0.06
      browRightY += 0.1
      browLeftAngle += 0.18
      browRightAngle += 0.14
      eyeForm -= 0.1
      mouthDown += 0.1
      breath -= 0.03
      break
    case 'speaking':
      headTilt += reduced ? 0 : Math.sin(seconds * 5.8) * 0.05
      bodyYaw += reduced ? 0 : Math.sin(seconds * 4.9) * 0.06
      mouthForm += 0.14 + mouthOpen * 0.22
      cheek += mouthOpen * 0.06
      breath += 0.06
      break
    case 'happy':
      headTilt += 0.12
      mouthForm += 0.08
      cheek += 0.1
      browLeftAngle -= 0.06
      browRightAngle -= 0.06
      eyeForm -= 0.08
      breath += 0.03
      break
    case 'sleepy':
      gazeX *= 0.45
      gazeY = clamp(gazeY + 0.22, -1, 1)
      headTilt += reduced ? -0.08 : Math.sin(seconds * 0.66) * 0.08 - 0.08
      bodyYaw *= 0.58
      browForm -= 0.08
      browLeftY -= 0.14
      browRightY -= 0.14
      browLeftAngle += 0.1
      browRightAngle += 0.1
      eyeForm -= 0.12
      breath -= 0.05
      mouthForm -= 0.04
      break
    case 'surprised':
      gazeY = clamp(gazeY - 0.12, -1, 1)
      headTilt += reduced ? 0 : Math.sin(seconds * 6.2) * 0.1
      browForm += 0.22
      browLeftY += 0.32
      browRightY += 0.32
      browLeftAngle -= 0.1
      browRightAngle -= 0.1
      eyeForm += 0.28
      breath += 0.08
      break
    case 'confused':
      gazeX *= 0.5
      gazeY = clamp(gazeY + 0.1, -1, 1)
      headTilt += reduced ? 0.1 : Math.sin(seconds * 1.4) * 0.16
      bodyYaw += reduced ? 0 : Math.sin(seconds * 0.7) * 0.09
      browForm -= 0.24
      browLeftY += 0.12
      browRightY -= 0.16
      browLeftAngle += 0.22
      browRightAngle -= 0.2
      eyeForm -= 0.06
      mouthDown += 0.22
      break
    case 'embarrassed':
      gazeX *= 0.3
      gazeY = clamp(gazeY + 0.16, -1, 1)
      headTilt += 0.16
      mouthForm += 0.06
      cheek += 0.18
      breath += 0.04
      browLeftY -= 0.04
      browRightY -= 0.06
      break
    case 'touchHead':
      headTilt += 0.14
      gazeY = clamp(gazeY - 0.14, -1, 1)
      mouthForm += 0.16
      cheek += 0.1
      eyeSmile = Math.max(eyeSmile, 0.55)
      break
    case 'touchFace':
      headTilt += reduced ? 0 : Math.sin(seconds * 7.2) * 0.04
      gazeX *= 0.28
      mouthForm += 0.19
      cheek += 0.12
      eyeSmile = Math.max(eyeSmile, 0.62)
      break
    case 'touchBody':
      headTilt += 0.08
      bodyYaw += gazeX * 0.14
      mouthForm += 0.1
      eyeSmile = Math.max(eyeSmile, 0.18)
      break
    default:
      break
  }

  const cue = input.performanceCue
  const durationMs = Math.max(1, cue?.durationMs || 1_200)
  const elapsed = Math.max(0, input.performanceElapsedMs ?? 0)
  const accent = cue ? clamp(1 - elapsed / durationMs, 0, 1) : 0
  const pulse = cue && !reduced ? Math.sin(elapsed / 1_000 * 12.5) * accent : 0
  if (cue && accent > 0) {
    breath += 0.04 * accent
    switch (expression) {
      case 'happy':
        headTilt += 0.12 * accent + pulse * 0.06
        bodyYaw += pulse * 0.1
        mouthForm += 0.12 * accent
        cheek += 0.12 * accent
        eyeSmile = clamp(eyeSmile + 0.18 * accent, 0, 1)
        break
      case 'thinking':
        gazeY = clamp(gazeY + 0.08 * accent, -1, 1)
        headTilt += 0.08 * accent + pulse * 0.05
        bodyYaw += pulse * 0.08
        browForm -= 0.08 * accent
        break
      case 'listening':
        headTilt += pulse * 0.05
        bodyYaw += pulse * 0.07
        mouthForm += 0.06 * accent
        break
      case 'speaking':
        headTilt += pulse * 0.04
        bodyYaw += pulse * 0.05
        break
      case 'sleepy':
        headTilt += pulse * 0.02
        breath -= 0.03 * accent
        break
      case 'touchHead':
        headTilt += 0.16 * accent + pulse * 0.07
        bodyYaw += pulse * 0.12
        cheek += 0.1 * accent
        eyeSmile = clamp(eyeSmile + 0.12 * accent, 0, 1)
        break
      case 'touchFace':
        gazeX *= 0.18
        headTilt += pulse * 0.06
        cheek += 0.12 * accent
        break
      case 'touchBody':
        headTilt += 0.08 * accent + pulse * 0.05
        bodyYaw += pulse * 0.12
        break
      default:
        break
    }
  }

  const action = reduced ? null : planPortraitPuppetAction({
    nowMs,
    performanceCue: cue,
    performanceElapsedMs: input.performanceElapsedMs,
    allowIdleAction: !input.isSpeaking
      && !input.isListening
      && !input.isBusy
      && expression === 'idle'
      && !cue,
  })
  if (action && action.weight > 0) {
    const keep = 1 - action.weight * 0.45
    gazeX = clamp(gazeX * keep + action.eyeX, -1, 1)
    gazeY = clamp(gazeY + action.eyeY, -1, 1)
    headTilt = clamp(headTilt + action.headTilt * ACTION_HEAD_TILT_SCALE, -1, 1)
    bodyYaw = clamp(bodyYaw + action.bodyLean * ACTION_BODY_LEAN_SCALE, -1, 1)
    armSway = clamp(armSway * keep + action.armSway, -1.5, 1.5)
    breath = clamp(breath + action.breath, -1, 1)
    actionHeadYaw = action.headYaw
    actionHeadPitch = action.headBob * ACTION_HEAD_BOB_SCALE
    actionEyeDrop = action.eyeDrop
  }

  const bodyPitch = (reduced ? gazeY * 0.08 : gazeY * 0.18) * (expression === 'sleepy' ? 0.55 : 1)

  if (state.blinkLeft.nextBlinkAt === 0) {
    const first = nowMs + 1_500 + blinkHash(11) * 2_400
    state.blinkLeft.nextBlinkAt = first
    state.blinkRight.nextBlinkAt = first + RIGHT_BLINK_LAG_MS
    state.blinkLeft.phaseStartedAt = nowMs
    state.blinkRight.phaseStartedAt = nowMs
  }
  const doubleRoll = () => blinkHash(Math.floor(nowMs / 250) * 7 + 40)
  const leftOpen = reduced ? 1 : stepBlinkLane(
    state.blinkLeft,
    nowMs,
    (at) => scheduleHashedBlink(at, 1),
    { doubleChance: BLINK_DOUBLE_CHANCE, random: doubleRoll },
  )
  const rightOpen = reduced ? 1 : stepBlinkLane(
    state.blinkRight,
    nowMs,
    (at) => scheduleHashedBlink(at, 2),
    { doubleChance: BLINK_DOUBLE_CHANCE, random: doubleRoll },
  )
  const openScale = lidScale(expression)
  let blinkLeft = clamp(1 - leftOpen * openScale + actionEyeDrop, 0, 1)
  let blinkRight = clamp(1 - rightOpen * openScale + actionEyeDrop, 0, 1)
  if (!reduced && cue?.accentStyle === 'sparkle') {
    blinkLeft = clamp(blinkLeft - accent * 0.16, 0, 1)
    blinkRight = clamp(blinkRight - accent * 0.16, 0, 1)
  }
  if (!reduced && cue?.accentStyle === 'write') {
    blinkLeft = clamp(blinkLeft + (1 - blinkLeft) * 0.06, 0, 1)
    blinkRight = clamp(blinkRight + (1 - blinkRight) * 0.06, 0, 1)
  }

  return {
    headYaw: clamp(gazeX * 0.58 + actionHeadYaw, -1, 1),
    headPitch: clamp(gazeY * 0.42 + actionHeadPitch, -1, 1),
    headTilt: clamp(headTilt, -1, 1),
    eyeX: clamp(gazeX, -1, 1),
    eyeY: clamp(gazeY, -1, 1),
    eyeBallForm: clamp(eyeSmile * 0.4, 0, 1),
    blinkLeft,
    blinkRight,
    eyeSmileLeft: clamp(eyeSmile, 0, 1),
    eyeSmileRight: clamp(eyeSmile, 0, 1),
    eyeFormLeft: clamp(eyeForm, -1, 1),
    eyeFormRight: clamp(eyeForm, -1, 1),
    mouthOpen,
    mouthForm: clamp(mouthForm, -1, 1),
    mouthRound: clamp(mouthRound, 0, 1),
    mouthNarrow: clamp(mouthNarrow, 0, 1),
    mouthDown: clamp(mouthDown, 0, 1),
    browForm: clamp(browForm, -1, 1),
    browLeftY: clamp(browLeftY, -1, 1),
    browRightY: clamp(browRightY, -1, 1),
    browLeftX: clamp(gazeX * 0.16, -1, 1),
    browRightX: clamp(gazeX * 0.16, -1, 1),
    browLeftAngle: clamp(browLeftAngle, -1, 1),
    browRightAngle: clamp(browRightAngle, -1, 1),
    browLeftForm: clamp(browForm, -1, 1),
    browRightForm: clamp(browForm, -1, 1),
    cheek: clamp(cheek, 0, 1),
    bodyYaw: clamp(bodyYaw, -1, 1),
    bodyPitch: clamp(bodyPitch, -1, 1),
    bodyTilt: clamp(bodyYaw * 0.85, -1, 1),
    breath: clamp(breath, -1, 1),
    armSway: clamp(armSway, -1.5, 1.5),
  }
}
