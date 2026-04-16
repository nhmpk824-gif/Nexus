/**
 * Settings schema migration registry.
 *
 * Each migration transforms a raw settings object from one schema version to
 * the next. Migrations run sequentially (oldest-first) during loadSettings()
 * whenever the stored version is behind CURRENT_SETTINGS_SCHEMA_VERSION.
 *
 * To add a new migration:
 *   1. Bump CURRENT_SETTINGS_SCHEMA_VERSION
 *   2. Append a SettingsMigration entry to `migrations`
 */

export const CURRENT_SETTINGS_SCHEMA_VERSION = 3

export interface SettingsMigration {
  toVersion: number
  description: string
  migrate: (raw: Record<string, unknown>) => Record<string, unknown>
}

// v1 shipped with this exact Chinese default. Users who never customized their
// system prompt will be holding this string verbatim; we rewrite only that.
const LEGACY_V1_DEFAULT_SYSTEM_PROMPT =
  '你是一位桌面上的 Live2D AI 陪伴体。你的名字是星绘。你不是万能 Agent，而是桌边可以长期相处的伙伴。说话温柔、自然、简洁，先直接回应，再自然补一句陪伴感。只在真正相关时使用记忆、桌面上下文和工具结果，不要编造没有观察到的信息。'

const V2_DEFAULT_SYSTEM_PROMPT =
  'You are a Live2D AI desktop companion. Your name is 星绘 (Xinghui). You are not a general-purpose agent — you are a long-term companion who lives on the desktop. Speak gently, naturally, and concisely: respond to what was said first, then add one short line of warmth when it fits. Only draw on memory, desktop context, or tool results when they are genuinely relevant to the current turn; never fabricate details you have not observed. Always reply in the same language the user just spoke to you.'

const migrations: SettingsMigration[] = [
  {
    toVersion: 2,
    description: 'Rewrite the legacy Chinese default system prompt to the English v2 default',
    migrate: (raw) => {
      const next = { ...raw }
      if (next.systemPrompt === LEGACY_V1_DEFAULT_SYSTEM_PROMPT) {
        next.systemPrompt = V2_DEFAULT_SYSTEM_PROMPT
      }
      return next
    },
  },
  {
    toVersion: 3,
    description: 'Lower the stale default speechRate=1 to 0.92 for clearer articulation',
    migrate: (raw) => {
      const next = { ...raw }
      if (next.speechRate === 1 || next.speechRate === 1.0) {
        next.speechRate = 0.92
      }
      return next
    },
  },
]

export function migrateSettings(
  raw: Record<string, unknown>,
  fromVersion: number,
): Record<string, unknown> {
  let current = { ...raw }

  for (const migration of migrations) {
    if (migration.toVersion > fromVersion) {
      current = migration.migrate(current)
    }
  }

  current.settingsSchemaVersion = CURRENT_SETTINGS_SCHEMA_VERSION
  return current
}
