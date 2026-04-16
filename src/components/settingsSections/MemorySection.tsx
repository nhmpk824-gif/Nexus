import { memo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { MemoryPanel } from '../../features/memory/components'
import { MEMORY_EMBEDDING_MODEL_OPTIONS, SCREEN_VLM_MODEL_OPTIONS } from '../../features/memory/constants'
import { pickTranslatedUiText } from '../../lib/uiLanguage'
import { parseNumberInput } from '../settingsDrawerSupport'
import type {
  AppSettings,
  DailyMemoryEntry,
  MemoryItem,
  MemorySearchMode,
  UiLanguage,
} from '../../types'

type MemorySearchModeOption = {
  value: MemorySearchMode
  label: string
  hint: string
}

type EmbeddingModelOption = {
  value: string
  hint?: string
}

type StatusMessage = {
  ok: boolean
  message: string
} | null

type MemorySectionProps = {
  active: boolean
  draft: AppSettings
  setDraft: Dispatch<SetStateAction<AppSettings>>
  memories: MemoryItem[]
  dailyMemoryEntries: DailyMemoryEntry[]
  uiLanguage: UiLanguage
  memorySearchModeOptions: MemorySearchModeOption[]
  selectedMemorySearchMode: MemorySearchModeOption
  selectedMemoryEmbeddingModel?: EmbeddingModelOption
  exportingMemoryArchive: boolean
  importingMemoryArchive: boolean
  clearingMemoryArchive: boolean
  chatBusy: boolean
  memoryArchiveStatus: StatusMessage
  onExportMemoryArchive: () => void
  onImportMemoryArchive: () => void
  onClearMemoryArchive: () => void
  onAddManualMemory: (content: string) => void
  onUpdateMemory: (id: string, content: string) => void
  onRemoveMemory: (id: string) => void
  onClearDailyMemory: () => void
  onUpdateDailyEntry?: (id: string, day: string, content: string) => void
  onRemoveDailyEntry?: (id: string, day: string) => void
}

export const MemorySection = memo(function MemorySection({
  active,
  draft,
  setDraft,
  memories,
  dailyMemoryEntries,
  uiLanguage,
  memorySearchModeOptions,
  selectedMemorySearchMode,
  selectedMemoryEmbeddingModel,
  exportingMemoryArchive,
  importingMemoryArchive,
  clearingMemoryArchive,
  chatBusy,
  memoryArchiveStatus,
  onExportMemoryArchive,
  onImportMemoryArchive,
  onClearMemoryArchive,
  onAddManualMemory,
  onUpdateMemory,
  onRemoveMemory,
  onClearDailyMemory,
  onUpdateDailyEntry,
  onRemoveDailyEntry,
}: MemorySectionProps) {
  const ti = (key: Parameters<typeof pickTranslatedUiText>[1]) => pickTranslatedUiText(uiLanguage, key)

  return (
    <section className={`settings-section ${active ? 'is-active' : 'is-hidden'}`}>
      <div className="settings-section__title-row">
        <div>
          <h4>{ti('settings.memory.context.title')}</h4>
          <p className="settings-drawer__hint">
            {ti('settings.memory.context.note')}
          </p>
        </div>
      </div>

      <label className="settings-toggle">
        <span>{ti('settings.memory.context.enable')}</span>
        <input
          type="checkbox"
          checked={draft.contextAwarenessEnabled}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              contextAwarenessEnabled: event.target.checked,
            }))
          }
        />
      </label>

      <label className="settings-toggle">
        <span>{ti('settings.memory.context.clipboard')}</span>
        <input
          type="checkbox"
          checked={draft.clipboardContextEnabled}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              clipboardContextEnabled: event.target.checked,
            }))
          }
          disabled={!draft.contextAwarenessEnabled}
        />
      </label>

      <label className="settings-toggle">
        <span>{ti('settings.memory.context.active_window')}</span>
        <input
          type="checkbox"
          checked={draft.activeWindowContextEnabled}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              activeWindowContextEnabled: event.target.checked,
            }))
          }
          disabled={!draft.contextAwarenessEnabled}
        />
      </label>

      <label className="settings-toggle">
        <span>{ti('settings.memory.context.screen_ocr')}</span>
        <input
          type="checkbox"
          checked={draft.screenContextEnabled}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              screenContextEnabled: event.target.checked,
            }))
          }
          disabled={!draft.contextAwarenessEnabled}
        />
      </label>

      {draft.contextAwarenessEnabled && draft.screenContextEnabled ? (
        <>
          <label>
            <span>{ti('settings.memory.context.ocr_language')}</span>
            <input
              value={draft.screenOcrLanguage}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  screenOcrLanguage: event.target.value,
                }))
              }
              placeholder="chi_sim+eng"
            />
          </label>

          <label className="settings-toggle">
            <span>{ti('settings.memory.context.vlm_enable')}</span>
            <input
              type="checkbox"
              checked={draft.screenVlmEnabled}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  screenVlmEnabled: event.target.checked,
                }))
              }
            />
          </label>

          <p className="settings-drawer__hint">
            {ti('settings.memory.context.vlm_note')}
          </p>

          {draft.screenVlmEnabled ? (
            <>
              <label>
                <span>{ti('settings.memory.context.vlm_base_url')}</span>
                <input
                  value={draft.screenVlmBaseUrl}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      screenVlmBaseUrl: event.target.value,
                    }))
                  }
                  placeholder="https://api.openai.com/v1"
                />
              </label>

              <label>
                <span>{ti('settings.memory.context.vlm_api_key')}</span>
                <input
                  type="password"
                  value={draft.screenVlmApiKey}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      screenVlmApiKey: event.target.value,
                    }))
                  }
                  placeholder={ti('settings.memory.context.vlm_api_key_placeholder')}
                />
              </label>

              <label>
                <span>{ti('settings.memory.context.vlm_model_preset')}</span>
                <select
                  value={SCREEN_VLM_MODEL_OPTIONS.some((option) => option.value === draft.screenVlmModel)
                    ? draft.screenVlmModel
                    : '__custom__'}
                  onChange={(event) => {
                    if (event.target.value === '__custom__') return
                    setDraft((prev) => ({
                      ...prev,
                      screenVlmModel: event.target.value,
                    }))
                  }}
                >
                  {SCREEN_VLM_MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  <option value="__custom__">{ti('settings.memory.custom_option')}</option>
                </select>
              </label>

              <p className="settings-drawer__hint">
                {SCREEN_VLM_MODEL_OPTIONS.find((option) => option.value === draft.screenVlmModel)?.hint
                  ?? ti('settings.memory.context.vlm_custom_hint')}
              </p>

              <label>
                <span>{ti('settings.memory.context.vlm_custom_model')}</span>
                <input
                  value={draft.screenVlmModel}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      screenVlmModel: event.target.value,
                    }))
                  }
                  placeholder="gpt-4o-mini"
                />
              </label>
            </>
          ) : null}
        </>
      ) : null}

      <div className="settings-section__title-row">
        <div>
          <h4>{ti('settings.memory.long_term.title')}</h4>
          <p className="settings-drawer__hint">
            {ti('settings.memory.long_term.note')}
          </p>
        </div>
      </div>

      <label>
        <span>{ti('settings.memory.long_term.search_mode')}</span>
        <select
          value={draft.memorySearchMode}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              memorySearchMode: event.target.value as MemorySearchMode,
            }))
          }
        >
          {memorySearchModeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <p className="settings-drawer__hint">
        {selectedMemorySearchMode.hint}
      </p>

      <label>
        <span>{ti('settings.memory.long_term.embedding_preset')}</span>
        <select
          value={selectedMemoryEmbeddingModel?.value ?? '__custom__'}
          onChange={(event) => {
            if (event.target.value === '__custom__') return

            setDraft((prev) => ({
              ...prev,
              memoryEmbeddingModel: event.target.value,
            }))
          }}
        >
          {MEMORY_EMBEDDING_MODEL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          <option value="__custom__">{ti('settings.memory.custom_option')}</option>
        </select>
      </label>

      <p className="settings-drawer__hint">
        {selectedMemoryEmbeddingModel?.hint ?? ti('settings.memory.long_term.embedding_custom_hint')}
      </p>

      <label>
        <span>{ti('settings.memory.long_term.embedding_custom_model')}</span>
        <input
          value={draft.memoryEmbeddingModel}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              memoryEmbeddingModel: event.target.value,
            }))
          }
        />
      </label>

      <div className="settings-grid">
        <label>
          <span>{ti('settings.memory.long_term.recall_long_term')}</span>
          <input
            type="number"
            min="1"
            max="8"
            step="1"
            value={draft.memoryLongTermRecallCount}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                memoryLongTermRecallCount: parseNumberInput(event.target.value, prev.memoryLongTermRecallCount),
              }))
            }
          />
        </label>

        <label>
          <span>{ti('settings.memory.long_term.recall_diary')}</span>
          <input
            type="number"
            min="1"
            max="8"
            step="1"
            value={draft.memoryDailyRecallCount}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                memoryDailyRecallCount: parseNumberInput(event.target.value, prev.memoryDailyRecallCount),
              }))
            }
          />
        </label>

        <label>
          <span>{ti('settings.memory.long_term.recall_semantic')}</span>
          <input
            type="number"
            min="1"
            max="8"
            step="1"
            value={draft.memorySemanticRecallCount}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                memorySemanticRecallCount: parseNumberInput(event.target.value, prev.memorySemanticRecallCount),
              }))
            }
          />
        </label>
      </div>

      <label>
        <span>{ti('settings.memory.long_term.diary_retention')}</span>
        <input
          type="number"
          min="1"
          max="30"
          step="1"
          value={draft.memoryDiaryRetentionDays}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              memoryDiaryRetentionDays: parseNumberInput(event.target.value, prev.memoryDiaryRetentionDays),
            }))
          }
        />
      </label>

      <p className="settings-drawer__hint">
        {ti('settings.memory.long_term.archive_note')}
      </p>

      <div className="settings-section__title-row">
        <button
          type="button"
          className="ghost-button"
          onClick={onExportMemoryArchive}
          disabled={exportingMemoryArchive}
        >
          {exportingMemoryArchive ? ti('settings.memory.long_term.exporting') : ti('settings.memory.long_term.export')}
        </button>

        <button
          type="button"
          className="ghost-button"
          onClick={onImportMemoryArchive}
          disabled={importingMemoryArchive || chatBusy}
        >
          {importingMemoryArchive ? ti('settings.memory.long_term.importing') : ti('settings.memory.long_term.import')}
        </button>

        <button
          type="button"
          className="ghost-button"
          onClick={onClearMemoryArchive}
          disabled={clearingMemoryArchive || chatBusy}
        >
          {clearingMemoryArchive ? ti('settings.memory.long_term.clearing') : ti('settings.memory.long_term.clear')}
        </button>
      </div>

      {memoryArchiveStatus ? (
        <div className={memoryArchiveStatus.ok ? 'settings-test-result is-success' : 'settings-test-result is-error'}>
          {memoryArchiveStatus.message}
        </div>
      ) : null}

      <MemoryPanel
        assistantName={draft.companionName}
        memories={memories}
        dailyEntries={dailyMemoryEntries}
        searchMode={draft.memorySearchMode}
        embeddingModel={draft.memoryEmbeddingModel}
        uiLanguage={uiLanguage}
        onAddMemory={onAddManualMemory}
        onUpdateMemory={onUpdateMemory}
        onRemove={onRemoveMemory}
        onClearDaily={onClearDailyMemory}
        onUpdateDailyEntry={onUpdateDailyEntry}
        onRemoveDailyEntry={onRemoveDailyEntry}
      />
    </section>
  )
})
