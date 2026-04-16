import type { PetMood, PetWindowPreferences } from '../../types'
import {
  PET_RUNTIME_STORAGE_KEY,
  PET_WINDOW_PREFERENCES_STORAGE_KEY,
  readJson,
  writeJson,
} from './core.ts'

type PetRuntimeState = {
  mood: PetMood
}

const defaultPetWindowPreferences: PetWindowPreferences = {
  isPinned: true,
  clickThrough: false,
}

const defaultPetRuntimeState: PetRuntimeState = {
  mood: 'idle',
}

export function loadPetWindowPreferences(): PetWindowPreferences {
  return {
    ...defaultPetWindowPreferences,
    ...readJson<Partial<PetWindowPreferences>>(PET_WINDOW_PREFERENCES_STORAGE_KEY, {}),
  }
}

export function savePetWindowPreferences(preferences: PetWindowPreferences) {
  writeJson(PET_WINDOW_PREFERENCES_STORAGE_KEY, preferences)
}

export function loadPetRuntimeState(): PetRuntimeState {
  return {
    ...defaultPetRuntimeState,
    ...readJson<Partial<PetRuntimeState>>(PET_RUNTIME_STORAGE_KEY, {}),
  }
}

export function savePetRuntimeState(state: PetRuntimeState) {
  writeJson(PET_RUNTIME_STORAGE_KEY, state)
}
