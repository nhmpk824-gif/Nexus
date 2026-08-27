import type { CoreTime } from '../time.ts'
import { systemTime } from '../time.ts'
import type { Skill, SkillId, SkillMatchContext, SkillMatchResult } from './types.ts'

export type SkillBackend = {
  load(): Promise<Skill[]>
  save(skills: Skill[]): Promise<void>
}

class InMemorySkillBackend implements SkillBackend {
  private stored: Skill[] = []
  async load(): Promise<Skill[]> {
    return this.stored.map((s) => ({ ...s }))
  }
  async save(skills: Skill[]): Promise<void> {
    this.stored = skills.map((s) => ({ ...s }))
  }
}

export type RegisterSkillInput = Omit<
  Skill,
  'id' | 'status' | 'version' | 'successCount' | 'failureCount' | 'createdAt' | 'updatedAt'
> & {
  id?: SkillId
  status?: Skill['status']
}

function cloneSkill(skill: Skill): Skill {
  return {
    ...skill,
    trigger: {
      ...skill.trigger,
      ...(skill.trigger.keywords ? { keywords: [...skill.trigger.keywords] } : {}),
      ...(skill.trigger.intents ? { intents: [...skill.trigger.intents] } : {}),
      ...(skill.trigger.channels ? { channels: [...skill.trigger.channels] } : {}),
    },
    ...(skill.metadata ? { metadata: { ...skill.metadata } } : {}),
  }
}

export class SkillRegistry {
  private readonly skills = new Map<SkillId, Skill>()
  private readonly backend: SkillBackend
  private readonly time: CoreTime

  constructor(options?: { backend?: SkillBackend; time?: CoreTime }) {
    this.backend = options?.backend ?? new InMemorySkillBackend()
    this.time = options?.time ?? systemTime()
  }

  async load(): Promise<void> {
    const loaded = await this.backend.load()
    this.skills.clear()
    for (const skill of loaded) {
      this.skills.set(skill.id, cloneSkill(skill))
    }
  }

  async persist(): Promise<void> {
    await this.backend.save(Array.from(this.skills.values()))
  }

  register(input: RegisterSkillInput): Skill {
    const now = this.time.now()
    const id = input.id ?? this.time.id('skill-')
    const existing = this.skills.get(id)
    if (existing) {
      const updated: Skill = {
        ...existing,
        name: input.name,
        description: input.description,
        trigger: {
          ...input.trigger,
          ...(input.trigger.keywords ? { keywords: [...input.trigger.keywords] } : {}),
          ...(input.trigger.intents ? { intents: [...input.trigger.intents] } : {}),
          ...(input.trigger.channels ? { channels: [...input.trigger.channels] } : {}),
        },
        body: input.body,
        status: input.status ?? existing.status,
        version: existing.version + 1,
        updatedAt: now,
        metadata: input.metadata,
      }
      this.skills.set(id, updated)
      return cloneSkill(updated)
    }
    const skill: Skill = {
      id,
      name: input.name,
      description: input.description,
      trigger: {
        ...input.trigger,
        ...(input.trigger.keywords ? { keywords: [...input.trigger.keywords] } : {}),
        ...(input.trigger.intents ? { intents: [...input.trigger.intents] } : {}),
        ...(input.trigger.channels ? { channels: [...input.trigger.channels] } : {}),
      },
      body: input.body,
      status: input.status ?? 'draft',
      version: 1,
      successCount: 0,
      failureCount: 0,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata,
    }
    this.skills.set(id, skill)
    return cloneSkill(skill)
  }

  get(id: SkillId): Skill | undefined {
    const skill = this.skills.get(id)
    return skill ? cloneSkill(skill) : undefined
  }

  list(status?: Skill['status']): Skill[] {
    const all = Array.from(this.skills.values())
    const filtered = status ? all.filter((s) => s.status === status) : all
    return filtered.map(cloneSkill)
  }

  remove(id: SkillId): boolean {
    return this.skills.delete(id)
  }

  match(context: SkillMatchContext): SkillMatchResult[] {
    const results: SkillMatchResult[] = []
    const text = context.text.toLowerCase()
    for (const skill of this.skills.values()) {
      if (skill.status !== 'active') continue
      const reasons: string[] = []
      let score = 0
      const { trigger } = skill

      if (trigger.keywords?.length) {
        const hits = trigger.keywords.filter((kw) => text.includes(kw.toLowerCase()))
        if (hits.length === 0) continue
        score += hits.length * 2
        reasons.push(`keywords:${hits.join(',')}`)
      }

      if (trigger.intents?.length) {
        if (!context.intent || !trigger.intents.includes(context.intent)) continue
        score += 3
        reasons.push(`intent:${context.intent}`)
      }

      if (trigger.channels?.length) {
        if (!context.channelId || !trigger.channels.includes(context.channelId)) continue
        score += 1
        reasons.push(`channel:${context.channelId}`)
      }

      if (trigger.minHistoryLength !== undefined) {
        if (context.historyLength < trigger.minHistoryLength) continue
        score += 1
      }

      if (trigger.hasToolCalls !== undefined) {
        if (trigger.hasToolCalls !== context.hasToolCalls) continue
        score += 1
      }

      const successRatio =
        skill.successCount + skill.failureCount === 0
          ? 0.5
          : skill.successCount / (skill.successCount + skill.failureCount)
      score += successRatio * 2

      results.push({ skill: cloneSkill(skill), score, reasons })
    }
    results.sort((a, b) => b.score - a.score)
    return results
  }

  recordSuccess(id: SkillId): void {
    const skill = this.skills.get(id)
    if (!skill) return
    skill.successCount += 1
    skill.updatedAt = this.time.now()
  }

  recordFailure(id: SkillId): void {
    const skill = this.skills.get(id)
    if (!skill) return
    skill.failureCount += 1
    skill.updatedAt = this.time.now()
  }
}
