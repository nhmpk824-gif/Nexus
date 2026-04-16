import {
  CHAT_STORAGE_KEY,
  DAILY_MEMORY_STORAGE_KEY,
  MEMORY_STORAGE_KEY,
  ONBOARDING_STORAGE_KEY,
  readJson,
  SETTINGS_STORAGE_KEY,
  writeJson,
} from './core.ts'

export function loadOnboardingCompleted() {
  const stored = readJson<{ completedAt?: string } | null>(ONBOARDING_STORAGE_KEY, null)
  if (stored?.completedAt) {
    return true
  }

  // Backfill: any pre-existing user data implies onboarding was already done in
  // an older build that didn't yet record the flag explicitly.
  return Boolean(
    window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    || window.localStorage.getItem(CHAT_STORAGE_KEY)
    || window.localStorage.getItem(MEMORY_STORAGE_KEY)
    || window.localStorage.getItem(DAILY_MEMORY_STORAGE_KEY),
  )
}

export function saveOnboardingCompleted(completed = true) {
  if (!completed) {
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY)
    return
  }

  writeJson(ONBOARDING_STORAGE_KEY, {
    completedAt: new Date().toISOString(),
  })
}
