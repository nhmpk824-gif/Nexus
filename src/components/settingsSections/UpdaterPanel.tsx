import { memo } from 'react'
import { useUpdater } from '../../features/updater'
import { resolveLocalizedText } from '../../lib/uiLanguage'
import type { UiLanguage } from '../../types'

type UpdaterPanelProps = {
  uiLanguage: UiLanguage
}

function formatBytes(bytes: number): string {
  if (!bytes || !Number.isFinite(bytes)) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`
}

export const UpdaterPanel = memo(function UpdaterPanel({ uiLanguage }: UpdaterPanelProps) {
  const t = (zhCN: string, enUS: string) =>
    resolveLocalizedText(uiLanguage, { 'zh-CN': zhCN, 'en-US': enUS })
  const updater = useUpdater()
  const { event, busy, currentVersion, isPackaged } = updater

  let statusText: string
  let statusTone: 'idle' | 'info' | 'success' | 'warning' | 'error' = 'idle'

  switch (event.type) {
    case 'idle':
      statusText = isPackaged
        ? t('尚未检查更新', 'No update check yet')
        : t('开发模式（自动更新已禁用）', 'Dev mode (auto-update disabled)')
      statusTone = 'idle'
      break
    case 'checking':
      statusText = t('正在检查更新…', 'Checking for updates...')
      statusTone = 'info'
      break
    case 'available':
      statusText = t(
        `发现新版本 v${event.version ?? '?'}，正在后台下载`,
        `Found new version v${event.version ?? '?'}, downloading in background`,
      )
      statusTone = 'info'
      break
    case 'not-available':
      statusText = t(
        `已是最新版本（v${event.version}）`,
        `Already up to date (v${event.version})`,
      )
      statusTone = 'success'
      break
    case 'progress': {
      const pct = Math.max(0, Math.min(100, Math.round(event.percent)))
      statusText = `${t('下载中', 'Downloading')} ${pct}% · ${formatBytes(event.transferred)} / ${formatBytes(event.total)} · ${formatSpeed(event.bytesPerSecond)}`
      statusTone = 'info'
      break
    }
    case 'downloaded':
      statusText = t(
        `v${event.version ?? '?'} 已下载完成，重启即可生效`,
        `v${event.version ?? '?'} downloaded, restart to apply`,
      )
      statusTone = 'success'
      break
    case 'error':
      statusText = `${t('更新失败：', 'Update failed: ')}${event.message}`
      statusTone = 'error'
      break
  }

  const showInstallButton = event.type === 'downloaded'
  const progressPercent = event.type === 'progress'
    ? Math.max(0, Math.min(100, event.percent))
    : null

  return (
    <section className="settings-updater-panel">
      <div className="settings-updater-panel__header">
        <div>
          <h5 className="settings-updater-panel__title">{t('应用更新', 'App updates')}</h5>
          <p className="settings-updater-panel__version">
            {t('当前版本', 'Current version')} v{currentVersion ?? '—'}
          </p>
        </div>
        <div className="settings-updater-panel__actions">
          {showInstallButton ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => void updater.installAndRestart()}
            >
              {t('立即重启并安装', 'Restart and install now')}
            </button>
          ) : (
            <button
              type="button"
              className="ghost-button"
              onClick={() => void updater.checkForUpdates()}
              disabled={busy || !isPackaged}
              title={!isPackaged ? t('仅在打包后的发行版本中可用', 'Only available in packaged releases') : undefined}
            >
              {busy ? t('检查中…', 'Checking...') : t('检查更新', 'Check for updates')}
            </button>
          )}
        </div>
      </div>

      <p className={`settings-updater-panel__status settings-updater-panel__status--${statusTone}`}>
        {statusText}
      </p>

      {progressPercent !== null ? (
        <div className="settings-updater-panel__progress" aria-hidden="true">
          <div
            className="settings-updater-panel__progress-bar"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      ) : null}
    </section>
  )
})
