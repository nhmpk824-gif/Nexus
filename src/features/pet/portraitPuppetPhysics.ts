import { clamp } from '../../lib/common.ts'

export type PortraitPuppetSpring = {
  position: number
  velocity: number
}

export type PortraitPuppetPhysicsState = {
  initialized: boolean
  headYaw: PortraitPuppetSpring
  headTilt: PortraitPuppetSpring
  bodyLean: PortraitPuppetSpring
  armSway: PortraitPuppetSpring
  hairSway: PortraitPuppetSpring
  clothSway: PortraitPuppetSpring
  pendantSway: PortraitPuppetSpring
  secondarySway: PortraitPuppetSpring
}

export type PortraitPuppetPhysicsTarget = {
  headYaw: number
  headTilt: number
  bodyLean: number
  /** Optional for v1/v2 callers; v3 poses always provide these channels. */
  armSway?: number
  hairSway?: number
  clothSway?: number
  pendantSway?: number
  secondarySway: number
}

export type PortraitPuppetPhysicsSample = Required<PortraitPuppetPhysicsTarget>

export function createPortraitPuppetPhysicsState(): PortraitPuppetPhysicsState {
  return {
    initialized: false,
    headYaw: { position: 0, velocity: 0 },
    headTilt: { position: 0, velocity: 0 },
    bodyLean: { position: 0, velocity: 0 },
    armSway: { position: 0, velocity: 0 },
    hairSway: { position: 0, velocity: 0 },
    clothSway: { position: 0, velocity: 0 },
    pendantSway: { position: 0, velocity: 0 },
    secondarySway: { position: 0, velocity: 0 },
  }
}

export function resetPortraitPuppetPhysics(
  state: PortraitPuppetPhysicsState,
  target: PortraitPuppetPhysicsTarget,
): PortraitPuppetPhysicsState {
  state.initialized = true
  state.headYaw = { position: target.headYaw, velocity: 0 }
  state.headTilt = { position: target.headTilt, velocity: 0 }
  state.bodyLean = { position: target.bodyLean, velocity: 0 }
  state.armSway = { position: target.armSway ?? 0, velocity: 0 }
  state.hairSway = { position: target.hairSway ?? 0, velocity: 0 }
  state.clothSway = { position: target.clothSway ?? 0, velocity: 0 }
  state.pendantSway = { position: target.pendantSway ?? 0, velocity: 0 }
  state.secondarySway = { position: target.secondarySway, velocity: 0 }
  return state
}

function stepSpring(
  spring: PortraitPuppetSpring,
  target: number,
  deltaSeconds: number,
  frequencyHz: number,
  dampingRatio: number,
) {
  const omega = Math.PI * 2 * frequencyHz
  const acceleration = omega * omega * (target - spring.position)
    - 2 * dampingRatio * omega * spring.velocity
  spring.velocity += acceleration * deltaSeconds
  spring.position += spring.velocity * deltaSeconds
}

/**
 * Advance head/body/hair channels with fixed substeps. Secondary motion is
 * driven by head angular velocity so it keeps moving briefly after a turn.
 */
export function stepPortraitPuppetPhysics(
  state: PortraitPuppetPhysicsState,
  target: PortraitPuppetPhysicsTarget,
  deltaMs: number,
): PortraitPuppetPhysicsSample {
  if (!state.initialized) resetPortraitPuppetPhysics(state, target)

  const totalSeconds = clamp(deltaMs / 1_000, 0, 1 / 30)
  const steps = Math.max(1, Math.ceil(totalSeconds / (1 / 120)))
  const stepSeconds = totalSeconds / steps

  for (let index = 0; index < steps; index += 1) {
    stepSpring(state.headYaw, target.headYaw, stepSeconds, 3.8, 0.82)
    stepSpring(state.headTilt, target.headTilt, stepSeconds, 3.3, 0.78)
    stepSpring(state.bodyLean, target.bodyLean, stepSeconds, 2, 0.9)
    const armTarget = clamp((target.armSway ?? 0) - state.bodyLean.velocity * 0.025, -1.3, 1.3)
    const hairTarget = clamp(
      (target.hairSway ?? 0) - state.headYaw.velocity * 0.11 - state.headTilt.velocity * 0.006,
      -1.4,
      1.4,
    )
    const clothTarget = clamp((target.clothSway ?? 0) - state.bodyLean.velocity * 0.075, -1.4, 1.4)
    const pendantTarget = clamp(
      (target.pendantSway ?? 0) - state.bodyLean.velocity * 0.09 - state.headYaw.velocity * 0.04,
      -1.5,
      1.5,
    )
    stepSpring(state.armSway, armTarget, stepSeconds, 1.7, 0.75)
    stepSpring(state.hairSway, hairTarget, stepSeconds, 2.4, 0.58)
    stepSpring(state.clothSway, clothTarget, stepSeconds, 1.45, 0.62)
    stepSpring(state.pendantSway, pendantTarget, stepSeconds, 1.8, 0.48)
    const inertialTarget = clamp(
      target.secondarySway - state.headYaw.velocity * 0.075,
      -1.25,
      1.25,
    )
    stepSpring(state.secondarySway, inertialTarget, stepSeconds, 2, 0.55)
  }

  return {
    headYaw: state.headYaw.position,
    headTilt: state.headTilt.position,
    bodyLean: state.bodyLean.position,
    armSway: state.armSway.position,
    hairSway: state.hairSway.position,
    clothSway: state.clothSway.position,
    pendantSway: state.pendantSway.position,
    secondarySway: state.secondarySway.position,
  }
}
