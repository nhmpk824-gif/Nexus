import { normalizeChineseText } from './chineseOptimization.ts'

export function segmentChineseText(text: string) {
  return normalizeChineseText(text).split(/\s+/).filter(Boolean)
}

export function extractKeywords(text: string, limit = 5) {
  return segmentChineseText(text).slice(0, Math.max(1, limit))
}

export function normalizeWakeWord(text: string) {
  return normalizeChineseText(text).replace(/\s+/g, '')
}
