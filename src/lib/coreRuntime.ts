// Renderer composition root for src/core stores.
// createCoreRuntime(deps) is the FILE-3 factory. getCoreRuntime() is the
// process-wide singleton used by chat/hooks. Tests call resetCoreRuntime()
// so files cannot leak auth, budget, or remembered Discord channels.
import {
  AuthProfileStore,
} from '../core/routing/AuthProfileStore.ts'
import type {
  AuthProfile,
  AuthProfileSnapshot,
} from '../core/routing/types.ts'
import type { CoreTime } from '../core/time.ts'
import { systemTime } from '../core/time.ts'
import type {
  BudgetConfig,
  CostEntry,
} from '../core/budget/types.ts'
import {
  CostTracker,
} from '../core/budget/CostTracker.ts'
import {
  UsagePricingTable,
} from '../core/budget/UsagePricing.ts'
import {
  InMemoryMemoryBackend,
} from '../core/agent/tools/MemoryTool.ts'
import {
  TodoStore,
} from '../core/agent/tools/TodoTool.ts'
import {
  SessionStore,
} from '../core/sessions/SessionStore.ts'
import {
  SkillRegistry,
} from '../core/skills/SkillRegistry.ts'
import {
  loadAuthProfileSnapshot,
  loadBudgetConfig,
  loadCostEntries,
  persistAuthProfileSnapshot,
  persistBudgetConfig,
  persistCostEntries,
} from './storage/index.ts'

export type CoreRuntime = {
  authStore: AuthProfileStore
  costTracker: CostTracker
  pricing: UsagePricingTable
  sessionStore: SessionStore
  skills: SkillRegistry
  memoryBackend: InMemoryMemoryBackend
  todoStore: TodoStore
  persistAuthProfiles: () => void
  persistBudget: () => void
  refreshBudgetConfig: (config: BudgetConfig) => void
}

export type CoreRuntimeOptions = {
  time?: CoreTime
  seedSkills?: boolean
  loadAuthSnapshot?: () => AuthProfileSnapshot
  loadBudgetConfig?: () => BudgetConfig
  loadCostEntries?: () => CostEntry[]
  persistAuthSnapshot?: (snapshot: AuthProfileSnapshot) => void
  persistCostEntries?: (entries: CostEntry[]) => void
  persistBudgetConfig?: (config: BudgetConfig) => void
}

type WiredRuntime = CoreRuntime & {
  telegramChatIds: Set<number>
  discordChannelIds: Set<string>
}

function asWired(runtime: CoreRuntime): WiredRuntime {
  return runtime as WiredRuntime
}

/**
 * Build an isolated core runtime. Does not touch the process singleton.
 */
export function createCoreRuntime(options: CoreRuntimeOptions = {}): CoreRuntime {
  const time = options.time ?? systemTime()
  const loadAuth = options.loadAuthSnapshot ?? loadAuthProfileSnapshot
  const loadBudget = options.loadBudgetConfig ?? loadBudgetConfig
  const loadCosts = options.loadCostEntries ?? loadCostEntries
  const persistAuth = options.persistAuthSnapshot ?? persistAuthProfileSnapshot
  const persistCosts = options.persistCostEntries ?? persistCostEntries
  const persistBudgetCfg = options.persistBudgetConfig ?? persistBudgetConfig

  const pricing = new UsagePricingTable()
  const authStore = new AuthProfileStore({ time })
  authStore.restore(loadAuth())

  const costTracker = new CostTracker({ pricing, config: loadBudget(), time })
  costTracker.restore(loadCosts())

  const sessionStore = new SessionStore({ time })
  const skills = new SkillRegistry({ time })
  if (options.seedSkills !== false) seedDefaultSkills(skills)

  const memoryBackend = new InMemoryMemoryBackend({ time })
  const todoStore = new TodoStore({ time })

  const persistAuthProfiles = () => {
    persistAuth(authStore.snapshot())
  }
  const persistBudget = () => {
    persistCosts(costTracker.listEntries())
  }
  const refreshBudgetConfig = (config: BudgetConfig) => {
    costTracker.setConfig(config)
    persistBudgetCfg(config)
  }

  const runtime: WiredRuntime = {
    authStore,
    costTracker,
    pricing,
    sessionStore,
    skills,
    memoryBackend,
    todoStore,
    persistAuthProfiles,
    persistBudget,
    refreshBudgetConfig,
    telegramChatIds: new Set<number>(),
    discordChannelIds: new Set<string>(),
  }
  return runtime
}

let singleton: CoreRuntime | null = null

/** Process-wide runtime. Created on first use from localStorage-backed loaders. */
export function getCoreRuntime(): CoreRuntime {
  if (!singleton) singleton = createCoreRuntime()
  return singleton
}

/** Drop the process singleton so the next getCoreRuntime() builds a fresh graph. */
export function resetCoreRuntime(): void {
  singleton = null
}

