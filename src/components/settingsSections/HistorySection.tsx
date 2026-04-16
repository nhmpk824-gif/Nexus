import { memo } from 'react'
import { resolveLocalizedText } from '../../lib/uiLanguage'
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
  const t = (zhCN: string, enUS: string) =>
    resolveLocalizedText(uiLanguage, { 'zh-CN': zhCN, 'en-US': enUS })

  return (
    <section className={`settings-section ${active ? 'is-active' : 'is-hidden'}`}>
      <div className="settings-section__title-row">
        <div>
          <h4>{t('聊天记录', 'Chat history')}</h4>
          <p className="settings-drawer__hint">
            {t(
              '这里管理当前会话的导出、导入和清空，不会改动长期记忆。',
              'Export, import, or clear the current chat session here. Long-term memory is untouched.',
            )}
          </p>
        </div>
      </div>

      <div className="settings-grid">
        <label>
          <span>{t('当前消息数', 'Message count')}</span>
          <input value={String(chatMessageCount)} readOnly />
        </label>

        <label>
          <span>{t('当前状态', 'Current status')}</span>
          <input
            value={chatBusy ? t('回复处理中', 'Replying...') : t('待机', 'Idle')}
            readOnly
          />
        </label>
      </div>

      <p className="settings-drawer__hint">
        {t(
          '导出会把当前所有聊天消息存成一个 JSON 文件。导入会替换当前聊天（原来的消息会被覆盖）。清空不可撤销——清掉之后就没了，长期记忆不受影响。',
          'Export saves all current messages to a JSON file. Import replaces the current chat — existing messages are overwritten. Clear is irreversible — once cleared, the messages are gone. Long-term memory is not affected by any of these.',
        )}
      </p>

      <div className="settings-section__title-row">
        <button
          type="button"
          className="ghost-button"
          onClick={onExportChatHistory}
          disabled={exportingChatHistory}
        >
          {exportingChatHistory
            ? t('导出中...', 'Exporting...')
            : t('导出聊天 JSON', 'Export chat JSON')}
        </button>

        <button
          type="button"
          className="ghost-button"
          onClick={onImportChatHistory}
          disabled={importingChatHistory || chatBusy}
        >
          {importingChatHistory
            ? t('导入中...', 'Importing...')
            : t('导入聊天 JSON', 'Import chat JSON')}
        </button>

        <button
          type="button"
          className="ghost-button"
          onClick={onClearChatHistory}
          disabled={clearingChatHistory || chatBusy || !chatMessageCount}
        >
          {clearingChatHistory
            ? t('清空中...', 'Clearing...')
            : t('清空当前聊天', 'Clear current chat')}
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
