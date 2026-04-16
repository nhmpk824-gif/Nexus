import type { SettingsSectionId } from './settingsDrawerSupport'
import type { PetModelDefinition } from '../features/pet'
import { getWebSearchProviderPreset } from '../lib/webSearchProviders'
import { getApiProviderPreset } from '../lib'
import type { AppSettings, DailyMemoryEntry, DebugConsoleEvent, MemoryItem } from '../types'

export type SettingsSectionDescriptionMap = Record<SettingsSectionId, string>

export type SettingsSectionMetaEntry = {
  eyebrow: string
  glyph: string
  description: string
  preview: string[]
}

export type SettingsSectionMetaMap = Record<SettingsSectionId, SettingsSectionMetaEntry>

type Translator = (zhCN: string, enUS: string) => string

export type BuildSettingsSectionMetaInput = {
  t: Translator
  draft: AppSettings
  petModel: PetModelDefinition | undefined
  memories: MemoryItem[]
  dailyMemoryEntries: DailyMemoryEntry[]
  chatMessageCount: number
  liveTranscript: string
  debugConsoleEvents: DebugConsoleEvent[]
  continuousVoiceActive: boolean
  clickThroughEnabled: boolean
}

export function buildSettingsSectionDescriptions(t: Translator): SettingsSectionDescriptionMap {
  return {
    console: t('运行控制台：语音状态、API 用量、操作记录、提醒和后台任务一览。', 'Runtime console: voice status, API usage, action log, reminders, and background tasks at a glance.'),
    model: t('单独管理大模型提供商、模型名称和主链路故障切换。', 'Manage the primary LLM provider, model id, and failover in one place.'),
    chat: t('调整角色名称、用户称呼、系统提示词和 Live2D 角色。', 'Tune the companion identity, user name, system prompt, and Live2D character.'),
    history: t('管理当前会话聊天记录的导入、导出与清理。', 'Manage import, export, and cleanup for the current chat history.'),
    memory: t('整理长期记忆、日记和向量检索策略。', 'Manage long-term memory, diary entries, and retrieval strategy.'),
    voice: t('统一配置连续对话、输入输出链路和语音体验。', 'Configure continuous talk mode plus the input and output voice pipeline.'),
    window: t('控制桌宠、面板和桌面交互方式。', 'Control the desktop pet, panel, and on-screen behavior.'),
    integrations: t('把 Nexus 连到外部系统：MCP 工具、游戏服务器、Telegram / Discord 聊天桥。', 'Connect Nexus to external systems: MCP tools, game servers, and Telegram / Discord chat bridges.'),
    tools: t('决定助手能不能自己调用搜索、天气、打开链接这些工具，并配置搜索后端。', 'Control whether the companion can call search, weather, and open-link tools on its own, and choose the search backend.'),
    autonomy: t('配置自治引擎：焦点感知、主动智能、记忆整理和通知桥。', 'Configure autonomy: focus awareness, proactive intelligence, memory dream, and notification bridge.'),
  }
}