export function recordCostEntry(entry: CostEntry): void {
  const runtime = getCoreRuntime()
  const kind = entry.kind ?? 'chat'
  if (kind === 'chat') {
    runtime.costTracker.record({
      providerId: entry.providerId,
      modelId: entry.modelId,
      tier: entry.tier,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      conversationId: entry.conversationId,
      timestamp: entry.timestamp,
    })
  } else {
    runtime.costTracker.recordAuxiliary({
      kind,
      providerId: entry.providerId,
      modelId: entry.modelId,
      units: entry.units ?? 0,
      costUsd: entry.costUsd,
      conversationId: entry.conversationId,
      timestamp: entry.timestamp,
    })
  }
  runtime.persistBudget()
}

export function upsertAuthProfileInRuntime(profile: AuthProfile): void {
  const runtime = getCoreRuntime()
  runtime.authStore.register({
    id: profile.id,
    providerId: profile.providerId,
    apiKey: profile.apiKey,
    label: profile.label,
  })
  runtime.persistAuthProfiles()
}

export function removeAuthProfileFromRuntime(id: string): void {
  const runtime = getCoreRuntime()
  runtime.authStore.remove(id)
  runtime.persistAuthProfiles()
}

// ── Cross-channel broadcast ──
//
// Known conversation IDs per channel are tracked here so non-UI subsystems
// (reminders, agent tools) have a single broadcast entry point. The React
// gateway hooks (useTelegramGateway / useDiscordGateway) own the bridge
// connections and remember IDs from inbound traffic and settings.

export function setTelegramKnownChatIds(ids: number[]): void {
  const idsSet = asWired(getCoreRuntime()).telegramChatIds
  idsSet.clear()
  for (const id of ids) {
    if (Number.isFinite(id) && id !== 0) idsSet.add(id)
  }
}

export function setDiscordKnownChannelIds(ids: string[]): void {
  const idsSet = asWired(getCoreRuntime()).discordChannelIds
  idsSet.clear()
  for (const id of ids) {
    if (id.trim().length > 0) idsSet.add(id.trim())
  }
}

export function rememberTelegramChatId(chatId: number): void {
  if (Number.isFinite(chatId) && chatId !== 0) {
    asWired(getCoreRuntime()).telegramChatIds.add(chatId)
  }
}

export function rememberDiscordChannelId(channelId: string): void {
  if (channelId.trim().length > 0) {
    asWired(getCoreRuntime()).discordChannelIds.add(channelId.trim())
  }
}

/** Snapshot of remembered Discord channel ids for the host broadcast path. */
export function listKnownDiscordChannelIds(): string[] {
  return [...asWired(getCoreRuntime()).discordChannelIds]
}

function seedDefaultSkills(registry: SkillRegistry): void {
  registry.register({
    id: 'builtin-proactive-question',
    name: '主动追问',
    description: '当用户表达模糊或只给出一句话时，主动反问以澄清需求。',
    trigger: { keywords: ['怎么办', '怎么', '帮我', '可以吗', '能不能', '如何'] },
    body: '如果用户的意图不明确，用一句温和的反问澄清具体需求，再给出简短建议。',
    status: 'active',
  })

  registry.register({
    id: 'builtin-emotion-mirror',
    name: '情绪回应',
    description: '识别用户表达的情绪并先给予共情，再进入内容回答。',
    trigger: { keywords: ['累', '烦', '难过', '开心', '生气', '焦虑', '害怕', '失落'] },
    body: '先用一句话回应用户当前的情绪感受，让对方感到被理解，再继续正事。保持语气温暖但不煽情。',
    status: 'active',
  })

  registry.register({
    id: 'builtin-time-aware-greeting',
    name: '时间感知问候',
    description: '当用户打招呼时，结合本地时间给出自然的问候语。',
    trigger: { keywords: ['你好', '早', '晚安', '下午好', '晚上好', '在吗', 'hi', 'hello'] },
    body: '结合当前时间（早上/下午/深夜等）给出自然问候，并主动询问今天有没有想聊或想做的事。',
    status: 'active',
  })

  registry.register({
    id: 'builtin-long-task-breakdown',
    name: '复杂任务拆解',
    description: '当用户请求多步骤任务时，先拆解成清晰步骤再执行。',
    trigger: { keywords: ['帮我做', '帮我写', '计划', '步骤', '整理', '规划'], minHistoryLength: 0 },
    body: '遇到多步骤任务时，先用 2-4 条简短的步骤列出执行顺序，再按步执行或询问是否照此进行。',
    status: 'active',
  })

  registry.register({
    id: 'builtin-search-assist',
    name: '搜索辅助',
    description: '当用户询问未知或时效性信息时，提示可以使用搜索命令。',
    trigger: { keywords: ['搜索', '查一下', '最新', '是什么', '谁是', '新闻'] },
    body: '如果问题涉及实时信息或未知事实，提示用户可以用 /search 命令在历史会话中检索，或调用联网搜索。',
    status: 'active',
  })
}

export function matchCoreSkills(
  text: string,
  historyLength: number,
  limit = 3,
): string {
  const runtime = getCoreRuntime()
  const results = runtime.skills.match({
    text,
    historyLength,
    hasToolCalls: false,
  })
  if (results.length === 0) return ''
  const top = results.slice(0, limit)
  return top
    .map((r) => `• ${r.skill.name}: ${r.skill.body}`)
    .join('\n')
}


