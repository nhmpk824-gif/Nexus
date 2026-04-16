import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getInitialPanelSection,
  getWindowView,
  getWindowViewSync,
} from '../appSupport'
import { subscribeToSettings } from '../store/settingsStore'
import {
  loadPetWindowPreferences,
} from '../../lib'
import type {
  AppSettings,
  ChatMessage,
  Goal,
  PanelWindowState,
  ReminderTask,
  VoiceState,
  WindowView,
} from '../../types'
import {
  useChat,
  useDesktopContext,
  useGameIntegration,
  useMemory,
  usePetBehavior,
  useReminderScheduler,
  useVoice,
} from '../../hooks'
import { shouldRunReminderScheduler } from '../../features/reminders'
import {
  buildBuiltInToolSpeechSummary,
  executeBuiltInTool,
  resolveBuiltInToolPolicy,
  toChatToolResult,
} from '../../features/tools'
import { getSettingsSnapshot, initializeSettingsWithVault } from '../store/settingsStore'
import {
  broadcastToChannels,
  getCoreRuntime,
  setDiscordKnownChannelIds,
  setTelegramKnownChatIds,
} from '../../lib/coreRuntime'
import { useAppOverlays } from './useAppOverlays'
import { useAutonomyController } from './useAutonomyController'
import { useDebugConsole } from './useDebugConsole'
import { useDesktopBridge } from './useDesktopBridge'
import { useMediaSessionController } from './useMediaSessionController'
import { useReminderTaskStore } from './useReminderTaskStore'
import { commitSettingsUpdate } from '../store/commitSettingsUpdate'
import { AUTONOMY_GOALS_STORAGE_KEY, readJson, writeJson } from '../../lib/storage'
import { classifyMessageSignals } from '../../features/autonomy/emotionModel'

type ChatController = ReturnType<typeof useChat>
type ReminderTaskStore = ReturnType<typeof useReminderTaskStore>

