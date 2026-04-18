import { useCallback, useEffect, useRef, useState } from 'react'

type ModelEntry = {
  id: string
  label: string
  sizeLabel: string
  purpose: string
  required: boolean
  kind: 'archive' | 'files' | 'standalone'
  present: boolean
  location: string | null
}

type Inventory = {
  models: ModelEntry[]
  ready: boolean
  missingRequired: string[]
  primaryDir: string
  searchRoots: string[]
}

type ProgressEvent = {
  modelId: string
  phase: 'start' | 'downloading' | 'done' | 'installed' | 'error'
  downloaded?: number
  total?: number
  fileName?: string
  message?: string
}

type PerModelProgress = {
  phase: ProgressEvent['phase']
  downloaded: number
  total: number
  fileName?: string
  message?: string
}

type Props = {
  /** Hide the overlay even when inventory is incomplete — used while the pet view is active. */
  suppressed?: boolean
}

const STORAGE_KEY = 'nexus.modelSetup.dismissedUntilRestart'

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function ModelSetupOverlay({ suppressed = false }: Props) {
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [progress, setProgress] = useState<Record<string, PerModelProgress>>({})
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
  })
  const [networkProbe, setNetworkProbe] = useState<{ huggingFaceReachable: boolean } | null>(null)
  const [pythonStatus, setPythonStatus] = useState<{
    pythonAvailable: boolean
    version: string | null
    omniVoice: { ready: boolean; missingImports: string[] }
    glmAsr: { ready: boolean; missingImports: string[] }
  } | null>(null)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  const refreshInventoryRef = useRef<() => Promise<void>>(() => Promise.resolve())

  const refreshInventory = useCallback(async () => {
    try {
      const inv = await window.desktopPet?.modelsGetInventory?.()
      if (inv) setInventory(inv)
    } catch (err) {
      console.warn('[ModelSetup] inventory fetch failed:', err)
    }
  }, [])
  refreshInventoryRef.current = refreshInventory

  useEffect(() => {
    refreshInventory()
    window.desktopPet?.modelsNetworkProbe?.().then(setNetworkProbe).catch(() => {})
    window.desktopPet?.pythonRuntimeStatus?.().then(setPythonStatus).catch(() => {})
  }, [refreshInventory])

  useEffect(() => {
    const unsubscribe = window.desktopPet?.subscribeModelsProgress?.((event: ProgressEvent) => {
      setProgress((prev) => {
        const current = prev[event.modelId] ?? { phase: 'start', downloaded: 0, total: 0 }
        const next: PerModelProgress = {
          phase: event.phase,
          downloaded: event.downloaded ?? current.downloaded,
          total: event.total ?? current.total,
          fileName: event.fileName ?? current.fileName,
          message: event.message ?? current.message,
        }
        return { ...prev, [event.modelId]: next }
      })

      if (event.phase === 'installed' || event.phase === 'done') {
        refreshInventoryRef.current()
      }
    })
    return () => { unsubscribe?.() }
  }, [])

  const startDownloadAll = useCallback(async () => {
    setBusy(true)
    setErrorBanner(null)
    try {
      const result = await window.desktopPet?.modelsDownloadMissing?.()
      if (result?.inventory) setInventory(result.inventory)
      const failed = result?.results.filter(r => !r.ok) ?? []
      if (failed.length) {
        setErrorBanner(`部分模型下载失败：${failed.map(f => f.id).join(', ')}。请检查网络后重试。`)
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [])

  const retryModel = useCallback(async (modelId: string) => {
    setErrorBanner(null)
    try {
      await window.desktopPet?.modelsDownload?.(modelId)
      await refreshInventory()
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err))
    }
  }, [refreshInventory])

  const handleDismiss = useCallback(() => {
    try { sessionStorage.setItem(STORAGE_KEY, '1') } catch { /* no session storage (sandboxed) */ }
    setDismissed(true)
  }, [])

  if (suppressed) return null
  if (dismissed) return null
  if (!inventory) return null
  if (inventory.ready) return null

  const requiredModels = inventory.models.filter(m => m.required)
  const optionalModels = inventory.models.filter(m => !m.required)

  const renderRow = (model: ModelEntry) => {
    const p = progress[model.id]
    const pct = p && p.total > 0 ? Math.min(100, Math.floor((p.downloaded / p.total) * 100)) : null
    const isActive = p && (p.phase === 'start' || p.phase === 'downloading')
    const hasError = p?.phase === 'error'

    return (
      <div key={model.id} className="model-setup__row" data-state={model.present ? 'done' : hasError ? 'error' : isActive ? 'active' : 'pending'}>
        <div className="model-setup__row-main">
          <div className="model-setup__row-title">
            <strong>{model.label}</strong>
            <span className="model-setup__size">{model.sizeLabel}</span>
            {!model.required ? <span className="model-setup__tag">可选</span> : null}
          </div>
          <div className="model-setup__row-desc">{model.purpose}</div>
          {model.present ? (
            <div className="model-setup__row-status model-setup__row-status--ok">已安装</div>
          ) : isActive ? (
            <div className="model-setup__row-status">
              {pct !== null ? `${pct}% · ${formatBytes(p.downloaded)} / ${formatBytes(p.total)}` : '正在下载…'}
              {p?.fileName ? <span className="model-setup__row-file"> · {p.fileName}</span> : null}
            </div>
          ) : hasError ? (
            <div className="model-setup__row-status model-setup__row-status--error">
              失败{p?.message ? `：${p.message}` : ''}
            </div>
          ) : (
            <div className="model-setup__row-status model-setup__row-status--pending">待下载</div>
          )}
        </div>

        <div className="model-setup__row-action">
          {!model.present && !isActive ? (
            <button
              type="button"
              className="model-setup__inline-btn"
              onClick={() => retryModel(model.id)}
              disabled={busy}
            >
              {hasError ? '重试' : '下载'}
            </button>
          ) : null}
        </div>

        {pct !== null && isActive ? (
          <div className="model-setup__progress">
            <div className="model-setup__progress-bar" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="model-setup-backdrop" role="dialog" aria-modal="true">
      <section className="model-setup-card">
        <header className="model-setup-card__header">
          <div>
            <p className="eyebrow">首次启动</p>
            <h2>安装本地语音模型</h2>
            <p className="model-setup-card__copy">
              Nexus 的语音唤醒、转写功能使用本地开源模型（
              sherpa-onnx / Silero VAD）。点击下方按钮自动下载到
              <code className="model-setup-card__path">{inventory.primaryDir}</code>。
            </p>
          </div>
          <button className="ghost-button" type="button" onClick={handleDismiss} disabled={busy}>
            稍后再说
          </button>
        </header>

        {networkProbe && !networkProbe.huggingFaceReachable ? (
          <div className="model-setup__hint">
            检测到 HuggingFace 不可直连，将优先使用 GitHub Releases / ModelScope 国内镜像。
          </div>
        ) : null}

        {errorBanner ? (
          <div className="model-setup__error">{errorBanner}</div>
        ) : null}

        <div className="model-setup__list">
          <h3>必需模型</h3>
          {requiredModels.map(renderRow)}

          {optionalModels.length ? (
            <>
              <h3 className="model-setup__optional-title">可选模型</h3>
              {optionalModels.map(renderRow)}
            </>
          ) : null}
        </div>

        {pythonStatus ? (
          <div className="model-setup__python">
            <strong>Python 可选服务</strong>
            <div>
              {pythonStatus.pythonAvailable
                ? `已检测到 Python ${pythonStatus.version ?? ''}`
                : '未检测到 Python（可选，仅影响 OmniVoice TTS / GLM-ASR）'}
            </div>
            {pythonStatus.pythonAvailable && !pythonStatus.omniVoice.ready ? (
              <div className="model-setup__python-note">
                OmniVoice TTS 缺少依赖：{pythonStatus.omniVoice.missingImports.join(', ')} — 运行
                <code> pip install -r requirements.txt </code>
                安装（不安装也不影响基础对话）。
              </div>
            ) : null}
          </div>
        ) : null}

        <footer className="model-setup-card__actions">
          <button
            type="button"
            className="primary-button"
            onClick={startDownloadAll}
            disabled={busy || inventory.missingRequired.length === 0}
          >
            {busy ? '正在下载…' : `一键下载缺失的 ${inventory.missingRequired.length} 个模型`}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={refreshInventory}
            disabled={busy}
          >
            重新检测
          </button>
        </footer>
      </section>
    </div>
  )
}
