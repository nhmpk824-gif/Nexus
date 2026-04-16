import type {
  AuthProfile,
  AuthProfileSnapshot,
  AuthProfileStatus,
  ProviderId,
} from './types'

const DEFAULT_COOLDOWN_MS = 60_000

export type RegisterProfileInput = {
  id: string
  providerId: ProviderId
  apiKey: string
  label?: string
}

export class AuthProfileStore {
  private readonly profiles = new Map<string, AuthProfile>()
  private readonly cooldownMs: number

  constructor(options?: { cooldownMs?: number }) {
    this.cooldownMs = options?.cooldownMs ?? DEFAULT_COOLDOWN_MS
  }

  register(input: RegisterProfileInput): AuthProfile {
    const existing = this.profiles.get(input.id)
    if (existing) {
      existing.providerId = input.providerId
      existing.apiKey = input.apiKey
      existing.label = input.label
      return existing
    }
    const profile: AuthProfile = {
      id: input.id,
      providerId: input.providerId,
      apiKey: input.apiKey,
      label: input.label,
      status: 'active',
      successCount: 0,
      failureCount: 0,
    }
    this.profiles.set(profile.id, profile)
    return profile
  }

  remove(id: string): void {
    this.profiles.delete(id)
  }

  get(id: string): AuthProfile | undefined {
    return this.profiles.get(id)
  }

  list(providerId?: ProviderId): AuthProfile[] {
    const all = Array.from(this.profiles.values())
    return providerId ? all.filter((p) => p.providerId === providerId) : all
  }

  pickNextActive(providerId: ProviderId, now: number = Date.now()): AuthProfile | undefined {
    const candidates: AuthProfile[] = []
    for (const profile of this.profiles.values()) {
      if (profile.providerId !== providerId) continue
      if (profile.status === 'cooldown' && profile.cooldownUntil && profile.cooldownUntil <= now) {
        profile.status = 'active'
        profile.cooldownUntil = undefined
      }
      if (profile.status === 'active') {
        candidates.push(profile)
      }
    }
    if (candidates.length === 0) return undefined
    candidates.sort((a, b) => (a.lastUsedAt ?? 0) - (b.lastUsedAt ?? 0))
    const picked = candidates[0]
    picked.lastUsedAt = now
    return picked
  }

  recordSuccess(id: string): void {
    const profile = this.profiles.get(id)
    if (!profile) return
    profile.successCount += 1
    profile.status = 'active'
    profile.cooldownUntil = undefined
  }

  recordFailure(id: string, reason: 'rate_limit' | 'auth' | 'other' = 'other'): void {
    const profile = this.profiles.get(id)
    if (!profile) return
    profile.failureCount += 1
    if (reason === 'auth') {
      profile.status = 'failed'
      return
    }
    profile.status = 'cooldown'
    profile.cooldownUntil = Date.now() + this.cooldownMs
  }

  setStatus(id: string, status: AuthProfileStatus): void {
    const profile = this.profiles.get(id)
    if (!profile) return
    profile.status = status
    if (status !== 'cooldown') {
      profile.cooldownUntil = undefined
    }
  }

  snapshot(): AuthProfileSnapshot {
    return { profiles: Array.from(this.profiles.values()).map((p) => ({ ...p })) }
  }

  restore(snapshot: AuthProfileSnapshot): void {
    this.profiles.clear()
    for (const profile of snapshot.profiles) {
      this.profiles.set(profile.id, { ...profile })
    }
  }
}