export function buildSettingsSectionMeta(input: BuildSettingsSectionMetaInput): {
  descriptions: SettingsSectionDescriptionMap
  meta: SettingsSectionMetaMap
} {
  const {
    t,
    draft,
    petModel,
    memories,
    dailyMemoryEntries,
    chatMessageCount,
    liveTranscript,
    debugConsoleEvents,
    continuousVoiceActive,
    clickThroughEnabled,
  } = input

  const descriptions = buildSettingsSectionDescriptions(t)
  const textProvider = getApiProviderPreset(draft.apiProviderId)

  const meta: SettingsSectionMetaMap = {
    console: {
      eyebrow: t('运行态观察', 'Runtime Monitor'),
      glyph: 'console',
      description: descriptions.console,
      preview: [
        liveTranscript ? t('实时转写中', 'Live transcript') : t('等待语音输入', 'Waiting for voice'),
        `${debugConsoleEvents.length} ${t('条事件', 'events')}`,
      ],
    },
    model: {
      eyebrow: t('主对话模型', 'Primary LLM'),
      glyph: 'model',
      description: descriptions.model,
      preview: [
        textProvider.label,
        draft.model || t('未填写模型', 'No model set'),
      ],
    },
    chat: {
      eyebrow: t('角色与设定', 'Companion Profile'),
      glyph: 'chat',
      description: descriptions.chat,
      preview: [
        draft.companionName || t('未命名角色', 'Unnamed companion'),
        petModel?.label ?? t('未选择 Live2D', 'No Live2D selected'),
        draft.characterProfiles.length
          ? t(`${draft.characterProfiles.length} 个角色档案`, `${draft.characterProfiles.length} profile(s)`)
          : '',
      ].filter(Boolean),
    },
    history: {
      eyebrow: t('会话归档', 'Conversation Archive'),
      glyph: 'history',
      description: descriptions.history,
      preview: [
        `${chatMessageCount} ${t('条消息', 'messages')}`,
        t('导入 / 导出 / 清理', 'Import / Export / Clear'),
      ],
    },
    memory: {
      eyebrow: t('长期记忆', 'Long-term Memory'),
      glyph: 'memory',
      description: descriptions.memory,
      preview: [
        `${memories.length} ${t('条记忆', 'memories')}`,
        `${dailyMemoryEntries.length} ${t('条日记', 'daily notes')}`,
      ],
    },
    voice: {
      eyebrow: t('连续对话模式', 'Talk Mode'),
      glyph: 'voice',
      description: descriptions.voice,
      preview: [
        draft.continuousVoiceModeEnabled ? t('连续语音开启', 'Continuous voice on') : t('连续语音关闭', 'Continuous voice off'),
        continuousVoiceActive ? t('当前正在监听', 'Live session running') : t('当前待命', 'Standing by'),
      ],
    },
    window: {
      eyebrow: t('桌宠与面板', 'Pet & Window'),
      glyph: 'window',
      description: descriptions.window,
      preview: [
        petModel?.label ?? t('桌宠模型', 'Desktop pet'),
        clickThroughEnabled ? t('穿透开启', 'Click-through on') : t('正常交互', 'Interactive'),
      ],
    },
    integrations: {
      eyebrow: t('模块映射', 'Module Mapping'),
      glyph: 'integrations',
      description: descriptions.integrations,
      preview: [
        draft.mcpServers.length ? t(`MCP ${draft.mcpServers.length} 个服务`, `MCP ${draft.mcpServers.length} server(s)`) : t('MCP 待配置', 'MCP pending'),
        draft.minecraftIntegrationEnabled || draft.factorioIntegrationEnabled
          ? t('游戏模块已启用', 'Game modules enabled')
          : t('游戏模块待命', 'Game modules idle'),
      ],
    },
    tools: {
      eyebrow: t('工具与搜索', 'Tools & Search'),
      glyph: 'tools',
      description: descriptions.tools,
      preview: [
        draft.toolWebSearchEnabled
          ? `${getWebSearchProviderPreset(draft.toolWebSearchProviderId).label}`
          : t('搜索已关闭', 'Search off'),
        draft.toolWeatherEnabled ? t('天气开启', 'Weather on') : t('天气关闭', 'Weather off'),
      ],
    },
    autonomy: {
      eyebrow: t('自主行为', 'Autonomous Behavior'),
      glyph: 'autonomy',
      description: descriptions.autonomy,
      preview: [
        draft.autonomyEnabled ? t('自治引擎开启', 'Autonomy on') : t('自治引擎关闭', 'Autonomy off'),
        draft.autonomyEnabled && draft.autonomyDreamEnabled
          ? t('记忆整理开启', 'Dream enabled')
          : t('记忆整理关闭', 'Dream off'),
      ],
    },
  }

  return { descriptions, meta }
}
