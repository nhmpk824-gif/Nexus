/**
 * Subagent dispatcher system-prompt dispatcher — per UI language.
 *
 * All narrative framing the subagent LLM reads is localized here. The
 * tool schema (web_search etc.) and the `Task:` / `Purpose:` labels that
 * structure the user turn stay in English across every locale, because
 * they match the tool-call contract the dispatcher expects.
 */

import type { UiLanguage } from '../../../../types'
import { normalizeUiLanguage } from '../../../../lib/uiLanguage.ts'
import { zhCNSubagentPrompts } from './subagent.zh-CN.ts'
import { zhTWSubagentPrompts } from './subagent.zh-TW.ts'
import { enUSSubagentPrompts } from './subagent.en-US.ts'
import { jaSubagentPrompts } from './subagent.ja.ts'
import { koSubagentPrompts } from './subagent.ko.ts'

export interface SubagentPromptStrings {
  /** Two-line opening that identifies the subagent as a back-office worker. */
  header: (params: { personaName: string }) => string[]
  /** Optional block showing a truncated persona-soul excerpt as tone reference. */
  personaToneHeader: (params: { personaName: string; soulExcerpt: string }) => string
  /** `# Work rules` header (localized label). */
  workRulesHeader: string
  /** The actual rule bullets — already include the leading dash. */
  workRules: (params: { personaName: string }) => string[]
  /** Localized user-turn text (keeps `Task:` / `Purpose:` labels in English). */
  userMessage: (params: { task: string; purpose: string }) => string
}

const REGISTRY: Record<UiLanguage, SubagentPromptStrings> = {
  'zh-CN': zhCNSubagentPrompts,
  'zh-TW': zhTWSubagentPrompts,
  'en-US': enUSSubagentPrompts,
  ja: jaSubagentPrompts,
  ko: koSubagentPrompts,
}

export function getSubagentPromptStrings(
  language: UiLanguage | undefined,
): SubagentPromptStrings {
  return REGISTRY[normalizeUiLanguage(language)]
}
