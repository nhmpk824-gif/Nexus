import {
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { getLiveTranscriptLabel, getTimeGreeting, voiceStateLabelMap } from '../appSupport'
import { MessageBubble } from '../../components'
import { resolveCharacterPreset } from '../../features/character'
import { shorten } from '../../lib'
import type { UseAppControllerResult } from '../controllers/useAppController'

type PanelViewProps = UseAppControllerResult['panelView'] & {
  settingsDrawer: ReactNode
  onboardingGuide: ReactNode
}

export function PanelView({
  settings,
  memory,
  pet,
  voice,
  chat,
  runtimeSnapshot,
  petRuntimeContinuousVoiceActive,
  panelCollapsed,
  openSettingsPanel,
  togglePanelCollapse,
  closePanel,
  settingsDrawer,
  onboardingGuide,
}: PanelViewProps) {
  const messageListRef = useRef<HTMLDivElement | null>(null)
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  const characterPreset = useMemo(() => resolveCharacterPreset(), [])
  const timeGreeting = getTimeGreeting()
  const voiceStateLabel = voiceStateLabelMap[voice.voiceState]
  const nextSchedulerStatusLabel = runtimeSnapshot.schedulerArmed
    ? runtimeSnapshot.activeTaskLabel
      ? `下个任务：${runtimeSnapshot.activeTaskLabel}`
      : '定时任务已挂起'
    : ''
  const assistantActivityLabel = voice.voiceState === 'speaking'
    ? '角色正在说话'
    : voice.voiceState === 'listening'
      ? '角色正在听你说话'
      : chat.assistantActivity === 'searching'
        ? '角色正在后台搜索并整理结果'
        : chat.assistantActivity === 'summarizing'
          ? '角色正在整理搜索内容'
          : chat.assistantActivity === 'scheduling'
            ? '角色正在安排提醒任务'
            : chat.busy
              ? '角色正在思考回复'
              : ''
  const companionStatusChipLabel = voice.voiceState !== 'idle'
    ? voiceStateLabel
    : chat.assistantActivity === 'searching'
      ? '搜索中'
      : chat.assistantActivity === 'summarizing'
        ? '整理中'
        : chat.assistantActivity === 'scheduling'
          ? '安排中'
          : chat.busy
            ? '思考中'
            : runtimeSnapshot.petOnline || runtimeSnapshot.panelOnline
              ? '在线'
              : voiceStateLabel
  const chatMessageCount = chat.messages.filter((message) => message.role !== 'system').length
  const welcomeTitle = `${timeGreeting}，${settings.userName}`
  const welcomeBody = memory.memories[0]?.content
    ? `我还记得你最近提过“${shorten(memory.memories[0].content, 24)}”，如果你希望再继续，我可以帮你把思路接上。`
    : `${settings.companionName} 已经在桌面这边准备好了。你可以直接打字，也可以开口叫我。`
  const liveTranscriptLabel = getLiveTranscriptLabel(voice.voiceState)
  const liveStatusLine = voice.liveTranscript
    ? `${liveTranscriptLabel}：${shorten(voice.liveTranscript, 34)}`
    : assistantActivityLabel
      ? assistantActivityLabel
      : nextSchedulerStatusLabel
        ? nextSchedulerStatusLabel
        : pet.petStatusText
  const panelHeroStatusText = chat.error
    ? '建议先打开设置页跑一次音频自检，确认输入输出链路都正常。'
    : assistantActivityLabel
      ? assistantActivityLabel
      : nextSchedulerStatusLabel
        ? nextSchedulerStatusLabel
        : pet.ambientPresence?.text
          ? shorten(pet.ambientPresence.text, 64)
          : characterPreset.motionLabel
  const panelQuickPrompts = useMemo(() => ([
    {
      label: memory.memories[0]?.content ? '继续上次话题' : '整理今日重点',
      prompt: memory.memories[0]?.content
        ? `继续我们刚才关于“${shorten(memory.memories[0].content, 18)}”的话题，先给我一个简短总结，再告诉我下一步。`
        : '帮我整理今天最重要的三件事，并告诉我现在第一步先做什么。',
    },
    {
      label: '读取桌面上下文',
      prompt: '结合当前桌面上下文，告诉我现在最值得处理的一件事，以及为什么。',
    },
    {
      label: '做个轻计划',
      prompt: '根据我现在的状态，给我一个 20 分钟可执行的小计划，语气轻一点。',
    },
  ]), [memory.memories])
  const voiceActionLabel = voice.continuousVoiceActive
    ? '停止连续语音'
    : petRuntimeContinuousVoiceActive
      ? '桌宠端连续语音中'
      : voice.voiceState === 'speaking'
        ? '打断播报并说话'
        : voice.voiceState === 'listening'
          ? '停止语音'
          : settings.continuousVoiceModeEnabled
            ? '开始连续语音'
            : '语音输入'
  const voiceActionDisabled = (
    !petRuntimeContinuousVoiceActive
    && !voice.continuousVoiceActive
    && voice.voiceState !== 'listening'
    && voice.voiceState !== 'speaking'
    && (chat.busy || voice.voiceState === 'processing')
  )

  function handleApplyQuickPrompt(prompt: string) {
    chat.setInput(prompt)
    window.requestAnimationFrame(() => {
      const composer = composerTextareaRef.current
      if (!composer) {
        return
      }

      composer.focus()
      const cursorPosition = composer.value.length
      composer.setSelectionRange(cursorPosition, cursorPosition)
    })
  }

  function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) {
      return
    }
    if (event.nativeEvent.isComposing) {
      return
    }

    event.preventDefault()
    void chat.sendMessage()
  }

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const messageList = messageListRef.current
      if (!messageList) {
        return
      }

      messageList.scrollTo({
        top: messageList.scrollHeight,
        behavior: 'smooth',
      })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [chat.messages])

  return (
    <div className={`desktop-pet-root desktop-pet-root--panel ${characterPreset.themeClassName} ${panelCollapsed ? 'desktop-pet-root--panel-collapsed' : ''}`}>
      <section className={`panel-window panel-window--simple panel-window--companion ${panelCollapsed ? 'is-collapsed' : ''}`}>
        {panelCollapsed ? (
          <>
            <div className="panel-window__simple-header">
              <div className="panel-window__simple-copy">
                <p className="eyebrow">{characterPreset.heroEyebrow}</p>
                <strong>{settings.companionName}</strong>
                <p>{panelHeroStatusText}</p>
              </div>

              <div className="panel-window__header-actions panel-window__header-actions--simple">
                <span className={`connection-dot ${runtimeSnapshot.petOnline || runtimeSnapshot.panelOnline ? 'is-online' : ''}`} title={companionStatusChipLabel} />
                <button className="ghost-button" type="button" onClick={togglePanelCollapse}>
                  展开
                </button>
                <button className="ghost-button" type="button" onClick={openSettingsPanel}>
                  设置
                </button>
                <button className="ghost-button" type="button" onClick={closePanel}>
                  关闭
                </button>
              </div>
            </div>

            <div className="panel-window__collapsed-bar">
              <span>{chatMessageCount} 条会话</span>
              <span>{chat.error ? shorten(chat.error, 26) : liveStatusLine}</span>
            </div>
          </>
        ) : (
          <div className="panel-window__shell">
            <div className="panel-window__ambient panel-window__ambient--primary" aria-hidden="true" />
            <div className="panel-window__ambient panel-window__ambient--secondary" aria-hidden="true" />

            <div className="companion-chat__toolbar">
              <div className="companion-chat__toolbar-left">
                <span className={`connection-dot ${runtimeSnapshot.petOnline || runtimeSnapshot.panelOnline ? 'is-online' : ''}`} title={companionStatusChipLabel} />
                <span className="companion-chat__toolbar-status">{liveStatusLine || companionStatusChipLabel}</span>
              </div>
              <div className="panel-window__header-actions panel-window__header-actions--hero">
                <button className="ghost-button" type="button" onClick={openSettingsPanel}>
                  设置
                </button>
                <button className="ghost-button" type="button" onClick={togglePanelCollapse}>
                  折叠
                </button>
                <button className="ghost-button" type="button" onClick={closePanel}>
                  关闭
                </button>
              </div>
            </div>

            <section className="companion-chat">

              <div ref={messageListRef} className="message-list companion-chat__messages">
                {chat.messages.length ? (
                  chat.messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      assistantName={settings.companionName}
                    />
                  ))
                ) : (
                  <div className="empty-chat empty-chat--nexus">
                    <div className="empty-chat__copy">
                      <strong>{welcomeTitle}</strong>
                      <p>{welcomeBody}</p>
                      <div className="empty-chat__prompt-grid">
                        {panelQuickPrompts.map((item) => (
                          <button
                            key={item.label}
                            className="empty-chat__prompt"
                            type="button"
                            onClick={() => handleApplyQuickPrompt(item.prompt)}
                          >
                            <span>{item.label}</span>
                            <small>{item.prompt}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {chat.error ? <div className="error-banner">{chat.error}</div> : null}

              <div className="composer composer--minimal companion-chat__composer">
                <textarea
                  ref={composerTextareaRef}
                  rows={5}
                  value={chat.input}
                  placeholder={`和 ${settings.companionName} 说点什么，比如：帮我整理今天待办 / 记一下刚才的灵感 / 给我一句放松的提醒。`}
                  onChange={(event) => chat.setInput(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                />

                <div className="companion-chat__composer-meta">
                  <div className="composer__hint">
                    回车发送，Shift + Enter 换行。
                  </div>
                </div>

                <div className="composer__actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={voice.toggleVoiceConversation}
                    disabled={voiceActionDisabled}
                  >
                    {voiceActionLabel}
                  </button>
                  <button className="primary-button" type="button" onClick={() => void chat.sendMessage()} disabled={chat.busy}>
                    {chat.busy ? `${settings.companionName} 回复中...` : '发送'}
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </section>
      {settingsDrawer}
      {onboardingGuide}
    </div>
  )
}
