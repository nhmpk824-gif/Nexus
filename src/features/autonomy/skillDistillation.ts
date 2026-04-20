/**
 * Skill auto-distillation — extracts reusable skill templates from conversation history.
 *
 * During the memory dream phase, recent conversations are analyzed for repeated
 * multi-step patterns. Discovered patterns are saved as skill templates in long-term
 * memory with category 'skill'. When a user later makes a similar request, the
 * semantic memory search surfaces the skill template, letting the LLM follow a
 * proven path instead of improvising.
 */

import type { DailyMemoryEntry, UiLanguage } from '../../types'
import { normalizeUiLanguage } from '../../lib/uiLanguage.ts'

const DISTILLATION_SYSTEM_PROMPT = `You are a skill extraction module. Your job is to analyze conversation history and identify multi-step patterns the user has performed repeatedly or is likely to need again.

For each discovered skill, output a concise skill description so the AI assistant can quickly execute it the next time a similar request appears.

Output format (strict JSON, no markdown code blocks):
{
  "skills": [
    {
      "name": "skill name (4-12 characters)",
      "trigger": "how the user might phrase a request that triggers this skill",
      "steps": "concise description of the execution steps",
      "tools": ["tool IDs involved, e.g. web_search, weather"]
    }
  ]
}

Rules:
- Only extract operation patterns that have appeared at least twice, or operations the user has explicitly said they will want again
- Describe each skill's steps in 1-2 sentences; do not be verbose
- If no extractable skill is found, return {"skills": []}
- Do not duplicate existing skills`

export type DistilledSkill = {
  name: string
  trigger: string
  steps: string
  tools: string[]
}

export function buildSkillDistillationPrompt(
  dailyEntries: DailyMemoryEntry[],
  existingSkills: string[],
): { system: string; user: string } | null {
  if (dailyEntries.length < 6) return null

  const recentEntries = dailyEntries.slice(-60)
  const entriesText = recentEntries
    .map((e) => `[${e.day} ${e.role}] ${e.content}`)
    .join('\n')

  const existingSection = existingSkills.length
    ? `\nExisting skills (do not duplicate):\n${existingSkills.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n`
    : ''

  return {
    system: DISTILLATION_SYSTEM_PROMPT,
    user: `Extract reusable skill patterns from the following conversation log:${existingSection}\n## Conversation log\n${entriesText}`,
  }
}

export function parseSkillDistillationResponse(content: string): DistilledSkill[] {
  try {
    let cleaned = content.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }

    const parsed = JSON.parse(cleaned)
    const raw = Array.isArray(parsed.skills) ? parsed.skills : []

    return raw.filter(
      (s: unknown): s is DistilledSkill =>
        typeof s === 'object' && s !== null
        && typeof (s as Record<string, unknown>).name === 'string'
        && typeof (s as Record<string, unknown>).trigger === 'string'
        && typeof (s as Record<string, unknown>).steps === 'string',
    ).map((s: DistilledSkill) => ({
      name: s.name,
      trigger: s.trigger,
      steps: s.steps,
      tools: Array.isArray(s.tools) ? s.tools.filter((t) => typeof t === 'string') : [],
    }))
  } catch {
    return []
  }
}

/**
 * Narrative labels around the `【技能】` marker. The marker itself is a
 * HOLDOUT — `useMemoryDream.ts` filters existing skill memories by
 * `content.startsWith('【技能】')`, so we MUST emit that exact prefix in
 * every locale. Only the "trigger / steps / tools" labels are localized.
 */
type SkillLabels = {
  trigger: string
  steps: string
  tools: string
}

const SKILL_LABELS: Record<UiLanguage, SkillLabels> = {
  'zh-CN': { trigger: '触发', steps: '步骤', tools: '工具' },
  'zh-TW': { trigger: '觸發', steps: '步驟', tools: '工具' },
  'en-US': { trigger: 'trigger', steps: 'steps', tools: 'tools' },
  ja: { trigger: 'トリガー', steps: '手順', tools: 'ツール' },
  ko: { trigger: '트리거', steps: '단계', tools: '도구' },
}

export function formatSkillAsMemory(
  skill: DistilledSkill,
  uiLanguage?: UiLanguage,
): string {
  const labels = SKILL_LABELS[normalizeUiLanguage(uiLanguage)]
  const toolsPart = skill.tools.length ? ` [${labels.tools}: ${skill.tools.join(', ')}]` : ''
  return `【技能】${skill.name} — ${labels.trigger}：${skill.trigger} — ${labels.steps}：${skill.steps}${toolsPart}`
}
