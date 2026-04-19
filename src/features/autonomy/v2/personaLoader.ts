/**
 * Pure persona loader — takes an absolute rootDir and reads the six files
 * that make up a v2 persona profile. No Electron imports, no IPC. The
 * Electron-side wrapper in `electron/services/personaLoader.js` resolves
 * the userData path and calls into this.
 *
 * File layout (all optional):
 *   <root>/soul.md        identity + speaking voice + backstory (markdown)
 *   <root>/memory.md      persona-private memory (markdown)
 *   <root>/examples.md    few-shot dialogues (structured markdown, see below)
 *   <root>/style.json     signature/forbidden/tone (PersonaStyle)
 *   <root>/voice.json     TTS override (PersonaVoice)
 *   <root>/tools.json     tool allowlist/blocklist (PersonaTools)
 *
 * examples.md format — each example block is an H3 header with a "User:" /
 * "Assistant:" pair. Any line that starts with `User:` or `Assistant:`
 * starts a new turn, text on subsequent lines until the next header or
 * turn marker is folded into that turn's content. This is deliberately
 * forgiving so the user can hand-edit the file without breaking the parser.
 *
 * Example:
 *     ### Morning greeting
 *     User: 早
 *     Assistant: 醒啦。今天的待办我调出来了。
 *
 *     ### Apologising for a mistake
 *     User: 你刚刚说错了
 *     Assistant: 嗯，是我搞错了 — 改一下。
 */

import type {
  LoadedPersona,
  PersonaFewShotExample,
  PersonaStyle,
  PersonaTools,
  PersonaVoice,
} from './personaTypes.ts'
import { createEmptyLoadedPersona } from './personaTypes.ts'

// ── File IO abstraction ─────────────────────────────────────────────────────
// We accept a FileReader function instead of importing Node's fs directly so
// this module stays testable without filesystem side-effects.

export type FileReader = (relativePath: string) => Promise<string | null>

export interface LoadPersonaOptions {
  /** Profile id used both as directory name and LoadedPersona.id. */
  id: string
  /** Absolute path the reader resolves relative paths against. */
  rootDir: string
  /** Async read function. Returns null when the file doesn't exist. */
  read: FileReader
}

// ── Parsing helpers ─────────────────────────────────────────────────────────

function safeParseJson<T>(raw: string, fallback: T): T {
  if (!raw.trim()) return fallback
  try {
    const parsed = JSON.parse(raw)
    // Only plain objects are accepted — arrays, strings, numbers, null all
    // fall back. style/voice/tools are all object-shaped schemas; a stray
    // top-level array would otherwise silently replace the {} default.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as T
    }
    return fallback
  } catch {
    return fallback
  }
}

/**
 * Parse few-shot dialogues from markdown. Forgiving grammar: any line starting
 * with `User:` (or `用户:` / `U:`) starts a user turn; any line starting with
 * `Assistant:` (or `助手:` / `A:`) starts an assistant turn. Subsequent lines
 * until the next role marker or H-tag header fold into the current turn.
 *
 * Pairs are emitted in file order. A stray user turn without a following
 * assistant turn is dropped (incomplete example).
 */
export function parseExamplesMarkdown(raw: string): PersonaFewShotExample[] {
  if (!raw.trim()) return []

  const examples: PersonaFewShotExample[] = []
  const userRe = /^(?:User|用户|U)\s*[:：]\s*(.*)$/i
  const asstRe = /^(?:Assistant|助手|Bot|A)\s*[:：]\s*(.*)$/i
  const headerRe = /^#{1,6}\s/
  type Turn = { role: 'user' | 'assistant'; content: string }
  const turns: Turn[] = []
  let current: Turn | null = null

  const pushCurrent = () => {
    if (current) {
      current.content = current.content.trim()
      if (current.content) turns.push(current)
      current = null
    }
  }

  for (const line of raw.split(/\r?\n/)) {
    if (headerRe.test(line)) {
      pushCurrent()
      continue
    }
    const uMatch = userRe.exec(line)
    if (uMatch) {
      pushCurrent()
      current = { role: 'user', content: uMatch[1] }
      continue
    }
    const aMatch = asstRe.exec(line)
    if (aMatch) {
      pushCurrent()
      current = { role: 'assistant', content: aMatch[1] }
      continue
    }
    if (current) {
      current.content += (current.content ? '\n' : '') + line
    }
  }
  pushCurrent()

  // Pair adjacent user/assistant turns.
  for (let i = 0; i + 1 < turns.length; i += 1) {
    if (turns[i].role === 'user' && turns[i + 1].role === 'assistant') {
      examples.push({
        user: turns[i].content,
        assistant: turns[i + 1].content,
      })
      i += 1 // skip the assistant we just consumed
    }
  }
  return examples
}

// ── Main loader ─────────────────────────────────────────────────────────────

export async function loadPersona(options: LoadPersonaOptions): Promise<LoadedPersona> {
  const out = createEmptyLoadedPersona(options.id, options.rootDir)

  const [soul, memory, examplesRaw, styleRaw, voiceRaw, toolsRaw] = await Promise.all([
    options.read('soul.md'),
    options.read('memory.md'),
    options.read('examples.md'),
    options.read('style.json'),
    options.read('voice.json'),
    options.read('tools.json'),
  ])

  if (soul != null) { out.soul = soul.trim(); out.present = true }
  if (memory != null) { out.memory = memory.trim(); out.present = true }
  if (examplesRaw != null) {
    out.examplesRaw = examplesRaw.trim()
    out.examples = parseExamplesMarkdown(examplesRaw)
    out.present = true
  }
  if (styleRaw != null) {
    out.style = safeParseJson<PersonaStyle>(styleRaw, {})
    out.present = true
  }
  if (voiceRaw != null) {
    out.voice = safeParseJson<PersonaVoice>(voiceRaw, {})
    out.present = true
  }
  if (toolsRaw != null) {
    out.tools = safeParseJson<PersonaTools>(toolsRaw, {})
    out.present = true
  }

  return out
}
