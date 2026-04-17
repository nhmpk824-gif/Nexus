import type { DesktopContextRequest, DesktopContextSnapshot } from '../../types'
import { shorten } from '../../lib/common'

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
    const activeWindowLines = ['Current foreground window:']

    if (activeWindowTitle) {
      activeWindowLines.push(`Window title: ${shorten(activeWindowTitle, MAX_ACTIVE_WINDOW_TITLE_LENGTH)}`)
    }

    if (activeWindowAppName) {
      activeWindowLines.push(`App name: ${shorten(activeWindowAppName, MAX_ACTIVE_WINDOW_APP_NAME_LENGTH)}`)
    }

    if (activeWindowProcessPath) {
      activeWindowLines.push(`Process path: ${shorten(activeWindowProcessPath, MAX_ACTIVE_WINDOW_PROCESS_PATH_LENGTH)}`)
    }

    sections.push(activeWindowLines.join('\n'))
  }

  if (clipboardText) {
    sections.push([
      `Clipboard text: ${shorten(clipboardText, MAX_CLIPBOARD_CONTEXT_LENGTH)}`,
    ].join('\n'))
  }

  if (screenText) {
    sections.push([
      'Visible on-screen text:',
      shorten(screenText, MAX_SCREEN_TEXT_CONTEXT_LENGTH),
    ].join('\n'))
  }

  if (vlmAnalysis) {
    sections.push([
      'Screen visual analysis (VLM):',
      shorten(vlmAnalysis, MAX_VLM_ANALYSIS_LENGTH),
    ].join('\n'))
  }

  if (!sections.length) {
    return ''
  }

  return [
    'Below is supplementary desktop context. Use it only when naturally relevant; do not force a reference. Reply in the user\'s language.',
    sections.join('\n\n'),
  ].join('\n\n')
}