export function useAppController() {
  const [view, setView] = useState<WindowView>(() => getWindowViewSync())
  const [settings, setSettings] = useState<AppSettings>(() => getSettingsSnapshot())
  const [settingsOpen, setSettingsOpen] = useState(
    () => view === 'panel' && getInitialPanelSection() === 'settings',
  )

  // Refine view from async preload bridge (only matters inside Electron)
  useEffect(() => {
    void getWindowView().then((resolved) => {
      if (resolved !== view) setView(resolved)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [panelWindowState, setPanelWindowState] = useState<PanelWindowState>({ collapsed: false })
  const [isPinned, setIsPinned] = useState(() => loadPetWindowPreferences().isPinned)
  const [clickThrough, setClickThrough] = useState(() => loadPetWindowPreferences().clickThrough)

  // Sync React state when settings change in storage (after save or external update)
  useEffect(() => {
    return subscribeToSettings((updated) => {
      setSettings(updated)
    })
  }, [])

  // Push budget config into CostTracker whenever relevant settings change.
  useEffect(() => {
    getCoreRuntime().refreshBudgetConfig({
      dailyCapUsd: settings.budgetDailyCapUsd || undefined,
      monthlyCapUsd: settings.budgetMonthlyCapUsd || undefined,
      downgradeThresholdRatio: settings.budgetDowngradeRatio || undefined,
      hardStop: settings.budgetHardStopEnabled,
    })
  }, [
    settings.budgetDailyCapUsd,
    settings.budgetMonthlyCapUsd,
    settings.budgetDowngradeRatio,
    settings.budgetHardStopEnabled,
  ])

  // Seed the core runtime's cross-channel broadcast targets from settings
  // (the React gateway hooks own the actual bridge connections).
  useEffect(() => {
    const allowedChatIds = settings.telegramIntegrationEnabled
      ? settings.telegramAllowedChatIds
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n) && n !== 0)
      : []
    setTelegramKnownChatIds(allowedChatIds)
  }, [settings.telegramIntegrationEnabled, settings.telegramAllowedChatIds])

  useEffect(() => {
    const allowedChannelIds = settings.discordIntegrationEnabled
      ? settings.discordAllowedChannelIds
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : []
    setDiscordKnownChannelIds(allowedChannelIds)
  }, [settings.discordIntegrationEnabled, settings.discordAllowedChannelIds])

  // Push the agent workspace root into the main process so the sandboxed
  // fs tools (Read/Edit/Glob/Grep) know where they're allowed to operate.
  useEffect(() => {
    const root = settings.agentWorkspaceRoot.trim()
    if (root) {
      // Reject paths containing traversal segments
      if (/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(root)) {
        console.error('[workspaceRoot] Rejected: path must not contain ".." segments:', root)
        setErrorRef.current?.('Workspace root must not contain ".." path segments.')
        return
      }
      // On Windows, require a drive letter prefix (e.g. C:\)
      const isWindows = typeof navigator !== 'undefined' && /win/i.test(navigator.platform)
      if (isWindows && !/^[A-Za-z]:[\\/]/.test(root)) {
        console.error('[workspaceRoot] Rejected: Windows path must start with a drive letter:', root)
        setErrorRef.current?.('On Windows, workspace root must start with a drive letter (e.g. C:\\).')
        return
      }
    }
    void window.desktopPet?.workspaceSetRoot?.({ root })
  }, [settings.agentWorkspaceRoot])

  const [goals] = useState<Goal[]>(() => readJson<Goal[]>(AUTONOMY_GOALS_STORAGE_KEY, []))
  const goalsRef = useRef(goals)
  useEffect(() => {
    goalsRef.current = goals
    writeJson(AUTONOMY_GOALS_STORAGE_KEY, goals)
  }, [goals])

  const settingsRef = useRef(settings)
  const settingsOpenRef = useRef(view === 'panel' && getInitialPanelSection() === 'settings')
  const busyRef = useRef(false)
  const inputRef = useRef('')
  const messagesRef = useRef<ChatMessage[]>([])
  const voiceStateRef = useRef<VoiceState>('idle')
  const continuousVoiceActiveRef = useRef(false)
  const addReminderTaskFnRef = useRef<ReminderTaskStore['addReminderTask'] | null>(null)
  const updateReminderTaskFnRef = useRef<ReminderTaskStore['updateReminderTask'] | null>(null)
  const removeReminderTaskFnRef = useRef<ReminderTaskStore['removeReminderTask'] | null>(null)
  const setErrorRef = useRef<ChatController['setError']>(() => {})
  const setInputFnRef = useRef<ChatController['setInput']>(() => {})
  const appendSystemMessageRef = useRef<ChatController['appendSystemMessage']>(() => {})
  const sendMessageRef = useRef<ChatController['sendMessage']>(async () => false)

  useEffect(() => {
    initializeSettingsWithVault()
      .then((hydrated) => setSettings(hydrated))
      .catch(() => { /* vault unavailable — settings loaded without keys */ })
  }, [])

  const reminderTaskStore = useReminderTaskStore()
  const debugConsole = useDebugConsole()
  const memory = useMemory({ settings })
  const desktopContext = useDesktopContext({ settingsRef })
  useGameIntegration({ settingsRef })
  const pet = usePetBehavior({
    settingsRef,
    busyRef,
    voiceStateRef,
    continuousVoiceActiveRef,
    settingsOpenRef,
    inputRef,
    messagesRef,
    memoriesRef: memory.memoriesRef,
    view,
  })

  const panelCollapsed = panelWindowState.collapsed

  const applyPanelWindowState = useCallback(async (partialState: Partial<PanelWindowState>) => {
    if (!window.desktopPet?.setPanelWindowState) {
      setPanelWindowState((current) => ({ ...current, ...partialState }))
      return
    }

    try {
      const nextState = await window.desktopPet.setPanelWindowState(partialState)
      setPanelWindowState(nextState)
    } catch {
      setPanelWindowState((current) => ({ ...current, ...partialState }))
    }
  }, [])

  const togglePanelCollapse = useCallback(() => {
    const nextCollapsed = !panelCollapsed
    if (nextCollapsed) {
      setSettingsOpen(false)
    }
    void applyPanelWindowState({ collapsed: nextCollapsed })
  }, [applyPanelWindowState, panelCollapsed])

  const openSettingsPanel = useCallback(() => {
    if (view === 'pet') {
      const pending = window.desktopPet?.openPanel?.('settings')
      pending?.catch(() => undefined)
      return
    }

    if (panelCollapsed) {
      void applyPanelWindowState({ collapsed: false })
    }
    setSettingsOpen(true)
  }, [applyPanelWindowState, panelCollapsed, view])

  const openChatPanelForVoice = useCallback(() => {
    if (view === 'panel') {
      setSettingsOpen(false)
      return
    }

    const pending = window.desktopPet?.openPanel?.('chat')
    pending?.catch(() => undefined)
  }, [view])

  const closePanel = useCallback(() => {
    const pending = window.desktopPet?.closePanel?.()
    pending?.catch(() => undefined)
  }, [])

  const openPetMenu = useCallback(() => {
    const pending = window.desktopPet?.openPetMenu?.()
    pending?.catch(() => undefined)
  }, [])

  const togglePinned = useCallback(() => {
    setIsPinned((current) => !current)
  }, [])

  const toggleClickThrough = useCallback(() => {
    setClickThrough((current) => !current)
  }, [])

  const toggleContinuousVoiceMode = useCallback(() => {
    void commitSettingsUpdate(
      (current) => ({
        ...current,
        continuousVoiceModeEnabled: !current.continuousVoiceModeEnabled,
      }),
      (nextSettings) => {
        settingsRef.current = nextSettings
        setSettings(nextSettings)
      },
    )
  }, [])

  const voice = useVoice({
    settings,
    settingsRef,
    applySettingsUpdate: (update) => commitSettingsUpdate(update, (nextSettings) => {
      settingsRef.current = nextSettings
      setSettings(nextSettings)
    }),
    busyRef,
    view,
    setMood: pet.setMood,
    updatePetStatus: pet.updatePetStatus,
    setError: (error) => setErrorRef.current(error),
    markPresenceActivity: pet.markPresenceActivity,
    openChatPanelForVoice,
    inputRef,
    setInput: (value) => setInputFnRef.current(value),
    setSettings,
    sendMessageRef,
    appendSystemMessage: (content, tone) => appendSystemMessageRef.current(content, tone),
  })

  // Ref bridge for emotion/relationship/rhythm prompt getters:
  // useChat must be created before useAutonomyController (autonomy depends on
  // chat), so we cannot pass autonomy.getEmotionPrompt / getRelationshipPrompt /
  // getRhythmPrompt directly into useChat. We create empty refs here first, then
  // after autonomy is created, a useEffect installs the real getters. The wrapper
  // function references seen by useChat ctx are stable, so ctx won't rebuild.
  const emotionPromptGetterRef = useRef<() => string>(() => '')
  const relationshipPromptGetterRef = useRef<() => string>(() => '')
  const rhythmPromptGetterRef = useRef<() => string>(() => '')

  const chat = useChat({
    settingsRef,
    setSettings,
    applySettingsUpdate: (update) => commitSettingsUpdate(update, (nextSettings) => {
      settingsRef.current = nextSettings
      setSettings(nextSettings)
    }),
    memoriesRef: memory.memoriesRef,
    dailyMemoriesRef: memory.dailyMemoriesRef,
    setMemories: memory.setMemories,
    appendDailyMemoryEntries: memory.appendDailyMemoryEntries,
    setMood: pet.setMood,
    updatePetStatus: pet.updatePetStatus,
    clearPetPerformanceCue: pet.clearPetPerformanceCue,
    queuePetPerformanceCue: pet.queuePetPerformanceCue,
    markPresenceActivity: pet.markPresenceActivity,
    voiceStateRef: voice.voiceStateRef,
    suppressVoiceReplyRef: voice.suppressVoiceReplyRef,
    setVoiceState: voice.setVoiceState,
    setLiveTranscript: voice.setLiveTranscript,
    updateVoicePipeline: voice.updateVoicePipeline,
    appendVoiceTrace: voice.appendVoiceTrace,
    speakAssistantReply: voice.speakAssistantReply,
    beginStreamingSpeechReply: voice.beginStreamingSpeechReply,
    scheduleVoiceRestart: voice.scheduleVoiceRestart,
    busEmit: voice.busEmit,
    shouldAutoRestartVoice: voice.shouldAutoRestartVoice,
    clearPendingVoiceRestart: voice.clearPendingVoiceRestart,
    resetNoSpeechRestartCount: voice.resetNoSpeechRestartCount,
    setContinuousVoiceSession: voice.setContinuousVoiceSession,
    fillComposerWithVoiceTranscript: voice.fillComposerWithVoiceTranscript,
    stopActiveSpeechOutput: voice.stopActiveSpeechOutput,
    canInterruptSpeech: () => settingsRef.current.voiceInterruptionEnabled,
    loadDesktopContextSnapshot: desktopContext.loadDesktopContextSnapshot,
    getEmotionPromptText: () => emotionPromptGetterRef.current(),
    getRelationshipPromptText: () => relationshipPromptGetterRef.current(),
    getRhythmPromptText: () => rhythmPromptGetterRef.current(),
    reminderTasksRef: reminderTaskStore.reminderTasksRef,
    addReminderTask: (input) => addReminderTaskFnRef.current?.(input) ?? null,
    updateReminderTask: (id, updates) => updateReminderTaskFnRef.current?.(id, updates) ?? null,
    removeReminderTask: (id) => removeReminderTaskFnRef.current?.(id) ?? null,
    appendDebugConsoleEvent: debugConsole.appendDebugConsoleEvent,
  })

  useEffect(() => {
    sendMessageRef.current = chat.sendMessage
  }, [chat.sendMessage])

  useEffect(() => {
    setErrorRef.current = chat.setError
    setInputFnRef.current = chat.setInput
    appendSystemMessageRef.current = chat.appendSystemMessage
  }, [chat.appendSystemMessage, chat.setError, chat.setInput])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    settingsOpenRef.current = settingsOpen
  }, [settingsOpen])

  useEffect(() => {
    busyRef.current = chat.busy
  }, [chat.busy])

  useEffect(() => {
    inputRef.current = chat.input
  }, [chat.input])

  useEffect(() => {
    messagesRef.current = chat.messages
  }, [chat.messages])

  useEffect(() => {
    voiceStateRef.current = voice.voiceState
  }, [voice.voiceState])

  useEffect(() => {
    addReminderTaskFnRef.current = reminderTaskStore.addReminderTask
    updateReminderTaskFnRef.current = reminderTaskStore.updateReminderTask
    removeReminderTaskFnRef.current = reminderTaskStore.removeReminderTask
  }, [
    reminderTaskStore.addReminderTask,
    reminderTaskStore.removeReminderTask,
    reminderTaskStore.updateReminderTask,
  ])

  const {
    runtimeSnapshot,
    petRuntimeContinuousVoiceActive,
    remotePanelSettingsOpen,
    petModelPresets,
    petModel,
    loadPetModels,
  } = useDesktopBridge({
    view,
    settings,
    setSettings,
    settingsOpen,
    setSettingsOpen,
    setPanelWindowState,
    panelCollapsed,
    applyPanelWindowState,
    isPinned,
    setIsPinned,
    clickThrough,
    setClickThrough,
    reminderTasks: reminderTaskStore.reminderTasks,
    setReminderTasks: reminderTaskStore.setReminderTasks,
    setDebugConsoleEvents: debugConsole.setDebugConsoleEvents,
    memory,
    chat,
    pet,
    voice,
  })

  useEffect(() => {
    continuousVoiceActiveRef.current = (
      voice.continuousVoiceActive
      || (view === 'panel' && petRuntimeContinuousVoiceActive && !voice.continuousVoiceActive)
    )
  }, [petRuntimeContinuousVoiceActive, view, voice.continuousVoiceActive])

  const handleReminderTaskTrigger = useCallback(async (task: ReminderTask) => {
    const displayText = task.prompt.trim()
    const action = task.action
    const currentSettings = settingsRef.current
    const defaultSpeechText = task.speechText?.trim() || `${task.title}提醒，${task.prompt.trim()}`

    const actionLabel = action.kind === 'notice' ? 'notice' : action.kind === 'weather' ? 'weather' : action.kind === 'chat_action' ? 'chat_action' : 'search'
    debugConsole.appendDebugConsoleEvent({
      source: 'tool',
      title: 'Starting automated task',
      detail: `${task.title} / ${actionLabel}`,
      relatedTaskId: task.id,
    })

    try {
      if (action.kind === 'notice') {
        await chat.pushCompanionNotice({
          chatContent: `【自动任务】${task.title}\n${displayText}`,
          bubbleContent: displayText,
          speechContent: defaultSpeechText,
          autoHideMs: 16_000,
        })
        const broadcastResults = await broadcastToChannels(
          `${task.title}\n${displayText}`,
        )
        const deliveredCount = broadcastResults.filter((r) => r.ok).length
        debugConsole.appendDebugConsoleEvent({
          source: 'tool',
          title: 'Automated reminder dispatched',
          detail: deliveredCount > 0
            ? `${task.title} / 本地 + 跨通道 ${deliveredCount}`
            : `${task.title} / next run visible in task snapshot`,
          tone: 'success',
          relatedTaskId: task.id,
        })
        return
      }

      if (action.kind === 'weather') {
        const policy = resolveBuiltInToolPolicy('weather', currentSettings)
        if (!policy.enabled) {
          chat.appendSystemMessage(`本地自动任务「${task.title}」没有执行：天气工具当前已关闭。`, 'error')
          debugConsole.appendDebugConsoleEvent({
            source: 'tool',
            title: 'Automated task skipped',
            detail: `${task.title} / weather tool currently disabled`,
            tone: 'error',
            relatedTaskId: task.id,
          })
          return
        }

        const result = await executeBuiltInTool(
          {
            id: 'weather',
            location: action.location,
          },
          policy,
          currentSettings,
        )

        await chat.pushCompanionNotice({
          chatContent: `【自动任务】${task.title}\n${result.assistantSummary}`,
          bubbleContent: result.assistantSummary,
          speechContent: task.speechText?.trim() || buildBuiltInToolSpeechSummary(result),
          autoHideMs: 18_000,
          toolResult: toChatToolResult(result),
        })
        debugConsole.appendDebugConsoleEvent({
          source: 'tool',
          title: 'Automated weather task completed',
          detail: `${task.title} / ${result.kind === 'weather' ? result.result.resolvedName : action.location || 'default location'}`,
          tone: 'success',
          relatedTaskId: task.id,
        })
        return
      }

      if (action.kind === 'chat_action') {
        await chat.sendMessage(
          `【定时智能动作】${task.title}\n请执行以下任务：${action.instruction}`,
          { source: 'text' },
        )
        debugConsole.appendDebugConsoleEvent({
          source: 'tool',
          title: 'Chat action triggered',
          detail: `${task.title} / ${action.instruction}`,
          tone: 'success',
          relatedTaskId: task.id,
        })
        return
      }

      const policy = resolveBuiltInToolPolicy('web_search', currentSettings)
      if (!policy.enabled) {
        chat.appendSystemMessage(`本地自动任务「${task.title}」没有执行：网页搜索工具当前已关闭。`, 'error')
        debugConsole.appendDebugConsoleEvent({
          source: 'tool',
          title: 'Automated task skipped',
          detail: `${task.title} / search tool currently disabled`,
          tone: 'error',
          relatedTaskId: task.id,
        })
        return
      }

      const result = await executeBuiltInTool(
        {
          id: 'web_search',
          query: action.query,
          limit: action.limit ?? 5,
        },
        policy,
        currentSettings,
      )

      await chat.pushCompanionNotice({
        chatContent: `【自动任务】${task.title}\n${result.assistantSummary}`,
        bubbleContent: result.assistantSummary,
        speechContent: task.speechText?.trim() || buildBuiltInToolSpeechSummary(result),
        autoHideMs: 18_000,
        toolResult: toChatToolResult(result),
      })
      debugConsole.appendDebugConsoleEvent({
        source: 'tool',
        title: 'Automated search task completed',
        detail: `${task.title} / ${result.kind === 'web_search' ? result.result.query : action.query}`,
        tone: 'success',
        relatedTaskId: task.id,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '自动任务执行失败。'
      chat.appendSystemMessage(`本地自动任务「${task.title}」执行失败：${errorMessage}`, 'error')
      pet.updatePetStatus(`自动任务失败：${task.title}`, 3200)
      debugConsole.appendDebugConsoleEvent({
        source: 'tool',
        title: 'Automated task execution failed',
        detail: `${task.title} / ${errorMessage}`,
        tone: 'error',
        relatedTaskId: task.id,
      })
    }
  }, [chat, debugConsole, pet])

  useReminderScheduler({
    enabled: shouldRunReminderScheduler(view, runtimeSnapshot),
    tasks: reminderTaskStore.reminderTasks,
    setTasks: reminderTaskStore.setReminderTasks,
    onTrigger: handleReminderTaskTrigger,
    onEvent: debugConsole.appendDebugConsoleEvent,
  })

  // ── Autonomy subsystem ──────────────────────────────────────────────────────

  const autonomy = useAutonomyController({
    settings,
    settingsRef,
    messagesRef,
    memory,
    reminderTasksRef: reminderTaskStore.reminderTasksRef,
    goalsRef,
    busyRef,
    chat,
    debugConsole,
  })

  // Install autonomy's emotion/relationship/rhythm prompt getters into the refs
  // created at the top. This lets useChat (when assembling chat options) read
  // the latest emotion/relationship/rhythm state text into the system prompt.
  // No dependency array: autonomy returns new getter references every render,
  // so we sync on every render.
  useEffect(() => {
    emotionPromptGetterRef.current = autonomy.getEmotionPrompt
    relationshipPromptGetterRef.current = autonomy.getRelationshipPrompt
    rhythmPromptGetterRef.current = autonomy.getRhythmPrompt
  })

  // Wake autonomy when user sends a chat message
  const originalSendMessage = chat.sendMessage
  const autonomyAwareSendMessage = useCallback(async (...args: Parameters<typeof originalSendMessage>) => {
    autonomy.focusAwareness.markActive()
    autonomy.autonomyTick.wakeUp()
    autonomy.markUserResponse()
    autonomy.markInteraction()

    // Classify user message text for emotion signals
    const messageText = typeof args[0] === 'string' ? args[0] : ''
    if (messageText) {
      autonomy.applyEmotionSignal('user_returned')
      for (const signal of classifyMessageSignals(messageText)) {
        autonomy.applyEmotionSignal(signal)
      }
    }

    const result = await originalSendMessage(...args)
    if (result) {
      autonomy.memoryDream.incrementSessionCount()
      autonomy.applyEmotionSignal('task_completed')
    }
    return result
  }, [originalSendMessage, autonomy])

  // Patch chat.sendMessage with autonomy-aware wrapper
  const chatWithAutonomy = useMemo(() => ({
    ...chat,
    sendMessage: autonomyAwareSendMessage,
  }), [chat, autonomyAwareSendMessage])

  const mediaSessionController = useMediaSessionController({
    view,
    appendSystemMessage: chat.appendSystemMessage,
  })

  const { overlays } = useAppOverlays({
    view,
    settings,
    setSettings,
    settingsOpen,
    setSettingsOpen,
    petModelPresets,
    petRuntimeContinuousVoiceActive,
    reminderTasks: reminderTaskStore.reminderTasks,
    debugConsoleEvents: debugConsole.debugConsoleEvents,
    loadPetModels,
    memory,
    chat: chatWithAutonomy,
    pet,
    voice,
    addReminderTask: reminderTaskStore.addReminderTask,
    updateReminderTask: reminderTaskStore.updateReminderTask,
    removeReminderTask: reminderTaskStore.removeReminderTask,
    clearDebugConsoleEvents: debugConsole.clearDebugConsoleEvents,
    notificationChannels: autonomy.notificationBridge.channels,
    notificationChannelsLoading: autonomy.notificationBridge.channelsLoading,
    onAddNotificationChannel: autonomy.notificationBridge.addChannel,
    onUpdateNotificationChannel: autonomy.notificationBridge.updateChannel,
    onRemoveNotificationChannel: autonomy.notificationBridge.removeChannel,
  })

  return {
    view,
    overlays,
    petView: {
      settings,
      petModel,
      pet,
      voice,
      chat: chatWithAutonomy,
      isPinned,
      clickThrough,
      runtimeSnapshot,
      mediaSession: mediaSessionController.mediaSession,
      musicActionBusy: mediaSessionController.musicActionBusy,
      dismissedMusicSessionKey: mediaSessionController.dismissedMusicSessionKey,
      remotePanelSettingsOpen,
      openSettingsPanel,
      openChatPanelForVoice,
      openPetMenu,
      togglePinned,
      toggleClickThrough,
      toggleContinuousVoiceMode,
      handleMediaSessionControl: mediaSessionController.handleMediaSessionControl,
      dismissCurrentMediaSession: mediaSessionController.dismissCurrentMediaSession,
      startMediaPolling: mediaSessionController.startMediaPolling,
      autonomyState: autonomy.autonomyTick.autonomyState,
      focusState: autonomy.focusAwareness.focusState,
      notificationUnreadCount: autonomy.notificationBridge.unreadCount,
    },
    panelView: {
      settings,
      petModel,
      memory,
      pet,
      voice,
      chat: chatWithAutonomy,
      runtimeSnapshot,
      petRuntimeContinuousVoiceActive,
      panelCollapsed,
      openSettingsPanel,
      togglePanelCollapse,
      closePanel,
      autonomyState: autonomy.autonomyTick.autonomyState,
      focusState: autonomy.focusAwareness.focusState,
      notificationBridge: autonomy.notificationBridge,
      contextScheduler: autonomy.contextScheduler,
    },
  }
}

export type UseAppControllerResult = ReturnType<typeof useAppController>
