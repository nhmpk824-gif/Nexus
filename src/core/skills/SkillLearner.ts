import type { Skill, SkillId, SkillOutcomeSignal } from './types'
import type { SkillRegistry } from './SkillRegistry'

export type SkillPromoteOptions = {
  minSuccessCount?: number
  minSuccessRatio?: number
  minDrafts?: number
}

export type SkillRetireOptions = {
  minFailureCount?: number
  maxSuccessRatio?: number
}

const DEFAULT_PROMOTE: Required<SkillPromoteOptions> = {
  minSuccessCount: 3,
  minSuccessRatio: 0.7,
  minDrafts: 1,
}

const DEFAULT_RETIRE: Required<SkillRetireOptions> = {
  minFailureCount: 5,
  maxSuccessRatio: 0.3,
}

export class SkillLearner {
  private readonly registry: SkillRegistry
  private readonly outcomes: SkillOutcomeSignal[] = []

  constructor(registry: SkillRegistry) {
    this.registry = registry
  }

  observe(signal: SkillOutcomeSignal): void {
    const stamped: SkillOutcomeSignal = {
      ...signal,
      timestamp: signal.timestamp ?? Date.now(),
    }
    this.outcomes.push(stamped)
    if (stamped.success) {
      this.registry.recordSuccess(stamped.skillId)
    } else {
      this.registry.recordFailure(stamped.skillId)
    }
  }

  getOutcomes(skillId?: SkillId): SkillOutcomeSignal[] {
    return skillId ? this.outcomes.filter((o) => o.skillId === skillId) : this.outcomes.slice()
  }

  evaluate(options: {
    promote?: SkillPromoteOptions
    retire?: SkillRetireOptions
  } = {}): {
    promoted: Skill[]
    retired: Skill[]
  } {
    const promoteCfg = { ...DEFAULT_PROMOTE, ...options.promote }
    const retireCfg = { ...DEFAULT_RETIRE, ...options.retire }

    const promoted: Skill[] = []
    const retired: Skill[] = []

    for (const skill of this.registry.list()) {
      const total = skill.successCount + skill.failureCount
      const ratio = total === 0 ? 0 : skill.successCount / total

      if (
        skill.status === 'draft' &&
        skill.successCount >= promoteCfg.minSuccessCount &&
        ratio >= promoteCfg.minSuccessRatio
      ) {
        const updated = this.registry.register({
          id: skill.id,
          name: skill.name,
          description: skill.description,
          trigger: skill.trigger,
          body: skill.body,
          status: 'active',
          metadata: skill.metadata,
        })
        promoted.push(updated)
        continue
      }

      if (
        skill.status === 'active' &&
        skill.failureCount >= retireCfg.minFailureCount &&
        ratio <= retireCfg.maxSuccessRatio
      ) {
        const updated = this.registry.register({
          id: skill.id,
          name: skill.name,
          description: skill.description,
          trigger: skill.trigger,
          body: skill.body,
          status: 'deprecated',
          metadata: skill.metadata,
        })
        retired.push(updated)
      }
    }

    return { promoted, retired }
  }

  proposeSkill(input: {
    name: string
    description: string
    trigger: Skill['trigger']
    body: string
    metadata?: Record<string, unknown>
  }): Skill {
    return this.registry.register({
      name: input.name,
      description: input.description,
      trigger: input.trigger,
      body: input.body,
      metadata: input.metadata,
      status: 'draft',
    })
  }
}
