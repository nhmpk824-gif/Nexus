import type { AppSettings, ChatMessage, MemoryItem, PetMood, PresenceCategory } from '../../types'
import { shorten } from '../../lib/common'

export type PresenceLine = {
  text: string
  category: PresenceCategory
}

type PresenceContext = {
  settings: AppSettings
  messages: ChatMessage[]
  memories: MemoryItem[]
  mood: PetMood
  recentLines?: PresenceLine[]
}

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

function getTimePresenceLines(userName: string) {
  const hour = new Date().getHours()

  if (hour < 5) {
    return [
      `${userName}，夜已经很深了，累的话就先休息一下，没做完的我们明天再接。`,
      `${userName}，这么晚还在忙的话，先把节奏放慢一点，我还能接住你刚才那件事。`,
    ]
  }

  if (hour < 11) {
    return [
      `${userName}，早上好，今天不用一下子切满状态，想从哪件事开始都可以。`,
      `${userName}，新的一天开始了，如果你要热启动，我可以先帮你理第一步。`,
    ]
  }

  if (hour < 14) {
    return [
      `${userName}，中午记得放松一下，别让自己一直绷着。`,
      `${userName}，午间适合清一下脑子，要不要我帮你把下半天的重点理一理。`,
    ]
  }

  if (hour < 18) {
    return [
      `${userName}，下午这段时间最容易掉专注，如果你卡住了，我可以先帮你拆下一步。`,
      `${userName}，下午辛苦了，想切回正题或者歇一下，我都接得住。`,
    ]
  }

  return [
    `${userName}，晚上如果还要继续做事，我们可以先把最重要的一件收掉。`,
    `${userName}，夜色慢慢深下来时，别把所有事都拖太晚，我可以先帮你梳理一遍。`,
  ]
}

function pickPresenceLine(candidates: PresenceLine[], recentLines: PresenceLine[]) {
  const recentTexts = new Set(recentLines.map((line) => line.text))
  const lastCategory = recentLines[0]?.category

  const withoutRecentText = candidates.filter((line) => !recentTexts.has(line.text))
  const withoutRecentCategory = withoutRecentText.filter((line) => line.category !== lastCategory)

  return pickRandom(
    withoutRecentCategory.length
      ? withoutRecentCategory
      : withoutRecentText.length
        ? withoutRecentText
        : candidates,
  )
}

export function buildPresenceMessage({
  settings,
  messages,
  memories,
  mood,
  recentLines = [],
}: PresenceContext) {
  const recentUserMessage = [...messages].reverse().find((message) => message.role === 'user')
  const latestMemory = memories[0]
  const candidates = [
    ...getTimePresenceLines(settings.userName).map((text) => ({
      text,
      category: 'time' as const,
    })),
    ...(latestMemory
      ? [
          {
            text: `你之前提过「${shorten(latestMemory.content, 20)}」，如果今天要继续，我可以直接从那里接上。`,
            category: 'memory' as const,
          },
          {
            text: `最近留下的「${shorten(latestMemory.content, 20)}」我还记得，要继续的话不用重新讲一遍。`,
            category: 'memory' as const,
          },
        ]
      : []),
    ...(recentUserMessage
      ? [
          {
            text: `你刚刚说到「${shorten(recentUserMessage.content, 20)}」，如果要继续，我这边还能接住。`,
            category: 'recent' as const,
          },
          {
            text: `关于你提到的「${shorten(recentUserMessage.content, 20)}」，要不要我先帮你接着往下理。`,
            category: 'recent' as const,
          },
        ]
      : []),
    ...(mood === 'happy'
      ? [
          {
            text: '刚才那轮互动还挺有意思的，我现在状态很好。',
            category: 'mood' as const,
          },
          {
            text: '刚刚那一下让我也跟着提起劲了。',
            category: 'mood' as const,
          },
        ]
      : []),
    ...(mood === 'thinking'
      ? [
          {
            text: '我还在整理你刚才那句里的重点，想继续的话随时接上。',
            category: 'mood' as const,
          },
        ]
      : []),
    ...(mood === 'sleepy'
      ? [
          {
            text: `${settings.userName}，如果你累了，就先把节奏放下来，剩下的我们慢一点做。`,
            category: 'mood' as const,
          },
        ]
      : []),
    {
      text: `${settings.userName}，如果你现在正卡在某一步，可以直接把那一步扔给我。`,
      category: 'neutral' as const,
    },
    {
      text: `${settings.companionName} 在桌面这边待命中，你想切回聊天时我能马上接上。`,
      category: 'neutral' as const,
    },
  ]

  return pickPresenceLine(candidates, recentLines)
}
