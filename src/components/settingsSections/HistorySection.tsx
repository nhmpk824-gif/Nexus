import { memo } from 'react'
import { pickTranslatedUiText } from '../../lib/uiLanguage'
import type { UiLanguage } from '../../types'

type StatusMessage = {
  ok: boolean
  message: string
} | null

type HistorySectionProps = {
  active: boolean
  uiLanguage: UiLanguage
  chatMessageCount: number
  chatBusy: boolean
  exportingChatHistory: boolean
  importingChatHistory: boolean
  clearingChatHistory: boolean
  chatHistoryStatus: StatusMessage
  onExportChatHistory: () => void
  onImportChatHistory: () => void
  onClearChatHistory: () => void
}

export const HistorySection = memo(function HistorySection({
  active,
  uiLanguage,
  chatMessageCount,
  chatBusy,
  exportingChatHistory,
  importingChatHistory,
  clearingChatHistory,
  chatHistoryStatus,
  onExportChatHistory,
  onImportChatHistory,
  onClearChatHistory,
}: HistorySectionProps) {
  const ti = (key: Parameters<typeof pickTranslatedUiText>[1]) => pickTranslatedUiText(uiLanguage, key)

  return (
    <section className={`settings-section ${active ? 'is-active' : 'is-hidden'}`}>
      <div className="settings-section__title-row">
        <div>
          <h4>{ti('settings.history.title')}</h4>
          <p className="settings-drawer__hint">
            {ti('settings.history.note')}
          </p>
        </div>
      </div>

      <div className="settings-grid">
        <label>
          <span>{ti('settings.history.message_count')}</span>
          <input value={String(chatMessageCount)} readOnly />
        </label>

        <label>
          <span>{ti('settings.history.current_status')}</span>
          <input
            value={chatBusy ? ti('settings.history.replying') : ti('settings.history.idle')}
            readOnly
          />
        </label>
      </div>

      <p className="settings-drawer__hint">
        {ti('settings.history.hint')}
      </p>

      <div className="settings-section__title-row">
        <button
          type="button"
          className="ghost-button"
          onClick={onExportChatHistory}
          disabled={exportingChatHistory}
        >
          {exportingChatHistory
            ? ti('settings.history.exporting')
            : ti('settings.history.export')}
        </button>

        <button
          type="button"
          className="ghost-button"
          onClick={onImportChatHistory}
          disabled={importingChatHistory || chatBusy}
        >
          {importingChatHistory
            ? ti('settings.history.importing')
            : ti('settings.history.import')}
        </button>

        <button
          type="button"
          className="ghost-button"
          onClick={onClearChatHistory}
          disabled={clearingChatHistory || chatBusy || !chatMessageCount}
        >
          {clearingChatHistory
            ? ti('settings.history.clearing')
            : ti('settings.history.clear')}
        </button>
      </div>

      {chatHistoryStatus ? (
        <div className={chatHistoryStatus.ok ? 'settings-test-result is-success' : 'settings-test-result is-error'}>
          {chatHistoryStatus.message}
        </div>
      ) : null}
    </section>
  )
})
