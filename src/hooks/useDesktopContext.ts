import { useCallback, useEffect } from 'react'
import {
  buildDesktopContextRequest,
} from '../features/context'
import { analyzeScreenWithVlm, disposeScreenOcrWorker, enqueueScreenOcr } from '../features/vision'
import type { AppSettings, DesktopContextSnapshot } from '../types'

type UseDesktopContextParams = {
  settingsRef: React.RefObject<AppSettings>
}

export function useDesktopContext({ settingsRef }: UseDesktopContextParams) {
  useEffect(() => {
    return () => {
      void disposeScreenOcrWorker()
    }
  }, [])

  const loadDesktopContextSnapshot = useCallback(async (): Promise<DesktopContextSnapshot | null> => {
    const currentSettings = settingsRef.current
    if (!currentSettings.contextAwarenessEnabled) return null

    const includeActiveWindow = currentSettings.activeWindowContextEnabled
    const includeClipboard = currentSettings.clipboardContextEnabled
    const includeScreenshot = currentSettings.screenContextEnabled

    if (!includeActiveWindow && !includeClipboard && !includeScreenshot) {
      return null
    }

    if (!window.desktopPet?.getDesktopContext) {
      return null
    }

    try {
      const desktopContextRequest = {
        ...buildDesktopContextRequest({
          includeActiveWindow,
          includeClipboard,
          includeScreenshot,
        }),
        policy: {
          activeWindow: currentSettings.activeWindowContextEnabled,
          clipboard: currentSettings.clipboardContextEnabled,
          screenshot: currentSettings.screenContextEnabled,
        },
      }
      const snapshot = await window.desktopPet.getDesktopContext(desktopContextRequest)

      if (
        !snapshot
        || !includeScreenshot
        || !snapshot.screenshotDataUrl
      ) {
        return snapshot
      }

      let enrichedSnapshot = snapshot

      const ocrPromise = (async () => {
        try {
          return await enqueueScreenOcr(
            snapshot.screenshotDataUrl!,
            currentSettings.screenOcrLanguage,
          )
        } catch (error) {
          console.warn('[screen-ocr] failed to recognize screenshot text', error)
          return undefined
        }
      })()

      const vlmEnabled = currentSettings.screenVlmEnabled
        && currentSettings.screenVlmBaseUrl
        && currentSettings.screenVlmModel

      const vlmPromise = vlmEnabled
        ? (async () => {
            try {
              return await analyzeScreenWithVlm(snapshot.screenshotDataUrl!, {
                providerId: currentSettings.screenVlmProviderId,
                baseUrl: currentSettings.screenVlmBaseUrl,
                apiKey: currentSettings.screenVlmApiKey,
                model: currentSettings.screenVlmModel,
              })
            } catch (error) {
              console.warn('[screen-vlm] failed to analyze screenshot', error)
              return undefined
            }
          })()
        : Promise.resolve(undefined)

      const [screenText, vlmAnalysis] = await Promise.all([ocrPromise, vlmPromise])

      if (screenText) {
        enrichedSnapshot = { ...enrichedSnapshot, screenText }
      }

      if (vlmAnalysis) {
        enrichedSnapshot = { ...enrichedSnapshot, vlmAnalysis }
      }

      return enrichedSnapshot
    } catch {
      return null
    }
  }, [settingsRef])

  return {
    loadDesktopContextSnapshot,
  }
}
