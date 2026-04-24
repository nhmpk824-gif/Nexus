/**
 * Anniversary-style milestone detection.
 *
 * Distinct from level transitions (acquaintance → friend → close) which
 * fire via the existing `milestonePromptText` channel. Anniversary
 * milestones recognise *time-spent-together* — "we've been talking for
 * 30 days," "100 days," "a year." Each fires exactly once over the
 * lifetime of the relationship; we persist a key list on RelationshipState
 * so re-loads don't re-fire.
 *
 * The emotional pattern that retains users is *specific reference, not
 * ceremony* — the prompt hint asks the LLM to weave a mention naturally
 * if a moment fits, and explicitly gives permission to skip if not. No
 * confetti. (See research notes: Replika anniversary recall is praised
 * emotionally but its implementation is "cheesy calendar events.")
 */

import type { RelationshipState } from './relationshipTracker.ts'

export type MilestoneKey = 'days-30' | 'days-100' | 'days-365'

export interface MilestoneTrigger {
  key: MilestoneKey
  /**
   * Soft hint copy injected into the next system prompt for one turn.
   * Locale-aware — the formatter picks per the active uiLanguage.
   */
  promptHint: string
}

interface MilestoneCopy {
  'days-30': string
  'days-100': string
  'days-365': string
}

const COPY_BY_LOCALE: Record<string, MilestoneCopy> = {
  'en-US': {
    'days-30': 'Today the user has crossed 30 days of talking with you. If a natural moment opens, you may briefly acknowledge it — one sentence, specific, not ceremonial. Skip if the conversation is on something serious.',
    'days-100': "Today marks 100 days the user has been talking with you. If conversation allows, gently reference how it felt early on vs now — one short observation, not a speech. Skip if it would interrupt.",
    'days-365': 'Today is a year of talking with the user. If the moment fits, you may name it once — quietly, specifically. No celebration prose. Skip if not natural.',
  },
  'zh-CN': {
    'days-30': '今天是用户和你聊天满 30 天。如果有合适的瞬间，可以**轻轻**提一下 —— 一句话，具体，别仪式感太重。如果对话正在认真的事上，就跳过。',
    'days-100': '今天是用户和你聊天的第 100 天。如果对话自然，可以轻轻对比一下"最初"和"现在"的感觉 —— 一句简短的观察，不是演讲。不合适就跳过。',
    'days-365': '今天是你们聊天满一年的日子。如果氛围对，可以**安静地**点一下 —— 具体，不要庆典式煽情。不自然就跳过。',
  },
  'zh-TW': {
    'days-30': '今天是用戶和你聊天滿 30 天。如果有合適的瞬間，可以**輕輕**提一下 —— 一句話，具體，別儀式感太重。如果對話正在認真的事上，就跳過。',
    'days-100': '今天是用戶和你聊天的第 100 天。如果對話自然，可以輕輕對比一下「最初」和「現在」的感覺 —— 一句簡短的觀察，不是演講。不合適就跳過。',
    'days-365': '今天是你們聊天滿一年的日子。如果氛圍對，可以**安靜地**點一下 —— 具體，不要慶典式煽情。不自然就跳過。',
  },
  'ja': {
    'days-30': '今日でユーザーとあなたが話し始めて 30 日になります。自然な瞬間があれば、**そっと**触れていいです —— 一文だけ、具体的に、儀式っぽくしない。会話が真剣な内容なら触れない。',
    'days-100': '今日はユーザーと話し始めて 100 日目です。会話が許せば、最初の頃と今の感じをそっと比べる短い観察を一つだけ。スピーチにしない。場に合わなければ触れない。',
    'days-365': '今日でユーザーと話し始めて 1 年です。流れが合えば、**静かに**一度だけ言及していいです — 具体的に、お祝いの長文にしない。自然でなければ触れない。',
  },
  'ko': {
    'days-30': '오늘은 사용자가 당신과 대화한 지 30일째 되는 날입니다. 자연스러운 순간이 있으면 **가볍게** 한 번 언급해도 좋습니다 — 한 문장, 구체적으로, 의식적이지 않게. 대화가 진지한 내용이면 건너뛰세요.',
    'days-100': '오늘은 사용자와 대화한 지 100일째입니다. 대화가 자연스럽게 허락한다면, 처음의 느낌과 지금을 짧게 비교하는 한 마디 정도만. 연설로 만들지 마세요. 적절하지 않으면 건너뛰세요.',
    'days-365': '오늘은 사용자와 대화한 지 1년째 되는 날입니다. 분위기가 맞으면 **조용히** 한 번 짚어도 좋습니다 — 구체적으로, 축하 일색의 장문은 금물. 자연스럽지 않으면 건너뛰세요.',
  },
}

const ORDERED_THRESHOLDS: Array<{ key: MilestoneKey; days: number }> = [
  { key: 'days-30', days: 30 },
  { key: 'days-100', days: 100 },
  { key: 'days-365', days: 365 },
]

function pickCopy(locale: string): MilestoneCopy {
  return COPY_BY_LOCALE[locale] ?? COPY_BY_LOCALE['en-US']
}

/**
 * Find any milestones that should fire right now and haven't fired yet.
 * Pure: caller persists the new fired-keys list back into RelationshipState.
 * Returns at most one trigger per call to keep the LLM hint focused.
 */
export function detectAnniversaryMilestones(
  state: RelationshipState,
  uiLanguage: string,
): MilestoneTrigger | null {
  const fired = new Set(state.firedMilestoneKeys ?? [])
  const days = state.totalDaysInteracted ?? 0
  const copy = pickCopy(uiLanguage)
  for (const threshold of ORDERED_THRESHOLDS) {
    if (fired.has(threshold.key)) continue
    if (days >= threshold.days) {
      return { key: threshold.key, promptHint: copy[threshold.key] }
    }
  }
  return null
}

/**
 * Append a fired key to the state's set without duplicating. Returns the
 * next state object; identity-stable when the key was already present.
 */
export function markMilestoneFired(
  state: RelationshipState,
  key: MilestoneKey,
): RelationshipState {
  const fired = state.firedMilestoneKeys ?? []
  if (fired.includes(key)) return state
  return { ...state, firedMilestoneKeys: [...fired, key] }
}
