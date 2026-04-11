import { enMessages } from './locales/en.ts'
import { jaMessages } from './locales/ja.ts'
import { koMessages } from './locales/ko.ts'
import { zhCNMessages } from './locales/zh-CN.ts'
import { zhTWMessages } from './locales/zh-TW.ts'
import { toTraditional } from './opencc.ts'
import type {
  AppLocale,
  TranslationDictionary,
  TranslationKey,
  TranslationParams,
} from '../types/i18n'

export const DEFAULT_LOCALE: AppLocale = 'zh-CN'

export const AVAILABLE_LOCALES: AppLocale[] = [
  'zh-CN',
  'zh-TW',
  'en-US',
  'ja',
  'ko',
]

const dictionaries: Record<AppLocale, TranslationDictionary> = {
  'zh-CN': zhCNMessages,
  'zh-TW': zhTWMessages,
  'en-US': enMessages,
  ja: jaMessages,
  ko: koMessages,
}

let currentLocale: AppLocale = DEFAULT_LOCALE

function interpolateMessage(template: string, params?: TranslationParams) {
  if (!params) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`))
}

function resolveMessage(locale: AppLocale, key: TranslationKey) {
  const message = dictionaries[locale][key]
  if (message) {
    return message
  }

  if (locale === 'zh-TW') {
    return toTraditional(dictionaries['zh-CN'][key] ?? key)
  }

  return dictionaries[DEFAULT_LOCALE][key] ?? key
}

export function normalizeLocale(value: unknown): AppLocale {
  switch (value) {
    case 'zh-TW':
    case 'en':
    case 'en-US':
    case 'ja':
    case 'ko':
      return value === 'en' ? 'en-US' : value
    case 'zh-CN':
    default:
      return DEFAULT_LOCALE
  }
}

export function getLocale() {
  return currentLocale
}

export function setLocale(locale: AppLocale) {
  currentLocale = normalizeLocale(locale)
}

export function getDictionary(locale: AppLocale = currentLocale) {
  return dictionaries[normalizeLocale(locale)]
}

export function hasKey(key: TranslationKey, locale: AppLocale = currentLocale) {
  const normalizedLocale = normalizeLocale(locale)
  return key in dictionaries[normalizedLocale] || key in dictionaries[DEFAULT_LOCALE]
}

export function t(
  key: TranslationKey,
  params?: TranslationParams,
  locale: AppLocale = currentLocale,
) {
  return interpolateMessage(resolveMessage(normalizeLocale(locale), key), params)
}
