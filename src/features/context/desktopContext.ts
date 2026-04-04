import type { DesktopContextRequest, DesktopContextSnapshot } from '../../types'

const MAX_ACTIVE_WINDOW_TITLE_LENGTH = 180
const MAX_ACTIVE_WINDOW_APP_NAME_LENGTH = 80
const MAX_ACTIVE_WINDOW_PROCESS_PATH_LENGTH = 220
const MAX_CLIPBOARD_CONTEXT_LENGTH = 1_600
const MAX_SCREEN_TEXT_CONTEXT_LENGTH = 1_800
const MAX_VLM_ANALYSIS_LENGTH = 800

type DesktopContextRequestOptions = {
  includeActiveWindow?: boolean
  includeClipboard?: boolean
  includeScreenshot?: boolean
}

export function buildDesktopContextRequest(options: DesktopContextRequestOptions = {}): DesktopContextRequest {
  return {
    includeActiveWindow: options.includeActiveWindow ?? true,
    includeClipboard: options.includeClipboard ?? true,
    includeScreenshot: options.includeScreenshot ?? false,
  }
}

export function formatDesktopContext(snapshot: DesktopContextSnapshot | null | undefined) {
  if (!snapshot) return ''

  const sections: string[] = []
  const activeWindowTitle = String(snapshot.activeWindowTitle ?? '').trim()
  const activeWindowAppName = String(snapshot.activeWindowAppName ?? '').trim()
  const activeWindowProcessPath = String(snapshot.activeWindowProcessPath ?? '').trim()
  const clipboardText = String(snapshot.clipboardText ?? '').trim()
  const screenText = String(snapshot.screenText ?? '').trim()
  const vlmAnalysis = String(snapshot.vlmAnalysis ?? '').trim()

  if (activeWindowTitle || activeWindowAppName || activeWindowProcessPath) {
    const activeWindowLines = ['当前前台窗口：']

    if (activeWindowTitle) {
      activeWindowLines.push(`窗口标题：${shorten(activeWindowTitle, MAX_ACTIVE_WINDOW_TITLE_LENGTH)}`)
    }

    if (activeWindowAppName) {
      activeWindowLines.push(`应用名称：${shorten(activeWindowAppName, MAX_ACTIVE_WINDOW_APP_NAME_LENGTH)}`)
    }

    if (activeWindowProcessPath) {
      activeWindowLines.push(`进程路径：${shorten(activeWindowProcessPath, MAX_ACTIVE_WINDOW_PROCESS_PATH_LENGTH)}`)
    }

    sections.push(activeWindowLines.join('\n'))
  }

  if (clipboardText) {
    sections.push([
      `剪贴板文本：${shorten(clipboardText, MAX_CLIPBOARD_CONTEXT_LENGTH)}`,
    ].join('\n'))
  }

  if (screenText) {
    sections.push([
      '屏幕可见文字：',
      shorten(screenText, MAX_SCREEN_TEXT_CONTEXT_LENGTH),
    ].join('\n'))
  }

  if (vlmAnalysis) {
    sections.push([
      '屏幕画面分析（VLM）：',
      shorten(vlmAnalysis, MAX_VLM_ANALYSIS_LENGTH),
    ].join('\n'))
  }

  if (!sections.length) {
    return ''
  }

  return [
    '以下是当前桌面补充上下文，请只在自然相关时使用，不要强行引用：',
    sections.join('\n\n'),
  ].join('\n\n')
}

function shorten(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`
}
