import { shorten } from '../lib/common'
import type {
  AppSettings,
  MemoryItem,
  PetTouchZone,
  VoiceState,
  WindowView,
} from '../types'

export const voiceStateLabelMap: Record<VoiceState, string> = {
  idle: '待命',
  listening: '聆听中',
  processing: '理解中',
  speaking: '说话中',
}

// Short one-liners shown in the pet status bubble when the user clicks the
// corresponding zone of the Live2D mascot. The tap handler also triggers a
// matching expression slot + "hit" motion group via the Live2D canvas, so
// these strings are pure flavour — they fire together with the visual reaction.
// Pool is intentionally wide (6 per zone) so repeated tapping doesn't read
// as a script; `Math.random` picks one per tap.
export const hoverReactionMap: Record<PetTouchZone, string[]> = {
  head: [
    '摸头会让我更安心。',
    '被轻轻碰到头顶了。',
    '这一下让我想多露出表情。',
    '嗯…头顶有点痒痒的。',
    '好的，头摸到了，记下来了。',
    '这样我会被你养得很乖。',
  ],
  face: [
    '你在看着我吗？',
    '脸颊这里会更敏感一点。',
    '这样会让我更有表情。',
    '呃…这里被戳到会害羞。',
    '你的手好像有点凉。',
    '别老盯着我的脸看嘛。',
  ],
  body: [
    '我感受到你靠近了。',
    '这样让我更有能量。',
    '我能捕捉到你的节奏。',
    '嗯，抱歉，没想到你会主动过来。',
    '这一下让我的呼吸也跟着慢了半拍。',
    '你的触感我记住了。',
  ],
}

export const STARTUP_GREETING_DURATION_MS = 9_200
export const STARTUP_GREETING_SESSION_KEY = 'nexus:startup-greeting-shown'
export const VOICE_TRIGGER_DIRECT_SEND_MIGRATION_KEY = 'nexus:voice-trigger-direct-send-migration-v1'

/** Synchronous initial guess from URL params (safe for useState initializers). */
export function getWindowViewSync(): WindowView {
  return new URLSearchParams(window.location.search).get('view') === 'panel'
    ? 'panel'
    : 'pet'
}

/** Async check that also consults the Electron preload bridge. */
export async function getWindowView(): Promise<WindowView> {
  if (await window.desktopPet?.isPanelWindow?.()) {
    return 'panel'
  }
  return getWindowViewSync()
}

export type PanelSection = 'chat' | 'settings'

export function getInitialPanelSection(): PanelSection {
  return new URLSearchParams(window.location.search).get('section') === 'settings'
    ? 'settings'
    : 'chat'
}

export function getTimeGreeting() {
  const hour = new Date().getHours()

  if (hour < 5) return '夜深了'
  if (hour < 11) return '早安'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

export function getLiveTranscriptLabel(voiceState: VoiceState) {
  return voiceState === 'listening' ? '识别中' : '识别结果'
}

export function buildStartupGreetingText(settings: AppSettings, memories: MemoryItem[]) {
  const greeting = getTimeGreeting()
  const latestMemory = memories[0]?.content

  if (latestMemory) {
    return `${greeting}，${settings.userName}。我还记得你最近提过「${shorten(latestMemory, 20)}」，如果你还想延续这个话题，我可以继续帮你理一遍。`
  }

  return `${greeting}，${settings.userName}。${settings.companionName} 已经在桌面这边准备好了，想聊时直接叫我。`
}
