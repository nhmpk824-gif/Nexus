import type { AuthProfile, AuthProfileSnapshot } from '../../core'
import { AUTH_PROFILES_STORAGE_KEY, readJson, writeJson } from './core.ts'

export function loadAuthProfileSnapshot(): AuthProfileSnapshot {
  return readJson<AuthProfileSnapshot>(AUTH_PROFILES_STORAGE_KEY, { profiles: [] })
}

export function persistAuthProfileSnapshot(snapshot: AuthProfileSnapshot): void {
  writeJson(AUTH_PROFILES_STORAGE_KEY, snapshot)
}

export function upsertStoredAuthProfile(profile: AuthProfile): void {
  const snapshot = loadAuthProfileSnapshot()
  const next = snapshot.profiles.filter((p) => p.id !== profile.id)
  next.push({ ...profile })
  persistAuthProfileSnapshot({ profiles: next })
}

export function removeStoredAuthProfile(id: string): void {
  const snapshot = loadAuthProfileSnapshot()
  persistAuthProfileSnapshot({
    profiles: snapshot.profiles.filter((p) => p.id !== id),
  })
}
