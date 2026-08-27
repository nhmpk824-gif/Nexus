/**
 * Standalone wear/perform module.
 *
 * Chat and settings are not wired yet. Call `decideSpritePetWear` from a
 * future composer hook, `planSpritePetWearBeats` from the sprite runtime,
 * and `createSpritePetWearSession` once a host can import and switch.
 */

import {
  detectSpritePetAtlasEdition,
  getSpritePetWearRow,
  resolveSpritePetWearState,
  type SpritePetAtlasEdition,
} from '../../../shared/spritePetWearContract.js'
import type {
  SpritePetWearBeat,
  SpritePetWearDecision,
  SpritePetWearHost,
  SpritePetWearMoment,
  SpritePetWearRequest,
} from './spritePetWearPorts.ts'

export type {
  SpritePetWearBeat,
  SpritePetWearDecision,
  SpritePetWearHost,
  SpritePetWearMoment,
  SpritePetWearRequest,
} from './spritePetWearPorts.ts'

const WEAR_INTENT_PATTERN = /做成?(?:一只|一个)?宠物|换上|穿上|变成它|用这张|make (?:this |it )?(?:my |a )?pet|wear this|put (?:this|it) on/iu

const MOMENT_BEATS: Record<SpritePetWearMoment, string[]> = {
  idle: ['idle'],
  listening: ['listening'],
  thinking: ['thinking'],
  speaking: ['thinking', 'speaking', 'happy'],
  happy: ['happy'],
  shy: ['shy'],
  sad: ['sad'],
  stuck: ['waiting'],
  alert: ['jumping', 'waving'],
  failed: ['failed'],
}

function normalizeText(value?: string) {
  return String(value ?? '').trim()
}

/** True when the user asked to wear / make a pet from the given picture. */
export function hasSpritePetWearIntent(text?: string) {
  const normalized = normalizeText(text)
  return Boolean(normalized) && WEAR_INTENT_PATTERN.test(normalized)
}

/** Combine spoken intent and image shape into a wear decision. */
export function decideSpritePetWear(input: SpritePetWearRequest = {}): SpritePetWearDecision {
  const edition = detectSpritePetAtlasEdition(
    Number(input.imageWidth),
    Number(input.imageHeight),
  )
  if (hasSpritePetWearIntent(input.text)) {
    return { shouldWear: true, reason: 'intent', edition }
  }
  if (edition === 'dense' || edition === 'legacy-8x9') {
    return { shouldWear: true, reason: 'atlas', edition }
  }
  return { shouldWear: false, reason: 'none', edition }
}

function collapseBeats(beats: SpritePetWearBeat[]) {
  const collapsed: SpritePetWearBeat[] = []
  for (const beat of beats) {
    const previous = collapsed.at(-1)
    if (previous && previous.playableState === beat.playableState) {
      previous.durationMs += beat.durationMs
      continue
    }
    collapsed.push({ ...beat })
  }
  return collapsed.slice(0, 3)
}

/**
 * Two or three stage beats for one companion moment. Adjacent beats that
 * fall back to the same legacy row are merged so 8x9 sheets do not flicker.
 */
export function planSpritePetWearBeats(
  edition: SpritePetAtlasEdition,
  moment: SpritePetWearMoment,
): SpritePetWearBeat[] {
  const desiredStates = MOMENT_BEATS[moment] ?? MOMENT_BEATS.idle
  return collapseBeats(desiredStates.map((desiredState) => {
    const playableState = resolveSpritePetWearState(edition, desiredState)
    const row = getSpritePetWearRow(edition, playableState)
    const durationMs = row.durationsMs.reduce((sum, value) => sum + value, 0)
    return { desiredState, playableState, durationMs }
  }))
}

/** Bind a future host. No-ops until import/switch/claim are passed in. */
export function createSpritePetWearSession(host: SpritePetWearHost) {
  return {
    async consider(input: SpritePetWearRequest) {
      const decision = decideSpritePetWear(input)
      if (!decision.shouldWear || !input.sourcePath) {
        return { ...decision, applied: false as const }
      }

      const imported = await host.importSheet({
        sourcePath: input.sourcePath,
        edition: decision.edition,
      })
      await host.switchAvatar(imported)
      await host.claim(imported)
      return { ...decision, applied: true as const, imported }
    },
  }
}
