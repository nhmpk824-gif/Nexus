import type { StoredMessage } from './types'
import type { SessionStore } from './SessionStore'
import { tokenize } from './SessionStore'

export type CuratedFact = {
  sessionId: string
  messageIndex: number
  text: string
  salience: number
  keywords: string[]
  role: StoredMessage['role']
  timestamp: number
}

export type CurationOptions = {
  maxFacts?: number
  minSalience?: number
  minMessageLength?: number
}

const FACT_SIGNALS = [
  'remember',
  'note',
  'prefer',
  'always',
  'never',
  'deadline',
  'tomorrow',
  'next week',
  'my ',
  '记住',
  '记得',
  '偏好',
  '总是',
  '从不',
  '截止',
  '下周',
  '我的',
]

export class CurationEngine {
  private readonly store: SessionStore

  constructor(store: SessionStore) {
    this.store = store
  }

  curateSession(sessionId: string, options: CurationOptions = {}): CuratedFact[] {
    const messages = this.store.getMessages(sessionId)
    const minLength = options.minMessageLength ?? 12
    const minSalience = options.minSalience ?? 1
    const facts: CuratedFact[] = []

    for (const message of messages) {
      if (message.content.length < minLength) continue
      if (message.role === 'system' || message.role === 'tool') continue

      const { salience, keywords } = this.score(message.content)
      if (salience < minSalience) continue

      facts.push({
        sessionId,
        messageIndex: message.messageIndex,
        text: message.content,
        salience,
        keywords,
        role: message.role,
        timestamp: message.timestamp,
      })
    }

    facts.sort((a, b) => b.salience - a.salience)
    return options.maxFacts ? facts.slice(0, options.maxFacts) : facts
  }

  private score(text: string): { salience: number; keywords: string[] } {
    const lowered = text.toLowerCase()
    let salience = 0
    for (const signal of FACT_SIGNALS) {
      if (lowered.includes(signal)) salience += 2
    }
    if (/\d{4}-\d{2}-\d{2}/.test(text)) salience += 2
    if (/[？?！!]/.test(text)) salience -= 1
    salience += Math.min(text.length / 160, 2)
    const tokens = tokenize(text)
    const keywords = tokens.slice(0, 8)
    return { salience, keywords }
  }
}
