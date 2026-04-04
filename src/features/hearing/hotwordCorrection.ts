import type { AppSettings } from '../../types'
import { normalizeIntentText } from '../intent/preprocess.ts'

type VoiceHotwordIntent = 'any' | 'reminder' | 'weather' | 'search' | 'lyrics' | 'time'

type VoiceHotwordEntry = {
  canonical: string
  variants: string[]
  intents?: VoiceHotwordIntent[]
}

export type VoiceHotwordCorrectionResult = {
  text: string
  changed: boolean
  replacements: Array<{
    from: string
    to: string
  }>
}

type VoiceHotwordCorrectionOptions = {
  settings?: Partial<Pick<AppSettings, 'toolWeatherDefaultLocation' | 'wakeWord' | 'companionName'>> | null
}

const GENERIC_HOTWORD_ENTRIES: VoiceHotwordEntry[] = [
  {
    canonical: '提醒我',
    variants: ['题醒我', '提型我', '提行我', '提醒窝', '体醒我', '停醒我', '挺醒我'],
  },
  {
    canonical: '提醒一下',
    variants: ['题醒一下', '提型一下', '提醒一夏', '体醒一下'],
  },
  {
    canonical: '设置提醒',
    variants: ['设置题醒', '设置提型', '设置体醒'],
  },
  {
    canonical: '设个提醒',
    variants: ['设个题醒', '设个提型', '设个体醒'],
  },
  {
    canonical: '搜索',
    variants: ['搜所', '收索', '搜锁'],
  },
  {
    canonical: '搜一下',
    variants: ['搜一夏', '搜一下子'],
  },
  {
    canonical: '查询',
    variants: ['查寻'],
  },
  {
    canonical: '查一下',
    variants: ['查一夏'],
  },
  {
    canonical: '天气',
    variants: ['天器', '天汽', '田气'],
  },
  {
    canonical: '歌词',
    variants: ['歌次', '格词', '歌瓷'],
  },
  {
    canonical: '分钟',
    variants: ['分种'],
  },
  {
    canonical: '小时',
    variants: ['小事'],
    intents: ['time', 'reminder'],
  },
  {
    canonical: '五分钟后',
    variants: ['五分种后', '五分钟侯'],
    intents: ['time', 'reminder'],
  },
  {
    canonical: '五分钟之后',
    variants: ['五分种之后'],
    intents: ['time', 'reminder'],
  },
]

const WEATHER_CITY_HOTWORD_ENTRIES: VoiceHotwordEntry[] = [
  { canonical: '深圳', variants: ['深证', '深镇'] },
  { canonical: '广州', variants: ['广洲'] },
  { canonical: '北京', variants: ['北经'] },
  { canonical: '上海', variants: ['上嗨'] },
  { canonical: '宁波', variants: ['宁博'] },
  { canonical: '杭州', variants: ['杭洲'] },
  { canonical: '成都', variants: ['成督'] },
  { canonical: '重庆', variants: ['重青'] },
]

const SEARCH_MEDIA_HOTWORD_ENTRIES: VoiceHotwordEntry[] = [
  { canonical: '周传雄', variants: ['周传熊', '州传雄'] },
  { canonical: '黄昏', variants: ['黄婚'] },
]

const LEADING_RELATIVE_TIME_FIX_PATTERN = /^(?:最后)(?=(?:提醒我|提醒一下|通知我|告诉我|设个提醒|设置提醒))/u

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function detectHotwordIntents(text: string) {
  const normalized = normalizeIntentText(text)

  return {
    reminder: /(?:提醒|题醒|提型|通知|设置提醒|设个提醒|分钟|小时|今天|明天|后天|今晚)/u.test(normalized),
    weather: /(?:天气|天器|天汽|气温|温度|下雨|降雨|深圳|深证|广州|广洲|北京|北经|上海|上嗨|宁波|宁博)/u.test(normalized),
    search: /(?:搜索|搜所|收索|搜锁|搜一下|查询|查一下|歌词|歌詞|歌次|新闻|资讯|周传雄|周传熊|黄昏|黄婚)/u.test(normalized),
    lyrics: /(?:歌词|歌詞|歌次|周传雄|周传熊|黄昏|黄婚)/u.test(normalized),
    time: /(?:分钟|分种|小时|今天|明天|后天|今晚|早上|上午|中午|下午|晚上|九点|十点)/u.test(normalized),
  }
}

function shouldApplyEntry(entry: VoiceHotwordEntry, intents: ReturnType<typeof detectHotwordIntents>) {
  if (!entry.intents?.length || entry.intents.includes('any')) {
    return true
  }

  return entry.intents.some((intent) => (
    intent !== 'any' && intents[intent]
  ))
}

function collectDynamicEntries(options?: VoiceHotwordCorrectionOptions) {
  const entries: VoiceHotwordEntry[] = []
  const defaultLocation = normalizeIntentText(options?.settings?.toolWeatherDefaultLocation ?? '')

  if (defaultLocation === '深圳') {
    entries.push({ canonical: '深圳', variants: ['深证', '深镇'], intents: ['weather', 'search'] })
  }

  if (defaultLocation === '广州') {
    entries.push({ canonical: '广州', variants: ['广洲'], intents: ['weather', 'search'] })
  }

  return entries
}

function applyEntryReplacements(
  text: string,
  entry: VoiceHotwordEntry,
  replacements: VoiceHotwordCorrectionResult['replacements'],
) {
  let nextText = text

  for (const variant of [...entry.variants].sort((left, right) => right.length - left.length)) {
    if (!variant || variant === entry.canonical) {
      continue
    }

    const pattern = new RegExp(escapeRegExp(variant), 'gu')
    if (!pattern.test(nextText)) {
      continue
    }

    nextText = nextText.replace(pattern, entry.canonical)
    replacements.push({
      from: variant,
      to: entry.canonical,
    })
  }

  return nextText
}

export function applyVoiceHotwordCorrections(
  text: string,
  options?: VoiceHotwordCorrectionOptions,
): VoiceHotwordCorrectionResult {
  let nextText = normalizeIntentText(text)
  const replacements: VoiceHotwordCorrectionResult['replacements'] = []

  if (!nextText) {
    return {
      text: '',
      changed: false,
      replacements,
    }
  }

  if (LEADING_RELATIVE_TIME_FIX_PATTERN.test(nextText)) {
    nextText = nextText.replace(LEADING_RELATIVE_TIME_FIX_PATTERN, '五分钟后')
    replacements.push({
      from: '最后',
      to: '五分钟后',
    })
  }

  const intents = detectHotwordIntents(nextText)
  const entries = [
    ...GENERIC_HOTWORD_ENTRIES,
    ...collectDynamicEntries(options),
    ...(intents.weather || intents.search ? WEATHER_CITY_HOTWORD_ENTRIES : []),
    ...(intents.search || intents.lyrics ? SEARCH_MEDIA_HOTWORD_ENTRIES : []),
  ]

  for (const entry of entries) {
    if (!shouldApplyEntry(entry, intents)) {
      continue
    }

    nextText = applyEntryReplacements(nextText, entry, replacements)
  }

  return {
    text: nextText,
    changed: nextText !== normalizeIntentText(text),
    replacements,
  }
}
