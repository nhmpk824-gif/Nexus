import { useCallback, useEffect, useState } from 'react'

// Mirror the bridge-side types locally. `ModelInventory` + co. are
// declared in src/vite-env.d.ts at module scope so `declare global` can
// reference them, but they're not exported. Inlining here keeps this
// component self-contained without forcing a types refactor.
type ModelCatalogEntryLike = {
  id: string
  label: string
  sizeLabel: string
  required: boolean
  present: boolean
}
type ModelInventoryLike = {
  models: ModelCatalogEntryLike[]
  ready: boolean
  missingRequired: string[]
}

/**
 * Onboarding inline panel that surfaces the state of the local sherpa
 * voice models (wake-word cn/en, SenseVoice offline STT, Silero VAD).
 *
 * Bundled installers (Windows NSIS, Mac dmg/zip, Linux AppImage/deb) now
 * ship these models via electron-builder's extraResources, so on a fresh
 * install `inventory.ready` should be true and the strip stays as a
 * single-line confirmation. The download CTA is the fallback path for:
 *   - Upgrades from a build that pre-dates the Mac/Linux bundling
 *   - Manual sideloads / sandbox wipes
 *   - CI builds deliberately produced without models (none right now,
 *     but this keeps the UI honest if that ever changes)
 *
 * Silently hides when the Electron bridge isn't attached (dev vite
 * server, Storybook, tests) — the step works identically without this
 * block, it's purely diagnostic.
 */
export function LocalVoiceModelsStatus() {
  const [inventory, setInventory] = useState<ModelInventoryLike | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [progressText, setProgressText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshInventory = useCallback(async () => {
    try {
      const next = await window.desktopPet?.modelsGetInventory?.()
      if (next) setInventory(next)
    } catch (err) {
      console.warn('[onboarding] modelsGetInventory failed:', err)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void refreshInventory()

    const unsubscribe = window.desktopPet?.subscribeModelsProgress?.((event) => {
      if (event.phase === 'downloading' && event.total && event.total > 0) {
        const percent = Math.floor(((event.downloaded ?? 0) / event.total) * 100)
        const file = event.fileName ?? event.modelId
        setProgressText(`${file} ${percent}%`)
      } else if (event.phase === 'installed' || event.phase === 'done') {
        setProgressText(null)
        void refreshInventory()
      } else if (event.phase === 'error') {
        setError(event.message ?? '下载失败')
      }
    })
    return () => unsubscribe?.()
  }, [refreshInventory])

  const handleDownload = useCallback(async () => {
    setDownloading(true)
    setError(null)
    try {
      const result = await window.desktopPet?.modelsDownloadMissing?.()
      if (result?.inventory) setInventory(result.inventory)
      const failures = result?.results.filter((r) => !r.ok) ?? []
      if (failures.length) {
        setError(`下载未完成：${failures.map((f) => f.id).join('、')}。稍后可在设置里重试。`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDownloading(false)
      setProgressText(null)
      void refreshInventory()
    }
  }, [refreshInventory])

  // Bridge unavailable or pre-mount: render nothing so the step layout
  // doesn't get a phantom placeholder.
  if (!loaded || !inventory) {
    return null
  }

  const requiredModels = inventory.models.filter((m) => m.required)
  const missing = requiredModels.filter((m) => !m.present)

  if (missing.length === 0) {
    return (
      <p className="onboarding-tip">
        ✓ 本地语音模型已就绪（{requiredModels.length} 项：唤醒词 + 离线识别 + VAD）。
      </p>
    )
  }

  return (
    <div className="onboarding-subsection">
      <strong>本地语音模型未就绪</strong>
      <p className="onboarding-tip">
        以下 {missing.length} 项模型尚未下载，选择本地离线识别或启用唤醒词前需要先补齐：
      </p>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.7)' }}>
        {missing.map((m) => (
          <li key={m.id}>
            {m.label}
            <span style={{ color: 'rgba(255,255,255,0.4)' }}> · {m.sizeLabel}</span>
          </li>
        ))}
      </ul>
      {progressText ? (
        <p className="onboarding-tip">下载中：{progressText}</p>
      ) : null}
      {error ? <p className="settings-test-result is-error">{error}</p> : null}
      <button
        className="primary-button"
        type="button"
        onClick={() => void handleDownload()}
        disabled={downloading}
      >
        {downloading ? '下载中…' : `下载 ${missing.length} 项必需模型`}
      </button>
    </div>
  )
}
